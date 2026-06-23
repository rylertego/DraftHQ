-- Clock behavior settings on drafts
alter table public.drafts
  add column timer_behavior text not null default 'nothing'
    check (timer_behavior in ('nothing', 'skip', 'auto_draft')),
  add column clock_extension_seconds integer not null default 30
    check (clock_extension_seconds between 0 and 300),
  add column max_clock_extensions integer not null default 0
    check (max_clock_extensions between 0 and 5),
  add column clock_extensions_used integer not null default 0
    check (clock_extensions_used between 0 and 5);

-- Extend configure_draft_timer to accept clock behavior settings.
-- Old signature (pick_seconds only) is preserved via default args.
create or replace function public.configure_draft_timer(
  p_draft_id uuid,
  p_pick_seconds integer,
  p_timer_behavior text default null,
  p_clock_extension_seconds integer default null,
  p_max_clock_extensions integer default null
)
returns public.drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
begin
  select * into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if auth.uid() is null or v_draft.commissioner_user_id <> auth.uid() then
    raise exception using
      errcode = '42501',
      message = 'Only the commissioner can configure the timer.';
  end if;

  if v_draft.status not in ('setup', 'paused') then
    raise exception using
      errcode = 'P0001',
      message = 'Pause the draft before changing the timer.';
  end if;

  if p_pick_seconds is null or p_pick_seconds not between 15 and 600 then
    raise exception using
      errcode = '22023',
      message = 'Pick timer must be between 15 and 600 seconds.';
  end if;

  if p_timer_behavior is not null
    and p_timer_behavior not in ('nothing', 'skip', 'auto_draft')
  then
    raise exception using
      errcode = '22023',
      message = 'Timer behavior must be nothing, skip, or auto_draft.';
  end if;

  if p_clock_extension_seconds is not null
    and p_clock_extension_seconds not between 0 and 300
  then
    raise exception using
      errcode = '22023',
      message = 'Clock extension must be between 0 and 300 seconds.';
  end if;

  if p_max_clock_extensions is not null
    and p_max_clock_extensions not between 0 and 5
  then
    raise exception using
      errcode = '22023',
      message = 'Max clock extensions must be between 0 and 5.';
  end if;

  update public.drafts set
    pick_seconds               = p_pick_seconds,
    timer_behavior             = coalesce(p_timer_behavior, timer_behavior),
    clock_extension_seconds    = coalesce(p_clock_extension_seconds, clock_extension_seconds),
    max_clock_extensions       = coalesce(p_max_clock_extensions, max_clock_extensions),
    paused_remaining_seconds   = case
      when status = 'paused' then p_pick_seconds
      else null
    end
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

-- extend_clock: owner or commissioner extends the current pick deadline once.
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
  v_user_id   uuid := auth.uid();
  v_draft     public.drafts%rowtype;
  v_team      public.teams%rowtype;
  v_draft_position integer;
  v_round     integer;
  v_pick_number integer;
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

  if v_draft.clock_extensions_used >= v_draft.max_clock_extensions then
    raise exception using
      errcode = 'P0001',
      message = 'No clock extensions remaining for this pick.';
  end if;

  -- Verify caller is the team on the clock or the commissioner.
  v_round        := ((v_draft.current_pick - 1) / v_draft.team_count) + 1;
  v_pick_number  := ((v_draft.current_pick - 1) % v_draft.team_count) + 1;
  v_draft_position := case
    when v_round % 2 = 1 then v_pick_number
    else v_draft.team_count - v_pick_number + 1
  end;

  select * into v_team
  from public.teams
  where draft_id = p_draft_id and draft_position = v_draft_position;

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

  update public.drafts set
    pick_deadline_at      = pick_deadline_at + make_interval(secs => clock_extension_seconds),
    clock_extensions_used = clock_extensions_used + 1
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

-- expire_current_pick: triggered by commissioner client when timer hits zero.
-- Executes the configured timer_behavior.
create or replace function public.expire_current_pick(
  p_draft_id uuid,
  p_expected_pick integer
)
returns public.drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft           public.drafts%rowtype;
  v_team            public.teams%rowtype;
  v_participant     public.draft_participants%rowtype;
  v_player_id       uuid;
  v_pick            public.picks%rowtype;
  v_round           integer;
  v_pick_number     integer;
  v_draft_position  integer;
  v_total_picks     integer;
begin
  select * into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if auth.uid() is null or v_draft.commissioner_user_id <> auth.uid() then
    raise exception using
      errcode = '42501',
      message = 'Only the commissioner can expire a pick.';
  end if;

  if v_draft.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'The draft is not active.';
  end if;

  if v_draft.current_pick <> p_expected_pick then
    -- Pick already advanced (race condition) — return current state silently.
    return v_draft;
  end if;

  if v_draft.timer_behavior = 'nothing' then
    raise exception using
      errcode = 'P0001',
      message = 'Timer behavior is set to nothing — no action taken.';
  end if;

  -- Verify timer has actually expired.
  if v_draft.pick_deadline_at is not null and v_draft.pick_deadline_at > now() then
    raise exception using
      errcode = 'P0001',
      message = 'The pick timer has not expired yet.';
  end if;

  v_total_picks    := v_draft.team_count * v_draft.rounds;
  v_round          := ((v_draft.current_pick - 1) / v_draft.team_count) + 1;
  v_pick_number    := ((v_draft.current_pick - 1) % v_draft.team_count) + 1;
  v_draft_position := case
    when v_round % 2 = 1 then v_pick_number
    else v_draft.team_count - v_pick_number + 1
  end;

  select * into v_team
  from public.teams
  where draft_id = p_draft_id and draft_position = v_draft_position;

  -- Find the commissioner participant (used as actor for auto picks).
  select * into v_participant
  from public.draft_participants
  where draft_id = p_draft_id
    and user_id = v_draft.commissioner_user_id;

  if v_draft.timer_behavior = 'auto_draft' then
    -- Pick the first available active player (alphabetical — commissioner can undo).
    select p.id into v_player_id
    from public.players p
    where p.active = true
      and not exists (
        select 1 from public.picks pk
        where pk.draft_id = p_draft_id and pk.player_id = p.id
      )
    order by p.full_name
    limit 1;

    if v_player_id is null then
      raise exception using errcode = 'P0002', message = 'No available players to auto-draft.';
    end if;

    insert into public.picks (
      draft_id, team_id, player_id, participant_id,
      round, pick_number, overall_pick_number
    ) values (
      p_draft_id, v_team.id, v_player_id, v_participant.id,
      v_round, v_pick_number, v_draft.current_pick
    ) returning * into v_pick;
  end if;

  -- Advance the draft (both 'skip' and 'auto_draft' move to next pick).
  update public.drafts set
    current_pick          = v_draft.current_pick + 1,
    status                = case
      when v_draft.current_pick = v_total_picks then 'complete'
      else 'active'
    end,
    pick_deadline_at      = case
      when v_draft.current_pick = v_total_picks then null
      else now() + make_interval(secs => pick_seconds)
    end,
    clock_extensions_used = 0,
    paused_remaining_seconds = null
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

-- Reset clock_extensions_used when a pick is made (hook into make_pick advances).
-- We do this by updating the existing make_pick function to reset the counter.
create or replace function public.make_pick(
  p_draft_id uuid,
  p_player_id uuid,
  p_expected_pick integer default null
)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id         uuid := auth.uid();
  v_draft           public.drafts%rowtype;
  v_team            public.teams%rowtype;
  v_participant     public.draft_participants%rowtype;
  v_pick            public.picks%rowtype;
  v_round           integer;
  v_pick_number     integer;
  v_draft_position  integer;
  v_total_picks     integer;
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

  if v_draft.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = case v_draft.status
        when 'setup'    then 'The draft has not started.'
        when 'paused'   then 'The draft is paused.'
        else                 'The draft is complete.'
      end;
  end if;

  if p_expected_pick is not null and v_draft.current_pick <> p_expected_pick then
    raise exception using
      errcode = 'P0001',
      message = 'The pick order changed while you were selecting. Please try again.';
  end if;

  v_total_picks    := v_draft.team_count * v_draft.rounds;

  if v_draft.current_pick > v_total_picks then
    raise exception using errcode = 'P0001', message = 'The draft has no remaining picks.';
  end if;

  v_round          := ((v_draft.current_pick - 1) / v_draft.team_count) + 1;
  v_pick_number    := ((v_draft.current_pick - 1) % v_draft.team_count) + 1;
  v_draft_position := case
    when v_round % 2 = 1 then v_pick_number
    else v_draft.team_count - v_pick_number + 1
  end;

  select * into v_team
  from public.teams
  where draft_id = p_draft_id and draft_position = v_draft_position;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The team on the clock could not be found.';
  end if;

  select * into v_participant
  from public.draft_participants
  where draft_id = p_draft_id
    and user_id = v_user_id
    and team_id = v_team.id
    and role in ('commissioner', 'owner');

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Only the team currently on the clock can make this pick.';
  end if;

  if not exists (select 1 from public.players where id = p_player_id and active) then
    raise exception using errcode = 'P0002', message = 'Active player not found.';
  end if;

  if exists (select 1 from public.picks where draft_id = p_draft_id and player_id = p_player_id) then
    raise exception using errcode = '23505', message = 'That player has already been drafted.';
  end if;

  insert into public.picks (
    draft_id, team_id, player_id, participant_id,
    round, pick_number, overall_pick_number
  ) values (
    p_draft_id, v_team.id, p_player_id, v_participant.id,
    v_round, v_pick_number, v_draft.current_pick
  ) returning * into v_pick;

  update public.drafts set
    current_pick          = v_draft.current_pick + 1,
    status                = case
      when v_draft.current_pick = v_total_picks then 'complete'
      else 'active'
    end,
    pick_deadline_at      = case
      when v_draft.current_pick = v_total_picks then null
      else now() + make_interval(secs => pick_seconds)
    end,
    clock_extensions_used = 0,
    paused_remaining_seconds = null
  where id = p_draft_id;

  return v_pick;
end;
$$;

revoke all on function public.extend_clock(uuid, integer) from public, anon;
revoke all on function public.expire_current_pick(uuid, integer) from public, anon;

grant execute on function public.extend_clock(uuid, integer) to authenticated;
grant execute on function public.expire_current_pick(uuid, integer) to authenticated;
