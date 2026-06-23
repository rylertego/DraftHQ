"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PickModal from "@/components/PickModal";
import DraftBoard from "@/components/DraftBoard";
import DraftTimer from "@/components/DraftTimer";
import DraftLobby from "@/components/DraftLobby";
import DraftChat from "@/components/DraftChat";
import CommissionerParticipantManager from "@/components/CommissionerParticipantManager";
import {
  commissionerMakePick,
  expireCurrentPick,
  extendClock,
  makePick,
  pauseDraft,
  resumeDraft,
  startDraft,
  undoPick,
} from "@/lib/draftApi";
import { createDraftResultsCsv } from "@/lib/draftExport";
import {
  getPickNumberInRound,
  getRoundForPick,
  getTeamOnClock,
} from "@/lib/draftLogic";
import type { Draft } from "@/types/draft";
import {
  getParticipantAccessState,
  getParticipantForUser,
} from "@/lib/participantLogic";
import { useRealtimeDraftRoom } from "@/hooks/useRealtimeDraftRoom";
import { formatLastSyncedAt } from "@/lib/draftRecovery";

interface DraftRoomProps {
  draftId: string | null;
}

export default function DraftRoom({ draftId }: DraftRoomProps) {
  const router = useRouter();
  const {
    snapshot,
    status,
    error,
    refresh,
    lastSyncedAt,
    isRefreshing,
    onlineUserIds,
    applyDraftUpdate,
  } = useRealtimeDraftRoom(draftId);
  const [showPickModal, setShowPickModal] = useState(false);
  const [isMakingPick, setIsMakingPick] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isControllingDraft, setIsControllingDraft] = useState(false);
  const [actionError, setActionError] = useState("");
  const [pickMode, setPickMode] = useState<"owner" | "commissioner">("owner");
  const [isExpiringPick, setIsExpiringPick] = useState(false);

  useEffect(() => {
    if (!draftId) {
      router.replace("/create");
    }
  }, [draftId, router]);

  async function handleMakePick(playerId: string) {
    if (!draftId || !snapshot) {
      return;
    }

    if (status !== "connected") {
      setActionError(
        "Drafting is disabled until the room reconnects and refreshes."
      );
      return;
    }

    setActionError("");
    setIsMakingPick(true);

    try {
      if (pickMode === "commissioner") {
        await commissionerMakePick(
          draftId,
          playerId,
          snapshot.draft.currentPick
        );
      } else {
        await makePick(draftId, playerId, snapshot.draft.currentPick);
      }
      await refresh();
      setShowPickModal(false);
      setPickMode("owner");
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

    if (!window.confirm("Undo the latest pick and put that team back on the clock?")) {
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

  function downloadResults() {
    const csv = createDraftResultsCsv(snapshot?.teams ?? [], snapshot?.picks ?? []);
    const blobUrl = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${snapshot?.draft.name ?? "draft"}-results.csv`
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-");
    link.click();
    URL.revokeObjectURL(blobUrl);
  }

  async function handleDraftControl(action: () => Promise<Draft>) {
    setActionError("");
    setIsControllingDraft(true);

    try {
      const updatedDraft = await action();
      applyDraftUpdate(updatedDraft);
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

  const handleTimerExpired = useCallback(() => {
    if (!draftId || !snapshot || isExpiringPick) return;
    if (status !== "connected") return;
    if (snapshot.currentUserId !== snapshot.draft.commissionerUserId) return;

    const expectedPick = snapshot.draft.currentPick;
    setIsExpiringPick(true);

    void expireCurrentPick(draftId, expectedPick)
      .then((updatedDraft) => {
        applyDraftUpdate(updatedDraft);
        return refresh();
      })
      .catch((err: unknown) => {
        setActionError(
          err instanceof Error ? err.message : "Unable to expire pick."
        );
      })
      .finally(() => {
        setIsExpiringPick(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, snapshot?.draft.currentPick, snapshot?.currentUserId, snapshot?.draft.commissionerUserId, isExpiringPick, status]);

  async function handleExtendClock() {
    if (!draftId || !snapshot) return;
    try {
      const updatedDraft = await extendClock(draftId, snapshot.draft.currentPick);
      applyDraftUpdate(updatedDraft);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to extend clock."
      );
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
    status === "connected" &&
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
  const currentParticipantId = currentParticipant?.id ?? null;

  // Show lobby before the draft starts
  if (snapshot.draft.status === "setup") {
    return (
      <>
        <DraftLobby
          draft={snapshot.draft}
          participants={snapshot.participants}
          teams={snapshot.teams}
          onlineUserIds={onlineUserIds}
          currentUserId={snapshot.currentUserId}
          isCommissioner={isCommissioner}
          allTeamsAssigned={allTeamsAssigned}
          isStarting={isControllingDraft}
          onStart={() =>
            void handleDraftControl(() => startDraft(draftId as string))
          }
        />
        <DraftChat
          draftId={draftId as string}
          participantId={currentParticipantId}
          isCommissioner={isCommissioner}
        />
      </>
    );
  }

  const draftedPlayerIds = new Set(
    snapshot.picks.map((pick) => pick.playerId)
  );
  const availablePlayers = snapshot.players.filter(
    (player) => !draftedPlayerIds.has(player.id)
  );
  const currentRound = teamOnClock
    ? getRoundForPick(snapshot.draft.currentPick, snapshot.draft.teamCount)
    : null;
  const currentPickInRound = teamOnClock
    ? getPickNumberInRound(
        snapshot.draft.currentPick,
        snapshot.draft.teamCount
      )
    : null;

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
    <main className="p-4 pb-28 sm:p-8 sm:pb-8">
      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-4xl">
          {snapshot.draft.name}
        </h1>
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

      {teamOnClock && snapshot.draft.status !== "complete" && (
        <section
          aria-live="polite"
          className={`mb-6 rounded-xl border p-4 sm:p-5 ${
            canMakePick
              ? "border-green-500 bg-green-950/40"
              : "border-blue-700 bg-blue-950/30"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-300">
            {canMakePick ? "Your pick" : "On the clock"}
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-3xl font-bold sm:text-4xl">
              {teamOnClock.name}
            </h2>
            <p className="text-sm text-gray-300">
              Overall {snapshot.draft.currentPick} | Round {currentRound}, Pick{" "}
              {currentPickInRound}
            </p>
          </div>
        </section>
      )}

      {status !== "connected" && (
        <section
          role="status"
          className="mb-4 flex flex-col gap-3 rounded border border-yellow-700 bg-yellow-950/40 p-3 sm:flex-row sm:items-center"
        >
          <div className="flex-1">
            <p className="font-semibold">
              {status === "connecting"
                ? "Refreshing draft state..."
                : "Draft room connection interrupted"}
            </p>
            <p className="text-sm text-gray-300">
              Picks are disabled to prevent stale submissions. {" "}
              {formatLastSyncedAt(lastSyncedAt)}.
            </p>
          </div>
          <button
            type="button"
            disabled={isRefreshing}
            className="rounded bg-yellow-700 px-4 py-2 font-semibold disabled:opacity-50"
            onClick={() => void refresh()}
          >
            {isRefreshing ? "Refreshing..." : "Retry Now"}
          </button>
        </section>
      )}

      {(error || actionError) && (
        <p className="mb-4 text-red-500">{actionError || error}</p>
      )}

      {snapshot.draft.status === "complete" && (
        <section className="mb-6 flex flex-col gap-3 rounded-lg border border-green-700 bg-green-950/30 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h2 className="text-xl font-bold">Draft Complete</h2>
            <p className="text-sm text-gray-300">
              All {snapshot.picks.length} picks are saved in DraftHQ.
            </p>
          </div>
          <button
            type="button"
            className="rounded bg-green-700 px-4 py-2 font-semibold"
            onClick={downloadResults}
          >
            Export Results
          </button>
        </section>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-[220px_1fr]">
        <DraftTimer
          draft={snapshot.draft}
          serverTimeOffsetMs={snapshot.serverTimeOffsetMs}
          canExtend={canMakePick || isCommissioner}
          onExpired={handleTimerExpired}
          onExtend={() => void handleExtendClock()}
        />

        {isCommissioner && (
          <section className="rounded-lg border border-gray-700 p-4">
            <h2 className="font-bold">Commissioner Controls</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
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
              {snapshot.draft.status === "active" && teamOnClock && (
                <button
                  type="button"
                  disabled={isControllingDraft || status !== "connected"}
                  className="rounded bg-blue-700 px-4 py-2 disabled:opacity-40"
                  onClick={() => {
                    setPickMode("commissioner");
                    setShowPickModal(true);
                  }}
                >
                  Recovery Pick for {teamOnClock.name}
                </button>
              )}
              {isExpiringPick && (
                <span className="text-sm text-gray-400">Advancing pick...</span>
              )}
            </div>
          </section>
        )}
      </div>

      {isCommissioner && (
        <div className="mb-6">
          <CommissionerParticipantManager
            draftId={draftId as string}
            status={snapshot.draft.status}
            participants={snapshot.participants}
            teams={snapshot.teams}
            onlineUserIds={onlineUserIds}
            onChanged={refresh}
          />
        </div>
      )}

      <div className="overflow-auto">
        <DraftBoard
          teams={teamNames}
          rounds={snapshot.draft.rounds}
          picks={snapshot.picks}
          currentPickNumber={snapshot.draft.currentPick}
          draftStatus={snapshot.draft.status}
          canMakePick={canMakePick && !isMakingPick}
          canUndoPick={canUndoPick && !isUndoing}
          myTeamName={
            accessState.kind === "assigned"
              ? snapshot.teams.find((t) => t.id === accessState.teamId)?.name
              : undefined
          }
          onSlotClick={() => {
            setActionError("");
            setPickMode("owner");
            setShowPickModal(true);
          }}
          onUndoPick={handleUndoPick}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-700 bg-gray-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        {canMakePick ? (
          <button
            type="button"
            className="w-full rounded bg-blue-600 px-4 py-3 font-bold text-white"
            onClick={() => {
              setActionError("");
              setPickMode("owner");
              setShowPickModal(true);
            }}
          >
            Make Pick for {teamOnClock?.name}
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                On the clock
              </p>
              <p className="font-semibold">
                {teamOnClock?.name ?? "Draft complete"}
              </p>
            </div>
            <span className="text-sm capitalize text-gray-400">{status}</span>
          </div>
        )}
      </div>

      {showPickModal && (
        <PickModal
          title={
            pickMode === "commissioner"
              ? `Recovery Pick for ${teamOnClock?.name ?? "Team"}`
              : "Select Draft Pick"
          }
          players={availablePlayers}
          isSaving={isMakingPick}
          error={actionError}
          onClose={() => {
            if (!isMakingPick) {
              setShowPickModal(false);
              setPickMode("owner");
              setActionError("");
            }
          }}
          onSave={handleMakePick}
        />
      )}

      <DraftChat
        draftId={draftId as string}
        participantId={currentParticipantId}
        isCommissioner={isCommissioner}
      />
    </main>
  );
}
