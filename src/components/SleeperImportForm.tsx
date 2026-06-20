"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSleeperDraft,
  getDraftSetup,
  getSleeperLeaguePreview,
  inviteOwner,
} from "@/lib/draftApi";
import { normalizeEmail } from "@/lib/email";
import { normalizeSleeperLeagueId } from "@/lib/sleeper";

interface EditableTeam {
  rosterId: number;
  ownerUserId: string | null;
  managerName: string;
  teamName: string;
  ownerEmail: string;
}

export default function SleeperImportForm() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [rounds, setRounds] = useState(15);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [teams, setTeams] = useState<EditableTeam[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function loadPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedId = normalizeSleeperLeagueId(leagueId);
    if (!normalizedId) {
      setError("Enter a valid Sleeper league ID.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const preview = await getSleeperLeaguePreview(normalizedId);
      setLeagueId(preview.leagueId);
      setLeagueName(preview.leagueName);
      setRounds(preview.rounds);
      setDraftId(preview.draftId);
      setWarnings(preview.warnings);
      setTeams(
        preview.teams.map((team) => ({
          rosterId: team.rosterId,
          ownerUserId: team.ownerUserId,
          managerName: team.managerName,
          teamName: team.teamName,
          ownerEmail: "",
        }))
      );
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Unable to preview the Sleeper league."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function updateTeam(index: number, changes: Partial<EditableTeam>) {
    setTeams((current) =>
      current.map((team, teamIndex) =>
        teamIndex === index ? { ...team, ...changes } : team
      )
    );
  }

  function moveTeam(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= teams.length) {
      return;
    }

    setTeams((current) => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [
        reordered[target],
        reordered[index],
      ];
      return reordered;
    });
  }

  async function approveImport() {
    if (!leagueName.trim()) {
      setError("League name is required.");
      return;
    }

    if (rounds < 1 || rounds > 30) {
      setError("Rounds must be between 1 and 30.");
      return;
    }

    if (teams.some((team) => !team.teamName.trim())) {
      setError("Every imported team needs a name.");
      return;
    }

    const invalidEmail = teams.find(
      (team) => team.ownerEmail.trim() && !normalizeEmail(team.ownerEmail)
    );
    if (invalidEmail) {
      setError(`Enter a valid email for ${invalidEmail.managerName}.`);
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const draft = await createSleeperDraft({
        name: leagueName.trim(),
        rounds,
        preview: {
          leagueId,
          draftId,
          leagueName: leagueName.trim(),
          rounds,
          warnings,
          teams: teams.map((team, index) => ({
            rosterId: team.rosterId,
            ownerUserId: team.ownerUserId,
            managerName: team.managerName,
            teamName: team.teamName.trim(),
            draftPosition: index + 1,
          })),
        },
      });
      setCreatedDraftId(draft.id);
      const setup = await getDraftSetup(draft.id);
      const invitationErrors: string[] = [];

      for (const [index, team] of teams.entries()) {
        const email = normalizeEmail(team.ownerEmail);
        if (!email) {
          continue;
        }

        try {
          await inviteOwner(draft.id, email, setup.teams[index].id);
        } catch (inviteError) {
          invitationErrors.push(
            `${team.managerName}: ${
              inviteError instanceof Error ? inviteError.message : "invite failed"
            }`
          );
        }
      }

      if (invitationErrors.length > 0) {
        setError(
          `Draft imported, but some invitations failed: ${invitationErrors.join("; ")}`
        );
        return;
      }

      router.push(`/teams?draftId=${draft.id}`);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to create the imported draft."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-700 p-5">
      <h2 className="text-xl font-bold">Import from Sleeper</h2>
      <p className="mt-1 text-sm text-gray-400">
        Preview league teams and draft order before anything is saved.
      </p>

      <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={loadPreview}>
        <input
          className="min-w-0 flex-1 rounded border p-2"
          inputMode="numeric"
          placeholder="Sleeper league ID"
          value={leagueId}
          onChange={(event) => setLeagueId(event.target.value)}
        />
        <button
          type="submit"
          disabled={isLoading || isCreating}
          className="rounded bg-purple-700 px-4 py-2 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Preview Import"}
        </button>
      </form>

      {teams.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <div>
              <label className="mb-1 block text-sm" htmlFor="sleeper-name">
                Draft name
              </label>
              <input
                id="sleeper-name"
                maxLength={100}
                className="w-full rounded border p-2"
                value={leagueName}
                onChange={(event) => setLeagueName(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm" htmlFor="sleeper-rounds">
                Rounds
              </label>
              <input
                id="sleeper-rounds"
                type="number"
                min={1}
                max={30}
                className="w-full rounded border p-2"
                value={rounds}
                onChange={(event) => setRounds(Number(event.target.value))}
              />
            </div>
          </div>

          {warnings.map((warning) => (
            <p key={warning} className="text-sm text-yellow-400">
              {warning}
            </p>
          ))}

          <div className="space-y-3">
            {teams.map((team, index) => (
              <div key={team.rosterId} className="rounded border border-gray-800 p-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 text-center font-bold">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-400">
                      Sleeper manager: {team.managerName}
                    </p>
                  </div>
                  <button type="button" disabled={index === 0} onClick={() => moveTeam(index, -1)} className="rounded bg-gray-800 px-2 py-1 disabled:opacity-30">Up</button>
                  <button type="button" disabled={index === teams.length - 1} onClick={() => moveTeam(index, 1)} className="rounded bg-gray-800 px-2 py-1 disabled:opacity-30">Down</button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    aria-label={`Team name for ${team.managerName}`}
                    maxLength={100}
                    className="rounded border p-2"
                    value={team.teamName}
                    onChange={(event) => updateTeam(index, { teamName: event.target.value })}
                  />
                  <input
                    aria-label={`Email for ${team.managerName}`}
                    type="email"
                    maxLength={320}
                    placeholder="Optional invitation email"
                    className="rounded border p-2"
                    value={team.ownerEmail}
                    onChange={(event) => updateTeam(index, { ownerEmail: event.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={isCreating || Boolean(createdDraftId)}
            className="w-full rounded bg-blue-600 px-4 py-3 font-bold disabled:opacity-50"
            onClick={() => void approveImport()}
          >
            {isCreating ? "Creating DraftHQ draft..." : "Approve and Create Draft"}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-red-500">{error}</p>}
      {createdDraftId && (
        <button
          type="button"
          className="mt-3 rounded bg-gray-700 px-4 py-2"
          onClick={() => router.push(`/teams?draftId=${createdDraftId}`)}
        >
          Continue to Team Setup
        </button>
      )}
    </section>
  );
}
