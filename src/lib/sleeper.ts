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
  /** Starting lineup parsed from the league's roster_positions */
  lineup: SleeperLineup | null;
  /** Scoring format inferred from the league's scoring_settings */
  scoringType: "standard" | "ppr" | "half_ppr" | "superflex" | null;
  warnings: string[];
}

/** A league's starting requirements, keyed by DraftHQ roster position id. */
export interface SleeperLineup {
  /** e.g. { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 } */
  starters: Record<string, number>;
  benchSlots: number;
  totalSlots: number;
}

// Sleeper roster_positions tokens → DraftHQ roster position ids.
// REC_FLEX (W/T) and WRRB_FLEX collapse onto FLEX: DraftHQ has no separate
// slot for them, and for grading purposes they behave the same way.
const SLEEPER_SLOT_MAP: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST",
  DST: "DST",
  FLEX: "FLEX",
  REC_FLEX: "FLEX",
  WRRB_FLEX: "FLEX",
  WRRB_WRT: "FLEX",
  SUPER_FLEX: "SUPERFLEX",
  IDP_FLEX: "IDP",
  DL: "DL",
  LB: "LB",
  DB: "DB",
};

export function parseSleeperLineup(rosterPositions: unknown): SleeperLineup | null {
  if (!Array.isArray(rosterPositions) || rosterPositions.length === 0) return null;
  const starters: Record<string, number> = {};
  let benchSlots = 0;
  let totalSlots = 0;

  for (const raw of rosterPositions) {
    if (typeof raw !== "string") continue;
    const token = raw.trim().toUpperCase();
    totalSlots++;
    if (token === "BN") { benchSlots++; continue; }
    if (token === "IR" || token === "TAXI") continue; // not startable
    const id = SLEEPER_SLOT_MAP[token];
    if (!id) continue;
    starters[id] = (starters[id] ?? 0) + 1;
  }

  return Object.keys(starters).length > 0 ? { starters, benchSlots, totalSlots } : null;
}

/** Infer DraftHQ's scoring type from Sleeper scoring_settings.
 * `rec` is points per reception; `bonus_rec_te` marks TE premium (which
 * DraftHQ cannot represent yet — surfaced as a warning by the caller). */
export function inferSleeperScoring(
  scoringSettings: unknown,
  lineup: SleeperLineup | null
): "standard" | "ppr" | "half_ppr" | "superflex" | null {
  if (lineup?.starters.SUPERFLEX) return "superflex";
  if (!isRecord(scoringSettings)) return null;
  const rec = scoringSettings.rec;
  if (typeof rec !== "number") return null;
  if (rec >= 0.75) return "ppr";
  if (rec >= 0.25) return "half_ppr";
  return "standard";
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

/** Apply an imported lineup onto DraftHQ's roster position rows: `min` becomes
 * the number of required starters at that slot, and any slot the league uses is
 * enabled. Slots the league doesn't use keep min 0 so they aren't treated as
 * roster needs. Returns a new array; the caller persists it. */
export function applyLineupToRosterPositions<
  T extends { id: string; enabled: boolean; min: number; max: number }
>(rosterPositions: T[], lineup: SleeperLineup): T[] {
  return rosterPositions.map((row) => {
    const required = lineup.starters[row.id] ?? 0;
    if (required > 0) {
      return { ...row, enabled: true, min: required, max: Math.max(row.max, required) };
    }
    // Positions the league doesn't start: keep bench-only slots usable (RB/WR
    // depth is still legal) but record no starting requirement.
    return { ...row, min: 0 };
  });
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

  const lineup = parseSleeperLineup(rosterPositions);
  const scoringType = inferSleeperScoring(input.league.scoring_settings, lineup);
  if (!lineup) {
    warnings.push("Sleeper did not return a starting lineup — configure roster positions manually.");
  }
  if (
    isRecord(input.league.scoring_settings) &&
    typeof input.league.scoring_settings.bonus_rec_te === "number" &&
    input.league.scoring_settings.bonus_rec_te !== 0
  ) {
    warnings.push("This league uses tight end premium scoring, which DraftHQ does not model yet.");
  }

  return {
    leagueId,
    draftId: selectedDraft ? getString(selectedDraft, "draft_id") : null,
    leagueName,
    rounds,
    lineup,
    scoringType,
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
