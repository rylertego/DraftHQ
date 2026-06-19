"use client";

import { useEffect, useState } from "react";
import { getDraftConfig, getDraftTeams } from "@/lib/storage";

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
        <table className="border-collapse border border-gray-700">
          <thead>
            <tr>
              <th className="border border-gray-700 p-2">
                Round
              </th>

              {teams.map((team) => (
                <th
                  key={team}
                  className="border border-gray-700 p-2 min-w-[150px]"
                >
                  {team}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Array.from(
              { length: rounds },
              (_, roundIndex) => (
                <tr key={roundIndex}>
                  <td className="border border-gray-700 p-2 font-bold">
                    {roundIndex + 1}
                  </td>

                  {teams.map((team) => (
                    <td
                      key={`${roundIndex}-${team}`}
                      className="border border-gray-700 p-4 h-16"
                    >
                    </td>
                  ))}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}