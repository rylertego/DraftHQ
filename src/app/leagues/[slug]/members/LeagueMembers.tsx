"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import {
  getPendingLeagueInvitations,
  inviteLeagueMember,
  removeLeagueMember,
  revokeLeagueInvitation,
  setLeagueMemberRole,
  transferLeagueOwnership,
} from "@/lib/leagueApi";
import type { PendingLeagueInvitation } from "@/lib/leagueApi";
import { supabase } from "@/lib/supabase";
import type { LeagueMember } from "@/types/league";
import {
  CommandButton,
  CommandEmptyState,
  CommandModal,
  CommandPanel,
  CommandStatusBadge,
  commandHelperClass,
  commandInputClass,
  commandLabelClass,
} from "@/components/CommandCenterUI";

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteMemberModal({ leagueId, onClose, onAdded, onInviteSent }: { leagueId: string; onClose: () => void; onAdded: () => void; onInviteSent: (email: string) => void }) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await inviteLeagueMember(leagueId, email.trim());
      onAdded();
      onClose();
      onInviteSent(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add member.");
      setLoading(false);
    }
  }

  return (
    <CommandModal
      eyebrow="League Access"
      title="Add Member"
      description="They will receive a pending invitation and can join or decline from DraftHQ."
      badge={<CommandStatusBadge label="Invite" tone="ready" />}
      onClose={loading ? undefined : onClose}
      footer={(
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CommandButton type="button" onClick={onClose} disabled={loading} className="sm:min-w-28">
            Cancel
          </CommandButton>
          <CommandButton type="submit" form="invite-member-form" variant="primary" disabled={loading || !email.trim()} className="sm:min-w-40" style={{ backgroundColor: primary, color: secondary }}>
            {loading ? "Sending..." : "Send Invitation"}
          </CommandButton>
        </div>
      )}
    >
        <form id="invite-member-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className={commandLabelClass}>Email Address</label>
            <input type="email" autoFocus className={commandInputClass} placeholder="teammate@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className={commandHelperClass}>Invitations are managed from the Pending Invitations section.</p>
          </div>
          {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">{error}</p>}
        </form>
    </CommandModal>
  );
}

// ── Remove confirm modal ──────────────────────────────────────────────────────

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
    <CommandModal
      eyebrow="Member Access"
      title={`Remove ${member.displayName}?`}
      description="They will be removed from this league. This does not affect any draft picks or history."
      badge={<CommandStatusBadge label="Destructive" tone="danger" />}
      onClose={loading ? undefined : onClose}
      footer={(
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CommandButton type="button" onClick={onClose} disabled={loading} className="sm:min-w-28">Cancel</CommandButton>
          <CommandButton type="button" variant="danger" onClick={() => void handleRemove()} disabled={loading} className="sm:min-w-32">
            {loading ? "Removing..." : "Remove"}
          </CommandButton>
        </div>
      )}
    >
      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">{error}</p>}
    </CommandModal>
  );
}

// ── Transfer ownership confirm modal ─────────────────────────────────────────

function TransferOwnershipModal({ member, leagueId, onClose, onTransferred }: { member: LeagueMember; leagueId: string; onClose: () => void; onTransferred: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleTransfer() {
    setLoading(true);
    setError("");
    try {
      await transferLeagueOwnership(leagueId, member.userId);
      onTransferred();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to transfer ownership.");
      setLoading(false);
    }
  }

  return (
    <CommandModal
      eyebrow="Ownership"
      title={`Transfer ownership to ${member.displayName}?`}
      description="They will become the league owner with full commissioner control. You will be demoted to co-commissioner and retain access."
      badge={<CommandStatusBadge label="Requires Trust" tone="warning" />}
      onClose={loading ? undefined : onClose}
      footer={(
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <CommandButton type="button" onClick={onClose} disabled={loading} className="sm:min-w-28">Cancel</CommandButton>
          <CommandButton type="button" variant="danger" onClick={() => void handleTransfer()} disabled={loading} className="sm:min-w-44">
            {loading ? "Transferring..." : "Transfer Ownership"}
          </CommandButton>
        </div>
      )}
    >
      <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200">
        This cannot be undone without their cooperation.
      </p>
      {error && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">{error}</p>}
    </CommandModal>
  );
}

const ROLE_LABELS: Record<string, string> = {
  commissioner: "Commissioner",
  "co-commissioner": "Co-Commissioner",
  member: "Member",
};

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({
  member,
  canManage,
  isMainCommissioner,
  isSelf,
  onRemove,
  onSetRole,
  onTransferOwnership,
}: {
  member: LeagueMember;
  canManage: boolean;
  isMainCommissioner: boolean;
  isSelf: boolean;
  onRemove: () => void;
  onSetRole: (role: "co-commissioner" | "member") => void;
  onTransferOwnership: () => void;
}) {
  const { accentColor: primary } = useLeagueTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = member.displayName.slice(0, 1).toUpperCase();

  const isCommissioner = member.role === "commissioner";
  const isCoCommissioner = member.role === "co-commissioner";
  const showMenu = canManage && !isSelf && !isCommissioner;
  const isElevated = isCommissioner || isCoCommissioner;

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    // Each row is its own grid, so an `auto` last column sizes per row: 0px
    // where there is no action, ~110px on the row with Edit profile. That
    // dragged the role column left on one row and right on the others, and the
    // list read as misaligned. A fixed track makes every row share the same
    // geometry whether or not it has an action.
    <article className="group relative grid gap-3 border-b border-slate-800/80 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.35fr)_180px_132px] sm:items-center">
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover sm:absolute sm:left-4" />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black sm:absolute sm:left-4" style={{ backgroundColor: primary + "22", color: primary }}>
          {initials}
        </div>
      )}
      <div className="min-w-0 pl-14 sm:pl-14">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-bold text-white">{member.displayName}</h3>
          {isSelf && <span className="text-xs text-slate-500">(you)</span>}
        </div>
        {member.bio && <p className="mt-1 truncate text-xs text-slate-500">{member.bio}</p>}
      </div>

      {/* Role reads as a column, because that is what it is — every row has
          one. Badges are for exceptions, and a pill on some rows next to bare
          text on others made the column look broken. Uniform treatment, with
          colour still distinguishing elevated roles from ordinary membership. */}
      <div className="pl-14 sm:pl-0 sm:text-right">
        <span
          className={`text-xs font-bold uppercase tracking-[0.14em] ${
            isElevated ? "text-emerald-300" : "text-slate-400"
          }`}
        >
          {ROLE_LABELS[member.role] ?? member.role}
        </span>
      </div>

      <div className="flex items-center gap-2 pl-14 sm:justify-end sm:pl-0">
        {/* No "Edit profile" here. My Team owns the member's own profile, and
            a second entry point that opened a different modal was duplicate
            surface for the same job. */}
        {showMenu && (
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen((o) => !o)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-800 hover:text-white ${menuOpen ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"}`}
              aria-label={`Open actions for ${member.displayName}`}>
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <circle cx="8" cy="3" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="8" cy="13" r="1.2" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 min-w-[210px] rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl">
                {isMainCommissioner && (
                  isCoCommissioner ? (
                    <button type="button" onClick={() => { setMenuOpen(false); onSetRole("member"); }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                      Remove Co-Commissioner
                    </button>
                  ) : (
                    <button type="button" onClick={() => { setMenuOpen(false); onSetRole("co-commissioner"); }}
                      className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-slate-800"
                      style={{ color: primary }}>
                      Make Co-Commissioner
                    </button>
                  )
                )}
                <button type="button" onClick={() => { setMenuOpen(false); onRemove(); }}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors">
                  Remove member
                </button>
                {isMainCommissioner && (
                  <>
                    <hr className="my-1 border-slate-700" />
                    <button type="button" onClick={() => { setMenuOpen(false); onTransferOwnership(); }}
                      className="w-full px-4 py-2 text-left text-sm text-orange-400 hover:bg-slate-800 hover:text-orange-300 transition-colors">
                      Transfer Ownership
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LeagueMembers({ slug, embedded = false }: { slug: string; embedded?: boolean }) {
  const { workspace, error, isLoading, reload } = useWorkspace();
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [removingMember, setRemovingMember] = useState<LeagueMember | null>(null);
  const [transferringMember, setTransferringMember] = useState<LeagueMember | null>(null);
  const [roleError, setRoleError] = useState("");
  const [toastEmail, setToastEmail] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingLeagueInvitation[]>([]);
  const [pendingRev, setPendingRev] = useState(0);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showInviteSentToast(email: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastEmail(email);
    toastTimer.current = setTimeout(() => setToastEmail(null), 3500);
  }

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!workspace?.canManage || !workspace?.league.id) return;
    let active = true;
    void getPendingLeagueInvitations(workspace.league.id)
      .then((invites) => { if (active) setPendingInvites(invites); })
      .catch(() => {});
    return () => { active = false; };
  }, [workspace?.league.id, workspace?.canManage, pendingRev]);

  async function handleRevokeInvite(id: string) {
    setRevokingId(id);
    try {
      await revokeLeagueInvitation(id);
      setPendingInvites((prev) => prev.filter((inv) => inv.id !== id));
    } finally {
      setRevokingId(null);
    }
  }

  async function handleSetRole(member: LeagueMember, role: "co-commissioner" | "member") {
    if (!workspace) return;
    setRoleError("");
    try {
      await setLeagueMemberRole(workspace.league.id, member.id, role);
      reload();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "Unable to update role.");
    }
  }

  if (isLoading) return <div className="p-8 text-slate-400">Loading members...</div>;
  if (error || !workspace) return <div className="p-8 text-red-400">{error || "League not found."}</div>;

  const isMainCommissioner = workspace.league.ownerUserId === currentUserId;

  // Authority order: commissioner, then co-commissioners, then members. The API
  // returns join order, which put whoever signed up first at the top and made
  // the list read as arbitrary. Ties fall back to display name so the order is
  // stable rather than dependent on however the rows arrived.
  const ROLE_RANK: Record<string, number> = { commissioner: 0, "co-commissioner": 1, member: 2 };
  const orderedMembers = [...workspace.members].sort((a, b) => {
    const rank = (ROLE_RANK[a.role] ?? 99) - (ROLE_RANK[b.role] ?? 99);
    if (rank !== 0) return rank;
    return (a.nickname || a.displayName).localeCompare(b.nickname || b.displayName);
  });

  const elevatedCount = workspace.members.filter((member) => member.role === "commissioner" || member.role === "co-commissioner").length;
  const memberCount = workspace.members.length;

  const content = (
    <div className={`space-y-5 ${embedded ? "" : "p-6"}`} data-league-slug={slug}>
      <CommandPanel
        eyebrow="League Access"
        title="Members"
        description="Review who has league access, assign commissioner roles, and manage invitation status."
        action={workspace.canManage ? (
          <CommandButton type="button" variant="primary" onClick={() => setShowInvite(true)} style={{ backgroundColor: primary, color: secondary }}>
            Add Member
          </CommandButton>
        ) : undefined}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-950/35 p-3 ring-1 ring-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Current Members</p>
            <p className="mt-1 text-xl font-black text-white tabular-nums">{memberCount}</p>
          </div>
          <div className="rounded-xl bg-slate-950/35 p-3 ring-1 ring-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Commissioners</p>
            <p className="mt-1 text-xl font-black text-white tabular-nums">{elevatedCount}</p>
          </div>
          <div className="rounded-xl bg-slate-950/35 p-3 ring-1 ring-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Pending Invites</p>
            <p className="mt-1 text-xl font-black text-white tabular-nums">{pendingInvites.length}</p>
          </div>
        </div>

        {roleError && (
          <p className="mt-3 rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {roleError}
            <button type="button" className="ml-3 underline opacity-70 hover:opacity-100" onClick={() => setRoleError("")}>Dismiss</button>
          </p>
        )}

        <div className="overflow-visible rounded-xl border border-slate-800 bg-slate-950/30">
          {orderedMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              canManage={workspace.canManage}
              isMainCommissioner={isMainCommissioner}
              isSelf={member.userId === currentUserId}
              onRemove={() => setRemovingMember(member)}
              onSetRole={(role) => void handleSetRole(member, role)}
              onTransferOwnership={() => setTransferringMember(member)}
            />
          ))}
        </div>
      </CommandPanel>

      {workspace.canManage && pendingInvites.length > 0 && (
        <CommandPanel
          eyebrow="Invitations"
          title="Pending Invitations"
          description="Invites remain pending until the recipient accepts or a commissioner revokes them."
          action={<CommandStatusBadge label={`${pendingInvites.length} Pending`} tone="warning" />}
        >
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/30">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{inv.email}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {inv.teamName ? `Team: ${inv.teamName} · ` : ""}
                    Invited {new Date(inv.invitedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Cancel invitation"
                  disabled={revokingId === inv.id}
                  onClick={() => void handleRevokeInvite(inv.id)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-red-950/50 hover:text-red-400 disabled:opacity-40"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </CommandPanel>
      )}

      <CommandPanel eyebrow="Archive" title="Past Members" description="Former-member history will appear here once archive tracking is enabled.">
        <CommandEmptyState title="No former members tracked yet" description="DraftHQ currently preserves current membership and pending invitations. Past-member archive support is not enabled for this league." />
      </CommandPanel>

      {showInvite && (
        <InviteMemberModal leagueId={workspace.league.id} onClose={() => setShowInvite(false)} onAdded={() => { reload(); setPendingRev((r) => r + 1); }} onInviteSent={showInviteSentToast} />
      )}
      {removingMember && (
        <RemoveConfirmModal member={removingMember} leagueId={workspace.league.id} onClose={() => setRemovingMember(null)} onRemoved={reload} />
      )}
      {transferringMember && (
        <TransferOwnershipModal member={transferringMember} leagueId={workspace.league.id} onClose={() => setTransferringMember(null)} onTransferred={reload} />
      )}
    </div>
  );

  return (
    <>
      {toastEmail && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
          <div
            className="flex items-center gap-3 rounded-2xl border border-slate-600 bg-slate-800 px-5 py-3 shadow-2xl shadow-black/60"
            style={{ animation: "slide-down 0.25s ease" }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" style={{ color: primary }}>
              <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 6l8 5 8-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-semibold text-white">
              Invite sent to <span style={{ color: primary }}>{toastEmail}</span>
            </p>
          </div>
        </div>
      )}
      {content}
    </>
  );
}
