"use client";

import { useState } from "react";
import type { Pick, Team } from "@/types/draft";
import DraftHQLogo from "@/components/DraftHQLogo";

type BoardView = "draft" | "players" | "roster" | "rounds";

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
}

const SPEEDS = [120, 80, 50, 30, 18];
const DEFAULT_SPEED_INDEX = 2;

const BOARD_BUTTONS: { label: string; value: BoardView }[] = [
  { label: "Draft Board", value: "draft" },
  { label: "Players",     value: "players" },
  { label: "Rosters",     value: "roster" },
  { label: "Rounds",      value: "rounds" },
];

const POS_BUTTONS = ["All", "QB", "RB", "WR", "TE", "K", "DST"];

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
  accentColor = "#14b8a6",
  mode = "ticker",
  boardView,
  onBoardViewChange,
  posFilter = "ALL",
  onPosFilterChange,
}: DraftTickerProps) {
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);

  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const sorted = [...picks].sort((a, b) => a.overallPickNumber - b.overallPickNumber);
  const duration = SPEEDS[speedIndex];

  // Build rich JSX ticker segments (rendered twice for seamless loop)
  function renderTickerContent(key: string) {
    return (
      <span key={key} className="flex items-center">
        {/* League intro */}
        <span className="flex items-center gap-3 px-10">
          <img src="/branding/logo-Photoroom.png" alt="DraftHQ" className="h-7 w-auto" />
          <span className="text-sm font-semibold text-slate-300">
            Welcome to this year&apos;s {leagueName ?? draftName} Draft!
          </span>
        </span>
        <span className="text-slate-700 px-2">·</span>
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
              <span className="mx-2 text-sm text-slate-400 font-semibold">
                {teamMap.get(p.teamId) ?? "—"}
              </span>
              <span className="text-slate-600 mr-2">/</span>
              {/* Player name bright */}
              <span className="text-sm font-bold text-white mr-1.5">
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
                <span className="mx-8 text-slate-700">·</span>
              )}
            </span>
          );
        })}
        <span className="px-8" />
      </span>
    );
  }

  return (
    <div className="shrink-0 flex items-stretch border-t border-white/8 bg-black" style={{ height: "58px" }}>

      {/* ── Left: DraftHQ brand + chat button ── */}
      <div className="flex shrink-0 items-center gap-3 border-r border-white/8 px-5">
        <DraftHQLogo accentColor={accentColor} className="h-10 w-auto" />

        <button
          type="button"
          aria-label={isChatOpen ? "Close chat" : "Open chat"}
          onClick={onChatToggle}
          className="relative ml-1 flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          style={isChatOpen ? { backgroundColor: `${accentColor}30`, color: accentColor } : { color: "#64748b" }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6l-4 4V5z" clipRule="evenodd"/>
          </svg>
          {unread > 0 && !isChatOpen && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </div>

      {/* ── Center: ticker or nav buttons ── */}
      {mode === "ticker" ? (
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className="flex h-full w-max items-center whitespace-nowrap"
            style={{ animation: `ticker ${duration}s linear infinite`, willChange: "transform" }}
            aria-live="off"
          >
            {renderTickerContent("a")}
            {renderTickerContent("b")}
          </div>
        </div>
      ) : (
        /* Nav mode: position pills | divider | board view pills */
        <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Position filter buttons */}
          {POS_BUTTONS.map((pos) => {
            const key = pos === "All" ? "ALL" : pos;
            const active = posFilter === key;
            const color = POS_COLORS[pos];
            return (
              <button
                key={pos}
                type="button"
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  active
                    ? "border-white/30 bg-white text-slate-950"
                    : "border-white/8 bg-white/5 hover:bg-white/10"
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
          <span className="shrink-0 h-5 w-px bg-white/10 mx-1" />

          {/* Board view buttons */}
          {BOARD_BUTTONS.map(({ label, value }) => {
            const active = boardView === value;
            return (
              <button
                key={value}
                type="button"
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  active
                    ? "border-white/30 bg-white text-slate-950"
                    : "border-white/8 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
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
        <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-white/8 px-3">
          <button type="button" title="Speed up"
            disabled={speedIndex >= SPEEDS.length - 1}
            className="flex h-5 w-6 items-center justify-center text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
            onClick={() => setSpeedIndex((i) => Math.min(i + 1, SPEEDS.length - 1))}>
            <svg viewBox="0 0 10 6" fill="currentColor" className="h-2.5 w-3"><polygon points="5,0 10,6 0,6"/></svg>
          </button>
          <button type="button" title="Slow down"
            disabled={speedIndex <= 0}
            className="flex h-5 w-6 items-center justify-center text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
            onClick={() => setSpeedIndex((i) => Math.max(i - 1, 0))}>
            <svg viewBox="0 0 10 6" fill="currentColor" className="h-2.5 w-3"><polygon points="5,6 10,0 0,0"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
