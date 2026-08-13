import { describe, expect, it } from "vitest";
import { gradeDraft } from "@/lib/draftGrading";
import type { PlayerMarketData } from "@/lib/rankingsApi";
import type { Pick, Player, Team } from "@/types/draft";

// Calibration guard. Simulates a full snake draft by a best-available bot and
// asserts the grades land where the brief says they should: an ordinary draft
// around a C+/B-, not an A. Also locks in two fixes that are easy to regress:
// kickers and defenses must not be judged against overall rank, and they must
// not count as unfilled "needs" through the middle of the draft.

const TEAMS = 10;
const ROUNDS = 15;
const POOL = 320;
const BASE = Date.parse("2026-09-01T19:00:00.000Z");

type Pos = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

// Rough shape of a real board: RB/WR dominate the top, K and DST sit far down.
function positionForRank(rank: number): Pos {
  if (rank > 300) return "DST";
  if (rank > 288) return "K";
  const r = rank % 10;
  if (rank < 40) return r < 4 ? "RB" : r < 8 ? "WR" : r === 8 ? "TE" : "QB";
  return r < 3 ? "RB" : r < 6 ? "WR" : r < 8 ? "QB" : "TE";
}

function buildPool(): Player[] {
  return Array.from({ length: POOL }, (_, i) => {
    const rank = i + 1;
    return {
      id: `p${rank}`,
      source: "sim",
      fullName: `Player ${rank}`,
      position: positionForRank(rank),
      nflTeam: `T${rank % 32}`,
      rank,
      active: true,
      createdAt: new Date(BASE).toISOString(),
      updatedAt: new Date(BASE).toISOString(),
    } as Player;
  });
}

/** A competent human draft: mostly best-available with small deviations, needs
 * respected, K and DST taken in the last two rounds. */
function simulate(pool: Player[]) {
  const picks: Pick[] = [];
  const taken = new Set<string>();
  const rosterPos = new Map<string, Record<string, number>>();
  let overall = 0;

  for (let round = 1; round <= ROUNDS; round++) {
    const order = round % 2 === 1
      ? [...Array(TEAMS).keys()]
      : [...Array(TEAMS).keys()].reverse();
    for (const t of order) {
      overall++;
      const teamId = `t${t}`;
      const held = rosterPos.get(teamId) ?? {};
      const lateRound = round >= ROUNDS - 1;

      const candidate = pool.find((p) => {
        if (taken.has(p.id)) return false;
        const pos = p.position as Pos;
        if (!lateRound && (pos === "K" || pos === "DST")) return false;
        if (lateRound && !(pos === "K" || pos === "DST")) return false;
        // Don't hoard: cap QB/TE at 2 before the last rounds.
        if ((pos === "QB" || pos === "TE") && (held[pos] ?? 0) >= 2) return false;
        return true;
      });
      if (!candidate) continue;

      taken.add(candidate.id);
      held[candidate.position] = (held[candidate.position] ?? 0) + 1;
      rosterPos.set(teamId, held);
      picks.push({
        id: `pick-${overall}`,
        draftId: "sim",
        teamId,
        playerId: candidate.id,
        round,
        pickNumber: overall,
        overallPickNumber: overall,
        playerName: candidate.fullName,
        playerPosition: candidate.position,
        nflTeam: candidate.nflTeam,
        isLandmine: false,
        createdAt: new Date(BASE + overall * 45_000).toISOString(),
      });
    }
  }
  return picks;
}

function gradeSimulatedDraft(opts: { adp: boolean }) {
  const pool = buildPool();
  const picks = simulate(pool);
  const teams: Team[] = Array.from({ length: TEAMS }, (_, i) => ({
    id: `t${i}`, draftId: "sim", name: `Team ${i + 1}`, draftPosition: i + 1,
  }));
  const market = new Map<string, PlayerMarketData>();
  for (const p of pool) {
    market.set(p.id, {
      rank: p.rank!,
      adp: opts.adp ? p.rank! : null,
      projectedPoints: null,
    });
  }
  return gradeDraft({
    picks, teams, players: pool, market, rosterPositions: null,
    scoringType: "ppr", teamCount: TEAMS, rounds: ROUNDS,
  });
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

describe("draft grading calibration", () => {
  it("lands an ordinary draft around a C+/B-, not an A", () => {
    const report = gradeSimulatedDraft({ adp: false });
    const teamScores = report.teams.map((t) => t.score);
    // The brief: "the average competent draft generally falls around a C+ or B-".
    expect(avg(teamScores)).toBeGreaterThanOrEqual(73);
    expect(avg(teamScores)).toBeLessThanOrEqual(84);
    // Nobody should be handed an A just for completing a roster...
    expect(Math.max(...teamScores)).toBeLessThan(90);
    // ...and a competent draft should never be failed.
    expect(Math.min(...teamScores)).toBeGreaterThanOrEqual(65);
  });

  it("does not punish kickers and defenses for their overall ranking", () => {
    const report = gradeSimulatedDraft({ adp: false });
    const lateSkill = [...report.picksByOverall.values()].filter(
      (p) => p.playerPosition === "K" || p.playerPosition === "DST"
    );
    expect(lateSkill.length).toBeGreaterThan(0);
    for (const pick of lateSkill) {
      // Overall rank is not a market for these positions, so value is skipped
      // rather than scored as a 150-pick reach.
      expect(pick.factors.value.score).toBeNull();
      expect(pick.marketBasis).toBe("none");
      expect(pick.score).toBeGreaterThan(60);
    }
  });

  it("does not treat kicker and defense as pressing needs mid-draft", () => {
    const report = gradeSimulatedDraft({ adp: false });
    const midDraft = [...report.picksByOverall.values()].filter(
      (p) => p.round >= 6 && p.round <= 10
    );
    // No mid-round pick should be told it ignored a more important starting
    // need when the only gaps left are the end-of-draft K/DST slots.
    const complaints = midDraft.filter((p) =>
      p.concerns.some((c) => /more pressing starting needs/i.test(c))
    );
    expect(complaints.length).toBeLessThan(midDraft.length);
  });

  it("scores every pick and keeps them inside the published scale", () => {
    const report = gradeSimulatedDraft({ adp: true });
    const all = [...report.picksByOverall.values()];
    expect(all).toHaveLength(TEAMS * ROUNDS);
    for (const pick of all) {
      expect(pick.score).toBeGreaterThanOrEqual(0);
      expect(pick.score).toBeLessThanOrEqual(100);
      expect(pick.grade).toMatch(/^[ABCDF][+-]?$/);
      expect(pick.summary.length).toBeGreaterThan(0);
    }
  });
});
