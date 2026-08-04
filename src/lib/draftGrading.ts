import type { Pick, Player, RosterPosition, Team } from "@/types/draft";
import type { PlayerMarketData } from "@/lib/rankingsApi";
import { hasDeclaredLineup } from "@/lib/rosterPositions";

// ─────────────────────────────────────────────────────────────────────────────
// Post-draft grading.
//
// Every judgement here uses only what was knowable at the moment of the pick:
// the board as it stood, the roster as it stood, and pre-draft market data.
// Nothing in this file looks at real-world results — a future "how did the
// picks actually pan out" feature must stay separate from this one.
//
// Factor scores are all 0–100 with 50 meaning "unremarkable". The raw weighted
// blend is then calibrated (see CALIBRATION) so an ordinary competent draft
// lands around a C+/B- rather than an A, per the grading brief.
// ─────────────────────────────────────────────────────────────────────────────

export type ScoringType = "standard" | "ppr" | "half_ppr" | "superflex";

export interface GradingInput {
  picks: Pick[];
  teams: Team[];
  players: Player[];
  /** playerId → rank / ADP / projection */
  market: Map<string, PlayerMarketData>;
  rosterPositions: RosterPosition[] | null;
  scoringType: ScoringType;
  teamCount: number;
  rounds: number;
  /** NFL team abbreviation → bye week */
  byeWeeks?: Map<string, number>;
}

export interface FactorScore {
  /** 0–100, or null when the underlying data isn't available */
  score: number | null;
  weight: number;
  note?: string;
}

export interface PickGrade {
  pickId: string;
  teamId: string;
  overallPickNumber: number;
  round: number;
  playerName: string;
  playerPosition: string;
  /** Calibrated 0–100 */
  score: number;
  grade: string;
  /** Whether market value came from ADP, consensus rank, or was unavailable */
  marketBasis: "adp" | "rank" | "none";
  /** Picks of value gained (+) or reached (−); null without market data */
  valueDelta: number | null;
  factors: {
    value: FactorScore;
    need: FactorScore;
    scarcity: FactorScore;
    quality: FactorScore;
    construction: FactorScore;
  };
  summary: string;
  positives: string[];
  concerns: string[];
}

export interface TeamGrade {
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  score: number;
  grade: string;
  pickScore: number;
  constructionScore: number;
  strategyScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  picks: PickGrade[];
}

export interface DraftGradeReport {
  teams: TeamGrade[];
  picksByOverall: Map<number, PickGrade>;
  lineup: Lineup;
  /** Caveats about data that was missing or assumed */
  dataNotes: string[];
}

// ── Lineup ──────────────────────────────────────────────────────────────────

export interface Lineup {
  /** Required starters per roster slot id */
  starters: Record<string, number>;
  benchSlots: number;
  /** False when no lineup was configured and a standard one was assumed */
  declared: boolean;
}

const FLEX_ELIGIBLE = new Set(["RB", "WR", "TE"]);
const SUPERFLEX_ELIGIBLE = new Set(["QB", "RB", "WR", "TE"]);

export function resolveLineup(
  rosterPositions: RosterPosition[] | null,
  scoringType: ScoringType,
  rounds: number
): Lineup {
  if (hasDeclaredLineup(rosterPositions)) {
    const starters: Record<string, number> = {};
    let total = 0;
    for (const row of rosterPositions!) {
      if (row.enabled && row.min > 0) {
        starters[row.id] = row.min;
        total += row.min;
      }
    }
    return { starters, benchSlots: Math.max(0, rounds - total), declared: true };
  }

  // No configured lineup — assume a conventional one for the format. Callers
  // surface this assumption rather than presenting it as league truth.
  const starters: Record<string, number> = {
    QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1,
  };
  if (scoringType === "superflex") starters.SUPERFLEX = 1;
  const total = Object.values(starters).reduce((a, b) => a + b, 0);
  return { starters, benchSlots: Math.max(0, rounds - total), declared: false };
}

/** Greedily assign a roster to starting slots: dedicated slots first (best
 * players by rank), then FLEX, then SUPERFLEX. Returns the slots left unfilled. */
export function unfilledStarterSlots(
  roster: { position: string; rank: number }[],
  lineup: Lineup
): Record<string, number> {
  const remaining = [...roster].sort((a, b) => a.rank - b.rank);
  const unfilled: Record<string, number> = {};

  const take = (predicate: (p: { position: string }) => boolean): boolean => {
    const idx = remaining.findIndex(predicate);
    if (idx === -1) return false;
    remaining.splice(idx, 1);
    return true;
  };

  for (const [slot, count] of Object.entries(lineup.starters)) {
    if (slot === "FLEX" || slot === "SUPERFLEX") continue;
    let missing = 0;
    for (let i = 0; i < count; i++) {
      if (!take((p) => p.position === slot)) missing++;
    }
    if (missing > 0) unfilled[slot] = missing;
  }
  for (const [slot, eligible] of [
    ["FLEX", FLEX_ELIGIBLE],
    ["SUPERFLEX", SUPERFLEX_ELIGIBLE],
  ] as const) {
    const count = lineup.starters[slot] ?? 0;
    let missing = 0;
    for (let i = 0; i < count; i++) {
      if (!take((p) => eligible.has(p.position))) missing++;
    }
    if (missing > 0) unfilled[slot] = missing;
  }
  return unfilled;
}

function positionFillsSlot(position: string, slot: string): boolean {
  if (slot === position) return true;
  if (slot === "FLEX") return FLEX_ELIGIBLE.has(position);
  if (slot === "SUPERFLEX") return SUPERFLEX_ELIGIBLE.has(position);
  return false;
}

/** How many of a position are genuinely useful before it becomes hoarding. */
function usefulDepthCap(position: string, lineup: Lineup): number {
  const startersAt = lineup.starters[position] ?? 0;
  const flexish = (lineup.starters.FLEX ?? 0) + (lineup.starters.SUPERFLEX ?? 0);
  if (position === "K" || position === "DST") return 1;
  if (position === "QB") return startersAt + (lineup.starters.SUPERFLEX ? 1 : 0) + 1;
  if (position === "TE") return startersAt + Math.min(1, flexish) + 1;
  return startersAt + flexish + 2;
}

// ── Grade scale ─────────────────────────────────────────────────────────────

export function letterGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

// A neutral 50 across every factor should read as "competent, unremarkable" —
// a C+ — not as a failing grade. This maps the raw blend onto the letter scale
// so an A has to be earned.
const CALIBRATION = { base: 55, span: 0.45 };
function calibrate(raw: number): number {
  return clamp(CALIBRATION.base + raw * CALIBRATION.span, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Weighted mean over factors that have data; missing factors redistribute
 * their weight rather than scoring zero. */
function blend(factors: FactorScore[]): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const f of factors) {
    if (f.score === null) continue;
    weighted += f.score * f.weight;
    totalWeight += f.weight;
  }
  return totalWeight === 0 ? 50 : weighted / totalWeight;
}

// ── Factor: draft value ─────────────────────────────────────────────────────

function gradeValue(
  overallPick: number,
  market: PlayerMarketData | undefined,
  teamCount: number
): { factor: FactorScore; basis: "adp" | "rank" | "none"; delta: number | null } {
  const baseline = market?.adp ?? market?.rank ?? null;
  if (baseline === null) {
    return {
      factor: { score: null, weight: 0.4, note: "No market data for this player." },
      basis: "none",
      delta: null,
    };
  }
  const basis: "adp" | "rank" = market?.adp != null ? "adp" : "rank";
  // Positive = the player was still there later than the market expected
  // (value). Negative = taken ahead of the market (a reach).
  const delta = overallPick - baseline;

  // Roughly one round of slack, so a 5–8 pick reach barely registers.
  const tolerance = Math.max(5, teamCount * 0.5);
  const scale = Math.max(8, teamCount * 1.2);

  let score: number;
  if (delta >= 0) {
    // tanh gives diminishing returns: a 60-pick faller isn't twice as good a
    // process decision as a 30-pick faller.
    score = 50 + 48 * Math.tanh(delta / (scale * 1.6));
  } else {
    const excess = Math.max(0, Math.abs(delta) - tolerance);
    score = 50 - 48 * Math.tanh(excess / (scale * 1.1));
  }
  return { factor: { score: clamp(score, 0, 100), weight: 0.4 }, basis, delta };
}

// ── Factor: team need ───────────────────────────────────────────────────────

function gradeNeed(
  position: string,
  rosterBefore: { position: string; rank: number }[],
  lineup: Lineup
): FactorScore {
  const unfilled = unfilledStarterSlots(rosterBefore, lineup);
  const unfilledTotal = Object.values(unfilled).reduce((a, b) => a + b, 0);
  const fillsSlot = Object.keys(unfilled).some((slot) => positionFillsSlot(position, slot));

  if (fillsSlot) {
    // Filling a hole is good; filling one of the last remaining holes is better.
    const score = unfilledTotal >= 4 ? 88 : unfilledTotal >= 2 ? 84 : 78;
    return { score, weight: 0.2 };
  }

  const heldAtPos = rosterBefore.filter((p) => p.position === position).length;
  const cap = usefulDepthCap(position, lineup);
  let score = unfilledTotal === 0 ? 68 : clamp(66 - unfilledTotal * 13, 12, 66);
  if (heldAtPos >= cap) score -= 22;
  return {
    score: clamp(score, 0, 100),
    weight: 0.2,
    note: unfilledTotal > 0 ? `${unfilledTotal} starting slots still open.` : undefined,
  };
}

// ── Factor: positional scarcity ─────────────────────────────────────────────

function gradeScarcity(
  position: string,
  playerRank: number | null,
  availableAtPosition: number[], // ranks of others still on the board, ascending
  teamsNeedingPosition: number,
  teamCount: number
): FactorScore {
  if (playerRank === null || availableAtPosition.length === 0) {
    return { score: null, weight: 0.15, note: "Not enough board data." };
  }

  // Tier break: how far the drop is to the next player at this position. A big
  // gap means this pick captured the last of a tier; a small gap means several
  // similar players remain, so a positional "run" shouldn't be rewarded.
  const nextRank = availableAtPosition[0];
  const gap = Math.max(0, nextRank - playerRank);
  const tierScore = 50 + 40 * Math.tanh(gap / (teamCount * 0.9));

  // Supply vs demand: viable options left relative to teams that still need one.
  const viable = availableAtPosition.filter((r) => r - playerRank <= teamCount * 2.5).length;
  const demand = Math.max(1, teamsNeedingPosition);
  const ratio = viable / demand;
  const supplyScore = ratio <= 0.5 ? 85 : ratio <= 1 ? 68 : ratio <= 2 ? 52 : 40;

  return { score: clamp(0.6 * tierScore + 0.4 * supplyScore, 0, 100), weight: 0.15 };
}

// ── Factor: player quality ──────────────────────────────────────────────────

function gradeQuality(
  market: PlayerMarketData | undefined,
  round: number,
  totalRounds: number,
  positionProjections: number[]
): FactorScore {
  if (!market) {
    return { score: null, weight: 0.15, note: "No ranking or projection available." };
  }

  let score: number;
  let note: string | undefined;

  if (market.projectedPoints != null && positionProjections.length >= 5) {
    const better = positionProjections.filter((p) => p < market.projectedPoints!).length;
    const percentile = better / positionProjections.length;
    score = 25 + 65 * percentile;
  } else {
    // Without projections, caliber can only be read from consensus rank.
    score = clamp(95 - market.rank * 0.28, 25, 95);
    note = "Graded on ranking only — no projection available.";
  }

  // Early picks are held to a higher reliability standard; late picks get
  // credit for taking a swing rather than a safe non-contributor.
  const progress = round / Math.max(1, totalRounds);
  if (progress <= 0.2) score -= 6;
  else if (progress >= 0.6) score += 6;

  return { score: clamp(score, 0, 100), weight: 0.15, note };
}

// ── Factor: roster construction ─────────────────────────────────────────────

function gradeConstruction(
  pick: Pick,
  rosterBefore: { position: string; rank: number; nflTeam?: string }[],
  lineup: Lineup,
  round: number,
  totalRounds: number,
  byeWeeks: Map<string, number> | undefined,
  valueScore: number | null
): { factor: FactorScore; positives: string[]; concerns: string[] } {
  const positives: string[] = [];
  const concerns: string[] = [];
  let score = 60;

  const unfilled = unfilledStarterSlots(rosterBefore, lineup);
  const fillsSlot = Object.keys(unfilled).some((s) => positionFillsSlot(pick.playerPosition, s));
  if (fillsSlot) {
    score += 18;
    positives.push("Improves the projected starting lineup");
  }

  // Kicker or defense taken well before the end of the draft is a wasted slot.
  const isLateOnly = pick.playerPosition === "K" || pick.playerPosition === "DST";
  if (isLateOnly && round < totalRounds - 1) {
    score -= 26;
    concerns.push(`${pick.playerPosition} drafted earlier than necessary`);
  }

  // Excessive concentration at one position.
  const heldAtPos = rosterBefore.filter((p) => p.position === pick.playerPosition).length;
  if (heldAtPos >= usefulDepthCap(pick.playerPosition, lineup)) {
    score -= 16;
    concerns.push(`Already deep at ${pick.playerPosition}`);
  }

  // Bye-week pileup among players at the same position.
  if (byeWeeks && pick.nflTeam) {
    const bye = byeWeeks.get(pick.nflTeam.toUpperCase());
    if (bye != null) {
      const clash = rosterBefore.filter(
        (p) => p.position === pick.playerPosition && p.nflTeam && byeWeeks.get(p.nflTeam.toUpperCase()) === bye
      ).length;
      if (clash >= 1) {
        score -= 8;
        concerns.push(`Shares a week ${bye} bye with another ${pick.playerPosition}`);
      }
    }
  }

  // A stack is a small bonus, and only when the pick already made sense.
  if (pick.nflTeam && valueScore !== null && valueScore >= 45) {
    const sameTeam = rosterBefore.filter((p) => p.nflTeam === pick.nflTeam);
    const hasQb = sameTeam.some((p) => p.position === "QB");
    const isPassCatcher = pick.playerPosition === "WR" || pick.playerPosition === "TE";
    if ((hasQb && isPassCatcher) || (pick.playerPosition === "QB" && sameTeam.some((p) => p.position === "WR" || p.position === "TE"))) {
      score += 5;
      positives.push(`Stacks with their ${pick.nflTeam} teammate`);
    }
  }

  return { factor: { score: clamp(score, 0, 100), weight: 0.1 }, positives, concerns };
}

// ── Explanation ─────────────────────────────────────────────────────────────

function describePick(
  grade: Omit<PickGrade, "summary" | "positives" | "concerns">,
  extraPositives: string[],
  extraConcerns: string[],
  unfilledBefore: number
): { summary: string; positives: string[]; concerns: string[] } {
  const positives = [...extraPositives];
  const concerns = [...extraConcerns];
  const { factors, valueDelta, marketBasis } = grade;
  const basisWord = marketBasis === "adp" ? "ADP" : "consensus rank";

  let valuePhrase: string;
  if (valueDelta === null) {
    valuePhrase = "Market value could not be evaluated for this player";
  } else if (valueDelta >= 12) {
    valuePhrase = `Excellent value — ${Math.round(valueDelta)} picks after ${basisWord}`;
    positives.push(`Fell ${Math.round(valueDelta)} picks past ${basisWord}`);
  } else if (valueDelta >= 4) {
    valuePhrase = `Good value, ${Math.round(valueDelta)} picks after ${basisWord}`;
    positives.push(`Modest value against ${basisWord}`);
  } else if (valueDelta > -6) {
    valuePhrase = `Taken right around ${basisWord}`;
  } else if (valueDelta > -18) {
    valuePhrase = `A ${Math.abs(Math.round(valueDelta))}-pick reach`;
    concerns.push(`Reached ${Math.abs(Math.round(valueDelta))} picks ahead of ${basisWord}`);
  } else {
    valuePhrase = `A significant ${Math.abs(Math.round(valueDelta))}-pick reach`;
    concerns.push(`Reached well ahead of ${basisWord}`);
  }

  const needScore = factors.need.score ?? 50;
  let needPhrase: string;
  if (needScore >= 78) {
    needPhrase = "filling an open starting spot";
    positives.push("Filled a starting need");
  } else if (needScore >= 60) {
    needPhrase = "adding useful depth";
  } else if (unfilledBefore > 0) {
    needPhrase = `with ${unfilledBefore} starting ${unfilledBefore === 1 ? "spot" : "spots"} still unfilled`;
    concerns.push("More pressing starting needs remained");
  } else {
    needPhrase = "adding depth the roster did not need";
    concerns.push("Duplicated an already-deep position");
  }

  if ((factors.scarcity.score ?? 0) >= 72) {
    positives.push("Bought in at a positional tier break");
  }

  const summary =
    valueDelta === null
      ? `${valuePhrase}; graded on the other factors, ${needPhrase}.`
      : `${valuePhrase}, ${needPhrase}.`;

  return { summary, positives, concerns };
}

// ── Main entry point ────────────────────────────────────────────────────────

export function gradeDraft(input: GradingInput): DraftGradeReport {
  const { picks, teams, players, market, scoringType, teamCount, rounds, byeWeeks } = input;
  const lineup = resolveLineup(input.rosterPositions, scoringType, rounds);
  const dataNotes: string[] = [];

  if (!lineup.declared) {
    dataNotes.push(
      "No starting lineup was configured for this league, so a standard lineup was assumed. Need and roster grades are approximate."
    );
  }
  const anyAdp = [...market.values()].some((m) => m.adp != null);
  if (!anyAdp) {
    dataNotes.push(
      "No ADP data was available, so value was measured against consensus rankings rather than where players actually came off boards."
    );
  }
  const anyProjection = [...market.values()].some((m) => m.projectedPoints != null);
  if (!anyProjection) {
    dataNotes.push("No projections were available; player quality was graded on rankings alone.");
  }

  const ordered = [...picks].sort((a, b) => a.overallPickNumber - b.overallPickNumber);
  const playerById = new Map(players.map((p) => [p.id, p]));

  // Board state, advanced pick by pick so every judgement uses only what was
  // knowable at the time.
  const drafted = new Set<string>();
  const rosters = new Map<string, { position: string; rank: number; nflTeam?: string }[]>();
  for (const team of teams) rosters.set(team.id, []);

  const rankOf = (playerId: string) => market.get(playerId)?.rank ?? 9999;
  const pickGrades: PickGrade[] = [];

  for (const pick of ordered) {
    const roster = rosters.get(pick.teamId) ?? [];
    const rosterBefore = [...roster];
    const m = market.get(pick.playerId);
    const playerRank = m?.rank ?? null;

    // Remaining board at this position, ascending by rank.
    const availableAtPosition: number[] = [];
    const positionProjections: number[] = [];
    for (const p of players) {
      if (drafted.has(p.id) || p.id === pick.playerId) continue;
      if (p.position !== pick.playerPosition) continue;
      const pm = market.get(p.id);
      if (pm) {
        availableAtPosition.push(pm.rank);
        if (pm.projectedPoints != null) positionProjections.push(pm.projectedPoints);
      }
    }
    availableAtPosition.sort((a, b) => a - b);

    // How many other teams still need this position in their starting lineup.
    let teamsNeeding = 0;
    for (const [teamId, other] of rosters) {
      if (teamId === pick.teamId) continue;
      const unfilled = unfilledStarterSlots(other, lineup);
      if (Object.keys(unfilled).some((slot) => positionFillsSlot(pick.playerPosition, slot))) {
        teamsNeeding++;
      }
    }

    const unfilledBefore = Object.values(unfilledStarterSlots(rosterBefore, lineup)).reduce(
      (a, b) => a + b,
      0
    );

    const value = gradeValue(pick.overallPickNumber, m, teamCount);
    const need = gradeNeed(pick.playerPosition, rosterBefore, lineup);
    const scarcity = gradeScarcity(
      pick.playerPosition,
      playerRank,
      availableAtPosition,
      teamsNeeding,
      teamCount
    );
    const quality = gradeQuality(m, pick.round, rounds, positionProjections);
    const construction = gradeConstruction(
      pick,
      rosterBefore,
      lineup,
      pick.round,
      rounds,
      byeWeeks,
      value.factor.score
    );

    const factors = {
      value: value.factor,
      need,
      scarcity,
      quality,
      construction: construction.factor,
    };
    const raw = blend(Object.values(factors));
    const score = Math.round(calibrate(raw));

    const partial = {
      pickId: pick.id,
      teamId: pick.teamId,
      overallPickNumber: pick.overallPickNumber,
      round: pick.round,
      playerName: pick.playerName,
      playerPosition: pick.playerPosition,
      score,
      grade: letterGrade(score),
      marketBasis: value.basis,
      valueDelta: value.delta,
      factors,
    };
    const described = describePick(
      partial,
      construction.positives,
      construction.concerns,
      unfilledBefore
    );

    pickGrades.push({ ...partial, ...described });

    // Advance the board.
    drafted.add(pick.playerId);
    roster.push({
      position: pick.playerPosition,
      rank: rankOf(pick.playerId),
      nflTeam: pick.nflTeam ?? playerById.get(pick.playerId)?.nflTeam,
    });
    rosters.set(pick.teamId, roster);
  }

  const teamGrades = teams
    .map((team) =>
      buildTeamGrade(
        team,
        pickGrades.filter((g) => g.teamId === team.id),
        rosters.get(team.id) ?? [],
        lineup,
        rounds,
        byeWeeks
      )
    )
    .sort((a, b) => b.score - a.score);

  return {
    teams: teamGrades,
    picksByOverall: new Map(pickGrades.map((g) => [g.overallPickNumber, g])),
    lineup,
    dataNotes,
  };
}

/** Earlier picks matter more. The brief's weights are written for a ~15-round
 * draft; these scale by position through the draft so shorter and longer
 * drafts behave sensibly. */
function roundWeight(round: number, totalRounds: number): number {
  const progress = (round - 1) / Math.max(1, totalRounds);
  if (progress < 0.2) return 1.3;
  if (progress < 0.47) return 1.1;
  if (progress < 0.74) return 1.0;
  return 0.8;
}

function buildTeamGrade(
  team: Team,
  picks: PickGrade[],
  finalRoster: { position: string; rank: number; nflTeam?: string }[],
  lineup: Lineup,
  rounds: number,
  byeWeeks: Map<string, number> | undefined
): TeamGrade {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // 70% — weighted pick performance
  let weighted = 0;
  let weightSum = 0;
  for (const p of picks) {
    const w = roundWeight(p.round, rounds);
    weighted += p.score * w;
    weightSum += w;
  }
  const pickScore = weightSum > 0 ? weighted / weightSum : 50;

  // 20% — final roster construction
  const unfilled = unfilledStarterSlots(finalRoster, lineup);
  const unfilledTotal = Object.values(unfilled).reduce((a, b) => a + b, 0);
  let construction = 78;
  if (unfilledTotal > 0) {
    construction -= unfilledTotal * 14;
    weaknesses.push(
      `Could not fill ${unfilledTotal} starting ${unfilledTotal === 1 ? "spot" : "spots"} (${Object.keys(unfilled).join(", ")})`
    );
  } else {
    strengths.push("Fielded a complete starting lineup");
  }

  for (const position of ["QB", "TE", "K", "DST"]) {
    const held = finalRoster.filter((p) => p.position === position).length;
    const cap = usefulDepthCap(position, lineup);
    if (held > cap) {
      construction -= 9;
      weaknesses.push(`Over-invested at ${position} (${held} rostered)`);
    }
  }

  if (byeWeeks) {
    const byPositionWeek = new Map<string, number>();
    for (const p of finalRoster) {
      if (!p.nflTeam) continue;
      const bye = byeWeeks.get(p.nflTeam.toUpperCase());
      if (bye == null) continue;
      const key = `${p.position}:${bye}`;
      byPositionWeek.set(key, (byPositionWeek.get(key) ?? 0) + 1);
    }
    const clashes = [...byPositionWeek.values()].filter((n) => n >= 3).length;
    if (clashes > 0) {
      construction -= clashes * 6;
      weaknesses.push("Bye-week pileups at one or more positions");
    }
  }

  // 10% — strategy across the whole draft
  const withMarket = picks.filter((p) => p.valueDelta !== null);
  const avgValueDelta =
    withMarket.length > 0
      ? withMarket.reduce((a, p) => a + (p.valueDelta ?? 0), 0) / withMarket.length
      : 0;
  const bigReaches = withMarket.filter((p) => (p.valueDelta ?? 0) <= -18).length;
  const tierHits = picks.filter((p) => (p.factors.scarcity.score ?? 0) >= 72).length;

  let strategy = 60 + clamp(avgValueDelta * 1.6, -22, 22);
  strategy -= bigReaches * 7;
  strategy += Math.min(10, tierHits * 2.5);
  strategy = clamp(strategy, 0, 100);

  if (avgValueDelta >= 4) strengths.push("Consistently drafted below market value");
  if (bigReaches >= 3) weaknesses.push(`${bigReaches} significant reaches`);
  if (tierHits >= 3) strengths.push("Repeatedly bought in at tier breaks");

  const best = [...picks].sort((a, b) => b.score - a.score)[0];
  const worst = [...picks].sort((a, b) => a.score - b.score)[0];
  if (best && best.score >= 85) strengths.push(`Best pick: ${best.playerName}`);
  if (worst && worst.score <= 65) weaknesses.push(`Weakest pick: ${worst.playerName}`);

  const score = Math.round(
    clamp(pickScore * 0.7 + construction * 0.2 + calibrate(strategy) * 0.1, 0, 100)
  );
  const grade = letterGrade(score);

  const lead = strengths[0] ?? "A serviceable draft without a standout theme";
  const issue = weaknesses[0];
  const summary = issue
    ? `${grade} — ${lead}. ${issue} is the main concern.`
    : `${grade} — ${lead}.`;

  return {
    teamId: team.id,
    teamName: team.name,
    teamLogoUrl: team.logoUrl,
    score,
    grade,
    pickScore: Math.round(pickScore),
    constructionScore: Math.round(clamp(construction, 0, 100)),
    strategyScore: Math.round(calibrate(strategy)),
    summary,
    strengths,
    weaknesses,
    picks: picks.sort((a, b) => a.overallPickNumber - b.overallPickNumber),
  };
}
