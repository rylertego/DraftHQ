export interface SleeperTeamPreview {
  rosterId: number;
  ownerUserId: string | null;
  managerName: string;
  teamName: string;
  draftPosition: number;
}

export interface SleeperLeaguePreview {
  leagueId: string;
  draftId: string | null;
  leagueName: string;
  rounds: number;
  teams: SleeperTeamPreview[];
  warnings: string[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(record: UnknownRecord, key: string) {
  return typeof record[key] === "string" ? record[key] : null;
}

function getInteger(record: UnknownRecord, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function getMetadataName(user: UnknownRecord | undefined) {
  if (!user || !isRecord(user.metadata)) {
    return null;
  }

  const teamName = getString(user.metadata, "team_name")?.trim();
  return teamName || null;
}

export function normalizeSleeperLeagueId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const leagueId = value.trim();
  return /^\d{5,30}$/.test(leagueId) ? leagueId : null;
}

export function buildSleeperLeaguePreview(input: {
  league: unknown;
  users: unknown;
  rosters: unknown;
  drafts: unknown;
}): SleeperLeaguePreview {
  if (!isRecord(input.league)) {
    throw new Error("Sleeper returned an invalid league.");
  }

  const leagueId = getString(input.league, "league_id");
  const leagueName = getString(input.league, "name")?.trim();

  if (!leagueId || !leagueName) {
    throw new Error("Sleeper league details are incomplete.");
  }

  if (!Array.isArray(input.users) || !Array.isArray(input.rosters)) {
    throw new Error("Sleeper league users or rosters are invalid.");
  }

  const users = new Map<string, UnknownRecord>();
  for (const value of input.users) {
    if (!isRecord(value)) {
      continue;
    }

    const userId = getString(value, "user_id");
    if (userId) {
      users.set(userId, value);
    }
  }

  const draftCandidates = Array.isArray(input.drafts)
    ? input.drafts.filter(isRecord)
    : [];
  const selectedDraft = draftCandidates.toSorted((first, second) => {
    const firstCreated = getInteger(first, "created") ?? 0;
    const secondCreated = getInteger(second, "created") ?? 0;
    return secondCreated - firstCreated;
  })[0];
  const draftOrder =
    selectedDraft && isRecord(selectedDraft.draft_order)
      ? selectedDraft.draft_order
      : null;
  const draftSettings =
    selectedDraft && isRecord(selectedDraft.settings)
      ? selectedDraft.settings
      : null;
  const rosterPositions = Array.isArray(input.league.roster_positions)
    ? input.league.roster_positions
    : [];
  const importedRounds = draftSettings
    ? getInteger(draftSettings, "rounds")
    : null;
  const rounds =
    importedRounds && importedRounds >= 1 && importedRounds <= 30
      ? importedRounds
      : Math.min(30, Math.max(1, rosterPositions.length || 15));
  const warnings: string[] = [];

  const parsedRosters = input.rosters.flatMap((value) => {
    if (!isRecord(value)) {
      return [];
    }

    const rosterId = getInteger(value, "roster_id");
    if (!rosterId) {
      return [];
    }

    const ownerUserId = getString(value, "owner_id");
    const user = ownerUserId ? users.get(ownerUserId) : undefined;
    const managerName =
      (user && getString(user, "display_name")?.trim()) || "Unassigned Owner";
    const teamName =
      getMetadataName(user) ||
      (managerName === "Unassigned Owner"
        ? `Team ${rosterId}`
        : `${managerName}'s Team`);
    const orderValue = ownerUserId && draftOrder ? draftOrder[ownerUserId] : null;
    const draftSlot =
      typeof orderValue === "number" && Number.isInteger(orderValue)
        ? orderValue
        : rosterId;

    if (!ownerUserId) {
      warnings.push(`Roster ${rosterId} does not have a primary owner.`);
    }

    return [{ rosterId, ownerUserId, managerName, teamName, draftSlot }];
  });

  if (parsedRosters.length < 2 || parsedRosters.length > 20) {
    throw new Error("Sleeper league must contain between 2 and 20 rosters.");
  }

  const draftSlots = parsedRosters.map((roster) => roster.draftSlot);
  if (!draftOrder || new Set(draftSlots).size !== parsedRosters.length) {
    warnings.push(
      "Sleeper draft order is unavailable or incomplete; roster order is used."
    );
    parsedRosters.sort((first, second) => first.rosterId - second.rosterId);
  } else {
    parsedRosters.sort(
      (first, second) =>
        first.draftSlot - second.draftSlot || first.rosterId - second.rosterId
    );
  }

  return {
    leagueId,
    draftId: selectedDraft ? getString(selectedDraft, "draft_id") : null,
    leagueName,
    rounds,
    teams: parsedRosters.map((roster, index) => ({
      rosterId: roster.rosterId,
      ownerUserId: roster.ownerUserId,
      managerName: roster.managerName,
      teamName: roster.teamName,
      draftPosition: index + 1,
    })),
    warnings,
  };
}
