-- Follow-up to 20260816000000_leave_league.sql.
--
-- The first version deleted the league_members row and released the league
-- team, but left two other places that still pointed at the departing user:
--
--   1. draft_participants. can_view_draft() grants access if you are a league
--      member OR a draft participant, so a member who had already joined a
--      draft could keep draft-room access after leaving the league — they fail
--      the league check and pass the participant check.
--
--   2. league_team_seasons.owner_user_id, which records who owned a franchise
--      in a given season and would keep naming someone who is gone.
--
-- Neither was observable in testing because the tester had never joined the
-- draft, so both branches failed for the ordinary reason. Fixing it anyway:
-- the hole is real for anyone who has actually been in a draft.

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

  -- Release any team they hold so the commissioner can reassign it.
  update public.league_teams
  set owner_user_id = null
  where league_id = p_league_id
    and owner_user_id = v_user_id;

  -- Drop the season-level ownership record for this league's seasons.
  update public.league_team_seasons lts
  set owner_user_id = null
  from public.league_seasons ls
  where lts.league_season_id = ls.id
    and ls.league_id = p_league_id
    and lts.owner_user_id = v_user_id;

  -- Remove draft-room access. Without this, can_view_draft() still passes on
  -- its draft_participants branch and leaving does not actually lock them out.
  delete from public.draft_participants dp
  using public.drafts d
  where dp.draft_id = d.id
    and d.league_id = p_league_id
    and dp.user_id = v_user_id;

  delete from public.league_members
  where id = v_member.id;
end;
$$;

revoke all on function public.leave_league(uuid) from public, anon;
grant execute on function public.leave_league(uuid) to authenticated;
