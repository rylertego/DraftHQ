-- The authenticated invitation API validates franchise/draft relationships
-- before creating a pending invite. Keep service-role access read-only and
-- limited to the four tables required for those checks.
grant select on public.league_teams to service_role;
grant select on public.league_seasons to service_role;
grant select on public.league_team_seasons to service_role;
