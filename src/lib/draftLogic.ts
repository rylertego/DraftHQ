import type { DraftRole, DraftStatus, Team } from "@/types/draft";

export type PickEligibilityReason =
  | "draft_not_started"
  | "draft_paused"
  | "draft_complete"
  | "invalid_state"
  | "team_not_assigned"
  | "participant_not_owner"
  | "not_on_clock"
  | "player_not_selected"
  | "player_unavailable"
  | "player_already_drafted";

export type PickEligibility =
  | { eligible: true }
  | { eligible: false; reason: PickEligibilityReason };

export interface PickEligibilityInput {
  status: DraftStatus;
  currentPick: number;
  rounds: number;
  teams: readonly Team[];
  participantTeamId: string | null;
  participantRole: DraftRole | null;
  playerId: string | null;
  playerIsActive: boolean;
  draftedPlayerIds: readonly string[];
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
}

export function getRoundForPick(
  overallPickNumber: number,
  teamCount: number
) {
  assertPositiveInteger(overallPickNumber, "Overall pick number");
  assertPositiveInteger(teamCount, "Team count");

  return Math.floor((overallPickNumber - 1) / teamCount) + 1;
}

export function getPickNumberInRound(
  overallPickNumber: number,
  teamCount: number
) {
  assertPositiveInteger(overallPickNumber, "Overall pick number");
  assertPositiveInteger(teamCount, "Team count");

  return ((overallPickNumber - 1) % teamCount) + 1;
}

export function getSnakeDraftPosition(
  round: number,
  pickNumber: number,
  teamCount: number
) {
  assertPositiveInteger(round, "Round");
  assertPositiveInteger(pickNumber, "Pick number");
  assertPositiveInteger(teamCount, "Team count");

  if (pickNumber > teamCount) {
    throw new RangeError("Pick number cannot exceed team count.");
  }

  return round % 2 === 1 ? pickNumber : teamCount - pickNumber + 1;
}

export function isDraftComplete(
  currentPick: number,
  teamCount: number,
  rounds: number
) {
  assertPositiveInteger(currentPick, "Current pick");
  assertPositiveInteger(teamCount, "Team count");
  assertPositiveInteger(rounds, "Rounds");

  return currentPick > teamCount * rounds;
}

export function getTeamOnClock(
  teams: readonly Team[],
  currentPick: number,
  rounds: number
) {
  const teamCount = teams.length;

  assertPositiveInteger(teamCount, "Team count");
  assertPositiveInteger(rounds, "Rounds");

  if (isDraftComplete(currentPick, teamCount, rounds)) {
    return null;
  }

  const round = getRoundForPick(currentPick, teamCount);
  const pickNumber = getPickNumberInRound(currentPick, teamCount);
  const draftPosition = getSnakeDraftPosition(round, pickNumber, teamCount);

  return teams.find((team) => team.draftPosition === draftPosition) ?? null;
}

export type TeamPickStatus =
  | { state: "unassigned" }
  | { state: "complete"; teamId: string }
  | {
      state: "on_clock" | "upcoming";
      teamId: string;
      round: number;
      pickNumber: number;
      overallPickNumber: number;
      picksAway: number;
    };

export function getTeamPickStatus(
  teams: readonly Team[],
  teamId: string | null,
  currentPick: number,
  rounds: number
): TeamPickStatus {
  if (!teamId) return { state: "unassigned" };

  assertPositiveInteger(currentPick, "Current pick");
  assertPositiveInteger(rounds, "Rounds");

  const teamCount = teams.length;
  assertPositiveInteger(teamCount, "Team count");

  for (
    let overallPickNumber = currentPick;
    overallPickNumber <= teamCount * rounds;
    overallPickNumber += 1
  ) {
    const team = getTeamOnClock(teams, overallPickNumber, rounds);
    if (team?.id !== teamId) continue;

    const pickNumber = getPickNumberInRound(overallPickNumber, teamCount);
    return {
      state: overallPickNumber === currentPick ? "on_clock" : "upcoming",
      teamId,
      round: getRoundForPick(overallPickNumber, teamCount),
      pickNumber,
      overallPickNumber,
      picksAway: overallPickNumber - currentPick,
    };
  }

  return { state: "complete", teamId };
}

export function getPickEligibility(
  input: PickEligibilityInput
): PickEligibility {
  const {
    status,
    currentPick,
    rounds,
    teams,
    participantTeamId,
    participantRole,
    playerId,
    playerIsActive,
    draftedPlayerIds,
  } = input;

  if (status === "complete") {
    return { eligible: false, reason: "draft_complete" };
  }

  if (status === "paused") {
    return { eligible: false, reason: "draft_paused" };
  }

  if (status === "setup") {
    return { eligible: false, reason: "draft_not_started" };
  }

  let teamOnClock: Team | null;

  try {
    if (isDraftComplete(currentPick, teams.length, rounds)) {
      return { eligible: false, reason: "draft_complete" };
    }

    teamOnClock = getTeamOnClock(teams, currentPick, rounds);
  } catch {
    return { eligible: false, reason: "invalid_state" };
  }

  if (!teamOnClock) {
    return { eligible: false, reason: "invalid_state" };
  }

  if (!participantTeamId) {
    return { eligible: false, reason: "team_not_assigned" };
  }

  if (participantRole !== "owner" && participantRole !== "commissioner") {
    return { eligible: false, reason: "participant_not_owner" };
  }

  if (participantTeamId !== teamOnClock.id) {
    return { eligible: false, reason: "not_on_clock" };
  }

  if (!playerId) {
    return { eligible: false, reason: "player_not_selected" };
  }

  if (!playerIsActive) {
    return { eligible: false, reason: "player_unavailable" };
  }

  if (draftedPlayerIds.includes(playerId)) {
    return { eligible: false, reason: "player_already_drafted" };
  }

  return { eligible: true };
}
