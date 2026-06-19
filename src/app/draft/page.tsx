"use client";

import { useEffect, useState } from "react";
import PickModal from "@/components/PickModal";
import { getDraftConfig, getDraftTeams } from "@/lib/storage";
import DraftBoard from "@/components/DraftBoard";
import type { DraftPick } from "@/types/pick";
import { getDraftState, saveDraftState } from "@/lib/draftStorage";

export default function DraftBoardPage() {
  const [draftName, setDraftName] = useState("");
  const [rounds, setRounds] = useState(0);
  const [teams, setTeams] = useState<string[]>([]);
  
  const [showPickModal, setShowPickModal] = useState(false);

  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [selectedPick, setSelectedPick] = useState<number | null>(null);

  useEffect(() => {
  const savedState = getDraftState();

  if (savedState) {
    setDraftName(savedState.draftName);
    setRounds(savedState.rounds);
    setTeams(savedState.teams);
    setPicks(savedState.picks);
    return;
  }

  const config = getDraftConfig();

  if (!config) {
    return;
  }

  const storedTeams = getDraftTeams();

  setDraftName(config.name);
  setRounds(config.rounds);
  setTeams(storedTeams);
}, []);

useEffect(() => {
  if (!draftName || teams.length === 0 || rounds === 0) {
    return;
  }

  saveDraftState({
    draftName,
    teamCount: teams.length,
    rounds,
    teams,
    currentPick: picks.length + 1,
    picks,
  });
}, [draftName, teams, rounds, picks]);
  

  return (
    <main className="p-8">
      <h1 className="text-4xl font-bold mb-2">
        {draftName}
      </h1>

      <p className="mb-8 text-gray-400">
        {teams.length} Teams • {rounds} Rounds
      </p>

      <div className="overflow-auto">
        <button
  className="bg-green-600 px-4 py-2 rounded mb-4"
  onClick={() => setShowPickModal(true)}
>
  Test Pick Modal
</button>

        <DraftBoard
  teams={teams}
  rounds={rounds}
  picks={picks}
  onSlotClick={(overallPickNumber) => {
    setSelectedPick(overallPickNumber);
    setShowPickModal(true);
  }}
  onUndoPick={() => {
    setPicks((current) =>
      current
        .sort(
          (a, b) =>
            a.overallPickNumber - b.overallPickNumber
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