import { generateSnakeDraftOrder } from "@/lib/draftOrder";
import { Team } from "@/types/draft";

interface DraftBoardProps {
  teams: string[];
  rounds: number;
}

export default function DraftBoard({ teams, rounds }: DraftBoardProps) {
  const teamObjects: Team[] = teams.map((name, index) => ({
    id: String(index + 1),
    draftId: "local",
    name,
    draftPosition: index + 1,
  }));

  const slots = generateSnakeDraftOrder(teamObjects, rounds);

  return (
    <div className="overflow-auto">
      <table className="border-collapse border border-gray-700">
        <tbody>
          {Array.from({ length: rounds }, (_, roundIndex) => {
            const round = roundIndex + 1;

            const roundSlots = slots
  .filter((slot) => slot.round === round)
  .sort((a, b) => {
    if (round % 2 === 1) {
      return a.pickNumber - b.pickNumber;
    }

    return b.pickNumber - a.pickNumber;
  });

            return (
              <tr key={round}>
                <td className="border border-gray-700 p-3 font-bold whitespace-nowrap">
                  Round {round}
                </td>

                {roundSlots.map((slot) => (
                  <td
                    key={slot.overallPickNumber}
                    className="border border-gray-700 p-3 min-w-[150px] h-24 align-top"
                  >
                    <div className="text-xs text-gray-400">
                      Pick {slot.overallPickNumber}
                    </div>

                    <div className="font-semibold">
                      {slot.teamName}
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}