import { generateSnakeDraftOrder } from "@/lib/draftOrder";
import type { DraftStatus, Pick, Team } from "@/types/draft";

interface DraftBoardProps {
  teams: string[];
  rounds: number;
  picks: Pick[];
  currentPickNumber: number;
  draftStatus: DraftStatus;
  canMakePick: boolean;
  canUndoPick: boolean;
  myTeamName?: string;
  byeWeeks?: Map<string, number>;
  onSlotClick: () => void;
  onUndoPick: () => void;
}

const POSITION_COLORS: Record<string, string> = {
  QB: "#67E8F9",
  RB: "#FCD34D",
  WR: "#F97316",
  TE: "#A78BFA",
  K: "#4ADE80",
  DST: "#F87171",
};

const POSITION_CELL: Record<string, { bg: string; text: string; sub: string }> = {
  QB: { bg: "#164e63", text: "#e0f7ff", sub: "#67E8F9" },
  RB: { bg: "#78350f", text: "#fef9c3", sub: "#FCD34D" },
  WR: { bg: "#7c2d12", text: "#ffedd5", sub: "#FB923C" },
  TE: { bg: "#3b0764", text: "#f5f3ff", sub: "#C4B5FD" },
  K:  { bg: "#14532d", text: "#dcfce7", sub: "#4ADE80" },
  DST:{ bg: "#7f1d1d", text: "#fee2e2", sub: "#FCA5A5" },
};

export default function DraftBoard({
  teams,
  rounds,
  picks,
  currentPickNumber,
  draftStatus,
  myTeamName,
  byeWeeks,
}: DraftBoardProps) {
  const teamObjects: Team[] = teams.map((name, index) => ({
    id: String(index + 1),
    draftId: "local",
    name,
    draftPosition: index + 1,
  }));

  const slots = generateSnakeDraftOrder(teamObjects, rounds);

  function getPick(overallPickNumber: number) {
    return picks.find((pick) => pick.overallPickNumber === overallPickNumber);
  }

  const rowHeight = "52px";

  return (
    <section className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto [touch-action:pan-x_pan-y]">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "40px" }} />
            {teams.map((_, i) => <col key={i} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 border-r border-b border-slate-800 bg-slate-950 px-2 py-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                RD
              </th>
              {teams.map((name, i) => (
                <th key={i} className={`sticky top-0 z-10 whitespace-nowrap border-r border-b border-slate-800 bg-slate-950 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide ${myTeamName === name ? "text-teal-400" : "text-slate-400"}`}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="h-full">
            {Array.from({ length: rounds }, (_, roundIndex) => {
              const round = roundIndex + 1;
              const isEvenRow = round % 2 === 0;
              const emptyBg = isEvenRow ? "#0d1a2e" : "#020617";

              const roundSlots = slots
                .filter((slot) => slot.round === round)
                .sort((a, b) => (round % 2 === 1 ? a.pickNumber - b.pickNumber : b.pickNumber - a.pickNumber));

              return (
                <tr key={round}>
                  <td
                    className="sticky left-0 z-10 border-r border-b border-slate-800 px-2 text-xs font-black text-slate-500 text-center align-middle"
                    style={{ height: rowHeight, backgroundColor: isEvenRow ? "#0d1a2e" : "#020617" }}
                  >
                    {round}
                  </td>

                  {roundSlots.map((slot) => {
                    const pick = getPick(slot.overallPickNumber);
                    const isCurrent = slot.overallPickNumber === currentPickNumber;
                    const cell = pick ? (POSITION_CELL[pick.playerPosition] ?? null) : null;
                    const posColor = pick ? (POSITION_COLORS[pick.playerPosition] ?? "#94A3B8") : null;
                    const byeWeek = pick?.nflTeam ? (byeWeeks?.get(pick.nflTeam) ?? null) : null;

                    const nameParts = pick ? pick.playerName.split(" ") : [];
                    const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "";
                    const firstName = nameParts.length > 1 ? nameParts[0] : "";

                    return (
                      <td
                        key={slot.overallPickNumber}
                        className="border-r border-b border-slate-800 px-1.5 align-middle overflow-hidden"
                        style={{
                          height: rowHeight,
                          backgroundColor: cell
                            ? cell.bg
                            : isCurrent
                            ? "rgba(30,58,138,0.3)"
                            : emptyBg,
                          boxShadow: isCurrent && !pick ? "inset 0 0 0 2px #14b8a6" : undefined,
                        }}
                      >
                        {pick ? (
                          <>
                            <div className="flex items-baseline justify-between gap-1 leading-none mb-0.5">
                              <span className="w-1/2 truncate text-[10px] font-semibold uppercase leading-none" style={{ color: cell?.sub ?? posColor ?? "#94A3B8", opacity: 0.75 }}>
                                {firstName}
                              </span>
                              <span className="w-1/2 text-right text-[10px] font-bold leading-none whitespace-nowrap overflow-hidden" style={{ color: cell?.sub ?? "#94A3B8", opacity: 0.8 }}>
                                {byeWeek && <span className="mr-0.5">{byeWeek}</span>}
                                <span>{pick.nflTeam}</span>
                                <span className="font-black ml-0.5">{pick.playerPosition}</span>
                              </span>
                            </div>
                            <div className="truncate text-2xl font-black leading-tight tracking-tight" style={{ color: cell?.text ?? "#fff" }}>
                              {lastName}
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            {isCurrent && (
                              <span className="text-xs font-black uppercase tracking-widest text-teal-500">
                                {draftStatus === "active" ? "Picking" : draftStatus === "setup" ? "Not started" : "Paused"}
                              </span>
                            )}
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
  );
}
