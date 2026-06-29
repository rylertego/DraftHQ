-- Store the Sleeper owner (user) ID on league_teams so future syncs can
-- match by stable identity instead of fuzzy team name.

alter table public.league_teams
  add column if not exists sleeper_owner_id text default null;
