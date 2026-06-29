"use client";
import { useState } from "react";
import { generateSnakeDraftOrder } from "@/lib/draftOrder";
import { buildPositionColorMap, positionCellColors } from "@/lib/positionColors";
import type { PositionCellColors } from "@/lib/positionColors";
import type { DraftStatus, Pick, RosterPosition, Team } from "@/types/draft";

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
  playerNameSize?: number;
  teamMap?: Map<string, string>;
  rosterPositions?: RosterPosition[] | null;
  onSlotClick: () => void;
  onUndoPick: () => void;
  onEditPick?: (pick: Pick) => void;
}

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
function splitBoardName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) return { first: "", last: parts[0] };
  const last = parts[parts.length - 1];
  if (parts.length >= 3 && NAME_SUFFIXES.has(last.toLowerCase().replace(".", ""))) {
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

const NAME_SIZE_REM = [0.8, 1.0, 1.25, 1.5, 1.75, 2.0, 2.35, 2.75, 3.2, 3.75];

const DEFAULT_POSITION_ACCENTS: Record<string, string> = {
  QB: "#67E8F9", RB: "#FCD34D", WR: "#FB923C",
  TE: "#A78BFA", K: "#4ADE80", DST: "#FCA5A5",
};

export default function DraftBoard({
  teams,
  rounds,
  picks,
  currentPickNumber,
  draftStatus,
  myTeamName,
  byeWeeks,
  playerNameSize = 6,
  teamMap,
  rosterPositions,
  onEditPick,
}: DraftBoardProps) {
  const [popupPick, setPopupPick] = useState<{ pick: Pick; x: number; y: number } | null>(null);

  const posColorMap = buildPositionColorMap(rosterPositions, DEFAULT_POSITION_ACCENTS);
  function getCell(position: string): PositionCellColors {
    return posColorMap.get(position) ?? positionCellColors(DEFAULT_POSITION_ACCENTS[position] ?? "#94A3B8");
  }

  const teamObjects: Team[] = teams.map((name, index) => ({
    id: String(index + 1),
    draftId: "local",
    name,
    draftPosition: index + 1,
    clockExtensionsUsed: 0,
    walkUpSongs: [],
  }));

  const slots = generateSnakeDraftOrder(teamObjects, rounds);

  function getPick(overallPickNumber: number) {
    return picks.find((pick) => pick.overallPickNumber === overallPickNumber);
  }

  // Row height: top padding (6) + first-name row (14) + gap (2) + last-name text + bottom breathing room (10)
  const rowHeight = `${Math.round(32 + NAME_SIZE_REM[playerNameSize - 1] * 18)}px`;

  return (
    <section className="flex h-full flex-col" onClick={() => setPopupPick(null)}>
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
                    const isSkipped = !pick && slot.overallPickNumber < currentPickNumber;
                    const cell = pick ? getCell(pick.playerPosition) : null;
                    const byeWeek = pick?.nflTeam ? (byeWeeks?.get(pick.nflTeam) ?? null) : null;

                    const { first: firstName, last: lastName } = pick ? splitBoardName(pick.playerName) : { first: "", last: "" };

                    return (
                      <td
                        key={slot.overallPickNumber}
                        className="relative border-r border-b border-slate-800 px-1.5 align-top overflow-hidden"
                        style={{
                          height: rowHeight,
                          backgroundColor: cell
                            ? cell.bg
                            : isSkipped
                            ? "rgba(71,20,20,0.5)"
                            : isCurrent
                            ? "rgba(30,58,138,0.3)"
                            : emptyBg,
                          boxShadow: isCurrent && !pick ? "inset 0 0 0 2px #14b8a6" : undefined,
                        }}
                      >
                        {pick ? (
                          <div
                            className={`w-full pt-1.5${onEditPick ? " cursor-pointer" : ""}`}
                            onClick={onEditPick ? (e) => {
                              e.stopPropagation();
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setPopupPick({ pick, x: rect.left + rect.width / 2, y: rect.bottom + 4 });
                            } : undefined}
                          >
                            <div className="flex items-center justify-between gap-1 leading-none mb-0.5">
                              <span className="truncate text-[10px] font-semibold uppercase leading-none" style={{ color: cell?.sub ?? "#94A3B8", opacity: 0.75 }}>
                                {firstName}
                              </span>
                              <span className="shrink-0 text-[10px] font-bold leading-none whitespace-nowrap" style={{ color: cell?.sub ?? "#94A3B8", opacity: 0.8 }}>
                                {byeWeek && <span className="mr-0.5">{byeWeek}</span>}
                                <span>{pick.nflTeam}</span>
                                <span className="font-black ml-0.5">{pick.playerPosition}</span>
                              </span>
                            </div>
                            <div className="truncate font-black leading-tight tracking-tight" style={{ color: cell?.text ?? "#fff", fontSize: `${NAME_SIZE_REM[playerNameSize - 1]}rem` }}>
                              {lastName}
                            </div>
                          </div>
                        ) : isSkipped ? (
                          <div className="flex h-full items-center justify-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-400/70">
                              Skipped
                            </span>
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            {isCurrent && (
                              <span className="text-xs font-black uppercase tracking-widest text-teal-500">
                                {draftStatus === "active" ? "Picking" : draftStatus === "setup" ? "Not started" : "Paused"}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Changed-team badge */}
                        {pick && teamMap && (() => {
                          const expectedName = teams[parseInt(slot.teamId) - 1];
                          const actualName = teamMap.get(pick.teamId);
                          if (!actualName || actualName === expectedName) return null;
                          return (
                            <span className="absolute bottom-1 right-1 rounded-sm bg-teal-500 px-1 py-px text-[8px] font-black uppercase leading-none text-black">
                              {actualName}
                            </span>
                          );
                        })()}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Floating popup */}
      {popupPick && onEditPick && (
        <div
          className="fixed z-50 min-w-[140px] rounded-xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden"
          style={{ left: popupPick.x, top: popupPick.y, transform: "translateX(-50%)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {popupPick.pick.playerPosition} · {popupPick.pick.nflTeam}
            </p>
            <p className="font-black text-white leading-tight">{popupPick.pick.playerName}</p>
            <p className="text-[10px] text-slate-500">Rnd {popupPick.pick.round}, Pk {popupPick.pick.pickNumber}</p>
          </div>
          <button
            type="button"
            onClick={() => { onEditPick(popupPick.pick); setPopupPick(null); }}
            className="w-full bg-slate-800 px-3 py-2 text-left text-xs font-black uppercase tracking-wider text-teal-400 hover:bg-slate-700 transition-colors"
          >
            Edit Pick
          </button>
        </div>
      )}
    </section>
  );
}
