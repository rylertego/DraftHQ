-- Filter landmine player pool to only positions enabled in roster_positions settings.
-- Uses roster_positions[].id which matches players.position values directly.
-- Virtual slots (FLEX, BN, IR, SF, etc.) don't match any player position, so they're harmless.
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

  -- Try ESPN rankings first, filtered to enabled positions
  select array_agg(id) into v_player_ids
  from (
    select p.id
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
    select array_agg(id) into v_player_ids
    from (
      select p.id
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

  -- Randomly pick landmine_count from the filtered pool
  select array_agg(pid) into v_player_ids
  from (
    select pid
    from unnest(v_player_ids) as t(pid)
    order by random()
    limit v_draft.landmine_count
  ) rand_pick;

  update public.drafts
  set landmine_player_ids = coalesce(v_player_ids, '{}')
  where id = p_draft_id;
end;
$$;

revoke all on function public.assign_landmines(uuid) from public, anon;
grant execute on function public.assign_landmines(uuid) to authenticated;
