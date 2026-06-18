import type { DraftSlot, Team } from "@/types/draft";

export function generateSnakeDraftOrder(
  teams: Team[],
  rounds: number
): DraftSlot[] {
  const slots: DraftSlot[] = [];

  for (let round = 1; round <= rounds; round++) {
    const isEvenRound = round % 2 === 0;
    const roundTeams = isEvenRound ? [...teams].reverse() : teams;

    roundTeams.forEach((team, index) => {
      const overallPickNumber = (round - 1) * teams.length + index + 1;

      slots.push({
        round,
        pickNumber: index + 1,
        overallPickNumber,
        teamId: team.id,
        teamName: team.name,
      });
    });
  }

  return slots;
}