"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDraftSetup, renameTeams } from "@/lib/draftApi";
import type { Team } from "@/types/draft";

interface TeamSetupFormProps {
  draftId: string | null;
}

export default function TeamSetupForm({ draftId }: TeamSetupFormProps) {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!draftId) {
      router.replace("/create");
      return;
    }

    let cancelled = false;

    async function loadTeams() {
      try {
        const setup = await getDraftSetup(draftId as string);

        if (!cancelled) {
          setTeams(setup.teams);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load teams."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTeams();

    return () => {
      cancelled = true;
    };
  }, [draftId, router]);

  function updateTeam(teamId: string, value: string) {
    setTeams((current) =>
      current.map((team) =>
        team.id === teamId ? { ...team, name: value } : team
      )
    );
  }

  async function continueToDraft() {
    if (!draftId) {
      return;
    }

    if (teams.some((team) => !team.name.trim())) {
      setError("Every team must have a name.");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      await renameTeams(
        draftId,
        teams.map((team) => team.name.trim())
      );
      router.push(`/draft?draftId=${draftId}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save teams."
      );
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className="max-w-2xl mx-auto p-8">Loading teams...</main>;
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Team Setup</h1>

      <div className="space-y-3">
        {teams.map((team) => (
          <input
            key={team.id}
            className="border rounded p-2 w-full"
            value={team.name}
            onChange={(event) => updateTeam(team.id, event.target.value)}
          />
        ))}
      </div>

      {error && <p className="text-red-500 mt-4">{error}</p>}

      <button
        onClick={continueToDraft}
        disabled={isSaving || teams.length === 0}
        className="mt-6 bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded"
      >
        {isSaving ? "Saving..." : "Continue"}
      </button>
    </main>
  );
}
