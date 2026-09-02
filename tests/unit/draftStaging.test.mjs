import { describe, expect, it } from "vitest";
import { resolveOnClockStagedPlayerId } from "../../src/lib/draftStaging.ts";

// 3 teams, snake order. Pick 1 is team A, pick 2 team B, pick 3 team C,
// pick 4 team C again (round 2 reverses).
const teams = [
  { id: "team-a", draftPosition: 1 },
  { id: "team-b", draftPosition: 2 },
  { id: "team-c", draftPosition: 3 },
];

const participants = [
  { teamId: "team-a", userId: "user-a" },
  { teamId: "team-b", userId: "user-b" },
  { teamId: "team-c", userId: "user-c" },
];

const base = {
  teams,
  rounds: 3,
  participants,
  currentUserId: "user-b",
  localStagedPlayerId: null,
  stagedByUserId: {},
};

describe("resolveOnClockStagedPlayerId", () => {
  it("surfaces the staged player of the team on the clock", () => {
    expect(
      resolveOnClockStagedPlayerId({
        ...base,
        currentPick: 1,
        stagedByUserId: { "user-a": "player-1" },
      })
    ).toBe("player-1");
  });

  it("stays silent when someone stages before their turn", () => {
    // user-c has staged, but team A is on the clock.
    expect(
      resolveOnClockStagedPlayerId({
        ...base,
        currentPick: 1,
        stagedByUserId: { "user-c": "player-9" },
      })
    ).toBeNull();
  });

  it("surfaces that same early stage once the clock reaches them", () => {
    // Pick 3 is team C in a 3 team round.
    expect(
      resolveOnClockStagedPlayerId({
        ...base,
        currentPick: 3,
        stagedByUserId: { "user-c": "player-9" },
      })
    ).toBe("player-9");
  });

  it("prefers local state for the current user, so their own shows instantly", () => {
    expect(
      resolveOnClockStagedPlayerId({
        ...base,
        currentPick: 2,
        currentUserId: "user-b",
        localStagedPlayerId: "player-local",
        stagedByUserId: { "user-b": "player-stale" },
      })
    ).toBe("player-local");
  });

  it("reports nothing staged when the on-clock owner has not staged", () => {
    expect(
      resolveOnClockStagedPlayerId({
        ...base,
        currentPick: 1,
        stagedByUserId: {},
      })
    ).toBeNull();
  });

  it("reports nothing when the on-clock team has no owner seated", () => {
    expect(
      resolveOnClockStagedPlayerId({
        ...base,
        currentPick: 1,
        participants: [{ teamId: "team-b", userId: "user-b" }],
        stagedByUserId: { "user-a": "player-1" },
      })
    ).toBeNull();
  });

  it("reports nothing once the draft has run out of picks", () => {
    expect(
      resolveOnClockStagedPlayerId({
        ...base,
        currentPick: 10, // beyond 3 teams x 3 rounds
        stagedByUserId: { "user-a": "player-1" },
      })
    ).toBeNull();
  });

  it("follows the snake back through round two", () => {
    // Pick 4 opens round 2, which reverses: team C picks again.
    expect(
      resolveOnClockStagedPlayerId({
        ...base,
        currentPick: 4,
        stagedByUserId: { "user-c": "player-9" },
      })
    ).toBe("player-9");
  });
});
