"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import {
  getLeagueTeams,
  createLeagueTeam,
  updateLeagueTeamDetails,
  uploadLeagueTeamLogo,
  deleteLeagueTeam,
  archiveLeagueTeam,
  unarchiveLeagueTeam,
  assignLeagueTeamOwner,
  inviteLeagueMember,
} from "@/lib/leagueApi";
import type { LeagueMember, LeagueTeam } from "@/types/league";

const INPUT_CLS = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-teal-500 focus:outline-none disabled:opacity-50 transition-colors";
const LABEL_CLS = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400";

// ── Add Team modal ────────────────────────────────────────────────────────────

function AddTeamModal({
  leagueId,
  members,
  onClose,
  onAdded,
}: {
  leagueId: string;
  members: LeagueMember[];
  onClose: () => void;
  onAdded: (team: LeagueTeam) => void;
}) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const team = await createLeagueTeam(leagueId, {
        name: name.trim(),
        shortName: shortName.trim() || undefined,
        ownerUserId: ownerUserId || null,
        ownerName: ownerName.trim() || undefined,
      });
      if (inviteEmail.trim() && !ownerUserId) {
        await inviteLeagueMember(leagueId, inviteEmail.trim());
      }
      onAdded(team);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add team.");
    } finally {
      setLoading(false);
    }
  }

  const useInvite = !ownerUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 my-auto">
        <h2 className="mb-5 text-lg font-bold text-white">Add Franchise Team</h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">

          {/* Team identity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLS}>Team Name <span className="text-red-400">*</span></label>
              <input autoFocus required maxLength={100} className={INPUT_CLS} placeholder="e.g. Philly Eagles" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLS}>Short Name <span className="font-normal normal-case text-slate-500">(Optional)</span></label>
              <input maxLength={10} className={INPUT_CLS} placeholder="e.g. Eagles" value={shortName} onChange={(e) => setShortName(e.target.value)} />
            </div>
          </div>

          {/* Owner */}
          <div>
            <label className={LABEL_CLS}>Owner <span className="font-normal normal-case text-slate-500">(Optional)</span></label>
            <select className={INPUT_CLS} value={ownerUserId} onChange={(e) => { setOwnerUserId(e.target.value); if (e.target.value) setInviteEmail(""); }}>
              <option value="">— Unassigned / Invite by email —</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>{m.displayName}</option>
              ))}
            </select>
            {useInvite && (
              <div className="mt-2">
                <input
                  type="email"
                  maxLength={320}
                  className={INPUT_CLS}
                  placeholder="Invite owner by email (optional)"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                {inviteEmail.trim() && (
                  <p className="mt-1 text-xs text-slate-500">
                    A league invite will be sent to this address. Assign as owner once they join.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={LABEL_CLS}>First Name <span className="font-normal normal-case text-slate-500">(Optional)</span></label>
            <input maxLength={100} className={INPUT_CLS} placeholder="Display name in draft" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>

          {error && (
            <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !name.trim()} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90" style={{ backgroundColor: primary, color: secondary }}>
              {loading ? "Adding..." : "Add Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function ConfirmDeleteModal({
  teamName,
  hasHistory,
  onConfirm,
  onCancel,
}: {
  teamName: string;
  hasHistory: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="mb-2 text-base font-bold text-white">Delete &ldquo;{teamName}&rdquo;?</h2>
        {hasHistory ? (
          <p className="mb-5 text-sm text-slate-400">
            This team has season history. Deleting it will remove it from past season records. This cannot be undone.
          </p>
        ) : (
          <p className="mb-5 text-sm text-slate-400">This cannot be undone.</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-700 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Team modal ───────────────────────────────────────────────────────────

function EditTeamModal({
  team,
  members,
  onClose,
  onSaved,
  onInvite,
}: {
  team: LeagueTeam;
  members: LeagueMember[];
  onClose: () => void;
  onSaved: (updates: Partial<LeagueTeam>) => void;
  onInvite: (email: string) => Promise<void>;
}) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [name, setName] = useState(team.name);
  const [shortName, setShortName] = useState(team.shortName ?? "");
  const [ownerName, setOwnerName] = useState(team.ownerName ?? "");
  const [ownerUserId, setOwnerUserId] = useState(team.ownerUserId ?? "");
  const [logoPreview, setLogoPreview] = useState<string | null>(team.logoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarColor = "#" + ((team.name.charCodeAt(0) * 9999991) % 0xffffff).toString(16).padStart(6, "0");
  const initials = team.name.trim().slice(0, 2).toUpperCase() || "T";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteStatus("");
    try {
      await onInvite(inviteEmail.trim());
      setInviteStatus(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : "Unable to send invite.");
    } finally {
      setInviting(false);
    }
  }

  async function handleAssignOwner(userId: string | null) {
    try {
      await assignLeagueTeamOwner(team.leagueId, team.id, userId);
      const member = userId ? members.find((m) => m.userId === userId) : undefined;
      onSaved({
        ownerUserId: userId,
        ownerDisplayName: member?.displayName ?? null,
        ownerAvatarUrl: member?.avatarUrl ?? null,
      });
      setOwnerUserId(userId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to assign owner.");
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      let logoUrl = team.logoUrl;
      if (logoFile) {
        setUploadingLogo(true);
        logoUrl = await uploadLeagueTeamLogo(team.leagueId, team.id, logoFile);
        setUploadingLogo(false);
      }
      await updateLeagueTeamDetails(team.leagueId, team.id, {
        name: name.trim(),
        shortName: shortName.trim() || null,
        ownerName: ownerName.trim() || null,
        logoUrl,
      });
      onSaved({ name: name.trim(), shortName: shortName.trim() || null, ownerName: ownerName.trim() || null, logoUrl });
      onClose();
    } catch (err) {
      setUploadingLogo(false);
      setError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 my-auto space-y-5">
        <h2 className="text-lg font-bold text-white">Edit Team</h2>

        {/* Logo */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-slate-600 hover:border-slate-400 transition-colors"
            title="Upload team logo"
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: avatarColor + "55" }}>
                {initials}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <div>
            <p className="text-sm font-semibold text-white">Team Logo</p>
            <p className="text-xs text-slate-500 mt-0.5">Click to upload · PNG, JPG, WEBP · 4MB max</p>
            {uploadingLogo && <p className="text-xs mt-1" style={{ color: primary }}>Uploading...</p>}
          </div>
        </div>

        {/* Name fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLS}>Team Name <span className="text-red-400">*</span></label>
            <input required maxLength={100} className={INPUT_CLS} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Short Name</label>
            <input maxLength={10} className={INPUT_CLS} placeholder="e.g. Eagles" value={shortName} onChange={(e) => setShortName(e.target.value)} />
          </div>
        </div>

        {/* Owner */}
        <div>
          <label className={LABEL_CLS}>Owner</label>
          <select
            className={INPUT_CLS}
            value={ownerUserId}
            onChange={(e) => void handleAssignOwner(e.target.value || null)}
          >
            <option value="">— Unassigned —</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
          </select>
        </div>

        <div>
          <label className={LABEL_CLS}>First Name</label>
          <input maxLength={100} className={INPUT_CLS} placeholder="Display name in draft" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </div>

        {/* Email invite (only when no owner) */}
        {!ownerUserId && (
          <div>
            <label className={LABEL_CLS}>Invite Owner by Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                maxLength={320}
                className={INPUT_CLS}
                placeholder="owner@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleInvite(); } }}
              />
              <button
                type="button"
                disabled={inviting || !inviteEmail.trim()}
                onClick={() => void handleInvite()}
                className="shrink-0 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-300 hover:border-slate-400 hover:text-white disabled:opacity-40 transition-colors"
              >
                {inviting ? "..." : "Invite"}
              </button>
            </div>
            {inviteStatus && (
              <p className={`mt-1 text-xs ${inviteStatus.startsWith("Invite sent") ? "text-green-400" : "text-red-400"}`}>
                {inviteStatus}
              </p>
            )}
          </div>
        )}

        {error && <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void handleSave()}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: primary, color: secondary }}
          >
            {saving ? (uploadingLogo ? "Uploading..." : "Saving...") : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kebab menu ────────────────────────────────────────────────────────────────

function KebabMenu({ items }: {
  items: { label: string; danger?: boolean; disabled?: boolean; title?: string; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
        aria-label="Team options"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
          <circle cx="8" cy="3" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="8" cy="13" r="1.2" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 min-w-[130px] rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-2xl">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              title={item.disabled ? (item.title ?? "Not available") : undefined}
              onClick={() => { setOpen(false); item.onClick(); }}
              className={`block w-full px-4 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 transition-colors ${
                item.danger
                  ? "text-red-400 hover:bg-red-950/40 disabled:hover:bg-transparent"
                  : "text-slate-300 hover:bg-slate-800 disabled:hover:bg-transparent"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Team card ─────────────────────────────────────────────────────────────────

function TeamCard({
  team,
  members,
  canManage,
  onRequestDelete,
  onArchive,
  onEdit,
}: {
  team: LeagueTeam;
  members: LeagueMember[];
  canManage: boolean;
  onRequestDelete: (team: LeagueTeam) => void;
  onArchive: (teamId: string) => Promise<void>;
  onEdit: (team: LeagueTeam) => void;
}) {
  const { accentColor: primary } = useLeagueTheme();
  const ownerInitial = (team.ownerDisplayName ?? "?").charAt(0).toUpperCase();
  const logoInitials = team.name.trim().slice(0, 2).toUpperCase() || "T";

  const menuItems = canManage ? [
    { label: "Edit team", onClick: () => onEdit(team) },
    { label: "Archive", onClick: () => void onArchive(team.id) },
    { label: "Delete", danger: true, onClick: () => onRequestDelete(team) },
  ] : [];

  return (
    <div
      className="rounded-2xl border bg-slate-900/60 p-5"
      style={{ borderColor: team.ownerUserId ? primary + "44" : "rgba(100,116,139,0.25)" }}
    >
      {/* Logo + right column */}
      <div className="flex items-start gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-700">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white bg-slate-800">
              {logoInitials}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white leading-tight">{team.name}</h3>
              {team.shortName && <p className="text-xs text-slate-500 mt-0.5">{team.shortName}</p>}
            </div>
            {canManage && <KebabMenu items={menuItems} />}
          </div>

          {/* Owner — under the name, inside the right column */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold overflow-hidden"
              style={{ backgroundColor: team.ownerUserId ? primary + "22" : "rgba(100,116,139,0.15)", color: team.ownerUserId ? primary : "#64748b" }}
            >
              {team.ownerAvatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={team.ownerAvatarUrl} alt="" className="h-full w-full object-cover" />
                : ownerInitial}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 leading-none mb-0.5">Owner</p>
              <p className={`text-sm font-semibold truncate leading-tight ${team.ownerUserId ? "text-white" : "text-slate-600 italic"}`}>
                {team.ownerDisplayName ?? "Unassigned"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LeagueTeams({ slug }: { slug: string }) {
  const { workspace, isLoading: loading, error } = useWorkspace();
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LeagueTeam | null>(null);
  const [editingTeam, setEditingTeam] = useState<LeagueTeam | null>(null);

  const league = workspace?.league;
  const canManage = workspace?.canManage ?? false;
  const members = workspace?.members ?? [];

  useEffect(() => {
    if (!league) return;
    let active = true;
    setTeamsLoading(true);
    void getLeagueTeams(league.id)
      .then((t) => { if (active) setTeams(t); })
      .catch((err) => { if (active) setTeamsError(err instanceof Error ? err.message : "Unable to load teams."); })
      .finally(() => { if (active) setTeamsLoading(false); });
    return () => { active = false; };
  }, [league]);

  function handleTeamSaved(teamId: string, updates: Partial<LeagueTeam>) {
    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, ...updates } : t));
  }

  async function handleDelete(teamId: string) {
    if (!league) return;
    setActionError("");
    try {
      await deleteLeagueTeam(league.id, teamId);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (err) {
      console.error("deleteLeagueTeam error:", err);
      const raw = err instanceof Error ? err.message : JSON.stringify(err);
      setActionError(`Delete failed: ${raw}`);
    }
  }

  async function handleArchive(teamId: string) {
    if (!league) return;
    await archiveLeagueTeam(league.id, teamId);
    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, archivedAt: new Date().toISOString() } : t));
  }

  async function handleUnarchive(teamId: string) {
    if (!league) return;
    await unarchiveLeagueTeam(league.id, teamId);
    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, archivedAt: null } : t));
  }


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-52 animate-pulse rounded-2xl bg-slate-800" />
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (error || !workspace || !league) {
    return <p className="text-red-400">{error || "League not found."}</p>;
  }

  const teamMax = league.teamCount;
  const activeTeams = teams.filter((t) => !t.archivedAt);
  const archivedTeams = teams.filter((t) => t.archivedAt);
  const atCapacity = activeTeams.length >= teamMax;
  const assignedOwnerIds = new Set(activeTeams.map((t) => t.ownerUserId).filter(Boolean) as string[]);

  return (
    <div className="space-y-6">
      {pendingDelete && (
        <ConfirmDeleteModal
          teamName={pendingDelete.name}
          hasHistory={pendingDelete.hasSeasonHistory}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const id = pendingDelete.id;
            setPendingDelete(null);
            void handleDelete(id);
          }}
        />
      )}

      {editingTeam && (
        <EditTeamModal
          team={editingTeam}
          members={members}
          onClose={() => setEditingTeam(null)}
          onSaved={(updates) => {
            handleTeamSaved(editingTeam.id, updates);
            setEditingTeam((prev) => prev ? { ...prev, ...updates } : null);
          }}
          onInvite={async (email) => { await inviteLeagueMember(editingTeam.leagueId, email); }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Franchise Teams</h2>
          <p className="text-sm text-slate-500">
            <span style={atCapacity ? { color: primary } : undefined}>
              {activeTeams.length} / {teamMax} active
            </span>
            {archivedTeams.length > 0 && ` · ${archivedTeams.length} archived`}
            {canManage && !atCapacity && " · Assign owners here to pre-populate draft slots"}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            disabled={atCapacity}
            title={atCapacity ? `League is at capacity (${teamMax} teams). Archive or delete a team first, or raise the limit in Settings.` : undefined}
            className="rounded-xl px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: primary, color: secondary }}
          >
            + Add Team
          </button>
        )}
      </div>

      {canManage && atCapacity && activeTeams.length > 0 && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: primary + "44", backgroundColor: primary + "12", color: primary }}>
          League is at capacity — {teamMax} of {teamMax} active teams. Archive or delete a team to add another, or raise the limit in{" "}
          <a href={`/leagues/${slug}/settings`} className="underline underline-offset-2">Settings</a>.
        </div>
      )}

      {teamsError && (
        <p className="rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {teamsError}
        </p>
      )}

      {actionError && (
        <p className="rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {actionError}
          <button className="ml-3 underline opacity-70 hover:opacity-100" onClick={() => setActionError("")}>Dismiss</button>
        </p>
      )}

      {teamsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-800" />
          ))}
        </div>
      ) : teamsError ? null : activeTeams.length === 0 && archivedTeams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center">
          <p className="text-slate-400 font-semibold">No franchise teams yet</p>
          {canManage ? (
            <p className="mt-1 text-sm text-slate-600">
              Add up to {teamMax} teams and assign owners. Owners will be automatically placed in their draft slots when a season is created.
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              The commissioner hasn&apos;t set up franchise teams yet.
            </p>
          )}
          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 rounded-xl px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary, color: secondary }}
            >
              + Add First Team
            </button>
          )}
        </div>
      ) : (
        <>
          {canManage && assignedOwnerIds.size < activeTeams.length && (
            <div className="rounded-xl border border-yellow-700/40 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-400">
              {activeTeams.length - assignedOwnerIds.size} team{activeTeams.length - assignedOwnerIds.size !== 1 ? "s" :  " "} without an owner — assign owners so they&apos;re automatically placed in their draft slots when a new season is created.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                members={members}
                canManage={canManage}
                onRequestDelete={setPendingDelete}
                onArchive={handleArchive}
                onEdit={setEditingTeam}
              />
            ))}
          </div>

          {archivedTeams.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors select-none">
                <svg className="h-3 w-3 transition-transform group-open:rotate-90" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M4 2l4 4-4 4" />
                </svg>
                Archived ({archivedTeams.length})
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {archivedTeams.map((team) => (
                  <div key={team.id} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 opacity-60">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-400 leading-tight">{team.name}</h3>
                      {canManage && (
                        <KebabMenu items={[
                          { label: "Unarchive", onClick: () => void handleUnarchive(team.id) },
                          {
                            label: "Delete",
                            danger: true,
                            onClick: () => setPendingDelete(team),
                          },
                        ]} />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 italic">
                      {team.ownerDisplayName ?? "No owner"} · Archived
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {showAddModal && league && (
        <AddTeamModal
          leagueId={league.id}
          members={members}
          onClose={() => setShowAddModal(false)}
          onAdded={(team) => {
            setTeams((prev) => [...prev, team]);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}
