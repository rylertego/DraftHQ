-- RPC: delete_league_team
-- Clears league_team_seasons references first, then deletes the franchise team.
-- Commissioner-only. Picks and draft data are unaffected (draft teams are separate rows).

create or replace function public.delete_league_team(
  p_league_id     uuid,
  p_league_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_league_commissioner(p_league_id) then
    raise exception using
      errcode = '42501',
      message = 'Only a league commissioner can delete franchise teams.';
  end if;

  if not exists (
    select 1 from public.league_teams
    where id = p_league_team_id and league_id = p_league_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Team does not belong to this league.';
  end if;

  -- Remove season slot references first (FK is ON DELETE RESTRICT)
  delete from public.league_team_seasons
  where league_team_id = p_league_team_id;

  -- Now safe to delete the franchise team
  delete from public.league_teams
  where id = p_league_team_id;
end;
$$;

revoke all on function public.delete_league_team(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_league_team(uuid, uuid) to authenticated;
