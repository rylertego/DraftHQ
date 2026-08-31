-- League team owner changes affect draft pick authorization. Do not allow
-- league-level owner edits when the affected franchise is linked to a live or
-- complete draft, because draft_participants cannot be safely rewritten then.

create or replace function public.assign_league_team_owner(
  p_league_id uuid,
  p_league_team_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_league_commissioner(p_league_id) then
    raise exception using
      errcode = '42501',
      message = 'Only a league commissioner can assign team owners.';
  end if;

  if not exists (
    select 1
    from public.league_teams
    where id = p_league_team_id
      and league_id = p_league_id
      and archived_at is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'Team does not belong to this league.';
  end if;

  if p_user_id is not null and not exists (
    select 1
    from public.league_members
    where league_id = p_league_id
      and user_id = p_user_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Owner must be a league member.';
  end if;

  if exists (
    select 1
    from public.league_seasons ls
    join public.league_team_seasons lts
      on lts.league_season_id = ls.id
     and lts.league_team_id = p_league_team_id
    join public.drafts d on d.id = ls.draft_id
    where ls.league_id = p_league_id
      and lts.draft_team_id is not null
      and d.status not in ('setup', 'paused')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Pause the draft before changing team assignments.';
  end if;

  update public.league_teams
  set owner_user_id = p_user_id
  where id = p_league_team_id
    and league_id = p_league_id;

  perform public.sync_league_team_owner_to_draft_assignments(
    p_league_id,
    p_league_team_id,
    p_user_id
  );
end;
$function$;

revoke all on function public.assign_league_team_owner(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.assign_league_team_owner(uuid, uuid, uuid)
to authenticated;
