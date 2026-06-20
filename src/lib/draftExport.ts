import type { Pick, Team } from "@/types/draft";

function escapeCsv(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createDraftResultsCsv(teams: Team[], picks: Pick[]) {
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const rows = picks
    .toSorted(
      (first, second) => first.overallPickNumber - second.overallPickNumber
    )
    .map((pick) => [
      pick.overallPickNumber,
      pick.round,
      teamNames.get(pick.teamId) ?? "Unknown Team",
      pick.playerName,
      pick.playerPosition,
      pick.nflTeam ?? "FA",
    ]);

  return [
    ["Overall Pick", "Round", "Team", "Player", "Position", "NFL Team"],
    ...rows,
  ]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");
}
