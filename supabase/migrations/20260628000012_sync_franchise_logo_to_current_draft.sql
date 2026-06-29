-- Keep the current draft's team logo in sync when a commissioner edits the
-- corresponding franchise team. Completed drafts retain their historical logo.

create or replace function public.sync_franchise_logo_to_current_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.teams as draft_team
  set logo_url = new.logo_url
  from public.league_team_seasons as team_season
  join public.league_seasons as season
    on season.id = team_season.league_season_id
  join public.drafts as draft
    on draft.id = season.draft_id
  where team_season.league_team_id = new.id
    and team_season.draft_team_id = draft_team.id
    and draft.status in ('setup', 'active', 'paused')
    and draft_team.logo_url is distinct from new.logo_url;

  return new;
end;
$$;

revoke all on function public.sync_franchise_logo_to_current_draft()
  from public, anon, authenticated;

drop trigger if exists league_teams_sync_logo_to_current_draft on public.league_teams;
create trigger league_teams_sync_logo_to_current_draft
after update of logo_url on public.league_teams
for each row
when (old.logo_url is distinct from new.logo_url)
execute function public.sync_franchise_logo_to_current_draft();
