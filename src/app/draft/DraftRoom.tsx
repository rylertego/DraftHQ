"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PickModal from "@/components/PickModal";
import DraftBoard from "@/components/DraftBoard";
import type { DraftPick } from "@/types/pick";
import type { DraftSetup } from "@/lib/draftApi";
import { getDraftSetup } from "@/lib/draftApi";
import { getDraftState, saveDraftState } from "@/lib/draftStorage";
import { getTeamOnClock } from "@/lib/draftLogic";
import {
  getParticipantAccessState,
  getParticipantForUser,
} from "@/lib/participantLogic";

interface DraftRoomProps {
  draftId: string | null;
}

export default function DraftRoom({ draftId }: DraftRoomProps) {
  const router = useRouter();
  const [setup, setSetup] = useState<DraftSetup | null>(null);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [selectedPick, setSelectedPick] = useState<number | null>(null);
  const [showPickModal, setShowPickModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!draftId) {
      router.replace("/create");
      return;
    }

    let cancelled = false;

    async function loadDraft() {
      try {
        const loadedSetup = await getDraftSetup(draftId as string);
        const savedState = getDraftState(draftId as string);

        if (!cancelled) {
          setSetup(loadedSetup);
          setPicks(savedState?.picks ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the draft."
          );
        }
      }
    }

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [draftId, router]);

  useEffect(() => {
    if (!draftId || !setup) {
      return;
    }

    saveDraftState({
      draftId,
      currentPick: picks.length + 1,
      picks,
    });
  }, [draftId, setup, picks]);

  if (error) {
    return <main className="p-8 text-red-500">{error}</main>;
  }

  if (!setup) {
    return <main className="p-8">Loading draft...</main>;
  }

  const teamNames = setup.teams.map((team) => team.name);
  const currentParticipant = getParticipantForUser(
    setup.participants,
    setup.currentUserId
  );
  const accessState = getParticipantAccessState(currentParticipant);
  const teamOnClock = getTeamOnClock(
    setup.teams,
    picks.length + 1,
    setup.draft.rounds
  );
  const canMakePick =
    accessState.kind === "assigned" &&
    accessState.teamId === teamOnClock?.id;
  const canUndoPick = currentParticipant?.role === "commissioner";

  let participantMessage: string;

  if (accessState.kind === "assigned") {
    const assignedTeam = setup.teams.find(
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
      <h1 className="text-4xl font-bold mb-2">{setup.draft.name}</h1>

      <p className="mb-8 text-gray-400">
        {teamNames.length} Teams | {setup.draft.rounds} Rounds
      </p>

      <p className="mb-6 border border-gray-700 rounded p-3">
        {participantMessage}
      </p>

      <div className="overflow-auto">
        <DraftBoard
          teams={teamNames}
          rounds={setup.draft.rounds}
          picks={picks}
          canMakePick={canMakePick}
          canUndoPick={canUndoPick}
          onSlotClick={(overallPickNumber) => {
            setSelectedPick(overallPickNumber);
            setShowPickModal(true);
          }}
          onUndoPick={() => {
            setPicks((current) =>
              [...current]
                .sort(
                  (first, second) =>
                    first.overallPickNumber - second.overallPickNumber
                )
                .slice(0, -1)
            );
          }}
        />
      </div>

      {showPickModal && selectedPick && (
        <PickModal
          onClose={() => {
            setShowPickModal(false);
            setSelectedPick(null);
          }}
          onSave={(playerName, position, nflTeam) => {
            const newPick: DraftPick = {
              overallPickNumber: selectedPick,
              playerName,
              position,
              nflTeam,
              draftedBy: "",
            };

            setPicks((current) => [
              ...current.filter(
                (pick) => pick.overallPickNumber !== selectedPick
              ),
              newPick,
            ]);

            setShowPickModal(false);
            setSelectedPick(null);
          }}
        />
      )}
    </main>
  );
}
