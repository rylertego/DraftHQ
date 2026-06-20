"use client";

import Link from "next/link";
import { useState } from "react";
import { assignTeam, removeDraftParticipant } from "@/lib/draftApi";
import { getAssignedTeamIds } from "@/lib/participantLogic";
import type {
  DraftParticipant,
  DraftStatus,
  Team,
} from "@/types/draft";

interface CommissionerParticipantManagerProps {
  draftId: string;
  status: DraftStatus;
  participants: DraftParticipant[];
  teams: Team[];
  onlineUserIds: string[];
  onChanged: () => Promise<void>;
}

export default function CommissionerParticipantManager({
  draftId,
  status,
  participants,
  teams,
  onlineUserIds,
  onChanged,
}: CommissionerParticipantManagerProps) {
  const [busyParticipantId, setBusyParticipantId] = useState<string | null>(
    null
  );
  const [error, setError] = useState("");
  const canManage = status === "setup" || status === "paused";
  const onlineUsers = new Set(onlineUserIds);

  async function updateAssignment(participantId: string, teamId: string) {
    setBusyParticipantId(participantId);
    setError("");

    try {
      await assignTeam(draftId, participantId, teamId || null);
      await onChanged();
    } catch (assignmentError) {
      setError(
        assignmentError instanceof Error
          ? assignmentError.message
          : "Unable to change the team assignment."
      );
    } finally {
      setBusyParticipantId(null);
    }
  }

  async function removeOwner(participant: DraftParticipant) {
    if (
      !window.confirm(
        `Remove ${participant.displayName} from this draft? Their team will become unassigned.`
      )
    ) {
      return;
    }

    setBusyParticipantId(participant.id);
    setError("");

    try {
      await removeDraftParticipant(draftId, participant.id);
      await onChanged();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove the owner."
      );
    } finally {
      setBusyParticipantId(null);
    }
  }

  return (
    <section className="rounded-lg border border-gray-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Owner Readiness</h2>
          <p className="text-sm text-gray-400">
            {canManage
              ? "Assignments can be changed while setup or paused."
              : "Pause the draft to reassign or replace an owner."}
          </p>
        </div>
        <Link
          className="text-sm text-blue-400 underline"
          href={`/teams?draftId=${draftId}`}
        >
          Manage invitations
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {participants.map((participant) => {
          const isOnline = onlineUsers.has(participant.userId);
          const unavailableTeamIds = getAssignedTeamIds(
            participants,
            participant.id
          );

          return (
            <div
              key={participant.id}
              className="grid gap-3 rounded border border-gray-800 p-3 sm:grid-cols-[1fr_180px_auto] sm:items-center"
            >
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isOnline ? "bg-green-400" : "bg-gray-600"
                    }`}
                  />
                  {participant.displayName}
                </div>
                <p className="text-xs capitalize text-gray-400">
                  {participant.role} | {isOnline ? "online" : "offline"}
                </p>
              </div>

              <select
                aria-label={`Team for ${participant.displayName}`}
                className="rounded border bg-gray-900 p-2"
                value={participant.teamId ?? ""}
                disabled={!canManage || busyParticipantId === participant.id}
                onChange={(event) =>
                  void updateAssignment(participant.id, event.target.value)
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

              {participant.role !== "commissioner" && (
                <button
                  type="button"
                  disabled={!canManage || busyParticipantId === participant.id}
                  className="rounded bg-red-900 px-3 py-2 text-sm disabled:opacity-40"
                  onClick={() => void removeOwner(participant)}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-red-500">{error}</p>}
    </section>
  );
}
