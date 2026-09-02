"use client";

import { useEffect, useRef, useState } from "react";
import type { Pick, Team } from "@/types/draft";
import DraftHQLogo from "@/components/DraftHQLogo";

type BoardView = "draft" | "players" | "roster" | "rounds" | "grades" | "queue";

interface DraftTickerProps {
  draftName: string;
  leagueName?: string;
  picks: Pick[];
  teams: Team[];
  unread: number;
  isChatOpen: boolean;
  onChatToggle: () => void;
  accentColor?: string;
  // nav mode
  mode?: "ticker" | "nav";
  boardView?: BoardView;
  onBoardViewChange?: (v: BoardView) => void;
  posFilter?: string;
  onPosFilterChange?: (pos: string) => void;
  enabledPositions?: string[];
}

// Scroll speed in pixels per second, not seconds per lap. The ticker's content
// grows with every pick, so a fixed lap time would silently accelerate the
// scroll all draft long. Holding px/sec constant keeps the reading pace the
// commissioner picked, however many picks are on the board.
const SPEEDS_PX_PER_SEC = [17, 25, 40, 67, 111];
const DEFAULT_SPEED_INDEX = 2;
/** Used until the track has been measured, so the animation never runs at 0s. */
const FALLBACK_DURATION_S = 50;

const BOARD_BUTTONS: { label: string; value: BoardView }[] = [
  { label: "Draft Board", value: "draft" },
  { label: "Players",     value: "players" },
  { label: "Rosters",     value: "roster" },
  { label: "Rounds",      value: "rounds" },
  { label: "Queue",       value: "queue" },
];

const DEFAULT_POS_BUTTONS = ["QB", "RB", "WR", "TE", "K", "DST"];

const POS_COLORS: Record<string, string> = {
  QB: "#38BDF8", RB: "#FCD34D", WR: "#FB923C",
  TE: "#A78BFA", K: "#4ADE80", DST: "#F87171",
};

export default function DraftTicker({
  draftName,
  leagueName,
  picks,
  teams,
  unread,
  isChatOpen,
  onChatToggle,
  accentColor = "var(--color-league-accent)",
  mode = "ticker",
  boardView,
  onBoardViewChange,
  posFilter = "ALL",
  onPosFilterChange,
  enabledPositions,
}: DraftTickerProps) {
  const posButtons = ["All", ...(enabledPositions ?? DEFAULT_POS_BUTTONS)];
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);

  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const sorted = [...picks].sort((a, b) => a.overallPickNumber - b.overallPickNumber);

  // One loop travels the width of a single content copy. Measuring it lets the
  // duration scale with the content so the speed itself stays put. The observer
  // also fires when picks widen the track, so no manual re-measure is needed.
  const contentRef = useRef<HTMLSpanElement>(null);
  const tickerViewportRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [tickerViewportWidth, setTickerViewportWidth] = useState(0);
  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setContentWidth(el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = tickerViewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setTickerViewportWidth(el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const duration =
    contentWidth > 0
      ? (contentWidth + tickerViewportWidth) / SPEEDS_PX_PER_SEC[speedIndex]
      : FALLBACK_DURATION_S;

  // Build rich JSX ticker segments.
  function renderTickerContent(key: string, ref?: React.Ref<HTMLSpanElement>) {
    return (
      <span key={key} ref={ref} className="flex items-center">
        {/* League intro */}
        <span className="flex items-center gap-3 px-10">
          <img src="/branding/mark.svg" alt="DraftHQ" className="h-7 w-auto" />
          <span className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
            Welcome to this year&apos;s {leagueName ?? draftName} Draft!
          </span>
        </span>
        <span className="px-2 text-[color:var(--color-text-muted)]">·</span>
        {sorted.map((p, i) => {
          const posColor = POS_COLORS[p.playerPosition] ?? "#94A3B8";
          const round = Math.ceil(p.overallPickNumber / (teams.length || 12));
          const pickInRound = ((p.overallPickNumber - 1) % (teams.length || 12)) + 1;
          return (
            <span key={p.id} className="flex items-center">
              {/* Pick number colored */}
              <span className="font-black text-sm" style={{ color: accentColor }}>
                {round}.{pickInRound}
              </span>
              {/* Team name slightly dimmed */}
              <span className="mx-2 text-sm font-semibold text-[color:var(--color-text-secondary)]">
                {teamMap.get(p.teamId) ?? "—"}
              </span>
              <span className="mr-2 text-[color:var(--color-text-muted)]">/</span>
              {/* Player name bright */}
              <span className="mr-1.5 text-sm font-bold text-[color:var(--color-text-primary)]">
                {p.playerName}
              </span>
              {/* NFL team + position in position color */}
              <span className="text-xs font-bold mr-1" style={{ color: posColor }}>
                {p.nflTeam}
              </span>
              <span className="text-xs font-black" style={{ color: posColor }}>
                {p.playerPosition}
              </span>
              {i < sorted.length - 1 && (
                <span className="mx-8 text-[color:var(--color-text-muted)]">·</span>
              )}
            </span>
          );
        })}
        <span className="px-8" />
      </span>
    );
  }

  return (
    <div className="flex shrink-0 items-stretch border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-canvas)]" style={{ height: "58px" }}>

      {/* ── Left: DraftHQ brand + chat button ── */}
      <div className="flex shrink-0 items-center gap-3 border-r border-[color:var(--color-border-subtle)] px-5">
        <DraftHQLogo accentColor={accentColor} className="h-10 w-auto" />

        <button
          type="button"
          aria-label={isChatOpen ? "Close chat" : "Open chat"}
          onClick={onChatToggle}
          className="relative ml-1 flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-colors"
          style={isChatOpen ? { backgroundColor: `${accentColor}30`, color: accentColor } : { color: "var(--color-text-muted)" }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6l-4 4V5z" clipRule="evenodd"/>
          </svg>
          {unread > 0 && !isChatOpen && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-[9px] font-black text-[color:var(--color-danger-foreground)]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </div>

      {/* ── Center: ticker or nav buttons ── */}
      {mode === "ticker" ? (
        <div ref={tickerViewportRef} className="min-w-0 flex-1 overflow-hidden">
          <div
            className="flex h-full w-max items-center whitespace-nowrap"
            style={{
              "--ticker-start": `${tickerViewportWidth}px`,
              animation: `ticker-crawl ${duration}s linear infinite`,
              willChange: "transform",
            } as React.CSSProperties}
            aria-live="off"
          >
            {renderTickerContent("a", contentRef)}
          </div>
        </div>
      ) : (
        /* Nav mode: position pills | divider | board view pills */
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Position filter buttons */}
          {posButtons.map((pos) => {
            const key = pos === "All" ? "ALL" : pos;
            const active = posFilter === key;
            const color = POS_COLORS[pos];
            return (
              <button
                key={pos}
                type="button"
                className={`shrink-0 rounded-[var(--radius-control)] border px-3 py-1 text-xs font-bold transition-colors ${
                  active
                    ? "border-[color:var(--color-league-accent-border)] bg-[var(--color-league-accent)] text-[color:var(--color-league-accent-foreground)]"
                    : "border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-2)] hover:bg-[color:var(--color-surface-3)]"
                }`}
                style={!active && color ? { color } : {}}
                onClick={() => {
                  onPosFilterChange?.(key);
                  onBoardViewChange?.("players");
                }}
              >
                {pos}
              </button>
            );
          })}

          {/* divider */}
          <span className="mx-1 h-5 w-px shrink-0 bg-[color:var(--color-border-subtle)]" />

          {/* Board view buttons */}
          {BOARD_BUTTONS.map(({ label, value }) => {
            const active = boardView === value;
            return (
              <button
                key={value}
                type="button"
                className={`shrink-0 rounded-[var(--radius-control)] border px-3 py-1 text-xs font-bold transition-colors ${
                  active
                    ? "border-[color:var(--color-league-accent-border)] bg-[var(--color-league-accent)] text-[color:var(--color-league-accent-foreground)]"
                    : "border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-2)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-3)] hover:text-[color:var(--color-text-primary)]"
                }`}
                onClick={() => onBoardViewChange?.(value)}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Right: speed controls (ticker only) ── */}
      {mode === "ticker" && (
        <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-[color:var(--color-border-subtle)] px-3">
          <button type="button" title="Speed up"
            disabled={speedIndex >= SPEEDS_PX_PER_SEC.length - 1}
            className="flex h-5 w-6 items-center justify-center text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-secondary)] disabled:opacity-20"
            onClick={() => setSpeedIndex((i) => Math.min(i + 1, SPEEDS_PX_PER_SEC.length - 1))}>
            <svg viewBox="0 0 10 6" fill="currentColor" className="h-2.5 w-3"><polygon points="5,0 10,6 0,6"/></svg>
          </button>
          <button type="button" title="Slow down"
            disabled={speedIndex <= 0}
            className="flex h-5 w-6 items-center justify-center text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-secondary)] disabled:opacity-20"
            onClick={() => setSpeedIndex((i) => Math.max(i - 1, 0))}>
            <svg viewBox="0 0 10 6" fill="currentColor" className="h-2.5 w-3"><polygon points="5,6 10,0 0,0"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
