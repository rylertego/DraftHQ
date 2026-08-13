const LEAGUE_QUERY_ROUTES = new Set(["/teams", "/draft", "/draft/lobby"]);

export function isLeagueFocusRoute(pathname: string, hasLeagueSlug: boolean): boolean {
  return pathname.startsWith("/leagues/")
    || (hasLeagueSlug && LEAGUE_QUERY_ROUTES.has(pathname));
}
