"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import {
  inviteLeagueMember,
  removeLeagueMember,
  setLeagueMemberRole,
  updateLeagueMemberProfile,
  uploadLeagueMemberAvatar,
} from "@/lib/leagueApi";
import { supabase } from "@/lib/supabase";
import type { LeagueMember } from "@/types/league";

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteMemberModal({ leagueId, onClose, onAdded }: { leagueId: string; onClose: () => void; onAdded: () => void }) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentInvite, setSentInvite] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await inviteLeagueMember(leagueId, email.trim());
      onAdded();
      setSentInvite(true);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add member.");
      setLoading(false);
    }
  }

  if (sentInvite) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: primary + "22" }}>
            <svg className="h-6 w-6" style={{ color: primary }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">Invitation sent</h2>
          <p className="mt-2 text-sm text-slate-400">
            <span className="text-white">{email}</span> has been invited. They will only join the league after accepting from their DraftHQ invitation inbox.
          </p>
          <button type="button" onClick={onClose}
            className="mt-5 w-full rounded-xl py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: primary, color: secondary }}>
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
        <p className="mt-1 text-sm text-slate-400">They&apos;ll receive a pending invitation and can join or decline from DraftHQ.</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email address</label>
            <input type="email" autoFocus className="w-full" placeholder="teammate@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !email.trim()}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary, color: secondary }}>
              {loading ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white">Remove {member.displayName}?</h2>
        <p className="mt-2 text-sm text-slate-400">They will be removed from this league. This does not affect any draft picks or history.</p>
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

// ── Edit league member profile modal ─────────────────────────────────────────

function EditMemberProfileModal({
  member,
  leagueId,
  onClose,
  onSaved,
}: {
  member: LeagueMember;
  leagueId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(member.nickname ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(member.avatarUrl);
  const [bio, setBio] = useState(member.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setUploadingAvatar(true);
    setError("");
    try {
      const url = await uploadLeagueMemberAvatar(leagueId, file);
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload image.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateLeagueMemberProfile(leagueId, {
        nickname,
        avatarUrl: avatarUrl ?? "",
        bio,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save profile.");
      setSaving(false);
    }
  }

  const initials = (nickname || member.displayName).charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white">Edit League Profile</h2>
        <p className="mt-1 text-sm text-slate-400">This profile is only visible within this league.</p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-5">

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="h-16 w-16 rounded-full border border-slate-700 object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 text-xl font-bold" style={{ backgroundColor: primary + "22", color: primary }}>
                  {initials}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="cursor-pointer rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                {uploadingAvatar ? "Uploading..." : "Upload photo"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  disabled={uploadingAvatar}
                  onChange={(e) => void handleAvatarChange(e)}
                />
              </label>
              {avatarUrl && (
                <button type="button" className="block text-xs text-slate-500 hover:text-red-400 transition-colors" onClick={() => setAvatarUrl(null)}>
                  Remove photo
                </button>
              )}
            </div>
          </div>

          {/* Nickname */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              League Nickname
            </label>
            <input
              type="text"
              maxLength={50}
              placeholder={member.displayName}
              className="w-full"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-600">Leave blank to use your display name.</p>
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bio / Trash Talk
            </label>
            <textarea
              maxLength={280}
              rows={3}
              className="w-full resize-none"
              placeholder="Your league persona..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <p className="mt-1 text-right text-xs text-slate-500">{bio.length}/280</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || uploadingAvatar}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary, color: secondary }}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
  onEditProfile,
  onSetRole,
}: {
  member: LeagueMember;
  canManage: boolean;
  isMainCommissioner: boolean;
  isSelf: boolean;
  onRemove: () => void;
  onEditProfile: () => void;
  onSetRole: (role: "co-commissioner" | "member") => void;
}) {
  const { accentColor: primary } = useLeagueTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = member.displayName.slice(0, 1).toUpperCase();

  const isCommissioner = member.role === "commissioner";
  const isCoCommissioner = member.role === "co-commissioner";
  const showMenu = canManage && !isSelf && !isCommissioner;

  const isElevated = isCommissioner || isCoCommissioner;

  return (
    <article className="group relative flex items-center gap-3 rounded-2xl border bg-slate-900 p-4" style={{ borderColor: isElevated ? primary + "44" : "rgba(100,116,139,0.2)" }}>
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: primary + "22", color: primary }}>
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold text-white">{member.displayName}</h3>
          {isSelf && <span className="text-xs text-slate-500">(you)</span>}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: isElevated ? primary : "#64748b" }}>
          {ROLE_LABELS[member.role] ?? member.role}
        </p>
        {member.bio && <p className="mt-1 truncate text-xs text-slate-500">{member.bio}</p>}
      </div>

      <div className="flex items-center gap-1">
        {isSelf && (
          <button
            type="button"
            onClick={onEditProfile}
            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Edit profile
          </button>
        )}
        {showMenu && (
          <div className="relative" onMouseLeave={() => setMenuOpen(false)}>
            <button type="button" onClick={() => setMenuOpen((o) => !o)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <circle cx="8" cy="3" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="8" cy="13" r="1.2" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 min-w-[180px] rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl">
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
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LeagueMembers({ slug: _slug, embedded = false }: { slug: string; embedded?: boolean }) {
  const { workspace, error, isLoading, reload } = useWorkspace();
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [removingMember, setRemovingMember] = useState<LeagueMember | null>(null);
  const [editingProfile, setEditingProfile] = useState<LeagueMember | null>(null);
  const [roleError, setRoleError] = useState("");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

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

  const content = (
    <div className="space-y-6">

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-white">
            Members <span className="text-lg font-normal text-slate-500">({workspace.members.length})</span>
          </h2>
          {workspace.canManage && (
            <button type="button" onClick={() => setShowInvite(true)}
              className="rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary, color: secondary }}>
              + Add Member
            </button>
          )}
        </div>

        {roleError && (
          <p className="mt-3 rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {roleError}
            <button type="button" className="ml-3 underline opacity-70 hover:opacity-100" onClick={() => setRoleError("")}>Dismiss</button>
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {workspace.members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              canManage={workspace.canManage}
              isMainCommissioner={isMainCommissioner}
              isSelf={member.userId === currentUserId}
              onRemove={() => setRemovingMember(member)}
              onEditProfile={() => setEditingProfile(member)}
              onSetRole={(role) => void handleSetRole(member, role)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-white">Past Members</h2>
        <p className="mt-4 rounded-2xl border bg-slate-900/40 px-6 py-8 text-center text-sm text-slate-500" style={{ borderColor: primary + "44" }}>
          Member history coming soon. Past members will appear here once archive tracking is enabled.
        </p>
      </section>

      {showInvite && (
        <InviteMemberModal leagueId={workspace.league.id} onClose={() => setShowInvite(false)} onAdded={reload} />
      )}
      {removingMember && (
        <RemoveConfirmModal member={removingMember} leagueId={workspace.league.id} onClose={() => setRemovingMember(null)} onRemoved={reload} />
      )}
      {editingProfile && (
        <EditMemberProfileModal member={editingProfile} leagueId={workspace.league.id} onClose={() => setEditingProfile(null)} onSaved={reload} />
      )}
    </div>
  );

  return content;
}
