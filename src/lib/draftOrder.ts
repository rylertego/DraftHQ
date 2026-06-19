import type { DraftSlot, Team } from "@/types/draft";
import { getSnakeDraftPosition } from "@/lib/draftLogic";

export function generateSnakeDraftOrder(
  teams: Team[],
  rounds: number
): DraftSlot[] {
  const slots: DraftSlot[] = [];

  for (let round = 1; round <= rounds; round++) {
    for (let pickNumber = 1; pickNumber <= teams.length; pickNumber++) {
      const draftPosition = getSnakeDraftPosition(
        round,
        pickNumber,
        teams.length
      );
      const team = teams.find(
        (candidate) => candidate.draftPosition === draftPosition
      );

      if (!team) {
        throw new Error(`Missing team at draft position ${draftPosition}.`);
      }

      const overallPickNumber =
        (round - 1) * teams.length + pickNumber;

      slots.push({
        round,
        pickNumber,
        overallPickNumber,
        teamId: team.id,
        teamName: team.name,
      });
    }
  }

  return slots;
}
