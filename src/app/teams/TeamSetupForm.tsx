"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignTeam,
  getDraftSetup,
  renameTeams,
  type DraftSetup,
} from "@/lib/draftApi";
import { getAssignedTeamIds } from "@/lib/participantLogic";
import type { Team } from "@/types/draft";

interface TeamSetupFormProps {
  draftId: string | null;
}

export default function TeamSetupForm({ draftId }: TeamSetupFormProps) {
  const router = useRouter();
  const [setup, setSetup] = useState<DraftSetup | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assigningParticipantId, setAssigningParticipantId] = useState<
    string | null
  >(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!draftId) {
      router.replace("/create");
      return;
    }

    let cancelled = false;

    async function loadTeams() {
      try {
        const loadedSetup = await getDraftSetup(draftId as string);

        if (!cancelled) {
          setSetup(loadedSetup);
          setTeams(loadedSetup.teams);
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

  async function refreshParticipants() {
    if (!draftId) {
      return;
    }

    setError("");
    setIsRefreshing(true);

    try {
      const refreshedSetup = await getDraftSetup(draftId);
      setSetup(refreshedSetup);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh participants."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function updateAssignment(participantId: string, teamId: string) {
    if (!draftId || !setup) {
      return;
    }

    setError("");
    setAssigningParticipantId(participantId);

    try {
      const updatedParticipant = await assignTeam(
        draftId,
        participantId,
        teamId || null
      );

      setSetup({
        ...setup,
        participants: setup.participants.map((participant) =>
          participant.id === participantId ? updatedParticipant : participant
        ),
      });
    } catch (assignmentError) {
      setError(
        assignmentError instanceof Error
          ? assignmentError.message
          : "Unable to assign the team."
      );
    } finally {
      setAssigningParticipantId(null);
    }
  }

  async function copyJoinLink() {
    if (!setup) {
      return;
    }

    const joinUrl = `${window.location.origin}/join/${setup.draft.joinCode}`;

    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopyStatus("Join link copied.");
    } catch {
      setCopyStatus(`Share this link: ${joinUrl}`);
    }
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

  if (!setup) {
    return (
      <main className="max-w-2xl mx-auto p-8 text-red-500">
        {error || "Unable to load draft setup."}
      </main>
    );
  }

  const isCommissioner =
    setup.currentUserId === setup.draft.commissionerUserId;

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-8">
      <section>
        <h1 className="text-3xl font-bold mb-2">Team Setup</h1>
        <p className="text-gray-400">Join code: {setup.draft.joinCode}</p>
        <div className="flex items-center gap-3 mt-3">
          <a
            className="text-blue-400 underline"
            href={`/join/${setup.draft.joinCode}`}
            target="_blank"
            rel="noreferrer"
          >
            Open join page
          </a>
          <button
            type="button"
            className="bg-gray-700 px-3 py-1 rounded"
            onClick={copyJoinLink}
          >
            Copy Join Link
          </button>
        </div>
        {copyStatus && <p className="text-sm text-gray-400 mt-2">{copyStatus}</p>}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-3">Teams</h2>
        <div className="space-y-3">
          {teams.map((team) => (
            <input
              key={team.id}
              disabled={!isCommissioner}
              className="border rounded p-2 w-full disabled:opacity-60"
              value={team.name}
              onChange={(event) => updateTeam(team.id, event.target.value)}
            />
          ))}
        </div>
      </section>

      {isCommissioner && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">Owners</h2>
            <button
              type="button"
              disabled={isRefreshing}
              className="bg-gray-700 disabled:opacity-50 px-3 py-1 rounded"
              onClick={refreshParticipants}
            >
              {isRefreshing ? "Refreshing..." : "Refresh Owners"}
            </button>
          </div>

          <div className="space-y-3">
            {setup.participants.map((participant) => {
              const unavailableTeamIds = getAssignedTeamIds(
                setup.participants,
                participant.id
              );

              return (
                <div
                  key={participant.id}
                  className="border border-gray-700 rounded p-3 flex items-center gap-3"
                >
                  <div className="flex-1">
                    <div className="font-semibold">{participant.displayName}</div>
                    <div className="text-xs text-gray-400 capitalize">
                      {participant.role}
                    </div>
                  </div>

                  <select
                    aria-label={`Team for ${participant.displayName}`}
                    className="border rounded p-2 bg-gray-900"
                    value={participant.teamId ?? ""}
                    disabled={assigningParticipantId === participant.id}
                    onChange={(event) =>
                      updateAssignment(participant.id, event.target.value)
                    }
                  >
                    <option value="">Unassigned</option>
                    {teams.map((team) => (
                      <option
                        key={team.id}
                        value={team.id}
                        disabled={unavailableTeamIds.includes(team.id)}
                      >
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {isCommissioner ? (
        <button
          onClick={continueToDraft}
          disabled={isSaving || teams.length === 0}
          className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded"
        >
          {isSaving ? "Saving..." : "Continue"}
        </button>
      ) : (
        <button
          onClick={() => router.push(`/draft?draftId=${draftId}`)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Open Draft
        </button>
      )}
    </main>
  );
}
