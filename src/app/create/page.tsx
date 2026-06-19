"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDraft } from "@/lib/draftApi";

export default function CreateDraftPage() {
  const router = useRouter();

  const [draftName, setDraftName] = useState("");
  const [teamCount, setTeamCount] = useState(12);
  const [rounds, setRounds] = useState(15);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateDraft() {
    if (!draftName.trim()) {
      setError("Draft name is required.");
      return;
    }

    if (teamCount < 2 || teamCount > 20) {
      setError("Team count must be between 2 and 20.");
      return;
    }

    if (rounds < 1 || rounds > 30) {
      setError("Rounds must be between 1 and 30.");
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const draft = await createDraft({
        name: draftName.trim(),
        teamCount,
        rounds,
      });

      router.push(`/teams?draftId=${draft.id}`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create the draft."
      );
      setIsCreating(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Create Draft</h1>

      <div className="space-y-4">
        <div>
          <label className="block mb-2">Draft Name</label>
          <input
            className="border rounded p-2 w-full"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-2">Number of Teams</label>
          <input
            type="number"
            min={2}
            max={20}
            className="border rounded p-2 w-full"
            value={teamCount}
            onChange={(e) => setTeamCount(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block mb-2">Number of Rounds</label>
          <input
            type="number"
            min={1}
            max={30}
            className="border rounded p-2 w-full"
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
          />
        </div>

        {error && <p className="text-red-500">{error}</p>}

        <button
          onClick={handleCreateDraft}
          disabled={isCreating}
          className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded"
        >
          {isCreating ? "Creating..." : "Create Draft"}
        </button>
      </div>
    </main>
  );
}
