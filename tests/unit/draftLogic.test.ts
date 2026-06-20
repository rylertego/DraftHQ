import { describe, expect, it } from "vitest";
import {
  getPickEligibility,
  getPickNumberInRound,
  getRoundForPick,
  getSnakeDraftPosition,
  getTeamOnClock,
  isDraftComplete,
  type PickEligibilityInput,
} from "@/lib/draftLogic";
import { generateSnakeDraftOrder } from "@/lib/draftOrder";
import type { Team } from "@/types/draft";

const teams: Team[] = Array.from({ length: 4 }, (_, index) => ({
  id: `team-${index + 1}`,
  draftId: "draft-1",
  name: `Team ${index + 1}`,
  draftPosition: index + 1,
}));

describe("draft pick coordinates", () => {
  it("calculates rounds across a round boundary", () => {
    expect(getRoundForPick(1, 4)).toBe(1);
    expect(getRoundForPick(4, 4)).toBe(1);
    expect(getRoundForPick(5, 4)).toBe(2);
  });

  it("calculates the pick number within each round", () => {
    expect(getPickNumberInRound(1, 4)).toBe(1);
    expect(getPickNumberInRound(4, 4)).toBe(4);
    expect(getPickNumberInRound(5, 4)).toBe(1);
  });

  it("reverses draft positions on even rounds", () => {
    expect(getSnakeDraftPosition(1, 1, 4)).toBe(1);
    expect(getSnakeDraftPosition(1, 4, 4)).toBe(4);
    expect(getSnakeDraftPosition(2, 1, 4)).toBe(4);
    expect(getSnakeDraftPosition(2, 4, 4)).toBe(1);
    expect(getSnakeDraftPosition(3, 1, 4)).toBe(1);
  });

  it("rejects invalid pick coordinates", () => {
    expect(() => getRoundForPick(0, 4)).toThrow(RangeError);
    expect(() => getPickNumberInRound(1, 0)).toThrow(RangeError);
    expect(() => getSnakeDraftPosition(1, 5, 4)).toThrow(RangeError);
  });
});

describe("getTeamOnClock", () => {
  it("uses draft positions rather than array order", () => {
    const unsortedTeams = [teams[2], teams[0], teams[3], teams[1]];

    expect(getTeamOnClock(unsortedTeams, 1, 2)?.id).toBe("team-1");
    expect(getTeamOnClock(unsortedTeams, 4, 2)?.id).toBe("team-4");
    expect(getTeamOnClock(unsortedTeams, 5, 2)?.id).toBe("team-4");
    expect(getTeamOnClock(unsortedTeams, 8, 2)?.id).toBe("team-1");
  });

  it("generates slots from explicit draft positions", () => {
    const unsortedTeams = [teams[2], teams[0], teams[3], teams[1]];
    const slots = generateSnakeDraftOrder(unsortedTeams, 2);

    expect(slots.map((slot) => slot.teamId)).toEqual([
      "team-1",
      "team-2",
      "team-3",
      "team-4",
      "team-4",
      "team-3",
      "team-2",
      "team-1",
    ]);
  });

  it("returns null after the final pick", () => {
    expect(getTeamOnClock(teams, 9, 2)).toBeNull();
  });
});

describe("isDraftComplete", () => {
  it("becomes complete only after the final pick is made", () => {
    expect(isDraftComplete(8, 4, 2)).toBe(false);
    expect(isDraftComplete(9, 4, 2)).toBe(true);
  });
});

describe("getPickEligibility", () => {
  const eligibleInput: PickEligibilityInput = {
    status: "active",
    currentPick: 1,
    rounds: 2,
    teams,
    participantTeamId: "team-1",
    participantRole: "owner",
    playerId: "player-1",
    playerIsActive: true,
    draftedPlayerIds: [],
  };

  it("allows the assigned owner to select an available player", () => {
    expect(getPickEligibility(eligibleInput)).toEqual({ eligible: true });
  });

  it("allows an assigned commissioner to pick for their team", () => {
    expect(
      getPickEligibility({
        ...eligibleInput,
        participantRole: "commissioner",
      })
    ).toEqual({ eligible: true });
  });

  it("rejects picks before the commissioner starts the draft", () => {
    expect(
      getPickEligibility({ ...eligibleInput, status: "setup" })
    ).toEqual({ eligible: false, reason: "draft_not_started" });
  });

  it.each([
    [
      { status: "paused" as const },
      "draft_paused",
    ],
    [
      { status: "complete" as const },
      "draft_complete",
    ],
    [
      { participantTeamId: null },
      "team_not_assigned",
    ],
    [
      { participantRole: "viewer" as const },
      "participant_not_owner",
    ],
    [
      { participantTeamId: "team-2" },
      "not_on_clock",
    ],
    [
      { playerId: null },
      "player_not_selected",
    ],
    [
      { playerIsActive: false },
      "player_unavailable",
    ],
    [
      { draftedPlayerIds: ["player-1"] },
      "player_already_drafted",
    ],
    [
      { currentPick: 9 },
      "draft_complete",
    ],
  ])("rejects an ineligible pick with %s", (changes, reason) => {
    expect(getPickEligibility({ ...eligibleInput, ...changes })).toEqual({
      eligible: false,
      reason,
    });
  });

  it("rejects malformed draft state", () => {
    expect(getPickEligibility({ ...eligibleInput, teams: [] })).toEqual({
      eligible: false,
      reason: "invalid_state",
    });
  });
});
