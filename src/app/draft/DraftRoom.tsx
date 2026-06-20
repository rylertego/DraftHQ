"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PickModal from "@/components/PickModal";
import DraftBoard from "@/components/DraftBoard";
import DraftTimer from "@/components/DraftTimer";
import {
  configureDraftTimer,
  makePick,
  pauseDraft,
  resumeDraft,
  startDraft,
  undoPick,
} from "@/lib/draftApi";
import { getTeamOnClock } from "@/lib/draftLogic";
import {
  getParticipantAccessState,
  getParticipantForUser,
} from "@/lib/participantLogic";
import { useRealtimeDraftRoom } from "@/hooks/useRealtimeDraftRoom";

interface DraftRoomProps {
  draftId: string | null;
}

export default function DraftRoom({ draftId }: DraftRoomProps) {
  const router = useRouter();
  const { snapshot, status, error, refresh } = useRealtimeDraftRoom(draftId);
  const [showPickModal, setShowPickModal] = useState(false);
  const [isMakingPick, setIsMakingPick] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isControllingDraft, setIsControllingDraft] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!draftId) {
      router.replace("/create");
    }
  }, [draftId, router]);

  async function handleMakePick(playerId: string) {
    if (!draftId) {
      return;
    }

    setActionError("");
    setIsMakingPick(true);

    try {
      await makePick(draftId, playerId);
      await refresh();
      setShowPickModal(false);
    } catch (pickError) {
      setActionError(
        pickError instanceof Error ? pickError.message : "Unable to make pick."
      );
    } finally {
      setIsMakingPick(false);
    }
  }

  async function handleUndoPick() {
    if (!draftId) {
      return;
    }

    setActionError("");
    setIsUndoing(true);

    try {
      await undoPick(draftId);
      await refresh();
    } catch (undoError) {
      setActionError(
        undoError instanceof Error ? undoError.message : "Unable to undo pick."
      );
    } finally {
      setIsUndoing(false);
    }
  }

  async function handleDraftControl(action: () => Promise<void>) {
    setActionError("");
    setIsControllingDraft(true);

    try {
      await action();
      await refresh();
    } catch (controlError) {
      setActionError(
        controlError instanceof Error
          ? controlError.message
          : "Unable to update the draft."
      );
    } finally {
      setIsControllingDraft(false);
    }
  }

  if (error && !snapshot) {
    return <main className="p-8 text-red-500">{error}</main>;
  }

  if (!snapshot) {
    return <main className="p-8">Connecting to draft room...</main>;
  }

  const teamNames = snapshot.teams.map((team) => team.name);
  const currentParticipant = getParticipantForUser(
    snapshot.participants,
    snapshot.currentUserId
  );
  const accessState = getParticipantAccessState(currentParticipant);
  const teamOnClock = getTeamOnClock(
    snapshot.teams,
    snapshot.draft.currentPick,
    snapshot.draft.rounds
  );
  const draftAcceptsPicks = snapshot.draft.status === "active";
  const canMakePick =
    draftAcceptsPicks &&
    accessState.kind === "assigned" &&
    accessState.teamId === teamOnClock?.id;
  const canUndoPick = currentParticipant?.role === "commissioner";
  const isCommissioner =
    snapshot.currentUserId === snapshot.draft.commissionerUserId;
  const assignedTeamCount = new Set(
    snapshot.participants.flatMap((participant) =>
      participant.teamId &&
      (participant.role === "commissioner" || participant.role === "owner")
        ? [participant.teamId]
        : []
    )
  ).size;
  const allTeamsAssigned = assignedTeamCount === snapshot.draft.teamCount;
  const draftedPlayerIds = new Set(
    snapshot.picks.map((pick) => pick.playerId)
  );
  const availablePlayers = snapshot.players.filter(
    (player) => !draftedPlayerIds.has(player.id)
  );

  let participantMessage: string;

  if (accessState.kind === "assigned") {
    const assignedTeam = snapshot.teams.find(
      (team) => team.id === accessState.teamId
    );
    participantMessage = `You control ${assignedTeam?.name ?? "an assigned team"}.`;
  } else if (accessState.kind === "viewer") {
    participantMessage = "You are viewing this draft and cannot make picks.";
  } else if (accessState.kind === "unassigned") {
    participantMessage = "You are joined but have not been assigned a team.";
  } else {
    participantMessage = "You are not a participant in this draft.";
  }

  return (
    <main className="p-8">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-4xl font-bold">{snapshot.draft.name}</h1>
        <span
          className={`text-sm capitalize ${
            status === "connected" ? "text-green-400" : "text-yellow-400"
          }`}
        >
          {status}
        </span>
      </div>

      <p className="mb-8 text-gray-400">
        {teamNames.length} Teams | {snapshot.draft.rounds} Rounds
      </p>

      <p className="mb-6 border border-gray-700 rounded p-3">
        {participantMessage}
      </p>

      {(error || actionError) && (
        <p className="mb-4 text-red-500">{actionError || error}</p>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-[220px_1fr]">
        <DraftTimer draft={snapshot.draft} />

        {isCommissioner && (
          <section className="rounded-lg border border-gray-700 p-4">
            <h2 className="font-bold">Commissioner Controls</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm" htmlFor="pick-timer">
                Pick time
              </label>
              <select
                id="pick-timer"
                className="rounded border bg-gray-900 p-2"
                value={snapshot.draft.pickSeconds}
                disabled={
                  isControllingDraft ||
                  !["setup", "paused"].includes(snapshot.draft.status)
                }
                onChange={(event) =>
                  void handleDraftControl(() =>
                    configureDraftTimer(
                      draftId as string,
                      Number(event.target.value)
                    )
                  )
                }
              >
                {[30, 45, 60, 90, 120, 180].map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds % 60 === 0
                      ? `${seconds / 60} ${
                          seconds === 60 ? "minute" : "minutes"
                        }`
                      : `${seconds} seconds`}
                  </option>
                ))}
              </select>

              {snapshot.draft.status === "setup" && (
                <button
                  type="button"
                  disabled={isControllingDraft || !allTeamsAssigned}
                  className="rounded bg-green-700 px-4 py-2 disabled:opacity-40"
                  onClick={() =>
                    void handleDraftControl(() => startDraft(draftId as string))
                  }
                >
                  Start Draft
                </button>
              )}
              {snapshot.draft.status === "active" && (
                <button
                  type="button"
                  disabled={isControllingDraft}
                  className="rounded bg-yellow-700 px-4 py-2 disabled:opacity-40"
                  onClick={() =>
                    void handleDraftControl(() => pauseDraft(draftId as string))
                  }
                >
                  Pause Draft
                </button>
              )}
              {snapshot.draft.status === "paused" && (
                <button
                  type="button"
                  disabled={isControllingDraft}
                  className="rounded bg-green-700 px-4 py-2 disabled:opacity-40"
                  onClick={() =>
                    void handleDraftControl(() => resumeDraft(draftId as string))
                  }
                >
                  Resume Draft
                </button>
              )}
            </div>
            {!allTeamsAssigned && snapshot.draft.status === "setup" && (
              <p className="mt-3 text-sm text-yellow-400">
                Assign an owner to every team before starting the draft.
              </p>
            )}
          </section>
        )}
      </div>

      <div className="overflow-auto">
        <DraftBoard
          teams={teamNames}
          rounds={snapshot.draft.rounds}
          picks={snapshot.picks}
          currentPickNumber={snapshot.draft.currentPick}
          draftStatus={snapshot.draft.status}
          canMakePick={canMakePick && !isMakingPick}
          canUndoPick={canUndoPick && !isUndoing}
          onSlotClick={() => {
            setActionError("");
            setShowPickModal(true);
          }}
          onUndoPick={handleUndoPick}
        />
      </div>

      {showPickModal && (
        <PickModal
          players={availablePlayers}
          isSaving={isMakingPick}
          error={actionError}
          onClose={() => {
            if (!isMakingPick) {
              setShowPickModal(false);
              setActionError("");
            }
          }}
          onSave={handleMakePick}
        />
      )}
    </main>
  );
}
