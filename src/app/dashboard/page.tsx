"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyLeagueWorkspaces } from "@/lib/leagueApi";
import type { LeagueWorkspace } from "@/types/league";

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<LeagueWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getMyLeagueWorkspaces()
      .then((results) => {
        if (active) setWorkspaces(results);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your leagues."
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400">Your DraftHQ league workspaces.</p>
        </div>
        <Link className="rounded bg-blue-600 px-4 py-2 font-semibold" href="/leagues/new">
          New League
        </Link>
      </div>

      {isLoading && <p>Loading leagues...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!isLoading && !error && workspaces.length === 0 && (
        <section className="rounded-xl border border-gray-700 p-6 text-center">
          <h2 className="text-xl font-bold">No leagues yet</h2>
          <p className="mt-2 text-gray-400">Create a league or continue using standalone drafts.</p>
          <Link className="mt-4 inline-block text-blue-400 underline" href="/create">
            Create a standalone draft
          </Link>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {workspaces.map((workspace) => {
          const currentSeason = workspace.seasons[0];
          const draftStatus = currentSeason?.draft?.status;
          const status =
            draftStatus === "active" || draftStatus === "paused"
              ? "Draft active now"
              : currentSeason
                ? `${currentSeason.year} ${currentSeason.status}`
                : "Offseason";

          return (
            <Link
              key={workspace.league.id}
              href={`/leagues/${workspace.league.slug}`}
              className="rounded-xl border border-gray-700 bg-gray-950 p-5 hover:border-blue-500"
            >
              <div className="flex items-center gap-3">
                {workspace.league.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={workspace.league.logoUrl} alt="" className="h-12 w-12 rounded object-cover" />
                )}
                <div>
                  <h2 className="text-xl font-bold">{workspace.league.name}</h2>
                  <p className="text-sm capitalize text-gray-400">{status}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
