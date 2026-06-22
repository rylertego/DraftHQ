import type { ProviderLeaguePreview, ProviderTeamPreview } from "./types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(record: UnknownRecord, key: string): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function getNumber(record: UnknownRecord, key: string): number | null {
  const v = record[key];
  return typeof v === "number" && isFinite(v) ? v : null;
}

function ownerName(team: UnknownRecord): string {
  const owners = Array.isArray(team.owners)
    ? (team.owners as unknown[]).filter(isRecord)
    : [];
  if (owners.length === 0) return "Unassigned Owner";
  return getString(owners[0], "displayName")?.trim() || "Unassigned Owner";
}

function countRosterSlots(rosters: UnknownRecord[]): number | null {
  if (rosters.length === 0) return null;
  const first = rosters[0];
  const groups = Array.isArray(first.groups)
    ? (first.groups as unknown[]).filter(isRecord)
    : [];
  let total = 0;
  for (const group of groups) {
    const slots = Array.isArray(group.slots)
      ? (group.slots as unknown[])
      : [];
    total += slots.length;
  }
  return total >= 1 ? total : null;
}

export function buildFleaflickerLeaguePreview(
  leagueRaw: unknown,
  rostersRaw: unknown
): ProviderLeaguePreview {
  if (!isRecord(leagueRaw)) {
    throw new Error("Fleaflicker returned an unexpected league response.");
  }

  const leagueName = getString(leagueRaw, "name")?.trim() || null;
  if (!leagueName) {
    throw new Error(
      "Fleaflicker league not found. Check your league ID."
    );
  }

  const rostersObj = isRecord(rostersRaw) ? rostersRaw : {};
  const rosterList = Array.isArray(rostersObj.rosters)
    ? (rostersObj.rosters as unknown[]).filter(isRecord)
    : [];

  if (rosterList.length < 2 || rosterList.length > 20) {
    throw new Error(
      rosterList.length === 0
        ? "No rosters found for this Fleaflicker league."
        : "Fleaflicker league must have between 2 and 20 teams."
    );
  }

  const rounds = countRosterSlots(rosterList) ?? 15;
  const warnings: string[] = [];
  if (!countRosterSlots(rosterList)) {
    warnings.push("Could not determine roster size; defaulting to 15 rounds.");
  }

  const teams: ProviderTeamPreview[] = rosterList.map((roster, index) => {
    const team = isRecord(roster.team) ? roster.team : {};
    const id = getNumber(team, "id") ?? index + 1;
    const name =
      getString(team, "name")?.trim() || `Team ${index + 1}`;
    return {
      externalId: String(id),
      ownerName: ownerName(team),
      teamName: name,
      draftPosition: index + 1,
    };
  });

  return {
    leagueName,
    rounds: Math.min(30, Math.max(1, rounds)),
    teams,
    warnings,
  };
}
