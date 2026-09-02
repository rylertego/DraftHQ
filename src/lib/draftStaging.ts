import { getTeamOnClock } from "@/lib/draftLogic";
import type { DraftParticipant, Team } from "@/types/draft";

/** userId → the player that user currently has staged. */
export type StagedByUserId = Record<string, string>;

export interface OnClockStagingInput {
  teams: readonly Team[];
  currentPick: number;
  rounds: number;
  participants: readonly DraftParticipant[];
  /** This client's own user, whose staging is known locally before it lands. */
  currentUserId: string | null;
  localStagedPlayerId: string | null;
  /** Staged players published by everyone else over presence. */
  stagedByUserId: StagedByUserId;
}

/**
 * The staged player of the team currently on the clock, or null.
 *
 * This is the gate for announcing "the pick is in". Keying off the team on the
 * clock rather than off whoever staged is what keeps an early pick quiet: an
 * owner who queues three turns ahead publishes their staging immediately, but
 * it stays invisible to the room until the clock reaches them.
 *
 * The current user's own staging is read from local state rather than the
 * presence map, so their own indicator does not wait for the round trip.
 */
export function resolveOnClockStagedPlayerId({
  teams,
  currentPick,
  rounds,
  participants,
  currentUserId,
  localStagedPlayerId,
  stagedByUserId,
}: OnClockStagingInput): string | null {
  if (teams.length === 0 || rounds <= 0) return null;

  const onClockTeam = getTeamOnClock(teams, currentPick, rounds);
  if (!onClockTeam) return null;

  const onClockUserId = participants.find(
    (participant) => participant.teamId === onClockTeam.id
  )?.userId;
  if (!onClockUserId) return null;

  if (currentUserId && onClockUserId === currentUserId) {
    return localStagedPlayerId;
  }

  return stagedByUserId[onClockUserId] ?? null;
}
