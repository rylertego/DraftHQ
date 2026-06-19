"use client";

import { useState } from "react";

export default function CreateDraftPage() {
  const [draftName, setDraftName] = useState("");
  const [teamCount, setTeamCount] = useState(12);
  const [rounds, setRounds] = useState(15);

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">
        Create Draft
      </h1>

      <div className="space-y-4">
        <div>
          <label className="block mb-2">
            Draft Name
          </label>
          <input
            className="border rounded p-2 w-full"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-2">
            Number of Teams
          </label>
          <input
            type="number"
            min={2}
            max={20}
            className="border rounded p-2 w-full"
            value={teamCount}
            onChange={(e) =>
              setTeamCount(Number(e.target.value))
            }
          />
        </div>

        <div>
          <label className="block mb-2">
            Number of Rounds
          </label>
          <input
            type="number"
            min={1}
            max={30}
            className="border rounded p-2 w-full"
            value={rounds}
            onChange={(e) =>
              setRounds(Number(e.target.value))
            }
          />
        </div>

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create Draft
        </button>
      </div>
    </main>
  );
}