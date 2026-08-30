export function slugFromLeagueName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function leagueImportPath(slug: string) {
  return `/leagues/${slug}/import`;
}

export type LeagueSourceConnection = "sleeper" | "espn" | "yahoo" | null;

export function shouldShowLeagueSourceSetup(activeIntegration: LeagueSourceConnection) {
  return activeIntegration === null;
}
