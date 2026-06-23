"use client";

import Link from "next/link";
import LeagueWorkspaceHeader from "@/components/LeagueWorkspaceHeader";
import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";

export default function LeagueSeasons({ slug }: { slug: string }) {
  const { workspace, error, isLoading } = useLeagueWorkspace(slug);
  if (isLoading) return <main className="mx-auto max-w-5xl p-8">Loading seasons...</main>;
  if (error || !workspace) return <main className="mx-auto max-w-5xl p-8 text-red-500">{error || "League not found."}</main>;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <LeagueWorkspaceHeader league={workspace.league} canManage={workspace.canManage} />
      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Seasons</h2>
          {workspace.canManage && (
            <Link className="rounded bg-blue-600 px-4 py-2 font-semibold" href={`/leagues/${slug}/seasons/new`}>
              New Season
            </Link>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {workspace.seasons.length === 0 && <p className="text-gray-400">No seasons yet.</p>}
          {workspace.seasons.map((season) => (
            <article key={season.id} className="flex flex-col justify-between gap-3 rounded-xl border border-gray-700 p-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-bold">{season.name}</h3>
                <p className="capitalize text-gray-400">{season.status}</p>
              </div>
              {season.draft && (
                <Link className="text-blue-400 underline" href={season.draft.status === "setup" ? `/teams?draftId=${season.draft.id}` : `/draft?draftId=${season.draft.id}`}>
                  {season.draft.status === "setup" ? "Configure Draft" : "Open Draft"}
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
