create or replace function public.get_draft_join_preview(p_join_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft     public.drafts%rowtype;
  v_email     text := lower(auth.jwt() ->> 'email');
  v_team_name text;
  v_already_joined boolean;
begin
  if p_join_code is null or char_length(trim(p_join_code)) not between 6 and 12 then
    raise exception using
      errcode = '22023',
      message = 'A valid join code is required.';
  end if;

  select * into v_draft
  from public.drafts
  where join_code = upper(trim(p_join_code));

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Draft not found. Check the join code and try again.';
  end if;

  -- Look up an invitation for this email so the join page can show the team name.
  if v_email is not null then
    select t.name into v_team_name
    from public.draft_invitations i
    join public.teams t on t.id = i.team_id and t.draft_id = i.draft_id
    where i.draft_id = v_draft.id
      and i.email = v_email
      and i.status = 'pending';

    select exists (
      select 1 from public.draft_participants
      where draft_id = v_draft.id and user_id = auth.uid()
    ) into v_already_joined;
  end if;

  return json_build_object(
    'draftName',       v_draft.name,
    'teamCount',       v_draft.team_count,
    'rounds',          v_draft.rounds,
    'joinCode',        v_draft.join_code,
    'status',          v_draft.status,
    'invitedTeamName', v_team_name,
    'alreadyJoined',   coalesce(v_already_joined, false)
  );
end;
$$;

revoke all on function public.get_draft_join_preview(text) from public, anon;
grant execute on function public.get_draft_join_preview(text) to authenticated, anon;
