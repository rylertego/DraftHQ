"use client";
import { useEffect, useRef, useState } from "react";
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
  byeWeeks?: Map<string, number>;
  playerNameSize?: number;
  teamMap?: Map<string, string>;
  rosterPositions?: RosterPosition[] | null;
  accentColor?: string | null;
  tvMode?: boolean;
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

/** Narrowest readable team column before the board starts scrolling. */
const MIN_TEAM_COL_WIDTH = 132;
const ROUND_COL_WIDTH = 40;

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
  byeWeeks,
  playerNameSize = 6,
  teamMap,
  rosterPositions,
  accentColor,
  tvMode = false,
  onEditPick,
}: DraftBoardProps) {
  const [popupPick, setPopupPick] = useState<{ pick: Pick; x: number; y: number } | null>(null);
  const boardViewportRef = useRef<HTMLDivElement>(null);
  const tableHeaderRef = useRef<HTMLTableSectionElement>(null);
  const [boardHeight, setBoardHeight] = useState(0);
  const [tableHeaderHeight, setTableHeaderHeight] = useState(0);
  const accent = accentColor ?? "var(--color-league-accent)";
  const accentGlow = `color-mix(in srgb, ${accent} 18%, transparent)`;
  const accentBadgeBorder = `color-mix(in srgb, ${accent} 34%, transparent)`;
  const accentBadgeBg = `color-mix(in srgb, ${accent} 10%, transparent)`;

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
  const baseRowHeight = Math.round(32 + NAME_SIZE_REM[playerNameSize - 1] * 18);
  useEffect(() => {
    const viewport = boardViewportRef.current;
    const header = tableHeaderRef.current;
    if (!viewport || !header) return;

    const updateHeight = () => {
      setBoardHeight(Math.floor(viewport.clientHeight));
      setTableHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(viewport);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const headerHeight = tableHeaderHeight || (tvMode ? 38 : 34);
  const availableBodyHeight = boardHeight > 0
    ? Math.max(1, boardHeight - headerHeight)
    : baseRowHeight * rounds;
  const stretchedRowHeight = availableBodyHeight / rounds;
  const shouldScrollRows = rounds > 15;
  const rowMinHeight = Math.min(baseRowHeight, stretchedRowHeight);
  const rowHeight = shouldScrollRows
    ? `${baseRowHeight}px`
    : tvMode
    ? `clamp(${rowMinHeight}px, ${stretchedRowHeight}px, 126px)`
    : `${stretchedRowHeight}px`;
  const headerTextClass = tvMode
    ? "text-[clamp(11px,0.55vw,18px)]"
    : "text-[11px]";
  const firstNameTextClass = tvMode
    ? "text-[clamp(10px,0.45vw,15px)]"
    : "text-[10px]";
  const detailTextClass = tvMode
    ? "text-[clamp(10px,0.45vw,15px)]"
    : "text-[10px]";
  const badgeTextClass = tvMode
    ? "text-[clamp(10px,0.42vw,14px)]"
    : "text-[10px]";
  const playerLastNameSize = tvMode
    ? `clamp(${NAME_SIZE_REM[playerNameSize - 1]}rem, 1.1vw, 2.8rem)`
    : `${NAME_SIZE_REM[playerNameSize - 1]}rem`;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[color:var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-canvas)_86%,black)] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]" onClick={() => setPopupPick(null)}>
      <div ref={boardViewportRef} className={`min-h-0 flex-1 ${shouldScrollRows ? "overflow-y-auto" : "overflow-y-hidden"} ${tvMode ? "overflow-x-hidden" : "overflow-x-auto"} [touch-action:pan-x_pan-y]`}>
        {/* A fixed-layout table at 100% width divides the viewport between every
            team, so a ten-team board renders columns too narrow to read a name
            in. Hold a floor per column and let the board scroll sideways past
            it — width:100% still fills the space when there is room to spare.
            TV mode keeps squeezing: a projected board must not need scrolling. */}
        <table
          className="w-full border-separate border-spacing-0"
          style={{
            tableLayout: "fixed",
            minWidth: tvMode ? undefined : `${ROUND_COL_WIDTH + teams.length * MIN_TEAM_COL_WIDTH}px`,
          }}
        >
          <colgroup>
            <col style={{ width: `${ROUND_COL_WIDTH}px` }} />
            {teams.map((_, i) => <col key={i} />)}
          </colgroup>
          <thead ref={tableHeaderRef}>
            <tr>
              <th className={`sticky left-0 top-0 z-20 border-r border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-canvas)] px-2 py-2 text-center font-black uppercase tracking-wider text-[color:var(--color-text-muted)] ${tvMode ? "text-[clamp(10px,0.5vw,16px)]" : "text-[10px]"}`}>
                RD
              </th>
              {teams.map((name, i) => (
                <th key={i} className={`sticky top-0 z-10 whitespace-nowrap border-r border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-canvas)] px-2 py-2 text-center font-black uppercase tracking-[0.12em] text-[color:var(--color-text-secondary)] ${headerTextClass}`}>
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
                    className={`sticky left-0 z-10 border-r border-b border-[color:var(--color-border-subtle)] px-2 text-center align-middle font-black text-[color:var(--color-text-muted)] ${tvMode ? "text-[clamp(12px,0.55vw,18px)]" : "text-xs"}`}
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
                        className={`relative overflow-hidden border-r border-b border-[color:var(--color-border-subtle)] px-1.5 align-top transition-colors ${isCurrent ? "z-[1]" : ""}`}
                        style={{
                          height: rowHeight,
                          backgroundColor: cell
                            ? cell.bg
                            : isSkipped
                            ? "rgba(71,20,20,0.5)"
                            : isCurrent
                            ? "rgba(30,58,138,0.3)"
                            : emptyBg,
                          boxShadow: isCurrent
                            ? pick
                              ? `inset 0 0 0 2px ${accent}, 0 0 24px ${accentGlow}`
                              : `inset 0 0 0 2px ${accent}, 0 0 24px ${accentGlow}`
                            : undefined,
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
                              <span className={`truncate font-semibold uppercase leading-none ${firstNameTextClass}`} style={{ color: cell?.sub ?? "#94A3B8", opacity: 0.75 }}>
                                {firstName}
                              </span>
                              <span className={`shrink-0 font-bold leading-none whitespace-nowrap ${detailTextClass}`} style={{ color: cell?.sub ?? "#94A3B8", opacity: 0.8 }}>
                                {byeWeek && <span className="mr-0.5">{byeWeek}</span>}
                                <span>{pick.nflTeam}</span>
                                <span className="font-black ml-0.5">{pick.playerPosition}</span>
                              </span>
                            </div>
                            <div className="truncate font-black leading-tight tracking-tight" style={{ color: cell?.text ?? "#fff", fontSize: playerLastNameSize }}>
                              {lastName}
                            </div>
                          </div>
                        ) : isSkipped ? (
                          <div className="flex h-full items-center justify-center">
                            <span className={`${badgeTextClass} font-black uppercase tracking-widest text-red-400/70`}>
                              Skipped
                            </span>
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            {isCurrent && (
                              <span
                                className={`rounded-full border px-2 py-1 font-black uppercase tracking-widest ${badgeTextClass}`}
                                style={{
                                  borderColor: accentBadgeBorder,
                                  backgroundColor: accentBadgeBg,
                                  color: accent,
                                }}
                              >
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
                            <span className="absolute bottom-1 right-1 rounded-sm bg-[var(--color-league-accent)] px-1 py-px text-[8px] font-black uppercase leading-none text-black">
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
          className="fixed z-50 min-w-[140px] overflow-hidden rounded-[var(--radius-panel)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-1)] shadow-2xl"
          style={{ left: popupPick.x, top: popupPick.y, transform: "translateX(-50%)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-text-muted)]">
              {popupPick.pick.playerPosition} · {popupPick.pick.nflTeam}
            </p>
            <p className="font-black leading-tight text-[color:var(--color-text-primary)]">{popupPick.pick.playerName}</p>
            <p className="text-[10px] text-[color:var(--color-text-muted)]">Rnd {popupPick.pick.round}, Pk {popupPick.pick.pickNumber}</p>
          </div>
          <button
            type="button"
            onClick={() => { onEditPick(popupPick.pick); setPopupPick(null); }}
            className="w-full bg-[color:var(--color-surface-2)] px-3 py-2 text-left text-xs font-black uppercase tracking-wider text-[color:var(--color-league-accent)] transition-colors hover:bg-[color:var(--color-surface-3)]"
          >
            Edit Pick
          </button>
        </div>
      )}
    </section>
  );
}
