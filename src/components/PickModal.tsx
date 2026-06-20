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

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return players
      .filter((player) => {
        if (position !== "ALL" && player.position !== position) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [player.fullName, player.position, player.nflTeam ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 50);
  }, [players, position, search]);

  const selectedPlayer = players.find(
    (player) => player.id === selectedPlayerId
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full flex-col bg-gray-900 p-4 sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-lg sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            disabled={isSaving}
            className="rounded px-3 py-2 text-gray-300 disabled:opacity-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <input
          autoFocus
          className="mt-4 w-full rounded border border-gray-700 p-3 text-base"
          placeholder="Search name, position, or NFL team"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {["ALL", "QB", "RB", "WR", "TE", "K", "DST"].map((value) => (
            <button
              key={value}
              type="button"
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                position === value ? "bg-blue-600" : "bg-gray-800"
              }`}
              onClick={() => setPosition(value)}
            >
              {value === "ALL" ? "All" : value}
            </button>
          ))}
        </div>

        <div className="mt-4 flex-1 space-y-2 overflow-y-auto overscroll-contain sm:max-h-96">
          {visiblePlayers.length === 0 ? (
            <p className="text-gray-400 p-3">
              {players.length === 0
                ? "No active players are loaded in Supabase."
                : "No available players match your search."}
            </p>
          ) : (
            visiblePlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                disabled={isSaving}
                className={`w-full rounded border p-3 text-left disabled:opacity-50 ${
                  selectedPlayerId === player.id
                    ? "border-blue-400 bg-blue-950"
                    : "border-gray-700 hover:bg-gray-800"
                }`}
                onClick={() => setSelectedPlayerId(player.id)}
              >
                <span className="font-semibold">{player.fullName}</span>
                <span className="text-sm text-gray-400 ml-2">
                  {player.position} | {player.nflTeam ?? "FA"}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-gray-700 bg-gray-900 pt-4 pb-[max(0px,env(safe-area-inset-bottom))]">
          {error && <p className="mb-3 text-red-500">{error}</p>}
          <button
            type="button"
            disabled={isSaving || !selectedPlayer}
            className="w-full rounded bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-40"
            onClick={() => selectedPlayer && onSave(selectedPlayer.id)}
          >
            {isSaving
              ? "Submitting pick..."
              : selectedPlayer
                ? `Draft ${selectedPlayer.fullName}`
                : "Select a player"}
          </button>
        </div>
      </div>
    </div>
  );
}
