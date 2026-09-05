-- Give the landmine weighting a floor so late rounds still get landmines.
--
-- 20260905161454 weighted candidates linearly by rank. Squaring that weight
-- concentrates the draw much harder at the top — but too hard: measured over a
-- 150-player pool it left only ~4% of picks past rank 100, so a draft drawing 8
-- landmines expected 0.32 of them in the back third and usually got none. The
-- mechanic died after the middle rounds.
--
-- Use weight = rank_position^2 + 0.18 * N^2 instead. The square keeps the draw
-- top-heavy; the floor keeps deep players genuinely reachable.
--
-- Measured over a 150-pool drawing 8 (3000 trials):
--
--   curve            top 25   top 75   past 100   past 125
--   linear            30.1%    74.1%       0.93       0.23
--   square alone      41.5%    86.9%       0.32       0.10
--   square + floor    32.4%    73.1%       1.16       0.51
--
-- So the floor is not a compromise between the two: it is more top-heavy than
-- linear at the very top AND reaches deeper into the tail, trading away the
-- middle instead. Roughly one landmine per draft now lands past rank 100.
--
-- The floor scales with N rather than being a constant, so it behaves the same
-- for a 10x10 draft as a 12x16 one — verified consistent at pool sizes 100, 150
-- and 200 (~74% in the top half, ~1.15 deep picks each).
create or replace function public.assign_landmines(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft             public.drafts%rowtype;
  v_total_picks       integer;
  v_player_ids        uuid[];
  v_season_year       integer;
  v_enabled_positions text[];
  v_pool_size         integer;
begin
  select * into v_draft from public.drafts where id = p_draft_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if v_draft.commissioner_user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only the commissioner can assign landmines.';
  end if;

  if not v_draft.use_landmines or v_draft.landmine_count <= 0 then
    update public.drafts set landmine_player_ids = '{}' where id = p_draft_id;
    return;
  end if;

  -- Collect position IDs where enabled = true from the JSONB settings.
  -- If roster_positions is null/empty we get null here → no position filter applied below.
  if v_draft.roster_positions is not null then
    select array_agg(rp.value ->> 'id')
    into v_enabled_positions
    from jsonb_array_elements(v_draft.roster_positions) as rp(value)
    where (rp.value ->> 'enabled')::boolean = true;
  end if;

  v_total_picks := v_draft.team_count * v_draft.rounds;
  v_season_year := extract(year from now())::integer;

  -- Try ESPN rankings first, filtered to enabled positions. Rank order is kept
  -- so the weighting below can read each player's position in the pool.
  select array_agg(id order by ord) into v_player_ids
  from (
    select p.id, row_number() over (order by er.rank asc) as ord
    from public.players p
    inner join public.espn_rankings er
      on er.player_name ilike p.full_name
      and er.season_year = v_season_year
      and er.scoring_type = v_draft.scoring_type
    where p.active = true
      and (v_enabled_positions is null or p.position = any(v_enabled_positions))
    order by er.rank asc
    limit v_total_picks
  ) top_espn;

  -- Fall back to players.rank if ESPN had insufficient results
  if v_player_ids is null or array_length(v_player_ids, 1) < v_draft.landmine_count then
    select array_agg(id order by ord) into v_player_ids
    from (
      select p.id, row_number() over (order by p.rank asc) as ord
      from public.players p
      where p.active = true
        and p.rank is not null
        and (v_enabled_positions is null or p.position = any(v_enabled_positions))
      order by p.rank asc
      limit v_total_picks
    ) top_ranked;
  end if;

  if v_player_ids is null or array_length(v_player_ids, 1) = 0 then
    update public.drafts set landmine_player_ids = '{}' where id = p_draft_id;
    return;
  end if;

  v_pool_size := array_length(v_player_ids, 1);

  -- Rank-weighted pick from the pool. ordinality gives each player its position
  -- in the rank-ordered array, so the base weight counts down from N to 1;
  -- squaring concentrates the draw near the top of the board, and the floor
  -- keeps deep players reachable so landmines still fire in the late rounds.
  --
  -- power(random(), 1.0 / weight) is the Efraimidis-Spirakis key: higher weight
  -- pushes the key toward 1, so ordering by it descending and taking the first
  -- k draws k distinct players with probability proportional to weight.
  select array_agg(pid) into v_player_ids
  from (
    select t.pid
    from unnest(v_player_ids) with ordinality as t(pid, ord)
    order by power(
      random(),
      1.0 / (
        power((v_pool_size - t.ord + 1)::double precision, 2)
        + 0.18 * power(v_pool_size::double precision, 2)
      )
    ) desc
    limit v_draft.landmine_count
  ) weighted_pick;

  update public.drafts
  set landmine_player_ids = coalesce(v_player_ids, '{}')
  where id = p_draft_id;
end;
$$;

revoke all on function public.assign_landmines(uuid) from public, anon;
grant execute on function public.assign_landmines(uuid) to authenticated;
