-- get_draft_join_preview() decided "already joined" inside an email check.
--
-- The previous shape was:
--
--   if v_email is not null then
--     ... invitation lookup by email ...      -- genuinely needs an email
--     select exists (... user_id = auth.uid()) into v_already_joined;
--   end if;
--
-- The participant lookup keys on auth.uid() and has nothing to do with email,
-- but it only ran when an email claim was present. So whether someone was told
-- they had already joined depended on the shape of their token rather than on
-- whether they had joined.
--
-- That matters most for anonymous users, who are exactly the people the join
-- code is for. Supabase is not consistent about omitting the email claim for
-- them — an empty string is common, and lower('') is not null, so the branch
-- could run or not run for two anonymous users in the same state.
--
-- The invitation lookup stays inside the email check, because matching an
-- invitation genuinely requires an address. Only the participant check moves
-- out.

create or replace function public.get_draft_join_preview(p_join_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft     public.drafts%rowtype;
  v_email     text := nullif(lower(auth.jwt() ->> 'email'), '');
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

  -- Invitation lookup genuinely needs an address, so it stays behind the email
  -- check. nullif() above also collapses the empty-string claim that anonymous
  -- tokens can carry, so this no longer runs a pointless lookup for ''.
  if v_email is not null then
    select t.name into v_team_name
    from public.draft_invitations i
    join public.teams t on t.id = i.team_id and t.draft_id = i.draft_id
    where i.draft_id = v_draft.id
      and i.email = v_email
      and i.status = 'pending';
  end if;

  -- Keyed on the caller, so it applies to everyone, signed in or anonymous.
  select exists (
    select 1 from public.draft_participants
    where draft_id = v_draft.id and user_id = auth.uid()
  ) into v_already_joined;

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
