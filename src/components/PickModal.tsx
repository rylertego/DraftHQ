"use client";

import { useMemo, useState } from "react";
import type { Player } from "@/types/draft";

interface PickModalProps {
  title?: string;
  players: Player[];
  isSaving: boolean;
  error: string;
  onSave: (playerId: string) => Promise<void>;
  onClose: () => void;
}

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-cyan-900/60 text-cyan-300",
  RB: "bg-yellow-900/60 text-yellow-300",
  WR: "bg-orange-900/60 text-orange-300",
  TE: "bg-purple-900/60 text-purple-300",
  K: "bg-green-900/60 text-green-300",
  DST: "bg-red-900/60 text-red-300",
};

export default function PickModal({
  title = "Select Draft Pick",
  players,
  isSaving,
  error,
  onSave,
  onClose,
}: PickModalProps) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const positionTabs = useMemo(() => {
    const present = new Set<string>(players.map((p) => p.position));
    return ["QB", "RB", "WR", "TE", "K", "DST"].filter((p) => present.has(p));
  }, [players]);

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return players
      .filter((player) => {
        if (position !== "ALL" && player.position !== position) return false;
        if (!query) return true;
        return [player.fullName, player.position, player.nflTeam ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 60);
  }, [players, position, search]);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-[95dvh] w-full flex-col rounded-t-2xl border border-slate-700 bg-slate-950 sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button type="button" disabled={isSaving} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-50 transition-colors" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-slate-800 px-4 py-3">
          <input
            autoFocus
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            placeholder="Search name, position, or NFL team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Position tabs */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-slate-800 px-4 py-2.5">
          {["ALL", ...positionTabs].map((val) => (
            <button
              key={val}
              type="button"
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                position === val
                  ? "bg-white text-slate-950"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
              onClick={() => setPosition(val)}
            >
              {val === "ALL" ? "All" : val}
            </button>
          ))}
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          {visiblePlayers.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              {players.length === 0 ? "No players loaded in Supabase." : "No players match your search."}
            </p>
          ) : (
            <div className="space-y-1">
              {visiblePlayers.map((player) => {
                const posClass = POSITION_COLORS[player.position] ?? "bg-slate-800 text-slate-400";
                const isSelected = selectedPlayerId === player.id;
                return (
                  <button
                    key={player.id}
                    type="button"
                    disabled={isSaving}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                      isSelected
                        ? "border-white/30 bg-white/10"
                        : "border-transparent hover:border-slate-700 hover:bg-slate-900"
                    }`}
                    onClick={() => setSelectedPlayerId(player.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold ${posClass}`}>
                        {player.position}
                      </span>
                      <span className="font-semibold text-white">{player.fullName}</span>
                      <span className="ml-auto text-xs text-slate-500 shrink-0">{player.nflTeam ?? "FA"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
          <button
            type="button"
            disabled={isSaving || !selectedPlayer}
            className="w-full rounded-xl bg-white py-3 text-sm font-bold text-slate-950 disabled:opacity-30 hover:bg-slate-100 transition-colors"
            onClick={() => selectedPlayer && void onSave(selectedPlayer.id)}
          >
            {isSaving ? "Submitting pick…" : selectedPlayer ? `Draft ${selectedPlayer.fullName}` : "Select a player"}
          </button>
        </div>
      </div>
    </div>
  );
}
