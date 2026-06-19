import type { DraftParticipant } from "@/types/draft";

export type ParticipantAccessState =
  | { kind: "not_joined" }
  | { kind: "viewer" }
  | { kind: "unassigned" }
  | { kind: "assigned"; teamId: string };

export function normalizeJoinCode(value: string) {
  return value.trim().toUpperCase();
}

export function getParticipantForUser(
  participants: readonly DraftParticipant[],
  userId: string
) {
  return participants.find((participant) => participant.userId === userId) ?? null;
}

export function getParticipantAccessState(
  participant: DraftParticipant | null
): ParticipantAccessState {
  if (!participant) {
    return { kind: "not_joined" };
  }

  if (participant.role === "viewer") {
    return { kind: "viewer" };
  }

  if (!participant.teamId) {
    return { kind: "unassigned" };
  }

  return { kind: "assigned", teamId: participant.teamId };
}

export function getAssignedTeamIds(
  participants: readonly DraftParticipant[],
  excludedParticipantId?: string
) {
  return participants.flatMap((participant) => {
    if (
      participant.id === excludedParticipantId ||
      participant.teamId === null
    ) {
      return [];
    }

    return [participant.teamId];
  });
}
