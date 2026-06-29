-- Whenever name, short_name, logo_url, or owner_name changes on league_teams,
-- propagate those values to the linked draft team slots via league_team_seasons.
-- This keeps draft settings in sync with the Teams page without any extra API calls.

create or replace function public.sync_league_team_to_draft_teams()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.name       is distinct from old.name)
  or (new.short_name is distinct from old.short_name)
  or (new.logo_url   is distinct from old.logo_url)
  or (new.owner_name is distinct from old.owner_name)
  then
    update public.teams t
    set
      name       = new.name,
      short_name = new.short_name,
      logo_url   = new.logo_url,
      owner_name = new.owner_name
    from public.league_team_seasons lts
    where lts.league_team_id = new.id
      and lts.draft_team_id  = t.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_league_team_to_draft_teams on public.league_teams;
create trigger trg_sync_league_team_to_draft_teams
  after update on public.league_teams
  for each row
  execute function public.sync_league_team_to_draft_teams();
