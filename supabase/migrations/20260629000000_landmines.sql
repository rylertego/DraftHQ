-- ── Landmine feature ──────────────────────────────────────────────────────────

-- Secret list of landmine player IDs stored on the draft (never exposed via RLS to non-commissioners)
alter table public.drafts
  add column if not exists landmine_player_ids uuid[] not null default '{}';

-- Flag stamped on a pick row the moment a landmine player is drafted
-- (this is what clients watch via realtime — revealed only when it happens)
alter table public.picks
  add column if not exists is_landmine boolean not null default false;

-- ── assign_landmines ──────────────────────────────────────────────────────────
-- Randomly selects landmine_count players from the top (team_count × rounds)
-- players ranked by ESPN rankings for the draft's scoring type (falls back to
-- the global players.rank column if ESPN rankings are not loaded).
create or replace function public.assign_landmines(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft        public.drafts%rowtype;
  v_total_picks  integer;
  v_player_ids   uuid[];
  v_season_year  integer;
begin
  select * into v_draft from public.drafts where id = p_draft_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  -- Only the commissioner may call this
  if v_draft.commissioner_user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only the commissioner can assign landmines.';
  end if;

  if not v_draft.use_landmines or v_draft.landmine_count <= 0 then
    -- Clear any existing landmines
    update public.drafts set landmine_player_ids = '{}' where id = p_draft_id;
    return;
  end if;

  v_total_picks := v_draft.team_count * v_draft.rounds;
  v_season_year := extract(year from now())::integer;

  -- Try ESPN rankings first (matches current scoring type), fall back to global rank
  select array_agg(id) into v_player_ids
  from (
    select p.id
    from public.players p
    inner join public.espn_rankings er
      on er.player_name ilike p.full_name
      and er.season_year = v_season_year
      and er.scoring_type = v_draft.scoring_type
    where p.active = true
    order by er.rank asc
    limit v_total_picks
  ) top_espn;

  -- Fall back to players.rank if ESPN had no results
  if v_player_ids is null or array_length(v_player_ids, 1) < v_draft.landmine_count then
    select array_agg(id) into v_player_ids
    from (
      select p.id
      from public.players p
      where p.active = true
        and p.rank is not null
      order by p.rank asc
      limit v_total_picks
    ) top_ranked;
  end if;

  if v_player_ids is null or array_length(v_player_ids, 1) = 0 then
    update public.drafts set landmine_player_ids = '{}' where id = p_draft_id;
    return;
  end if;

  -- Randomly pick landmine_count from the pool
  select array_agg(id order by random()) into v_player_ids
  from (
    select unnest(v_player_ids) as id
    order by random()
    limit v_draft.landmine_count
  ) selected;

  update public.drafts
    set landmine_player_ids = coalesce(v_player_ids, '{}')
    where id = p_draft_id;
end;
$$;

revoke all on function public.assign_landmines(uuid) from public, anon;
grant execute on function public.assign_landmines(uuid) to authenticated;

-- ── reveal_landmines ──────────────────────────────────────────────────────────
-- Commissioner-only: returns name + position of remaining (unpicked) landmine players
create or replace function public.reveal_landmines(p_draft_id uuid)
returns table (player_id uuid, full_name text, "position" text, nfl_team text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
begin
  select * into v_draft from public.drafts where id = p_draft_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if v_draft.commissioner_user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only the commissioner can reveal landmines.';
  end if;

  return query
    select p.id, p.full_name, p.position::text, p.nfl_team
    from public.players p
    where p.id = any(v_draft.landmine_player_ids)
      -- exclude already-picked landmines (already revealed publicly)
      and not exists (
        select 1 from public.picks pk
        where pk.draft_id = p_draft_id
          and pk.player_id = p.id
      )
    order by p.full_name;
end;
$$;

revoke all on function public.reveal_landmines(uuid) from public, anon;
grant execute on function public.reveal_landmines(uuid) to authenticated;

-- ── make_pick: stamp is_landmine ─────────────────────────────────────────────
create or replace function public.make_pick(
  p_draft_id uuid,
  p_player_id uuid
)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id       uuid := auth.uid();
  v_draft         public.drafts%rowtype;
  v_team          public.teams%rowtype;
  v_participant   public.draft_participants%rowtype;
  v_pick          public.picks%rowtype;
  v_round         integer;
  v_pick_number   integer;
  v_draft_position integer;
  v_total_picks   integer;
  v_is_landmine   boolean;
begin
  select * into v_draft from public.drafts where id = p_draft_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  if v_draft.status = 'paused' then
    raise exception using errcode = 'P0001', message = 'The draft is paused.';
  end if;

  if v_draft.status = 'complete' then
    raise exception using errcode = 'P0001', message = 'The draft is complete.';
  end if;

  v_total_picks := v_draft.team_count * v_draft.rounds;

  if v_draft.current_pick > v_total_picks then
    raise exception using errcode = 'P0001', message = 'The draft has no remaining picks.';
  end if;

  v_round := ((v_draft.current_pick - 1) / v_draft.team_count) + 1;
  v_pick_number := ((v_draft.current_pick - 1) % v_draft.team_count) + 1;
  v_draft_position := case
    when v_round % 2 = 1 then v_pick_number
    else v_draft.team_count - v_pick_number + 1
  end;

  select * into v_team
  from public.teams
  where draft_id = p_draft_id and draft_position = v_draft_position;

  if not found then
    raise exception using errcode = 'P0002', message = 'The team on the clock could not be found.';
  end if;

  select * into v_participant
  from public.draft_participants
  where draft_id = p_draft_id
    and user_id = v_user_id
    and team_id = v_team.id
    and role in ('commissioner', 'owner');

  if not found then
    raise exception using errcode = '42501', message = 'Only the team currently on the clock can make this pick.';
  end if;

  if not exists (select 1 from public.players where id = p_player_id and active) then
    raise exception using errcode = 'P0002', message = 'Active player not found.';
  end if;

  if exists (select 1 from public.picks where draft_id = p_draft_id and player_id = p_player_id) then
    raise exception using errcode = '23505', message = 'That player has already been drafted.';
  end if;

  -- Check if this player is a landmine
  v_is_landmine := v_draft.use_landmines
    and array_length(v_draft.landmine_player_ids, 1) > 0
    and p_player_id = any(v_draft.landmine_player_ids);

  insert into public.picks (
    draft_id, team_id, player_id, participant_id,
    round, pick_number, overall_pick_number, is_landmine
  )
  values (
    p_draft_id, v_team.id, p_player_id, v_participant.id,
    v_round, v_pick_number, v_draft.current_pick, v_is_landmine
  )
  returning * into v_pick;

  update public.drafts
  set
    current_pick = v_draft.current_pick + 1,
    status = case
      when v_draft.current_pick = v_total_picks then 'complete'
      else 'active'
    end
  where id = p_draft_id;

  return v_pick;
end;
$$;
