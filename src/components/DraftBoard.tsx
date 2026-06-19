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
  const currentSlot = slots[0];

  return (
    <div className="space-y-8">
      <section className="border border-gray-700 rounded-lg p-6 bg-gray-950">
        <p className="text-sm uppercase tracking-wide text-gray-400">
          On the Clock
        </p>

        <h2 className="text-4xl font-bold mt-2">
          {currentSlot?.teamName}
        </h2>

        <p className="text-gray-400 mt-2">
          Pick {currentSlot?.overallPickNumber} • Round {currentSlot?.round}
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Draft Board</h2>

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
                    <td className="border border-gray-700 p-3 font-bold whitespace-nowrap bg-gray-900">
                      Round {round}
                    </td>

                    {roundSlots.map((slot) => (
                      <td
                        key={slot.overallPickNumber}
                        className={`border border-gray-700 p-3 min-w-[150px] h-24 align-top ${
                          slot.overallPickNumber === currentSlot?.overallPickNumber
                            ? "bg-blue-950"
                            : ""
                        }`}
                      >
                        <div className="text-xs text-gray-400">
                          Pick {slot.overallPickNumber}
                        </div>

                        <div className="font-semibold">
                          {slot.teamName}
                        </div>

                        <div className="text-xs text-gray-500 mt-2">
                          Empty
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}