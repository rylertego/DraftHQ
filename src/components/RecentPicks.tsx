import type { Pick } from "@/types/draft";

const POSITION_COLORS: Record<string, string> = {
  QB: "#67E8F9",
  RB: "#FCD34D",
  WR: "#F97316",
  TE: "#A78BFA",
  K: "#4ADE80",
  DST: "#F87171",
};

interface RecentPicksProps {
  picks: Pick[];
}

export default function RecentPicks({ picks }: RecentPicksProps) {
  const recent = [...picks]
    .sort((a, b) => b.overallPickNumber - a.overallPickNumber)
    .slice(0, 6);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Recent Picks</h2>
      {recent.length === 0 ? (
        <p className="text-sm text-slate-600">No picks yet</p>
      ) : (
        <div className="space-y-2">
          {recent.map((pick) => {
            const posColor = POSITION_COLORS[pick.playerPosition] ?? "#94A3B8";
            return (
              <div key={pick.overallPickNumber} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-6 shrink-0 text-right text-[10px] font-bold text-slate-600">#{pick.overallPickNumber}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold" style={{ color: posColor }}>{pick.playerPosition}</span>
                    <span className="truncate text-sm font-semibold text-white">{pick.playerName}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{pick.nflTeam}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
