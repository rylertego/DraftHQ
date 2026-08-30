"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Panel, Select } from "@/components/ui";
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
  leagueSlug?: string;
  embedded?: boolean;
}

export default function CommissionerParticipantManager({
  draftId,
  status,
  participants,
  teams,
  onlineUserIds,
  onChanged,
  leagueSlug,
  embedded = false,
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

  const content = (
    <>
      {embedded ? (
        <div className="mb-[var(--space-3)] flex justify-end">
          <Link
            className="text-sm font-semibold text-[color:var(--color-league-accent)] underline-offset-4 hover:underline"
            href={`/teams?draftId=${draftId}&tab=settings${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`}
          >
            Manage invitations
          </Link>
        </div>
      ) : null}

      {error ? (
        <Alert status="danger" title="Unable to update participant">
          {error}
        </Alert>
      ) : null}

      <div className="mt-[var(--space-4)] grid gap-[var(--space-3)]">
        {participants.map((participant) => {
          const isOnline = onlineUsers.has(participant.userId);
          const unavailableTeamIds = getAssignedTeamIds(
            participants,
            participant.id
          );

          return (
            <div
              key={participant.id}
              className="grid gap-[var(--space-3)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] p-[var(--space-3)] sm:grid-cols-[minmax(0,1fr)_minmax(160px,220px)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-[var(--space-2)] font-semibold text-[color:var(--color-text-primary)]">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      isOnline ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{participant.displayName}</span>
                </div>
                <div className="mt-[var(--space-1)] flex flex-wrap items-center gap-[var(--space-2)] text-xs text-[color:var(--color-text-secondary)]">
                  <span className="capitalize">{participant.role}</span>
                  <span>{isOnline ? "Online" : "Offline"}</span>
                </div>
              </div>

              <Select
                aria-label={`Team for ${participant.displayName}`}
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
              </Select>

              {participant.role !== "commissioner" && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={!canManage || busyParticipantId === participant.id}
                  onClick={() => void removeOwner(participant)}
                >
                  Remove
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Panel
      title="Seat Owners"
      description={
        canManage
          ? "Assign joined owners to draft seats while setup or paused."
          : "Pause the draft to reassign or replace an owner."
      }
      actions={
        <Link
          className="text-sm font-semibold text-[color:var(--color-league-accent)] underline-offset-4 hover:underline"
          href={`/teams?draftId=${draftId}&tab=settings${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`}
        >
          Manage invitations
        </Link>
      }
    >
      {content}
    </Panel>
  );
}
