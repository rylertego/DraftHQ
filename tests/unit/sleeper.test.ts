import { describe, expect, it } from "vitest";
import {
  buildSleeperLeaguePreview,
  normalizeSleeperLeagueId,
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
