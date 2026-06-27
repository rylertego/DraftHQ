-- Soft-delete for league teams: archived teams are hidden from active rosters
-- and excluded from the league team_count total.

alter table public.league_teams
  add column if not exists archived_at timestamptz default null;
