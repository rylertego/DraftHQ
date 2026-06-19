"use client";

import { useEffect, useState } from "react";
import { getDraftConfig, getDraftTeams } from "@/lib/storage";
import DraftBoard from "@/components/DraftBoard";

export default function DraftBoardPage() {
  const [draftName, setDraftName] = useState("");
  const [rounds, setRounds] = useState(0);
  const [teams, setTeams] = useState<string[]>([]);

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
        <DraftBoard teams={teams} rounds={rounds} />

      </div>
    </main>
  );
}