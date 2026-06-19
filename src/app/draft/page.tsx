"use client";

import { useEffect, useState } from "react";
import PickModal from "@/components/PickModal";
import { getDraftConfig, getDraftTeams } from "@/lib/storage";
import DraftBoard from "@/components/DraftBoard";
import type { DraftPick } from "@/types/pick";

export default function DraftBoardPage() {
  const [draftName, setDraftName] = useState("");
  const [rounds, setRounds] = useState(0);
  const [teams, setTeams] = useState<string[]>([]);
  
  const [showPickModal, setShowPickModal] = useState(false);

  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [selectedPick, setSelectedPick] = useState<number | null>(null);

  useEffect(() => {
    const config = getDraftConfig();

    if (!config) {
      return;
    }

    setDraftName(config.name);
    setRounds(config.rounds);
    setTeams(getDraftTeams());
  }, []);
  

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