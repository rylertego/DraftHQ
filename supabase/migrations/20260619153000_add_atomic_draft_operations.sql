create or replace function public.create_draft(
  p_name text,
  p_team_count integer,
  p_rounds integer,
  p_display_name text
)
returns public.drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.drafts%rowtype;
  v_join_code text;
  v_attempts integer := 0;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication is required.';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'Draft name must be between 1 and 100 characters.';
  end if;

  if p_team_count is null or p_team_count not between 2 and 20 then
    raise exception using
      errcode = '22023',
      message = 'Team count must be between 2 and 20.';
  end if;

  if p_rounds is null or p_rounds not between 1 and 30 then
    raise exception using
      errcode = '22023',
      message = 'Rounds must be between 1 and 30.';
  end if;

  if p_display_name is null
    or char_length(trim(p_display_name)) not between 1 and 50
  then
    raise exception using
      errcode = '22023',
      message = 'Display name must be between 1 and 50 characters.';
  end if;

  loop
    v_join_code := upper(
      substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8)
    );

    begin
      insert into public.drafts (
        name,
        join_code,
        commissioner_user_id,
        team_count,
        rounds
      )
      values (
        trim(p_name),
        v_join_code,
        v_user_id,
        p_team_count,
        p_rounds
      )
      returning * into v_draft;

      exit;
    exception
      when unique_violation then
        v_attempts := v_attempts + 1;

        if v_attempts >= 5 then
          raise exception using
            errcode = 'P0001',
            message = 'Unable to generate a unique join code.';
        end if;
    end;
  end loop;

  insert into public.teams (draft_id, name, draft_position)
  select
    v_draft.id,
    'Team ' || team_position,
    team_position
  from generate_series(1, p_team_count) as positions(team_position);

  insert into public.draft_participants (
    draft_id,
    user_id,
    display_name,
    role
  )
  values (
    v_draft.id,
    v_user_id,
    trim(p_display_name),
    'commissioner'
  );

  return v_draft;
end;
$$;

create or replace function public.join_draft(
  p_join_code text,
  p_display_name text
)
returns public.draft_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.drafts%rowtype;
  v_participant public.draft_participants%rowtype;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication is required.';
  end if;

  if p_join_code is null or char_length(trim(p_join_code)) not between 6 and 12 then
    raise exception using
      errcode = '22023',
      message = 'A valid join code is required.';
  end if;

  if p_display_name is null
    or char_length(trim(p_display_name)) not between 1 and 50
  then
    raise exception using
      errcode = '22023',
      message = 'Display name must be between 1 and 50 characters.';
  end if;

  select *
  into v_draft
  from public.drafts
  where join_code = upper(trim(p_join_code))
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Draft not found.';
  end if;

  if v_draft.status = 'complete' then
    raise exception using
      errcode = 'P0001',
      message = 'This draft is complete.';
  end if;

  insert into public.draft_participants (
    draft_id,
    user_id,
    display_name,
    role
  )
  values (
    v_draft.id,
    v_user_id,
    trim(p_display_name),
    'owner'
  )
  on conflict (draft_id, user_id)
  do update set display_name = excluded.display_name
  returning * into v_participant;

  return v_participant;
end;
$$;

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
  v_user_id uuid := auth.uid();
  v_draft public.drafts%rowtype;
  v_participant public.draft_participants%rowtype;
begin
  select *
  into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Draft not found.';
  end if;

  if v_user_id is null or v_draft.commissioner_user_id <> v_user_id then
    raise exception using
      errcode = '42501',
      message = 'Only the commissioner can assign teams.';
  end if;

  if v_draft.status = 'complete' then
    raise exception using
      errcode = 'P0001',
      message = 'Team assignments cannot change after draft completion.';
  end if;

  select *
  into v_participant
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
    select 1
    from public.teams
    where id = p_team_id
      and draft_id = p_draft_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Team not found in this draft.';
  end if;

  if p_team_id is not null and exists (
    select 1
    from public.draft_participants
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
  select *
  into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Draft not found.';
  end if;

  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication is required.';
  end if;

  if v_draft.status = 'paused' then
    raise exception using
      errcode = 'P0001',
      message = 'The draft is paused.';
  end if;

  if v_draft.status = 'complete' then
    raise exception using
      errcode = 'P0001',
      message = 'The draft is complete.';
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

  select *
  into v_team
  from public.teams
  where draft_id = p_draft_id
    and draft_position = v_draft_position;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The team on the clock could not be found.';
  end if;

  select *
  into v_participant
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
    select 1
    from public.players
    where id = p_player_id
      and active
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Active player not found.';
  end if;

  if exists (
    select 1
    from public.picks
    where draft_id = p_draft_id
      and player_id = p_player_id
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
  )
  values (
    p_draft_id,
    v_team.id,
    p_player_id,
    v_participant.id,
    v_round,
    v_pick_number,
    v_draft.current_pick
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

create or replace function public.undo_pick(p_draft_id uuid)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.drafts%rowtype;
  v_pick public.picks%rowtype;
begin
  select *
  into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Draft not found.';
  end if;

  if v_user_id is null or v_draft.commissioner_user_id <> v_user_id then
    raise exception using
      errcode = '42501',
      message = 'Only the commissioner can undo picks.';
  end if;

  select *
  into v_pick
  from public.picks
  where draft_id = p_draft_id
  order by overall_pick_number desc
  limit 1;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'There are no picks to undo.';
  end if;

  if v_pick.overall_pick_number <> v_draft.current_pick - 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Draft pick state is inconsistent.';
  end if;

  delete from public.picks
  where id = v_pick.id;

  update public.drafts
  set
    current_pick = v_pick.overall_pick_number,
    status = case
      when v_draft.status = 'complete' then 'active'
      else v_draft.status
    end
  where id = p_draft_id;

  return v_pick;
end;
$$;

revoke all on function public.create_draft(text, integer, integer, text)
  from public, anon;
revoke all on function public.join_draft(text, text)
  from public, anon;
revoke all on function public.assign_team(uuid, uuid, uuid)
  from public, anon;
revoke all on function public.make_pick(uuid, uuid)
  from public, anon;
revoke all on function public.undo_pick(uuid)
  from public, anon;

grant execute on function public.create_draft(text, integer, integer, text)
  to authenticated;
grant execute on function public.join_draft(text, text)
  to authenticated;
grant execute on function public.assign_team(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.make_pick(uuid, uuid)
  to authenticated;
grant execute on function public.undo_pick(uuid)
  to authenticated;
