-- Let a member remove themselves from a league.
--
-- league_members DELETE is commissioner-only, which is correct for removing
-- *other* people but left members with no way out: only a commissioner could
-- remove them. This is a security-definer RPC rather than a new RLS policy so
-- the exit is narrow — you can delete exactly your own row and nothing else.

create or replace function public.leave_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_member  public.league_members%rowtype;
  v_owner   uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in to leave a league.';
  end if;

  select owner_user_id into v_owner
  from public.leagues
  where id = p_league_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'League not found.';
  end if;

  -- The owner leaving would orphan the league: no one could invite, configure,
  -- or run the draft. Ownership must be handed over first.
  if v_owner = v_user_id then
    raise exception using errcode = '22023',
      message = 'Transfer league ownership before leaving.';
  end if;

  select * into v_member
  from public.league_members
  where league_id = p_league_id
    and user_id = v_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'You are not a member of this league.';
  end if;

  -- Release any team they held so the commissioner can reassign it, rather
  -- than leaving a dangling owner reference on the franchise.
  update public.league_teams
  set owner_user_id = null
  where league_id = p_league_id
    and owner_user_id = v_user_id;

  delete from public.league_members
  where id = v_member.id;
end;
$$;

revoke all on function public.leave_league(uuid) from public, anon;
grant execute on function public.leave_league(uuid) to authenticated;
