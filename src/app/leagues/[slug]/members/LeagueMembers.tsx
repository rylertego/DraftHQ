"use client";

import { useState } from "react";
import LeagueWorkspaceHeader from "@/components/LeagueWorkspaceHeader";
import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";
import { inviteLeagueMember, removeLeagueMember } from "@/lib/leagueApi";
import type { LeagueMember } from "@/types/league";

function InviteMemberModal({ leagueId, onClose, onAdded }: { leagueId: string; onClose: () => void; onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentInvite, setSentInvite] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { invited } = await inviteLeagueMember(leagueId, email.trim());
      onAdded();
      if (invited) {
        setSentInvite(true);
        setLoading(false);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add member.");
      setLoading(false);
    }
  }

  if (sentInvite) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-900/60">
            <svg className="h-6 w-6 text-teal-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">Invitation sent</h2>
          <p className="mt-2 text-sm text-slate-400">
            <span className="text-white">{email}</span> doesn&apos;t have a DraftHQ account yet. We&apos;ve sent them an invite — they&apos;ll be added to the league as soon as they sign up.
          </p>
          <button type="button" onClick={onClose}
            className="mt-5 w-full rounded-xl bg-teal-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400 transition-colors">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white">Add Member</h2>
        <p className="mt-1 text-sm text-slate-400">Enter the email address of the person you want to add. They must already have a DraftHQ account.</p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email address</label>
            <input
              type="email"
              autoFocus
              className="w-full"
              placeholder="teammate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !email.trim()}
              className="flex-1 rounded-xl bg-teal-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {loading ? "Adding..." : "Add Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RemoveConfirmModal({ member, leagueId, onClose, onRemoved }: { member: LeagueMember; leagueId: string; onClose: () => void; onRemoved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRemove() {
    setLoading(true);
    setError("");
    try {
      await removeLeagueMember(leagueId, member.id);
      onRemoved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove member.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white">Remove {member.displayName}?</h2>
        <p className="mt-2 text-sm text-slate-400">
          They will be removed from this league. This does not affect any draft picks or history.
        </p>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => void handleRemove()} disabled={loading}
            className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40 transition-colors">
            {loading ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberCard({ member, canManage, isCurrentUser, onRemove }: { member: LeagueMember; canManage: boolean; isCurrentUser: boolean; onRemove: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = member.displayName.slice(0, 1).toUpperCase();

  return (
    <article className="group relative flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4">
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-900 text-sm font-bold text-teal-200">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-white">{member.displayName}</h3>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{member.role}</p>
      </div>

      {canManage && !isCurrentUser && member.role !== "commissioner" && (
        <div className="relative" onMouseLeave={() => setMenuOpen(false)}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <circle cx="8" cy="3" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="8" cy="13" r="1.2" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 min-w-[140px] rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl">
              <button type="button" onClick={() => { setMenuOpen(false); onRemove(); }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors">
                Remove member
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function LeagueMembers({ slug }: { slug: string }) {
  const { workspace, error, isLoading, reload } = useLeagueWorkspace(slug);
  const [showInvite, setShowInvite] = useState(false);
  const [removingMember, setRemovingMember] = useState<LeagueMember | null>(null);

  if (isLoading) return <main className="w-full p-8 text-slate-400">Loading members...</main>;
  if (error || !workspace) return <main className="w-full p-8 text-red-400">{error || "League not found."}</main>;

  const currentMember = workspace.members.find((m) => m.role === "commissioner");

  return (
    <main className="w-full space-y-6 px-6 py-8">
      <LeagueWorkspaceHeader league={workspace.league} canManage={workspace.canManage} />

      {/* Active Members */}
      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-white">Members <span className="text-lg font-normal text-slate-500">({workspace.members.length})</span></h2>
          {workspace.canManage && (
            <button type="button" onClick={() => setShowInvite(true)}
              className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400 transition-colors">
              + Add Member
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {workspace.members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              canManage={workspace.canManage}
              isCurrentUser={member.id === currentMember?.id}
              onRemove={() => setRemovingMember(member)}
            />
          ))}
        </div>
      </section>

      {/* Past Members */}
      <section>
        <h2 className="text-2xl font-bold text-white">Past Members</h2>
        <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 px-6 py-8 text-center text-sm text-slate-500">
          Member history coming soon. Past members will appear here once archive tracking is enabled.
        </p>
      </section>

      {showInvite && (
        <InviteMemberModal
          leagueId={workspace.league.id}
          onClose={() => setShowInvite(false)}
          onAdded={reload}
        />
      )}

      {removingMember && (
        <RemoveConfirmModal
          member={removingMember}
          leagueId={workspace.league.id}
          onClose={() => setRemovingMember(null)}
          onRemoved={reload}
        />
      )}
    </main>
  );
}
