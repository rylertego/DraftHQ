-- Extend the league_teams → draft_teams sync trigger to also propagate
-- last_season_record and last_season_playoffs, so Sleeper sync auto-populates
-- the "Last season details" section in draft settings.

create or replace function public.sync_league_team_to_draft_teams()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.name                is distinct from old.name)
  or (new.short_name          is distinct from old.short_name)
  or (new.logo_url            is distinct from old.logo_url)
  or (new.owner_name          is distinct from old.owner_name)
  or (new.last_season_record  is distinct from old.last_season_record)
  or (new.last_season_playoffs is distinct from old.last_season_playoffs)
  then
    update public.teams t
    set
      name                 = new.name,
      short_name           = new.short_name,
      logo_url             = new.logo_url,
      owner_name           = new.owner_name,
      last_season_record   = new.last_season_record,
      last_season_playoffs = new.last_season_playoffs
    from public.league_team_seasons lts
    where lts.league_team_id = new.id
      and lts.draft_team_id  = t.id;
  end if;
  return new;
end;
$$;

-- Backfill existing linked draft teams from current league_teams values
update public.teams t
set
  last_season_record   = lt.last_season_record,
  last_season_playoffs = lt.last_season_playoffs
from public.league_team_seasons lts
join public.league_teams lt on lt.id = lts.league_team_id
where lts.draft_team_id = t.id
  and (lt.last_season_record is not null or lt.last_season_playoffs is not null);
