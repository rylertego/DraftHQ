"use client";

import { useMemo, useState } from "react";
import type { Player } from "@/types/draft";

interface PickModalProps {
  players: Player[];
  isSaving: boolean;
  error: string;
  onSave: (playerId: string) => Promise<void>;
  onClose: () => void;
}

export default function PickModal({
  players,
  isSaving,
  error,
  onSave,
  onClose,
}: PickModalProps) {
  const [search, setSearch] = useState("");

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return players
      .filter((player) => {
        if (!query) {
          return true;
        }

        return [player.fullName, player.position, player.nflTeam ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 50);
  }, [players, search]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-900 p-6 rounded-lg w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">Select Draft Pick</h2>

        <input
          autoFocus
          className="border border-gray-700 p-2 w-full rounded"
          placeholder="Search name, position, or NFL team"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="mt-4 max-h-96 overflow-y-auto space-y-2">
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
                className="w-full border border-gray-700 hover:bg-gray-800 disabled:opacity-50 rounded p-3 text-left"
                onClick={() => onSave(player.id)}
              >
                <span className="font-semibold">{player.fullName}</span>
                <span className="text-sm text-gray-400 ml-2">
                  {player.position} | {player.nflTeam ?? "FA"}
                </span>
              </button>
            ))
          )}
        </div>

        {error && <p className="text-red-500 mt-4">{error}</p>}

        <button
          type="button"
          disabled={isSaving}
          className="bg-gray-700 disabled:opacity-50 px-4 py-2 rounded mt-4"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
