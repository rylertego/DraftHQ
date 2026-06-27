"use client";

import Link from "next/link";
import LeagueWorkspaceHeader from "@/components/LeagueWorkspaceHeader";
import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";
import { useLeagueTheme } from "@/context/LeagueThemeContext";

export default function LeagueSeasons({ slug }: { slug: string }) {
  const { workspace, error, isLoading } = useLeagueWorkspace(slug);
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();

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
              className="rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary, color: secondary }}
            >
              New Season
            </Link>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {workspace.seasons.length === 0 && (
            <p className="rounded-2xl border bg-slate-900 px-6 py-10 text-center text-sm text-slate-500" style={{ borderColor: primary + "44" }}>
              No seasons yet. Create one to get started.
            </p>
          )}
          {workspace.seasons.map((season) => (
            <article key={season.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border bg-slate-900 p-5 sm:flex-row sm:items-center"
              style={{ borderColor: primary + "44" }}
            >
              <div>
                <h3 className="font-bold text-white">{season.name}</h3>
                <p className="text-sm capitalize text-slate-400">{season.status}</p>
              </div>
              {season.draft && (
                <Link
                  className="text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: primary }}
                  href={season.draft.status === "setup" ? `/teams?draftId=${season.draft.id}&tab=settings&leagueSlug=${slug}` : `/draft?draftId=${season.draft.id}&leagueSlug=${slug}`}
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
