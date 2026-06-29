-- Per-team clock extension tracking
-- Each team has its own clock_extensions_used counter, reset when they make a pick.

alter table public.teams
  add column if not exists clock_extensions_used integer not null default 0
    check (clock_extensions_used >= 0);

-- ── extend_clock: check + increment per-team counter ─────────────────────────

create or replace function public.extend_clock(
  p_draft_id uuid,
  p_expected_pick integer
)
returns public.drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id        uuid := auth.uid();
  v_draft          public.drafts%rowtype;
  v_team           public.teams%rowtype;
  v_draft_position integer;
  v_round          integer;
  v_pick_number    integer;
begin
  select * into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if v_draft.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'The draft is not active.';
  end if;

  if v_draft.current_pick <> p_expected_pick then
    raise exception using errcode = 'P0001', message = 'The pick has already advanced.';
  end if;

  if v_draft.max_clock_extensions = 0 then
    raise exception using errcode = 'P0001', message = 'Clock extensions are not enabled.';
  end if;

  -- Determine which team is on the clock
  v_round          := ((v_draft.current_pick - 1) / v_draft.team_count) + 1;
  v_pick_number    := ((v_draft.current_pick - 1) % v_draft.team_count) + 1;
  v_draft_position := case
    when v_round % 2 = 1 then v_pick_number
    else v_draft.team_count - v_pick_number + 1
  end;

  select * into v_team
  from public.teams
  where draft_id = p_draft_id and draft_position = v_draft_position;

  -- Check per-team limit (not draft-level)
  if v_team.clock_extensions_used >= v_draft.max_clock_extensions then
    raise exception using
      errcode = 'P0001',
      message = 'No clock extensions remaining for this pick.';
  end if;

  -- Verify caller is the team on the clock or the commissioner
  if v_draft.commissioner_user_id <> v_user_id then
    if not exists (
      select 1 from public.draft_participants
      where draft_id = p_draft_id
        and user_id = v_user_id
        and team_id = v_team.id
        and role = 'owner'
    ) then
      raise exception using
        errcode = '42501',
        message = 'Only the team on the clock or the commissioner can extend.';
    end if;
  end if;

  -- Increment per-team counter
  update public.teams
  set clock_extensions_used = clock_extensions_used + 1
  where id = v_team.id;

  -- Extend the deadline
  update public.drafts
  set pick_deadline_at = pick_deadline_at + make_interval(secs => clock_extension_seconds)
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

-- ── record_draft_pick: reset the picking team's counter after their turn ──────
-- Both make_pick and commissioner_make_pick delegate here, so one patch covers all.

create or replace function public.record_draft_pick(
  p_draft_id uuid,
  p_player_id uuid,
  p_commissioner_override boolean
)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.drafts%rowtype;
  v_team public.teams%rowtype;
  v_participant public.draft_participants%rowtype;
  v_pick public.picks%rowtype;
  v_round integer;
  v_pick_number integer;
  v_draft_position integer;
  v_total_picks integer;
begin
  select * into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  if p_commissioner_override
    and v_draft.commissioner_user_id <> v_user_id
  then
    raise exception using
      errcode = '42501',
      message = 'Only the commissioner can make a recovery pick.';
  end if;

  if v_draft.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = case v_draft.status
        when 'setup' then 'The draft has not started.'
        when 'paused' then 'The draft is paused.'
        else 'The draft is complete.'
      end;
  end if;

  v_total_picks := v_draft.team_count * v_draft.rounds;

  if v_draft.current_pick > v_total_picks then
    raise exception using
      errcode = 'P0001',
      message = 'The draft has no remaining picks.';
  end if;

  v_round := ((v_draft.current_pick - 1) / v_draft.team_count) + 1;
  v_pick_number := ((v_draft.current_pick - 1) % v_draft.team_count) + 1;
  v_draft_position := case
    when v_round % 2 = 1 then v_pick_number
    else v_draft.team_count - v_pick_number + 1
  end;

  select * into v_team
  from public.teams
  where draft_id = p_draft_id
    and draft_position = v_draft_position;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The team on the clock could not be found.';
  end if;

  if p_commissioner_override then
    select * into v_participant
    from public.draft_participants
    where draft_id = p_draft_id
      and user_id = v_user_id
      and role = 'commissioner';
  else
    select * into v_participant
    from public.draft_participants
    where draft_id = p_draft_id
      and user_id = v_user_id
      and team_id = v_team.id
      and role in ('commissioner', 'owner');
  end if;

  if not found then
    raise exception using
      errcode = '42501',
      message = case
        when p_commissioner_override
          then 'Commissioner participant not found.'
        else 'Only the team currently on the clock can make this pick.'
      end;
  end if;

  if not exists (
    select 1 from public.players where id = p_player_id and active
  ) then
    raise exception using errcode = 'P0002', message = 'Active player not found.';
  end if;

  if exists (
    select 1 from public.picks
    where draft_id = p_draft_id and player_id = p_player_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'That player has already been drafted.';
  end if;

  insert into public.picks (
    draft_id,
    team_id,
    player_id,
    participant_id,
    round,
    pick_number,
    overall_pick_number
  ) values (
    p_draft_id,
    v_team.id,
    p_player_id,
    v_participant.id,
    v_round,
    v_pick_number,
    v_draft.current_pick
  ) returning * into v_pick;

  -- Reset this team's per-turn clock extension counter
  update public.teams
  set clock_extensions_used = 0
  where id = v_team.id;

  update public.drafts
  set
    current_pick = v_draft.current_pick + 1,
    status = case
      when v_draft.current_pick = v_total_picks then 'complete'
      else 'active'
    end,
    pick_deadline_at = case
      when v_draft.current_pick = v_total_picks then null
      else now() + make_interval(secs => pick_seconds)
    end,
    paused_remaining_seconds = null
  where id = p_draft_id;

  return v_pick;
end;
$$;

-- ── reset_draft: clear all team extension counters too ───────────────────────
drop function if exists public.reset_draft(uuid);

create or replace function public.reset_draft(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_draft   public.drafts;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = 'PGRST301';
  end if;

  select * into v_draft from public.drafts where id = p_draft_id;

  if not found then
    raise exception 'Draft not found.' using errcode = 'P0002';
  end if;

  if v_draft.commissioner_user_id != v_user_id then
    if not exists (
      select 1 from public.draft_participants
      where draft_id = p_draft_id and user_id = v_user_id and role = 'commissioner'
    ) then
      raise exception 'Only the draft commissioner can reset the draft.' using errcode = '42501';
    end if;
  end if;

  delete from public.picks where draft_id = p_draft_id;

  update public.drafts set
    status                   = 'setup',
    current_pick             = 1,
    pick_deadline_at         = null,
    paused_remaining_seconds = null,
    clock_extensions_used    = 0
  where id = p_draft_id
  returning * into v_draft;

  -- Reset all teams' extension counters
  update public.teams
  set clock_extensions_used = 0
  where draft_id = p_draft_id;

  return jsonb_build_object(
    'id',               v_draft.id,
    'status',           v_draft.status,
    'current_pick',     v_draft.current_pick,
    'pick_deadline_at', v_draft.pick_deadline_at
  );
end;
$$;
