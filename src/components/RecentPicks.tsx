import type { DraftPick } from "@/types/pick";

interface RecentPicksProps {
  picks: DraftPick[];
}

export default function RecentPicks({
  picks,
}: RecentPicksProps) {
  const recent = [...picks]
    .sort(
      (a, b) =>
        b.overallPickNumber - a.overallPickNumber
    )
    .slice(0, 5);

  return (
    <div className="border border-gray-700 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">
        Recent Picks
      </h2>

      <div className="space-y-3">
        {recent.length === 0 ? (
          <p className="text-gray-500">
            No picks yet
          </p>
        ) : (
          recent.map((pick) => (
            <div
              key={pick.overallPickNumber}
              className="border-b border-gray-800 pb-2"
            >
              <div className="text-xs text-gray-400">
                Pick {pick.overallPickNumber}
              </div>

              <div className="font-semibold">
                {pick.playerName}
              </div>

              <div className="text-sm text-gray-400">
                {pick.position} - {pick.nflTeam}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}