-- Weight landmine selection toward the top of the pool.
--
-- The pool is the top `team_count * rounds` players (150 in a 10-team, 15-round
-- draft), and selection was `order by random()` — uniform, so on average half
-- the landmines landed in the back half of the pool, on players nobody would
-- draft early enough for the landmine to matter.
--
-- Weight each candidate linearly by its rank position instead: the top player
-- carries weight N, the last carries 1. Sampling is Efraimidis-Spirakis
-- weighted sampling without replacement — key = random()^(1/weight), take the
-- largest keys — which is the standard way to draw k distinct items with
-- probability proportional to weight in one pass.
--
-- For a 150-player pool that puts ~75% of landmines in the top 75 while
-- leaving every player reachable, rather than truncating the pool outright.
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

  -- Rank-weighted pick from the pool. ordinality gives each player its position
  -- in the rank-ordered array, so weight counts down from N to 1.
  --
  -- power(random(), 1.0 / weight) is the Efraimidis-Spirakis key: higher weight
  -- pushes the key toward 1, so ordering by it descending and taking the first
  -- k draws k distinct players with probability proportional to weight.
  select array_agg(pid) into v_player_ids
  from (
    select t.pid
    from unnest(v_player_ids) with ordinality as t(pid, ord)
    order by power(random(), 1.0 / (array_length(v_player_ids, 1) - t.ord + 1)::double precision) desc
    limit v_draft.landmine_count
  ) weighted_pick;

  update public.drafts
  set landmine_player_ids = coalesce(v_player_ids, '{}')
  where id = p_draft_id;
end;
$$;

revoke all on function public.assign_landmines(uuid) from public, anon;
grant execute on function public.assign_landmines(uuid) to authenticated;
