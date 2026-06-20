import { generateSnakeDraftOrder } from "@/lib/draftOrder";
import type { DraftStatus, Pick, Team } from "@/types/draft";
import RecentPicks from "./RecentPicks";

interface DraftBoardProps {
  teams: string[];
  rounds: number;
  picks: Pick[];
  currentPickNumber: number;
  draftStatus: DraftStatus;
  canMakePick: boolean;
  canUndoPick: boolean;
  onSlotClick: () => void;
  onUndoPick: () => void;
}

export default function DraftBoard({
  teams,
  rounds,
  picks,
  currentPickNumber,
  draftStatus,
  canMakePick,
  canUndoPick,
  onSlotClick,
  onUndoPick,
}: DraftBoardProps) {
  const teamObjects: Team[] = teams.map((name, index) => ({
    id: String(index + 1),
    draftId: "local",
    name,
    draftPosition: index + 1,
  }));

  const slots = generateSnakeDraftOrder(teamObjects, rounds);
  const currentSlot = slots.find(
    (slot) => slot.overallPickNumber === currentPickNumber
  );

  function getPick(overallPickNumber: number) {
    return picks.find(
      (pick) => pick.overallPickNumber === overallPickNumber
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 border border-gray-700 rounded-lg p-6 bg-gray-950">
          <p className="text-sm uppercase tracking-wide text-gray-400">
            On the Clock
          </p>

          <h2 className="text-4xl font-bold mt-2">
            {currentSlot?.teamName ?? "Draft Complete"}
          </h2>

          <p className="text-gray-400 mt-2">
            Pick {currentSlot?.overallPickNumber ?? "-"} | Round{" "}
            {currentSlot?.round ?? "-"}
          </p>

          <button
            onClick={onUndoPick}
            disabled={!canUndoPick || picks.length === 0}
            className="mt-4 bg-red-700 disabled:opacity-40 hover:bg-red-600 px-4 py-2 rounded"
          >
            Undo Last Pick
          </button>
        </section>

        <RecentPicks picks={picks} />
      </div>

      <section>
        <h2 className="text-2xl font-bold mb-4">Draft Board</h2>

        <div className="overflow-auto">
          <table className="border-collapse border border-gray-700">
            <tbody>
              {Array.from({ length: rounds }, (_, roundIndex) => {
                const round = roundIndex + 1;
                const roundSlots = slots
                  .filter((slot) => slot.round === round)
                  .sort((first, second) => {
                    if (round % 2 === 1) {
                      return first.pickNumber - second.pickNumber;
                    }

                    return second.pickNumber - first.pickNumber;
                  });

                return (
                  <tr key={round}>
                    <td className="border border-gray-700 p-3 font-bold whitespace-nowrap bg-gray-900">
                      Round {round}
                    </td>

                    {roundSlots.map((slot) => {
                      const pick = getPick(slot.overallPickNumber);
                      const isCurrent =
                        slot.overallPickNumber === currentPickNumber;
                      const isSelectable = isCurrent && canMakePick;

                      return (
                        <td
                          key={slot.overallPickNumber}
                          onClick={() => {
                            if (isSelectable) {
                              onSlotClick();
                            }
                          }}
                          className={`border border-gray-700 p-3 min-w-[170px] h-28 align-top ${
                            isSelectable
                              ? "cursor-pointer bg-blue-950"
                              : "cursor-not-allowed"
                          }`}
                        >
                          <div className="text-xs text-gray-400">
                            Pick {slot.overallPickNumber}
                          </div>

                          <div className="font-semibold">{slot.teamName}</div>

                          {pick ? (
                            <div className="mt-2">
                              <div className="font-bold">{pick.playerName}</div>
                              <div className="text-xs text-gray-400">
                                {pick.playerPosition} - {pick.nflTeam}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 mt-2">
                              {isSelectable
                                ? "Click to draft"
                                : isCurrent
                                  ? draftStatus === "active"
                                    ? "Waiting for team owner"
                                    : draftStatus === "setup"
                                      ? "Draft has not started"
                                      : "Draft is paused"
                                  : "Waiting"}
                            </div>
                          )}
                        </td>
                      );
                    })}
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
