import { describe, expect, it } from "vitest";
import {
  buildSleeperLeaguePreview,
  normalizeSleeperLeagueId,
  parseSleeperLineup,
  inferSleeperScoring,
  applyLineupToRosterPositions,
} from "@/lib/sleeper";

const league = {
  league_id: "123456789",
  name: "Sunday League",
  total_rosters: 2,
  roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF", "BN"],
};
const users = [
  {
    user_id: "user-1",
    display_name: "Alex",
    metadata: { team_name: "Alpha Squad" },
  },
  { user_id: "user-2", display_name: "Blake", metadata: {} },
];
const rosters = [
  { roster_id: 1, owner_id: "user-1" },
  { roster_id: 2, owner_id: "user-2" },
];

describe("normalizeSleeperLeagueId", () => {
  it("normalizes a numeric league ID", () => {
    expect(normalizeSleeperLeagueId(" 123456789 ")).toBe("123456789");
  });

  it.each(["", "1234", "league-123"])("rejects invalid ID %s", (value) => {
    expect(normalizeSleeperLeagueId(value)).toBeNull();
  });
});

describe("buildSleeperLeaguePreview", () => {
  it("maps managers, team names, rounds, and draft order", () => {
    const preview = buildSleeperLeaguePreview({
      league,
      users,
      rosters,
      drafts: [
        {
          draft_id: "987654321",
          created: 10,
          settings: { rounds: 16 },
          draft_order: { "user-1": 2, "user-2": 1 },
        },
      ],
    });

    expect(preview).toMatchObject({
      leagueId: "123456789",
      draftId: "987654321",
      leagueName: "Sunday League",
      rounds: 16,
      warnings: [],
    });
    expect(preview.teams.map((team) => team.managerName)).toEqual([
      "Blake",
      "Alex",
    ]);
    expect(preview.teams.map((team) => team.teamName)).toEqual([
      "Blake's Team",
      "Alpha Squad",
    ]);
  });

  it("falls back to roster order and reports missing owners", () => {
    const preview = buildSleeperLeaguePreview({
      league,
      users,
      rosters: [
        { roster_id: 2, owner_id: null },
        { roster_id: 1, owner_id: "user-1" },
      ],
      drafts: [],
    });

    expect(preview.teams.map((team) => team.rosterId)).toEqual([1, 2]);
    expect(preview.rounds).toBe(8);
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("does not have a primary owner"),
        expect.stringContaining("roster order is used"),
      ])
    );
  });

  it("rejects malformed Sleeper responses", () => {
    expect(() =>
      buildSleeperLeaguePreview({
        league: null,
        users,
        rosters,
        drafts: [],
      })
    ).toThrow("invalid league");
  });
});

describe("parseSleeperLineup", () => {
  it("counts starters, bench, and total slots", () => {
    const lineup = parseSleeperLineup([
      "QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF", "BN", "BN", "BN",
    ]);
    expect(lineup).toEqual({
      starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
      benchSlots: 3,
      totalSlots: 12,
    });
  });

  it("maps superflex and collapses rec flex onto FLEX", () => {
    const lineup = parseSleeperLineup(["QB", "SUPER_FLEX", "REC_FLEX", "WRRB_FLEX", "BN"]);
    expect(lineup?.starters).toEqual({ QB: 1, SUPERFLEX: 1, FLEX: 2 });
  });

  it("excludes IR and taxi slots from starters", () => {
    const lineup = parseSleeperLineup(["QB", "IR", "TAXI", "BN"]);
    expect(lineup?.starters).toEqual({ QB: 1 });
    expect(lineup?.benchSlots).toBe(1);
  });

  it("returns null when there is nothing startable", () => {
    expect(parseSleeperLineup([])).toBeNull();
    expect(parseSleeperLineup(["BN", "BN"])).toBeNull();
    expect(parseSleeperLineup(undefined)).toBeNull();
  });
});

describe("inferSleeperScoring", () => {
  it("reads points per reception", () => {
    expect(inferSleeperScoring({ rec: 1 }, null)).toBe("ppr");
    expect(inferSleeperScoring({ rec: 0.5 }, null)).toBe("half_ppr");
    expect(inferSleeperScoring({ rec: 0 }, null)).toBe("standard");
  });

  it("prefers superflex when the lineup has a superflex slot", () => {
    const lineup = parseSleeperLineup(["QB", "SUPER_FLEX", "BN"]);
    expect(inferSleeperScoring({ rec: 1 }, lineup)).toBe("superflex");
  });

  it("returns null when scoring settings are unusable", () => {
    expect(inferSleeperScoring(null, null)).toBeNull();
    expect(inferSleeperScoring({}, null)).toBeNull();
  });
});

describe("applyLineupToRosterPositions", () => {
  const rows = [
    { id: "QB", enabled: true, min: 0, max: 9 },
    { id: "RB", enabled: true, min: 0, max: 9 },
    { id: "SUPERFLEX", enabled: false, min: 0, max: 9 },
    { id: "K", enabled: true, min: 0, max: 9 },
  ];

  it("sets minimums from the lineup and enables used slots", () => {
    const lineup = parseSleeperLineup(["QB", "RB", "RB", "SUPER_FLEX"])!;
    const applied = applyLineupToRosterPositions(rows, lineup);
    expect(applied.find((r) => r.id === "QB")).toMatchObject({ min: 1, enabled: true });
    expect(applied.find((r) => r.id === "RB")).toMatchObject({ min: 2, enabled: true });
    expect(applied.find((r) => r.id === "SUPERFLEX")).toMatchObject({ min: 1, enabled: true });
  });

  it("leaves unused positions with no starting requirement", () => {
    const lineup = parseSleeperLineup(["QB", "RB"])!;
    const applied = applyLineupToRosterPositions(rows, lineup);
    expect(applied.find((r) => r.id === "K")?.min).toBe(0);
  });
});
