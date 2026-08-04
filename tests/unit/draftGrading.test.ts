import { describe, expect, it } from "vitest";
import {
  gradeDraft,
  letterGrade,
  resolveLineup,
  unfilledStarterSlots,
  type GradingInput,
} from "@/lib/draftGrading";
import type { PlayerMarketData } from "@/lib/rankingsApi";
import type { Pick, Player, RosterPosition, Team } from "@/types/draft";

const BASE = Date.parse("2026-09-01T19:00:00.000Z");

function team(id: string, name: string, draftPosition: number): Team {
  return { id, draftId: "d1", name, draftPosition };
}

function player(id: string, position: Player["position"], nflTeam = "KC"): Player {
  return {
    id,
    source: "test",
    fullName: `Player ${id}`,
    position,
    nflTeam,
    active: true,
    createdAt: new Date(BASE).toISOString(),
    updatedAt: new Date(BASE).toISOString(),
  };
}

function pick(
  overall: number,
  teamId: string,
  playerId: string,
  position: Pick["playerPosition"],
  round: number,
  nflTeam = "KC"
): Pick {
  return {
    id: `pick-${overall}`,
    draftId: "d1",
    teamId,
    playerId,
    round,
    pickNumber: overall,
    overallPickNumber: overall,
    playerName: `Player ${playerId}`,
    playerPosition: position,
    nflTeam,
    isLandmine: false,
    createdAt: new Date(BASE + overall * 30_000).toISOString(),
  };
}

function market(entries: Array<[string, number, number | null]>): Map<string, PlayerMarketData> {
  return new Map(
    entries.map(([id, rank, adp]) => [id, { rank, adp, projectedPoints: null }])
  );
}

describe("letterGrade", () => {
  it("maps the published scale", () => {
    expect(letterGrade(98)).toBe("A+");
    expect(letterGrade(93)).toBe("A");
    expect(letterGrade(90)).toBe("A-");
    expect(letterGrade(83)).toBe("B");
    expect(letterGrade(77)).toBe("C+");
    expect(letterGrade(70)).toBe("C-");
    expect(letterGrade(63)).toBe("D");
    expect(letterGrade(59)).toBe("F");
  });
});

describe("resolveLineup", () => {
  const rows = (overrides: Partial<RosterPosition>[] = []): RosterPosition[] =>
    [
      { id: "QB", label: "QB", abbrev: "QB", enabled: true, min: 0, max: 9, color: "#fff" },
      { id: "RB", label: "RB", abbrev: "RB", enabled: true, min: 0, max: 9, color: "#fff" },
      { id: "SUPERFLEX", label: "SF", abbrev: "SF", enabled: false, min: 0, max: 9, color: "#fff" },
    ].map((row) => ({ ...row, ...overrides.find((o) => o.id === row.id) }));

  it("uses a configured lineup when one exists", () => {
    const lineup = resolveLineup(
      rows([{ id: "QB", min: 1 } as RosterPosition, { id: "RB", min: 2 } as RosterPosition]),
      "ppr",
      15
    );
    expect(lineup.declared).toBe(true);
    expect(lineup.starters).toEqual({ QB: 1, RB: 2 });
    expect(lineup.benchSlots).toBe(12);
  });

  it("assumes a standard lineup when nothing is configured", () => {
    const lineup = resolveLineup(rows(), "ppr", 15);
    expect(lineup.declared).toBe(false);
    expect(lineup.starters.QB).toBe(1);
    expect(lineup.starters.FLEX).toBe(1);
    expect(lineup.starters.SUPERFLEX).toBeUndefined();
  });

  it("adds a superflex slot in superflex leagues", () => {
    expect(resolveLineup(null, "superflex", 15).starters.SUPERFLEX).toBe(1);
  });
});

describe("unfilledStarterSlots", () => {
  const lineup = { starters: { QB: 1, RB: 2, FLEX: 1 }, benchSlots: 5, declared: true };

  it("reports every slot open for an empty roster", () => {
    expect(unfilledStarterSlots([], lineup)).toEqual({ QB: 1, RB: 2, FLEX: 1 });
  });

  it("lets a surplus running back fill the flex", () => {
    const roster = [
      { position: "QB", rank: 10 },
      { position: "RB", rank: 5 },
      { position: "RB", rank: 20 },
      { position: "RB", rank: 40 },
    ];
    expect(unfilledStarterSlots(roster, lineup)).toEqual({});
  });

  it("does not let a quarterback fill a standard flex", () => {
    const roster = [
      { position: "QB", rank: 10 },
      { position: "QB", rank: 30 },
      { position: "RB", rank: 5 },
      { position: "RB", rank: 20 },
    ];
    expect(unfilledStarterSlots(roster, lineup)).toEqual({ FLEX: 1 });
  });
});

describe("gradeDraft", () => {
  const teams = [team("t1", "Alpha", 1), team("t2", "Bravo", 2)];
  const players = [
    player("a", "RB"), player("b", "WR"), player("c", "RB"), player("d", "WR"),
    player("e", "QB"), player("f", "TE"), player("g", "WR"), player("h", "RB"),
  ];

  function input(overrides: Partial<GradingInput> = {}): GradingInput {
    return {
      picks: [],
      teams,
      players,
      market: market([]),
      rosterPositions: null,
      scoringType: "ppr",
      teamCount: 2,
      rounds: 4,
      ...overrides,
    };
  }

  it("returns a grade for every team", () => {
    const picks = [
      pick(1, "t1", "a", "RB", 1),
      pick(2, "t2", "b", "WR", 1),
    ];
    const report = gradeDraft(input({ picks, market: market([["a", 1, 1], ["b", 2, 2]]) }));
    expect(report.teams).toHaveLength(2);
    expect(report.teams.every((t) => t.grade.length > 0)).toBe(true);
  });

  it("grades a faller above a reach", () => {
    const picks = [
      // Alpha reaches: the consensus #40 player taken 1st overall.
      pick(1, "t1", "a", "RB", 1),
      // Bravo gets value: the consensus #1 player still there at pick 30.
      pick(30, "t2", "c", "RB", 3),
    ];
    const report = gradeDraft(
      input({ picks, market: market([["a", 40, 40], ["c", 1, 1]]), rounds: 4 })
    );
    const reach = report.picksByOverall.get(1)!;
    const value = report.picksByOverall.get(30)!;
    expect(reach.valueDelta).toBe(-39);
    expect(value.valueDelta).toBe(29);
    expect(value.score).toBeGreaterThan(reach.score);
    expect(reach.concerns.join(" ")).toMatch(/reach/i);
  });

  it("does not punish a small reach of a few picks", () => {
    const picks = [pick(1, "t1", "a", "RB", 1)];
    const report = gradeDraft(input({ picks, market: market([["a", 6, 6]]) }));
    // Player ranked 6th taken 1st — 5 picks early, inside tolerance.
    expect(report.picksByOverall.get(1)!.factors.value.score).toBeGreaterThan(45);
  });

  it("applies diminishing returns so an extreme fall is not automatic perfection", () => {
    // Same pick slot, progressively bigger falls.
    const near = gradeDraft(input({
      picks: [pick(20, "t1", "a", "RB", 2)],
      market: market([["a", 10, 10]]),
      rounds: 4,
    })).picksByOverall.get(20)!.factors.value.score!;
    const extreme = gradeDraft(input({
      picks: [pick(20, "t1", "a", "RB", 2)],
      market: market([["a", 1, 1]]),
      rounds: 4,
    })).picksByOverall.get(20)!.factors.value.score!;
    expect(extreme).toBeGreaterThan(near);
    expect(extreme).toBeLessThan(100);
    // The extra 9 picks of fall are worth far less than the first 10.
    expect(extreme - near).toBeLessThan(near - 50);
  });

  it("uses ADP over rank when both exist and records the basis", () => {
    // Rank says elite, ADP says he lasts to 30 — taking him 1st is a reach
    // against the market even though he is the top-ranked player.
    const withAdp = gradeDraft(input({
      picks: [pick(1, "t1", "a", "RB", 1)],
      market: new Map([["a", { rank: 1, adp: 30, projectedPoints: null }]]),
    })).picksByOverall.get(1)!;
    expect(withAdp.marketBasis).toBe("adp");
    expect(withAdp.valueDelta).toBe(-29);

    const rankOnly = gradeDraft(input({
      picks: [pick(1, "t1", "a", "RB", 1)],
      market: market([["a", 1, null]]),
    })).picksByOverall.get(1)!;
    expect(rankOnly.marketBasis).toBe("rank");
  });

  it("does not zero a pick when market data is missing", () => {
    const report = gradeDraft(input({ picks: [pick(1, "t1", "a", "RB", 1)], market: market([]) }));
    const graded = report.picksByOverall.get(1)!;
    expect(graded.marketBasis).toBe("none");
    expect(graded.valueDelta).toBeNull();
    expect(graded.score).toBeGreaterThan(50);
    expect(graded.summary).toMatch(/could not be evaluated/i);
  });

  it("treats a second quarterback differently in superflex", () => {
    const picks = [
      pick(1, "t1", "e", "QB", 1),
      pick(2, "t2", "b", "WR", 1),
      pick(3, "t2", "c", "RB", 2),
      pick(4, "t1", "f", "QB", 2),
    ];
    const m = market([["e", 1, 1], ["b", 2, 2], ["c", 3, 3], ["f", 4, 4]]);
    const oneQb = gradeDraft(input({ picks, market: m, scoringType: "ppr" }));
    const superflex = gradeDraft(input({ picks, market: m, scoringType: "superflex" }));
    const needOne = oneQb.picksByOverall.get(4)!.factors.need.score!;
    const needSf = superflex.picksByOverall.get(4)!.factors.need.score!;
    expect(needSf).toBeGreaterThan(needOne);
  });

  it("flags an early kicker as a construction concern", () => {
    const picks = [pick(1, "t1", "a", "K", 1)];
    const report = gradeDraft(input({ picks, market: market([["a", 1, 1]]), rounds: 10 }));
    const graded = report.picksByOverall.get(1)!;
    expect(graded.concerns.join(" ")).toMatch(/earlier than necessary/i);
  });

  it("notes assumed lineup and missing market data", () => {
    const report = gradeDraft(input({ picks: [pick(1, "t1", "a", "RB", 1)] }));
    expect(report.dataNotes.join(" ")).toMatch(/standard lineup was assumed/i);
    expect(report.dataNotes.join(" ")).toMatch(/No ADP data/i);
  });

  it("centres an ordinary draft near a C+/B- rather than an A", () => {
    // Every player taken exactly at their ADP: unremarkable process.
    const picks = [
      pick(1, "t1", "a", "RB", 1), pick(2, "t2", "b", "WR", 1),
      pick(3, "t2", "c", "RB", 2), pick(4, "t1", "d", "WR", 2),
      pick(5, "t1", "e", "QB", 3), pick(6, "t2", "f", "TE", 3),
      pick(7, "t2", "g", "WR", 4), pick(8, "t1", "h", "RB", 4),
    ];
    const m = market(
      picks.map((p) => [p.playerId, p.overallPickNumber, p.overallPickNumber] as [string, number, number])
    );
    const report = gradeDraft(input({ picks, market: m }));
    for (const t of report.teams) {
      expect(t.score).toBeGreaterThanOrEqual(70);
      expect(t.score).toBeLessThan(90);
    }
  });

  it("produces an explanation that matches the pick's factors", () => {
    // Consensus #10 player still available at pick 40 — a 30-pick fall.
    const picks = [pick(40, "t1", "a", "RB", 4)];
    const report = gradeDraft(input({ picks, market: market([["a", 10, 10]]), rounds: 4 }));
    const graded = report.picksByOverall.get(40)!;
    expect(graded.valueDelta).toBe(30);
    expect(graded.summary).toMatch(/value/i);
    expect(graded.positives.join(" ")).toMatch(/fell 30 picks/i);
  });

  it("penalises reaching, in the explanation as well as the score", () => {
    const picks = [pick(1, "t1", "a", "RB", 1)];
    const report = gradeDraft(input({ picks, market: market([["a", 45, 45]]), rounds: 4 }));
    const graded = report.picksByOverall.get(1)!;
    expect(graded.valueDelta).toBe(-44);
    expect(graded.factors.value.score!).toBeLessThan(20);
    expect(graded.summary).toMatch(/reach/i);
  });
});
