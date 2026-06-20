alter table public.drafts
add column pick_seconds integer not null default 90 check (
  pick_seconds between 15 and 600
),
add column pick_deadline_at timestamptz,
add column paused_remaining_seconds integer check (
  paused_remaining_seconds between 0 and 600
);

update public.drafts
set pick_deadline_at = now() + make_interval(secs => pick_seconds)
where status = 'active';

update public.drafts
set paused_remaining_seconds = pick_seconds
where status = 'paused';

create or replace function public.configure_draft_timer(
  p_draft_id uuid,
  p_pick_seconds integer
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

  update public.drafts
  set
    pick_seconds = p_pick_seconds,
    paused_remaining_seconds = case
      when status = 'paused' then p_pick_seconds
      else null
    end
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

create or replace function public.start_draft(p_draft_id uuid)
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
      message = 'Only the commissioner can start the draft.';
  end if;

  if v_draft.status <> 'setup' then
    raise exception using
      errcode = 'P0001',
      message = 'Only a draft in setup can be started.';
  end if;

  if (
    select count(*)
    from public.draft_participants
    where draft_id = p_draft_id
      and team_id is not null
      and role in ('commissioner', 'owner')
  ) <> v_draft.team_count then
    raise exception using
      errcode = 'P0001',
      message = 'Every team must have an owner before the draft starts.';
  end if;

  update public.drafts
  set
    status = 'active',
    pick_deadline_at = now() + make_interval(secs => pick_seconds),
    paused_remaining_seconds = null
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

create or replace function public.pause_draft(p_draft_id uuid)
returns public.drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
  v_remaining integer;
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
      message = 'Only the commissioner can pause the draft.';
  end if;

  if v_draft.status <> 'active' or v_draft.pick_deadline_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'Only an active draft can be paused.';
  end if;

  v_remaining := least(
    v_draft.pick_seconds,
    greatest(
      0,
      ceil(extract(epoch from (v_draft.pick_deadline_at - now())))::integer
    )
  );

  update public.drafts
  set
    status = 'paused',
    pick_deadline_at = null,
    paused_remaining_seconds = v_remaining
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

create or replace function public.resume_draft(p_draft_id uuid)
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
      message = 'Only the commissioner can resume the draft.';
  end if;

  if v_draft.status <> 'paused' then
    raise exception using
      errcode = 'P0001',
      message = 'Only a paused draft can be resumed.';
  end if;

  update public.drafts
  set
    status = 'active',
    pick_deadline_at = now() + make_interval(
      secs => coalesce(paused_remaining_seconds, pick_seconds)
    ),
    paused_remaining_seconds = null
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

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
  where draft_id = p_draft_id
    and draft_position = v_draft_position;

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

  if not exists (
    select 1 from public.players where id = p_player_id and active
  ) then
    raise exception using errcode = 'P0002', message = 'Active player not found.';
  end if;

  if exists (
    select 1 from public.picks
    where draft_id = p_draft_id and player_id = p_player_id
  ) then
    raise exception using errcode = '23505', message = 'That player has already been drafted.';
  end if;

  insert into public.picks (
    draft_id, team_id, player_id, participant_id,
    round, pick_number, overall_pick_number
  ) values (
    p_draft_id, v_team.id, p_player_id, v_participant.id,
    v_round, v_pick_number, v_draft.current_pick
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

create or replace function public.undo_pick(p_draft_id uuid)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
  v_pick public.picks%rowtype;
begin
  select * into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if auth.uid() is null or v_draft.commissioner_user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only the commissioner can undo picks.';
  end if;

  select * into v_pick
  from public.picks
  where draft_id = p_draft_id
  order by overall_pick_number desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0002', message = 'There are no picks to undo.';
  end if;

  if v_pick.overall_pick_number <> v_draft.current_pick - 1 then
    raise exception using errcode = 'P0001', message = 'Draft pick state is inconsistent.';
  end if;

  delete from public.picks where id = v_pick.id;

  update public.drafts
  set
    current_pick = v_pick.overall_pick_number,
    status = case when v_draft.status = 'complete' then 'active' else v_draft.status end,
    pick_deadline_at = case
      when v_draft.status in ('active', 'complete')
        then now() + make_interval(secs => pick_seconds)
      else null
    end,
    paused_remaining_seconds = case
      when v_draft.status = 'paused' then pick_seconds
      else null
    end
  where id = p_draft_id;

  return v_pick;
end;
$$;

revoke all on function public.configure_draft_timer(uuid, integer) from public, anon;
revoke all on function public.start_draft(uuid) from public, anon;
revoke all on function public.pause_draft(uuid) from public, anon;
revoke all on function public.resume_draft(uuid) from public, anon;

grant execute on function public.configure_draft_timer(uuid, integer) to authenticated;
grant execute on function public.start_draft(uuid) to authenticated;
grant execute on function public.pause_draft(uuid) to authenticated;
grant execute on function public.resume_draft(uuid) to authenticated;
