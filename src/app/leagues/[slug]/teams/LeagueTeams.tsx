"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LeagueImportModal from "@/components/LeagueImportModal";
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

type Tone = "neutral" | "ready" | "warning" | "danger" | "complete";

const INPUT_CLS = "w-full rounded-xl border border-slate-700/80 bg-slate-950/55 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 disabled:opacity-50";
const LABEL_CLS = "mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500";
const HELPER_CLS = "mt-1.5 text-xs leading-relaxed text-slate-500";
const primaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white shadow-[0_14px_40px_rgba(59,130,246,0.28)] transition-colors hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/60 px-5 py-3 text-sm font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40";

function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const classes: Record<Tone, string> = {
    neutral: "border-slate-700 bg-slate-800/70 text-slate-300",
    ready: "border-blue-400/35 bg-blue-500/12 text-blue-200",
    warning: "border-amber-400/35 bg-amber-500/12 text-amber-200",
    danger: "border-red-400/35 bg-red-500/12 text-red-200",
    complete: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${classes[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function SectionPanel({ title, eyebrow, children, action, className = "" }: { title: string; eyebrow?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-800/90 bg-slate-900/72 shadow-[0_18px_50px_rgba(0,0,0,0.22)] ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
        <div>
          {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>}
          <h2 className="mt-1 text-base font-bold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/35 px-5 py-8 text-center">
      <p className="text-sm font-bold text-slate-200">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-slate-500">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

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
        await inviteLeagueMember(leagueId, inviteEmail.trim(), { leagueTeamId: team.id });
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
                    They&apos;ll be assigned to this team automatically after accepting the invitation.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/68 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="border-b border-slate-800/80 px-5 py-4">
          <StatusBadge label="Danger Zone" tone="danger" />
          <h2 className="mt-3 text-base font-black text-white">Delete &ldquo;{teamName}&rdquo;?</h2>
        </div>
        <div className="px-5 py-5">
        {hasHistory ? (
          <p className="mb-5 text-sm leading-6 text-slate-400">
            This team has season history. Deleting it will remove it from past season records. This cannot be undone.
          </p>
        ) : (
          <p className="mb-5 text-sm leading-6 text-slate-400">This cannot be undone.</p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white shadow-[0_14px_40px_rgba(220,38,38,0.24)] transition-colors hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Delete
          </button>
        </div>
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
  const [assigningOwner, setAssigningOwner] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarColor = "#" + ((team.name.charCodeAt(0) * 9999991) % 0xffffff).toString(16).padStart(6, "0");
  const initials = team.name.trim().slice(0, 2).toUpperCase() || "T";
  const ownerAssigned = Boolean(ownerUserId);
  const selectedOwnerName = ownerUserId
    ? members.find((member) => member.userId === ownerUserId)?.displayName ?? team.ownerDisplayName ?? "Assigned owner"
    : "Unassigned";

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
    setAssigningOwner(true);
    setError("");
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
    } finally {
      setAssigningOwner(false);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/68 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-team-title"
    >
      <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="relative border-b border-slate-800/80 px-5 py-4 sm:px-6">
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: primary }} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Team Command</p>
              <h2 id="edit-team-title" className="mt-1 text-xl font-black text-white">Edit Team</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Manage franchise identity and owner assignment for draft night.
              </p>
            </div>
            <StatusBadge label={ownerAssigned ? "Assigned" : "Needs Owner"} tone={ownerAssigned ? "complete" : "warning"} />
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <section className="rounded-xl border border-slate-800/90 bg-slate-950/28 p-4">
            <div className="mb-4">
              <h3 className="text-sm font-black text-white">Team Identity</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Name, abbreviation, and logo used across DraftHQ.</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-[112px_1fr]">
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-600/90 bg-slate-950/70 text-white transition-colors hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                  title="Upload team logo"
                  aria-label="Upload team logo"
                >
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" className="h-full w-full object-contain p-2" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-black text-white" style={{ backgroundColor: avatarColor + "55" }}>
                      {initials}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-slate-950/82 px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    {logoPreview ? "Replace" : "Upload"}
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <p className={HELPER_CLS}>PNG, JPG, or WEBP. 4MB max.</p>
                {logoFile && !uploadingLogo && <p className="mt-1 text-xs font-semibold text-blue-200">New logo selected. Save to apply.</p>}
                {uploadingLogo && <p className="mt-1 text-xs font-semibold" style={{ color: primary }}>Uploading logo...</p>}
              </div>

              <div className="grid content-start gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="edit-team-name" className={LABEL_CLS}>Team Name <span className="text-red-400">*</span></label>
                  <input
                    id="edit-team-name"
                    required
                    maxLength={100}
                    className={INPUT_CLS}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={!name.trim()}
                    aria-describedby="edit-team-name-help"
                  />
                  <p id="edit-team-name-help" className={HELPER_CLS}>This is the primary franchise name shown in league views.</p>
                </div>
                <div>
                  <label htmlFor="edit-team-short-name" className={LABEL_CLS}>Short Name</label>
                  <input
                    id="edit-team-short-name"
                    maxLength={10}
                    className={INPUT_CLS}
                    placeholder="e.g. Eagles"
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                  />
                  <p className={HELPER_CLS}>Optional compact label for tight draft displays.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800/90 bg-slate-950/28 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white">Owner Assignment</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Assign a league member, invite an owner, or leave this franchise open.
                </p>
              </div>
              <StatusBadge label={selectedOwnerName} tone={ownerAssigned ? "complete" : "warning"} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="edit-team-owner" className={LABEL_CLS}>Assigned Owner</label>
                <select
                  id="edit-team-owner"
                  className={INPUT_CLS}
                  value={ownerUserId}
                  disabled={assigningOwner || saving}
                  onChange={(e) => void handleAssignOwner(e.target.value || null)}
                  aria-describedby="edit-team-owner-help"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
                </select>
                <p id="edit-team-owner-help" className={HELPER_CLS}>
                  Select Unassigned to remove the current owner from this team.
                </p>
                {assigningOwner && <p className="mt-1 text-xs font-semibold text-blue-200">Updating owner assignment...</p>}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="edit-team-owner-name" className={LABEL_CLS}>Owner Display Name</label>
                <input
                  id="edit-team-owner-name"
                  maxLength={100}
                  className={INPUT_CLS}
                  placeholder="Name shown during the draft"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  aria-describedby="edit-team-owner-name-help"
                />
                <p id="edit-team-owner-name-help" className={HELPER_CLS}>
                  Optional draft-room display name. This does not change the owner account profile.
                </p>
              </div>
            </div>

            {!ownerUserId && (
              <div className="mt-4 border-t border-slate-800/80 pt-4">
                <label htmlFor="edit-team-invite" className={LABEL_CLS}>Invite Owner by Email</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="edit-team-invite"
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
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {inviting ? "Sending..." : "Invite"}
                  </button>
                </div>
                <p className={HELPER_CLS}>Use this when the owner is not yet listed as a league member.</p>
                {inviteStatus && (
                  <p className={`mt-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                    inviteStatus.startsWith("Invite sent")
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-red-400/30 bg-red-500/10 text-red-200"
                  }`}>
                    {inviteStatus}
                  </p>
                )}
              </div>
            )}
          </section>

          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-800/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className={`${secondaryButtonClass} sm:min-w-28`}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || assigningOwner || !name.trim()}
            onClick={() => void handleSave()}
            className={`${primaryButtonClass} sm:min-w-36`}
            style={{ backgroundColor: primary, color: secondary }}
          >
            {saving ? (uploadingLogo ? "Uploading logo..." : "Saving...") : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Kebab menu ------------------------------------------------------------

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

function TeamRow({
  team,
  canManage,
  teamChangesLocked,
  onRequestDelete,
  onArchive,
  onEdit,
}: {
  team: LeagueTeam;
  canManage: boolean;
  teamChangesLocked: boolean;
  onRequestDelete: (team: LeagueTeam) => void;
  onArchive: (teamId: string) => Promise<void>;
  onEdit: (team: LeagueTeam) => void;
}) {
  return (
    <TeamRosterRow
      team={team}
      canManage={canManage}
      teamChangesLocked={teamChangesLocked}
      onRequestDelete={onRequestDelete}
      onArchive={onArchive}
      onEdit={onEdit}
    />
  );
}
function TeamRosterRow({
  team,
  canManage,
  teamChangesLocked,
  onRequestDelete,
  onArchive,
  onEdit,
}: {
  team: LeagueTeam;
  canManage: boolean;
  teamChangesLocked: boolean;
  onRequestDelete: (team: LeagueTeam) => void;
  onArchive: (teamId: string) => Promise<void>;
  onEdit: (team: LeagueTeam) => void;
}) {
  const { accentColor: primary } = useLeagueTheme();
  const ownerAssigned = Boolean(team.ownerUserId);
  const ownerInitial = (team.ownerDisplayName ?? "?").charAt(0).toUpperCase();
  const logoInitials = team.name.trim().slice(0, 2).toUpperCase() || "T";
  const menuItems = canManage ? [
    { label: "Edit team", onClick: () => onEdit(team) },
    {
      label: "Archive",
      disabled: teamChangesLocked,
      title: "Teams cannot be archived while a draft is active.",
      onClick: () => void onArchive(team.id),
    },
    {
      label: "Delete",
      danger: true,
      disabled: teamChangesLocked,
      title: "Teams cannot be deleted while a draft is active.",
      onClick: () => onRequestDelete(team),
    },
  ] : [];

  return (
    <article
      className={`grid gap-4 border-b border-slate-800/70 bg-slate-950/20 px-4 py-4 transition-colors last:border-b-0 hover:bg-slate-950/35 md:items-center ${
        canManage ? "md:grid-cols-[minmax(0,1fr)_240px_auto]" : "md:grid-cols-[minmax(0,1fr)_240px]"
      }`}
      style={{ borderLeft: `3px solid ${ownerAssigned ? primary + "99" : "rgba(251,191,36,0.75)"}` }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-800 text-sm font-black uppercase text-white">
              {logoInitials}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-black leading-tight text-white">{team.name}</h3>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{team.shortName || "No short name"}</p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 md:justify-center">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold"
          style={{ backgroundColor: ownerAssigned ? primary + "22" : "rgba(100,116,139,0.15)", color: ownerAssigned ? primary : "#64748b" }}
        >
          {team.ownerAvatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={team.ownerAvatarUrl} alt="" className="h-full w-full object-cover" />
            : ownerInitial}
        </div>
        <div className="min-w-0 w-32">
          <p className="mb-0.5 text-[10px] font-black uppercase leading-none tracking-[0.16em] text-slate-500">Owner</p>
          <p className={`truncate text-sm font-semibold leading-tight ${ownerAssigned ? "text-white" : "italic text-slate-500"}`}>
            {team.ownerDisplayName ?? "Unassigned"}
          </p>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-2 md:justify-end">
          {!ownerAssigned && (
            <button
              type="button"
              onClick={() => onEdit(team)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-2 text-sm font-black text-amber-100 transition-colors hover:bg-amber-500/15"
            >
              Assign
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(team)}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/65 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800"
          >
            Edit
          </button>
          <KebabMenu items={menuItems} />
        </div>
      )}
    </article>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LeagueTeams({ slug }: { slug: string }) {
  const router = useRouter();
  const { workspace, isLoading: loading, error } = useWorkspace();
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<LeagueTeam | null>(null);
  const [editingTeam, setEditingTeam] = useState<LeagueTeam | null>(null);

  const league = workspace?.league;
  const canManage = workspace?.canManage ?? false;
  const members = workspace?.members ?? [];
  const teamChangesLocked = workspace?.seasons.some(
    (season) => season.draft?.status === "active" || season.draft?.status === "paused"
  ) ?? false;

  useEffect(() => {
    if (!league) return;
    let active = true;
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
    if (teamChangesLocked) {
      setActionError("Teams cannot be deleted while a draft is active.");
      return;
    }
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
    if (teamChangesLocked) {
      setActionError("Teams cannot be archived while a draft is active.");
      return;
    }
    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, archivedAt: new Date().toISOString() } : t));
    try {
      await archiveLeagueTeam(league.id, teamId);
    } catch (err) {
      setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, archivedAt: null } : t));
      setActionError(err instanceof Error ? err.message : "Unable to archive team.");
    }
  }

  async function handleUnarchive(teamId: string) {
    if (!league) return;
    if (teamChangesLocked) {
      setActionError("Teams cannot be unarchived while a draft is active.");
      return;
    }
    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, archivedAt: null } : t));
    try {
      await unarchiveLeagueTeam(league.id, teamId);
    } catch (err) {
      setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, archivedAt: new Date().toISOString() } : t));
      setActionError(err instanceof Error ? err.message : "Unable to unarchive team.");
    }
  }

  async function refreshTeams() {
    if (!league) return;
    setTeams(await getLeagueTeams(league.id));
    router.refresh();
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
  const rosterActions = canManage ? (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        disabled={atCapacity || teamChangesLocked}
        title={teamChangesLocked ? "Teams cannot be added while a draft is active." : atCapacity ? `League is at capacity (${teamMax} teams).` : undefined}
        className={primaryButtonClass}
      >
        Add Team
      </button>
      <button
        type="button"
        onClick={() => setShowImportModal(true)}
        disabled={atCapacity || teamChangesLocked}
        title={teamChangesLocked ? "Teams cannot be imported while a draft is active." : atCapacity ? `League is at capacity (${teamMax} teams).` : undefined}
        className={secondaryButtonClass}
      >
        Import League
      </button>
    </div>
  ) : undefined;

  return (
    <div className="space-y-6" data-league-slug={slug}>
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
          onInvite={async (email) => { await inviteLeagueMember(editingTeam.leagueId, email, { leagueTeamId: editingTeam.id }); }}
        />
      )}

      {showImportModal && league && (
        <LeagueImportModal
          leagueId={league.id}
          availableSlots={league.teamCount - teams.filter((team) => !team.archivedAt).length}
          onClose={() => setShowImportModal(false)}
          onImported={async (count) => {
            await refreshTeams();
            setShowImportModal(false);
            setSuccessMessage(`${count} team${count === 1 ? "" : "s"} imported successfully.`);
          }}
        />
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="status">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage("")} className="ml-3 text-xs font-bold uppercase tracking-wide opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {teamsError && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {teamsError}
        </p>
      )}

      {actionError && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {actionError}
          <button className="ml-3 text-xs font-bold uppercase tracking-wide underline opacity-70 hover:opacity-100" onClick={() => setActionError("")}>Dismiss</button>
        </p>
      )}

      {teamsLoading ? (
        <div className="space-y-3 rounded-xl border border-slate-800/90 bg-slate-900/72 p-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-800/70" />
          ))}
        </div>
      ) : teamsError ? null : activeTeams.length === 0 && archivedTeams.length === 0 ? (
        <EmptyState
          title="No franchise teams yet"
          detail={canManage ? `Add up to ${teamMax} teams and assign owners. Owners will be automatically placed in their draft slots when a season is created.` : "The commissioner has not set up franchise teams yet."}
          action={canManage ? (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              disabled={teamChangesLocked}
              title={teamChangesLocked ? "Teams cannot be added while a draft is active." : undefined}
              className={primaryButtonClass}
            >
              Add First Team
            </button>
          ) : undefined}
        />
      ) : (
        <>
          <SectionPanel
            title="Active Teams"
            eyebrow={`${activeTeams.length} active teams`}
            action={rosterActions}
          >
            <div className="overflow-hidden rounded-xl border border-slate-800/80">
              <div
                className={`hidden border-b border-slate-800/80 bg-slate-950/45 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 md:grid ${
                  canManage ? "grid-cols-[minmax(0,1fr)_240px_auto]" : "grid-cols-[minmax(0,1fr)_240px]"
                }`}
              >
                <span>Team</span>
                <span className="text-center">Owner</span>
                {canManage && <span className="text-right">Actions</span>}
              </div>
              {activeTeams.map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  canManage={canManage}
                  teamChangesLocked={teamChangesLocked}
                  onRequestDelete={setPendingDelete}
                  onArchive={handleArchive}
                  onEdit={setEditingTeam}
                />
              ))}
            </div>
          </SectionPanel>

          {archivedTeams.length > 0 && (
            <SectionPanel title="Archived Teams" eyebrow={`${archivedTeams.length} inactive`}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archivedTeams.map((team) => (
                  <div key={team.id} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4 opacity-70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-300">{team.name}</p>
                        <p className="mt-1 text-xs italic text-slate-600">{team.ownerDisplayName ?? "No owner"} - Archived</p>
                      </div>
                      {canManage && (
                        <KebabMenu items={[
                          {
                            label: "Unarchive",
                            disabled: teamChangesLocked,
                            title: "Teams cannot be unarchived while a draft is active.",
                            onClick: () => void handleUnarchive(team.id),
                          },
                          {
                            label: "Delete",
                            danger: true,
                            disabled: teamChangesLocked,
                            title: "Teams cannot be deleted while a draft is active.",
                            onClick: () => setPendingDelete(team),
                          },
                        ]} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionPanel>
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
