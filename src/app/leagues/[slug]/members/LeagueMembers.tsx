"use client";

import LeagueWorkspaceHeader from "@/components/LeagueWorkspaceHeader";
import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";

export default function LeagueMembers({ slug }: { slug: string }) {
  const { workspace, error, isLoading } = useLeagueWorkspace(slug);
  if (isLoading) return <main className="mx-auto max-w-5xl p-8">Loading members...</main>;
  if (error || !workspace) return <main className="mx-auto max-w-5xl p-8 text-red-500">{error || "League not found."}</main>;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <LeagueWorkspaceHeader league={workspace.league} canManage={workspace.canManage} />
      <section>
        <h2 className="text-2xl font-bold">Members</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {workspace.members.map((member) => (
            <article key={member.id} className="flex items-center gap-3 rounded-xl border border-gray-700 p-4">
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 font-bold">
                  {member.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="font-semibold">{member.displayName}</h3>
                <p className="text-sm capitalize text-gray-400">{member.role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
