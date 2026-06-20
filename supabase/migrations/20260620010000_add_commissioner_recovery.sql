create or replace function public.assign_team(
  p_draft_id uuid,
  p_participant_id uuid,
  p_team_id uuid
)
returns public.draft_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
  v_participant public.draft_participants%rowtype;
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
      message = 'Only the commissioner can assign teams.';
  end if;

  if v_draft.status not in ('setup', 'paused') then
    raise exception using
      errcode = 'P0001',
      message = 'Pause the draft before changing team assignments.';
  end if;

  select * into v_participant
  from public.draft_participants
  where id = p_participant_id
    and draft_id = p_draft_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Participant not found in this draft.';
  end if;

  if p_team_id is not null and not exists (
    select 1 from public.teams
    where id = p_team_id and draft_id = p_draft_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Team not found in this draft.';
  end if;

  if p_team_id is not null and exists (
    select 1 from public.draft_participants
    where draft_id = p_draft_id
      and team_id = p_team_id
      and id <> p_participant_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'That team is already assigned.';
  end if;

  update public.draft_participants
  set team_id = p_team_id
  where id = p_participant_id
  returning * into v_participant;

  return v_participant;
end;
$$;

create or replace function public.remove_draft_participant(
  p_draft_id uuid,
  p_participant_id uuid
)
returns public.draft_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
  v_participant public.draft_participants%rowtype;
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
      message = 'Only the commissioner can remove owners.';
  end if;

  if v_draft.status not in ('setup', 'paused') then
    raise exception using
      errcode = 'P0001',
      message = 'Pause the draft before removing an owner.';
  end if;

  select * into v_participant
  from public.draft_participants
  where id = p_participant_id
    and draft_id = p_draft_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Participant not found in this draft.';
  end if;

  if v_participant.role = 'commissioner' then
    raise exception using
      errcode = '42501',
      message = 'The commissioner cannot be removed from the draft.';
  end if;

  delete from public.draft_participants
  where id = p_participant_id;

  return v_participant;
end;
$$;

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

create or replace function public.make_pick(
  p_draft_id uuid,
  p_player_id uuid
)
returns public.picks
language sql
security definer
set search_path = ''
as $$
  select public.record_draft_pick(p_draft_id, p_player_id, false);
$$;

create or replace function public.commissioner_make_pick(
  p_draft_id uuid,
  p_player_id uuid
)
returns public.picks
language sql
security definer
set search_path = ''
as $$
  select public.record_draft_pick(p_draft_id, p_player_id, true);
$$;

revoke all on function public.remove_draft_participant(uuid, uuid)
  from public, anon;
revoke all on function public.record_draft_pick(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.commissioner_make_pick(uuid, uuid)
  from public, anon;
revoke all on function public.make_pick(uuid, uuid)
  from public, anon;

grant execute on function public.remove_draft_participant(uuid, uuid)
  to authenticated;
grant execute on function public.commissioner_make_pick(uuid, uuid)
  to authenticated;
grant execute on function public.make_pick(uuid, uuid)
  to authenticated;
