-- Account deletion, the app-data half.
--
-- The privacy policy promises deletion on request, so it needs to be a real
-- flow rather than a manual SQL job. This RPC removes everything that points
-- at the caller inside our own tables. Deleting the auth.users row itself
-- needs the service role and happens in /api/account/delete, which calls this
-- first and only then removes the login.
--
-- Ordering matters: if the auth user were deleted first and this failed, the
-- account would be unreachable but its data would remain — the worst outcome
-- for something a user asked us to erase.
--
-- League owners are refused, for the same reason leave_league() refuses them:
-- deleting the owner orphans the league so nobody can invite, configure, or
-- run the draft. They must hand over ownership first.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_owned   text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in to delete your account.';
  end if;

  select string_agg(name, ', ' order by name) into v_owned
  from public.leagues
  where owner_user_id = v_user_id;

  if v_owned is not null then
    raise exception using errcode = '22023',
      message = 'Transfer ownership of these leagues before deleting your account: ' || v_owned;
  end if;

  -- Release held teams so commissioners can reassign them.
  update public.league_teams
  set owner_user_id = null
  where owner_user_id = v_user_id;

  update public.league_team_seasons
  set owner_user_id = null
  where owner_user_id = v_user_id;

  -- Draft-room access is granted by league membership OR draft participation,
  -- so both have to go.
  delete from public.draft_participants
  where user_id = v_user_id;

  delete from public.league_members
  where user_id = v_user_id;

  -- Invitations addressed to this account's email are personal data too.
  delete from public.league_invitations
  where lower(email) = (
    select lower(email) from auth.users where id = v_user_id
  );

  delete from public.profiles
  where id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
