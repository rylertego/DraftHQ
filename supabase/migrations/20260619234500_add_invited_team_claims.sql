alter table public.draft_invitations
add column team_id uuid;

alter table public.draft_invitations
add constraint draft_invitations_team_id_draft_id_fkey
foreign key (team_id, draft_id)
references public.teams (id, draft_id)
on delete restrict;

create unique index draft_invitations_team_assignment_idx
on public.draft_invitations (draft_id, team_id)
where team_id is not null and status = 'pending';

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

  if v_email is not null then
    select *
    into v_invitation
    from public.draft_invitations
    where draft_id = v_draft.id
      and email = v_email
    for update;
  end if;

  select *
  into v_existing_participant
  from public.draft_participants
  where draft_id = v_draft.id
    and user_id = v_user_id
  for update;

  if found
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

  return v_participant;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'That invited team is already assigned.';
end;
$$;

revoke all on function public.join_draft(text, text)
  from public, anon;
grant execute on function public.join_draft(text, text)
  to authenticated;
