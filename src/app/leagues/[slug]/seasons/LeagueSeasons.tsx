"use client";

import Link from "next/link";
import LeagueWorkspaceHeader from "@/components/LeagueWorkspaceHeader";
import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";

export default function LeagueSeasons({ slug }: { slug: string }) {
  const { workspace, error, isLoading } = useLeagueWorkspace(slug);
  if (isLoading) return <main className="px-6 py-8 text-slate-400">Loading seasons...</main>;
  if (error || !workspace) return <main className="px-6 py-8 text-red-400">{error || "League not found."}</main>;

  return (
    <main className="w-full space-y-6 px-6 py-8">
      <LeagueWorkspaceHeader league={workspace.league} canManage={workspace.canManage} />
      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-white">Seasons</h2>
          {workspace.canManage && (
            <Link
              href={`/leagues/${slug}/seasons/new`}
              className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400 transition-colors"
            >
              New Season
            </Link>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {workspace.seasons.length === 0 && (
            <p className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-10 text-center text-sm text-slate-500">
              No seasons yet. Create one to get started.
            </p>
          )}
          {workspace.seasons.map((season) => (
            <article
              key={season.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:flex-row sm:items-center"
            >
              <div>
                <h3 className="font-bold text-white">{season.name}</h3>
                <p className="text-sm capitalize text-slate-400">{season.status}</p>
              </div>
              {season.draft && (
                <Link
                  className="text-sm font-medium text-teal-400 hover:text-teal-300"
                  href={season.draft.status === "setup" ? `/teams?draftId=${season.draft.id}` : `/draft?draftId=${season.draft.id}`}
                >
                  {season.draft.status === "setup" ? "Configure Draft →" : "Open Draft →"}
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
