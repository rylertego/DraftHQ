-- A league member should not be able to enter their own league's draft through
-- the join code.
--
-- Doing so creates a draft_participants row with no team_id, so they show up in
-- the lobby as an unattached guest alongside the league identity they already
-- have. The proper route is the league page, where the auto-assign path in
-- 20260625010000 has already given every league team owner a seat.
--
-- Two carve-outs, both load-bearing:
--
--   1. Someone who is ALREADY a draft participant is still allowed through.
--      join_draft is an upsert and the join form has an explicit "Rejoin Draft"
--      state built on it — somebody who cleared their browser mid-draft has to
--      be able to get back in. Blocking every league member would break exactly
--      the people join_draft itself created, because this function adds joiners
--      to league_members at the end.
--
--   2. Drafts with no league (standalone) are unaffected — there is no
--      membership to check.
--
-- KNOWN CONSEQUENCE: a league member who has no team and is not yet a
-- participant is now blocked. Previously they could take an unattached seat.
-- That is the behaviour being removed on purpose, but it means their only route
-- in is a commissioner assigning them a team. If that proves too strict, the
-- fix is to let the commissioner seat them, not to reopen the join code.

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
  v_email text := lower(auth.jwt() ->> 'email');
  v_draft public.drafts%rowtype;
  v_invitation public.draft_invitations%rowtype;
  v_existing_participant public.draft_participants%rowtype;
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

  select *
  into v_existing_participant
  from public.draft_participants
  where draft_id = v_draft.id
    and user_id = v_user_id
  for update;

  -- Already in the league, and not already seated in this draft: send them in
  -- through the league instead of handing them an unattached guest seat.
  -- Existing participants fall through so that rejoining keeps working.
  if v_draft.league_id is not null
    and v_existing_participant.id is null
    and exists (
      select 1
      from public.league_members lm
      where lm.league_id = v_draft.league_id
        and lm.user_id = v_user_id
    )
  then
    raise exception using
      errcode = '23505',
      message = 'You are already in this league. Open the draft from your league page.';
  end if;

  if v_email is not null then
    select *
    into v_invitation
    from public.draft_invitations
    where draft_id = v_draft.id
      and email = v_email
    for update;
  end if;

  if v_existing_participant.id is not null
    and v_invitation.team_id is not null
    and v_existing_participant.team_id is not null
    and v_existing_participant.team_id <> v_invitation.team_id
  then
    raise exception using
      errcode = '23505',
      message = 'Your account is already assigned to another team.';
  end if;

  insert into public.draft_participants (
    draft_id,
    user_id,
    team_id,
    display_name,
    role
  )
  values (
    v_draft.id,
    v_user_id,
    v_invitation.team_id,
    trim(p_display_name),
    'owner'
  )
  on conflict (draft_id, user_id)
  do update set
    display_name = excluded.display_name,
    team_id = coalesce(
      public.draft_participants.team_id,
      excluded.team_id
    )
  returning * into v_participant;

  if v_invitation.id is not null then
    update public.draft_invitations
    set
      participant_id = v_participant.id,
      status = 'accepted',
      accepted_at = coalesce(accepted_at, now())
    where id = v_invitation.id;
  end if;

  if v_draft.league_id is not null then
    insert into public.league_members (league_id, user_id, role)
    values (v_draft.league_id, v_user_id, 'member')
    on conflict (league_id, user_id) do nothing;
  end if;

  return v_participant;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'That invited team is already assigned.';
end;
$$;
