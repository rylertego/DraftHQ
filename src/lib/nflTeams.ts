const NFL_TEAM_ALIASES: Record<string, string> = {
  AZ: "ARI",
  ARZ: "ARI",
  JAC: "JAX",
  LA: "LAR",
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
  WSH: "WAS",
};

export function canonicalNflTeam(value: string) {
  const team = value.trim().toUpperCase();
  return NFL_TEAM_ALIASES[team] ?? team;
}

export function resolveDraftSeasonYear(
  draftName: string,
  scheduledAt: string | null,
  now = new Date()
) {
  if (scheduledAt) {
    const scheduled = new Date(scheduledAt);
    if (!Number.isNaN(scheduled.getTime())) return scheduled.getFullYear();
  }

  const nameYear = draftName.match(/\b(20\d{2})\b/)?.[1];
  return nameYear ? Number(nameYear) : now.getFullYear();
}

export function buildByeWeekLookup(
  rows: Array<{ nfl_team: string; bye_week: number }>
) {
  const lookup = new Map<string, number>();
  for (const row of rows) {
    const rawTeam = row.nfl_team.trim().toUpperCase();
    const canonicalTeam = canonicalNflTeam(rawTeam);
    lookup.set(rawTeam, row.bye_week);
    lookup.set(canonicalTeam, row.bye_week);
  }

  for (const [alias, canonical] of Object.entries(NFL_TEAM_ALIASES)) {
    const byeWeek = lookup.get(canonical);
    if (byeWeek != null) lookup.set(alias, byeWeek);
  }
  return lookup;
}
