import { describe, expect, it } from "vitest";
import {
  getAssignedTeamIds,
  getParticipantAccessState,
  getParticipantForUser,
  normalizeJoinCode,
} from "@/lib/participantLogic";
import type { DraftParticipant } from "@/types/draft";

function makeParticipant(
  changes: Partial<DraftParticipant> = {}
): DraftParticipant {
  return {
    id: "participant-1",
    draftId: "draft-1",
    userId: "user-1",
    teamId: null,
    displayName: "Owner One",
    role: "owner",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
    ...changes,
  };
}

describe("normalizeJoinCode", () => {
  it("trims and uppercases a join code", () => {
    expect(normalizeJoinCode("  ab12cd34 ")).toBe("AB12CD34");
  });
});

describe("getParticipantForUser", () => {
  it("finds the participant for the current user", () => {
    const participant = makeParticipant();

    expect(getParticipantForUser([participant], "user-1")).toBe(participant);
    expect(getParticipantForUser([participant], "missing-user")).toBeNull();
  });
});

describe("getParticipantAccessState", () => {
  it("distinguishes every participant access state", () => {
    expect(getParticipantAccessState(null)).toEqual({ kind: "not_joined" });
    expect(
      getParticipantAccessState(makeParticipant({ role: "viewer" }))
    ).toEqual({ kind: "viewer" });
    expect(getParticipantAccessState(makeParticipant())).toEqual({
      kind: "unassigned",
    });
    expect(
      getParticipantAccessState(makeParticipant({ teamId: "team-1" }))
    ).toEqual({ kind: "assigned", teamId: "team-1" });
  });
});

describe("getAssignedTeamIds", () => {
  it("returns assigned teams and can exclude the participant being edited", () => {
    const first = makeParticipant({ teamId: "team-1" });
    const second = makeParticipant({
      id: "participant-2",
      userId: "user-2",
      teamId: "team-2",
    });

    expect(getAssignedTeamIds([first, second])).toEqual([
      "team-1",
      "team-2",
    ]);
    expect(getAssignedTeamIds([first, second], "participant-1")).toEqual([
      "team-2",
    ]);
  });
});
