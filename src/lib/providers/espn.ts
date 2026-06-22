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

function espnTeamName(team: UnknownRecord): string {
  const location = getString(team, "location") ?? "";
  const nickname = getString(team, "nickname") ?? "";
  return [location, nickname].filter(Boolean).join(" ").trim() || `Team ${String(team.id ?? "?")}`;
}

export function buildEspnLeaguePreview(raw: unknown): ProviderLeaguePreview {
  if (!isRecord(raw)) {
    throw new Error("ESPN returned an unexpected response.");
  }

  const settings = isRecord(raw.settings) ? raw.settings : null;
  const leagueName =
    (settings && getString(settings, "name")?.trim()) || null;

  if (!leagueName) {
    throw new Error("ESPN league name is missing. Check your league ID and year.");
  }

  const teams = Array.isArray(raw.teams) ? raw.teams.filter(isRecord) : [];
  if (teams.length < 2 || teams.length > 20) {
    throw new Error(
      teams.length === 0
        ? "No teams found. The league may be private — provide your espn_s2 and SWID cookies."
        : "ESPN league must have between 2 and 20 teams."
    );
  }

  const members = Array.isArray(raw.members) ? raw.members.filter(isRecord) : [];
  const memberMap = new Map<string, string>();
  for (const member of members) {
    const id = getString(member, "id");
    const displayName = getString(member, "displayName")?.trim();
    if (id && displayName) {
      memberMap.set(id, displayName);
    }
  }

  const draftSettings = settings && isRecord(settings.draftSettings)
    ? settings.draftSettings
    : null;
  const pickOrder = Array.isArray(draftSettings?.pickOrder)
    ? (draftSettings.pickOrder as unknown[]).filter(
        (v): v is number => typeof v === "number"
      )
    : [];

  const rosterSettings = settings && isRecord(settings.rosterSettings)
    ? settings.rosterSettings
    : null;
  const slotCounts = isRecord(rosterSettings?.lineupSlotCounts)
    ? (rosterSettings.lineupSlotCounts as UnknownRecord)
    : null;

  let rounds = 15;
  if (slotCounts) {
    const IR_SLOT = 21;
    let total = 0;
    for (const [slotId, count] of Object.entries(slotCounts)) {
      if (Number(slotId) !== IR_SLOT && typeof count === "number") {
        total += count;
      }
    }
    if (total >= 1 && total <= 30) rounds = total;
  }

  const teamById = new Map<number, UnknownRecord>();
  for (const team of teams) {
    const id = getNumber(team, "id");
    if (id !== null) teamById.set(id, team);
  }

  const ordered: UnknownRecord[] =
    pickOrder.length === teams.length
      ? pickOrder.flatMap((id) => {
          const team = teamById.get(id);
          return team ? [team] : [];
        })
      : [...teams].sort(
          (a, b) => (getNumber(a, "id") ?? 0) - (getNumber(b, "id") ?? 0)
        );

  const warnings: string[] = [];
  if (pickOrder.length !== teams.length) {
    warnings.push("ESPN draft order unavailable; teams sorted by ID.");
  }

  const previewTeams: ProviderTeamPreview[] = ordered.map((team, index) => {
    const ownerId = getString(team, "primaryOwner");
    const ownerName =
      (ownerId && memberMap.get(ownerId)) || "Unassigned Owner";
    return {
      externalId: String(getNumber(team, "id") ?? index + 1),
      ownerName,
      teamName: espnTeamName(team),
      draftPosition: index + 1,
    };
  });

  return { leagueName, rounds, teams: previewTeams, warnings };
}
