"use client";

import Link from "next/link";
import LeagueWorkspaceHeader from "@/components/LeagueWorkspaceHeader";
import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";

export default function LeagueHome({ slug }: { slug: string }) {
  const { workspace, error, isLoading } = useLeagueWorkspace(slug);

  if (isLoading) return <main className="mx-auto max-w-5xl p-8">Loading league...</main>;
  if (error || !workspace) return <main className="mx-auto max-w-5xl p-8 text-red-500">{error || "League not found."}</main>;

  const season = workspace.seasons[0];
  const draft = season?.draft;
  const draftIsLive = draft?.status === "active" || draft?.status === "paused";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <LeagueWorkspaceHeader league={workspace.league} canManage={workspace.canManage} />
      <section className={`rounded-xl border p-5 ${draftIsLive ? "border-green-600 bg-green-950/20" : "border-gray-700"}`}>
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">League status</p>
        <h2 className="mt-2 text-2xl font-bold">
          {draftIsLive ? "Draft active now" : season ? season.name : "Offseason"}
        </h2>
        {draft && (
          <Link className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 font-semibold" href={`/draft?draftId=${draft.id}`}>
            {draftIsLive ? "Enter Draft Room" : "Open Draft"}
          </Link>
        )}
      </section>
      <section className="rounded-xl border border-gray-700 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Current Season</h2>
          <Link className="text-blue-400 underline" href={`/leagues/${slug}/seasons`}>All seasons</Link>
        </div>
        {season ? (
          <div className="mt-3">
            <p className="text-lg font-semibold">{season.name}</p>
            <p className="capitalize text-gray-400">{season.status} · {workspace.members.length} members</p>
          </div>
        ) : (
          <p className="mt-3 text-gray-400">No season has been created yet.</p>
        )}
      </section>
    </main>
  );
}
