"use client";

import { useState } from "react";

interface PickModalProps {
  onSave: (
    playerName: string,
    position: string,
    nflTeam: string
  ) => void;
  onClose: () => void;
}

export default function PickModal({
  onSave,
  onClose,
}: PickModalProps) {
  const [playerName, setPlayerName] = useState("");
  const [position, setPosition] = useState("");
  const [nflTeam, setNflTeam] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-gray-900 p-6 rounded-lg w-[400px]">
        <h2 className="text-xl font-bold mb-4">
          Enter Draft Pick
        </h2>

        <div className="space-y-3">
          <input
            className="border border-gray-700 p-2 w-full rounded"
            placeholder="Player Name"
            value={playerName}
            onChange={(e) =>
              setPlayerName(e.target.value)
            }
          />

          <input
            className="border border-gray-700 p-2 w-full rounded"
            placeholder="Position"
            value={position}
            onChange={(e) =>
              setPosition(e.target.value)
            }
          />

          <input
            className="border border-gray-700 p-2 w-full rounded"
            placeholder="NFL Team"
            value={nflTeam}
            onChange={(e) =>
              setNflTeam(e.target.value)
            }
          />
        </div>

        <div className="flex gap-2 mt-4">
          <button
            className="bg-blue-600 px-4 py-2 rounded"
            onClick={() =>
              onSave(
                playerName,
                position,
                nflTeam
              )
            }
          >
            Save
          </button>

          <button
            className="bg-gray-700 px-4 py-2 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}