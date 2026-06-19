"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeamSetupPage() {
  const router = useRouter();

  const [teamNames, setTeamNames] = useState<string[]>([]);

  useEffect(() => {
    const config = localStorage.getItem("draftConfig");

    if (!config) {
      router.push("/create");
      return;
    }

    const draftConfig = JSON.parse(config);

    setTeamNames(
      Array.from(
        { length: draftConfig.teamCount },
        (_, i) => `Team ${i + 1}`
      )
    );
  }, [router]);

  function updateTeam(index: number, value: string) {
    const updated = [...teamNames];
    updated[index] = value;
    setTeamNames(updated);
  }

  function continueToDraft() {
    localStorage.setItem(
      "draftTeams",
      JSON.stringify(teamNames)
    );

    router.push("/draft");
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">
        Team Setup
      </h1>

      <div className="space-y-3">
        {teamNames.map((team, index) => (
          <input
            key={index}
            className="border rounded p-2 w-full"
            value={team}
            onChange={(e) =>
              updateTeam(index, e.target.value)
            }
          />
        ))}
      </div>

      <button
        onClick={continueToDraft}
        className="mt-6 bg-blue-600 text-white px-4 py-2 rounded"
      >
        Continue
      </button>
    </main>
  );
}