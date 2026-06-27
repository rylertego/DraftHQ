"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeEmail } from "@/lib/email";
import { createImportedLeagueSeason } from "@/lib/leagueApi";
import { getDraftSetup, inviteOwner } from "@/lib/draftApi";
import type { ProviderLeaguePreview } from "@/lib/providers/types";

interface EditableTeam {
  externalId: string;
  ownerName: string;
  teamName: string;
  ownerEmail: string;
}

interface ProviderImportFormProps {
  preview: ProviderLeaguePreview;
  seasonContext: {
    leagueId: string;
    year: number;
    seasonName: string;
  };
  onBack: () => void;
  leagueSlug?: string;
}

export default function ProviderImportForm({
  preview,
  seasonContext,
  onBack,
  leagueSlug,
}: ProviderImportFormProps) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(preview.leagueName);
  const [rounds, setRounds] = useState(preview.rounds);
  const [teams, setTeams] = useState<EditableTeam[]>(
    preview.teams.map((team) => ({
      externalId: team.externalId,
      ownerName: team.ownerName,
      teamName: team.teamName,
      ownerEmail: "",
    }))
  );
  const [isCreating, setIsCreating] = useState(false);
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function updateTeam(index: number, changes: Partial<EditableTeam>) {
    setTeams((current) =>
      current.map((team, i) => (i === index ? { ...team, ...changes } : team))
    );
  }

  function moveTeam(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= teams.length) return;
    setTeams((current) => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  }

  async function handleApprove() {
    if (!draftName.trim()) {
      setError("Draft name is required.");
      return;
    }
    if (rounds < 1 || rounds > 30) {
      setError("Rounds must be between 1 and 30.");
      return;
    }
    if (teams.some((team) => !team.teamName.trim())) {
      setError("Every team needs a name.");
      return;
    }
    const invalidEmail = teams.find(
      (team) => team.ownerEmail.trim() && !normalizeEmail(team.ownerEmail)
    );
    if (invalidEmail) {
      setError(`Enter a valid email for ${invalidEmail.ownerName}.`);
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const season = await createImportedLeagueSeason({
        leagueId: seasonContext.leagueId,
        year: seasonContext.year,
        seasonName: seasonContext.seasonName,
        draftName: draftName.trim(),
        rounds,
        teamNames: teams.map((team) => team.teamName.trim()),
      });

      if (!season.draftId) {
        throw new Error("The season was created without a linked draft.");
      }

      setCreatedDraftId(season.draftId);
      const setup = await getDraftSetup(season.draftId);
      const invitationErrors: string[] = [];

      for (const [index, team] of teams.entries()) {
        const email = normalizeEmail(team.ownerEmail);
        if (!email) continue;
        try {
          const result = await inviteOwner(season.draftId, email, setup.teams[index].id);
          if (result.warning) {
            invitationErrors.push(`${team.ownerName}: ${result.warning}`);
          }
        } catch (inviteError) {
          invitationErrors.push(
            `${team.ownerName}: ${inviteError instanceof Error ? inviteError.message : "invite failed"}`
          );
        }
      }

      if (invitationErrors.length > 0) {
        setError(`Season created, but some invitations failed: ${invitationErrors.join("; ")}`);
        return;
      }

      router.push(`/teams?draftId=${season.draftId}&tab=settings${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`);
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Unable to create the season."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      {preview.warnings.map((warning) => (
        <p key={warning} className="text-sm text-yellow-400">{warning}</p>
      ))}

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <label className="mb-1 block text-sm" htmlFor="import-draft-name">Draft name</label>
          <input
            id="import-draft-name"
            maxLength={100}
            className="w-full rounded border p-2"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm" htmlFor="import-rounds">Rounds</label>
          <input
            id="import-rounds"
            type="number"
            min={1}
            max={30}
            className="w-full rounded border p-2"
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-3">
        {teams.map((team, index) => (
          <div key={team.externalId} className="rounded border border-gray-800 p-3">
            <div className="flex items-center gap-2">
              <span className="w-8 text-center font-bold">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-400">
                  {team.ownerName}
                </p>
              </div>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveTeam(index, -1)}
                className="rounded bg-gray-800 px-2 py-1 disabled:opacity-30"
              >
                Up
              </button>
              <button
                type="button"
                disabled={index === teams.length - 1}
                onClick={() => moveTeam(index, 1)}
                className="rounded bg-gray-800 px-2 py-1 disabled:opacity-30"
              >
                Down
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                aria-label={`Team name for ${team.ownerName}`}
                maxLength={100}
                className="rounded border p-2"
                value={team.teamName}
                onChange={(e) => updateTeam(index, { teamName: e.target.value })}
              />
              <input
                aria-label={`Email for ${team.ownerName}`}
                type="email"
                maxLength={320}
                placeholder="Optional invitation email"
                className="rounded border p-2"
                value={team.ownerEmail}
                onChange={(e) => updateTeam(index, { ownerEmail: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded bg-gray-700 px-4 py-2 font-semibold"
        >
          Back
        </button>
        <button
          type="button"
          disabled={isCreating || Boolean(createdDraftId)}
          onClick={() => void handleApprove()}
          className="flex-1 rounded bg-blue-600 px-4 py-3 font-bold disabled:opacity-50"
        >
          {isCreating ? "Creating season..." : "Approve and Create Season"}
        </button>
      </div>

      {createdDraftId && (
        <button
          type="button"
          className="w-full rounded bg-gray-700 px-4 py-2"
          onClick={() => router.push(`/teams?draftId=${createdDraftId}&tab=settings${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`)}
        >
          Continue to Team Setup
        </button>
      )}
    </div>
  );
}
