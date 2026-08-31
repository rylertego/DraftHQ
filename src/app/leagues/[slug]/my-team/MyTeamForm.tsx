"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import SongPicker from "@/components/SongPicker";
import { MAX_WALK_UP_SONGS } from "@/lib/draftAudio";
import { isSpotifyConnected, needsSpotifyReconnect } from "@/lib/spotifyAuth";
import {
  assignLeagueTeamOwner,
  getLeagueTeams,
  inviteLeagueMember,
  updateLeagueTeamDetails,
  updateMyLeagueTeamDetails,
  uploadMyLeagueTeamLogoAsset,
  uploadMyLeagueTeamOwnerPhotoAsset,
} from "@/lib/leagueApi";
import { resolveInitialTeamId, isTeamProfileDirty } from "@/lib/teamEditing";
import type { LeagueTeam } from "@/types/league";
import type { WalkUpSong } from "@/types/draft";
import { Alert, Button, EmptyState, Field, IconButton, Input, Panel, Select } from "@/components/ui";

function SongSourceBadge({ platform }: { platform: WalkUpSong["platform"] }) {
  return (
    <span className="rounded-full border border-slate-700/80 bg-slate-950/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
      {platform}
    </span>
  );
}

export function SongPlaybackBadge() {
  return (
    <span className="rounded-full border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--color-warning)]">
      Reconnect to play
    </span>
  );
}

export function TeamOwnerPanel({
  ownerDisplayName,
  members,
  selectedOwnerUserId,
  onAssign,
  onInvite,
  assigning,
  inviting,
  statusMessage,
}: {
  ownerDisplayName: string | null;
  members: Array<{ userId: string; displayName: string }>;
  selectedOwnerUserId: string;
  onAssign: (userId: string) => void;
  onInvite: (email: string) => void;
  assigning: boolean;
  inviting: boolean;
  statusMessage?: string | null;
}) {
  const [email, setEmail] = useState("");

  function submitInvite() {
    const trimmed = email.trim();
    if (!trimmed || inviting) return;
    onInvite(trimmed);
    setEmail("");
  }

  return (
    <Panel title="Owner">
      <p className="text-sm leading-6 text-[color:var(--color-text-secondary)]">
        Current owner: {ownerDisplayName ?? "Unassigned"}
      </p>

      <Field label="Assign a league member" controlId="team-owner-select">
        <Select
          id="team-owner-select"
          value={selectedOwnerUserId}
          disabled={assigning}
          onChange={(e) => onAssign(e.target.value)}
        >
          <option value="">{ownerDisplayName ? "Remove owner" : "Unassigned"}</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.displayName}</option>
          ))}
        </Select>
        {assigning && (
          <p className="mt-1 text-xs font-bold text-[color:var(--color-league-accent)]">
            Updating owner…
          </p>
        )}
      </Field>

      <Field label="Or invite by email" controlId="team-owner-invite">
        <div className="flex gap-[var(--space-2)]">
          <Input
            id="team-owner-invite"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitInvite();
              }
            }}
            placeholder="owner@example.com"
          />
          <Button
            scope="league"
            onClick={submitInvite}
            disabled={!email.trim() || inviting}
            loading={inviting}
          >
            Invite
          </Button>
        </div>
      </Field>

      {statusMessage && (
        <p className="mt-1 text-xs font-bold text-[color:var(--color-success)]">
          {statusMessage}
        </p>
      )}
    </Panel>
  );
}

export default function MyTeamForm({ slug, teamId: teamIdParam }: { slug: string; teamId?: string | null }) {
  void slug;
  const { workspace, isLoading } = useWorkspace();
  const { accentColor: primary } = useLeagueTheme();
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [team, setTeam] = useState<LeagueTeam | null>(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [walkUpSongs, setWalkUpSongs] = useState<WalkUpSong[]>([]);
  // Moved here from Draft Settings. A trigger syncs these down to every draft
  // team this franchise is linked to, so this is the only place they are set.
  // Autodraft, pre-draft notes, and last-season details deliberately stayed
  // behind — they are decisions about one draft night, not facts about the
  // franchise.
  const [ttsName, setTtsName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [ownerPhotoPreview, setOwnerPhotoPreview] = useState<string | null>(null);
  const [ownerPhotoFile, setOwnerPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingOwnerPhoto, setUploadingOwnerPhoto] = useState(false);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [songSaving, setSongSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const league = workspace?.league;
  const myTeamRef = workspace?.myTeam;
  const canManage = Boolean(workspace?.canManage);
  const isOwnTeam = Boolean(team && myTeamRef && team.id === myTeamRef.id);

  useEffect(() => {
    if (!league) return;
    let active = true;

    void getLeagueTeams(league.id)
      .then((leagueTeams) => {
        if (!active) return;
        const sorted = [...leagueTeams].sort((a, b) => a.name.localeCompare(b.name));
        setTeams(sorted);
        const initialId = resolveInitialTeamId(
          canManage ? teamIdParam ?? null : null,
          myTeamRef?.id ?? null,
          sorted.map((t) => t.id)
        );
        setSelectedTeamId(initialId);
        const found = sorted.find((t) => t.id === initialId) ?? null;
        if (!found) return;

        setTeam(found);
        setName(found.name);
        setShortName(found.shortName ?? "");
        setOwnerName(found.ownerName ?? "");
        setWalkUpSongs(Array.isArray(found.walkUpSongs) ? found.walkUpSongs : []);
        setTtsName(found.ttsName ?? "");
        setLogoPreview(found.logoUrl);
        setOwnerPhotoPreview(found.ownerPhotoUrl);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load your team.");
      });

    return () => {
      active = false;
    };
  }, [league, myTeamRef, canManage, teamIdParam]);

  useEffect(() => {
    function syncSpotifyState() {
      setSpotifyConnected(isSpotifyConnected());
    }

    syncSpotifyState();
    window.addEventListener("storage", syncSpotifyState);
    window.addEventListener("focus", syncSpotifyState);
    return () => {
      window.removeEventListener("storage", syncSpotifyState);
      window.removeEventListener("focus", syncSpotifyState);
    };
  }, []);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setSuccess(false);
  }

  function handleOwnerPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOwnerPhotoFile(file);
    setOwnerPhotoPreview(URL.createObjectURL(file));
    setSuccess(false);
  }

  /** The song list saves on its own, so a pick is never lost to a forgotten
   *  Save. Every other field is sent at its LAST SAVED value — the RPC reads
   *  null as "clear", so all fields must go on every write, and sending the
   *  live inputs here would commit a half-typed team name as a side effect of
   *  adding a song. Those still belong to Save Team Profile. */
  /** Keep `team`, the form's song list, and the switcher's copy in agreement —
   *  the selector reads from `teams`, so a save that skipped it would show
   *  stale data the moment you switched away and back. */
  function applyUpdatedTeam(updated: LeagueTeam) {
    setTeam(updated);
    setWalkUpSongs(updated.walkUpSongs);
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function persistSongs(songs: WalkUpSong[]) {
    if (!team || !league) return;
    setSongSaving(true);
    setError("");
    try {
      if (isOwnTeam) {
        const updated = await updateMyLeagueTeamDetails(league.id, team.id, {
          name: team.name,
          shortName: team.shortName ?? null,
          ownerName: team.ownerName ?? null,
          logoUrl: team.logoUrl,
          ownerPhotoUrl: team.ownerPhotoUrl,
          walkUpSongs: songs,
          ttsName: team.ttsName ?? null,
          lastSeasonPickPlayer: team.lastSeasonPickPlayer,
          lastSeasonRecord: team.lastSeasonRecord,
          lastSeasonPlayoffs: team.lastSeasonPlayoffs,
        });
        applyUpdatedTeam(updated);
      } else {
        await updateLeagueTeamDetails(league.id, team.id, { walkUpSongs: songs });
        applyUpdatedTeam({ ...team, walkUpSongs: songs });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your songs.");
    } finally {
      setSongSaving(false);
    }
  }

  function removeSong(index: number) {
    const next = walkUpSongs.filter((_, i) => i !== index);
    setWalkUpSongs(next);
    setSuccess(false);
    void persistSongs(next);
  }

  function closeSongPicker() {
    setShowSongPicker(false);
    setSpotifyConnected(isSpotifyConnected());
  }

  function selectTeam(nextId: string) {
    if (nextId === selectedTeamId) return;
    if (
      team &&
      isTeamProfileDirty(
        { name, shortName, ownerName, ttsName },
        {
          name: team.name,
          shortName: team.shortName ?? "",
          ownerName: team.ownerName ?? "",
          ttsName: team.ttsName ?? "",
        },
        Boolean(logoFile || ownerPhotoFile)
      ) &&
      !window.confirm("Discard unsaved changes to this team?")
    ) {
      return;
    }

    const next = teams.find((t) => t.id === nextId);
    if (!next) return;
    setSelectedTeamId(nextId);
    setTeam(next);
    setName(next.name);
    setShortName(next.shortName ?? "");
    setOwnerName(next.ownerName ?? "");
    setWalkUpSongs(Array.isArray(next.walkUpSongs) ? next.walkUpSongs : []);
    setTtsName(next.ttsName ?? "");
    setLogoPreview(next.logoUrl);
    setOwnerPhotoPreview(next.ownerPhotoUrl);
    setLogoFile(null);
    setOwnerPhotoFile(null);
    setError("");
    setSuccess(false);
    setOwnerStatus("");
  }

  function addSong(song: WalkUpSong) {
    const next = [...walkUpSongs, song].slice(0, MAX_WALK_UP_SONGS);
    setWalkUpSongs(next);
    closeSongPicker();
    setSuccess(false);
    void persistSongs(next);
  }

  const [assigningOwner, setAssigningOwner] = useState(false);
  const [invitingOwner, setInvitingOwner] = useState(false);
  const [ownerStatus, setOwnerStatus] = useState("");

  async function handleAssignOwner(userId: string) {
    if (!team || !league) return;
    setAssigningOwner(true);
    setError("");
    try {
      await assignLeagueTeamOwner(league.id, team.id, userId || null);
      const refreshed = await getLeagueTeams(league.id);
      const sorted = [...refreshed].sort((a, b) => a.name.localeCompare(b.name));
      setTeams(sorted);
      const updated = sorted.find((t) => t.id === team.id);
      if (updated) {
        setTeam(updated);
        setWalkUpSongs(updated.walkUpSongs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to assign that owner.");
    } finally {
      setAssigningOwner(false);
    }
  }

  async function handleInviteOwner(email: string) {
    if (!team || !league || !email) return;
    setInvitingOwner(true);
    setError("");
    try {
      await inviteLeagueMember(league.id, email, { leagueTeamId: team.id });
      setOwnerStatus(`Invite sent to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send that invite.");
    } finally {
      setInvitingOwner(false);
    }
  }

  async function handleSave() {
    if (!team || !league || !name.trim()) return;
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      let logoUrl = team.logoUrl;
      let ownerPhotoUrl = team.ownerPhotoUrl;
      if (logoFile) {
        setUploadingLogo(true);
        logoUrl = await uploadMyLeagueTeamLogoAsset(league.id, team.id, logoFile);
        setUploadingLogo(false);
      }
      if (ownerPhotoFile) {
        setUploadingOwnerPhoto(true);
        ownerPhotoUrl = await uploadMyLeagueTeamOwnerPhotoAsset(league.id, team.id, ownerPhotoFile);
        setUploadingOwnerPhoto(false);
      }

      if (isOwnTeam) {
        const updated = await updateMyLeagueTeamDetails(league.id, team.id, {
          name: name.trim(),
          shortName: shortName.trim() || null,
          ownerName: ownerName.trim() || null,
          logoUrl,
          ownerPhotoUrl,
          walkUpSongs: walkUpSongs.slice(0, MAX_WALK_UP_SONGS),
          ttsName: ttsName.trim() || null,
          lastSeasonPickPlayer: team.lastSeasonPickPlayer,
          lastSeasonRecord: team.lastSeasonRecord,
          lastSeasonPlayoffs: team.lastSeasonPlayoffs,
        });
        applyUpdatedTeam(updated);
        setName(updated.name);
        setShortName(updated.shortName ?? "");
        setOwnerName(updated.ownerName ?? "");
        setTtsName(updated.ttsName ?? "");
        setLogoPreview(updated.logoUrl);
        setOwnerPhotoPreview(updated.ownerPhotoUrl);
      } else {
        await updateLeagueTeamDetails(league.id, team.id, {
          name: name.trim(),
          shortName: shortName.trim() || null,
          ownerName: ownerName.trim() || null,
          logoUrl,
          ownerPhotoUrl,
          walkUpSongs: walkUpSongs.slice(0, MAX_WALK_UP_SONGS),
          ttsName: ttsName.trim() || null,
        });
        applyUpdatedTeam({
          ...team,
          name: name.trim(),
          shortName: shortName.trim() || null,
          ownerName: ownerName.trim() || null,
          logoUrl,
          ownerPhotoUrl,
          walkUpSongs: walkUpSongs.slice(0, MAX_WALK_UP_SONGS),
          ttsName: ttsName.trim() || null,
        });
      }
      setLogoFile(null);
      setOwnerPhotoFile(null);
      setSuccess(true);
    } catch (err) {
      setUploadingLogo(false);
      setUploadingOwnerPhoto(false);
      setError(err instanceof Error ? err.message : "Unable to save your team.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
        <div className="h-96 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
      </div>
    );
  }

  if (!myTeamRef && !canManage) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/75 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border"
          style={{ borderColor: `${primary}40`, backgroundColor: `${primary}14`, color: primary }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
            <path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-black text-white">No Team Assigned Yet</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
          Once a commissioner assigns you to a franchise, this page becomes your team profile and walk-up song control room.
        </p>
      </div>
    );
  }

  const initials = (team?.name ?? myTeamRef?.name ?? "").trim().slice(0, 2).toUpperCase() || "T";

  return (
    <>
      <div className="grid gap-[var(--space-5)] lg:grid-cols-[20rem_1fr]">
        {/* Summary sits beside the form on desktop and above it on mobile — the
            grid handles both, so no duplicated markup. */}
        <aside className="rounded-[var(--radius-panel)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-1)] p-[var(--space-4)]">
          <div className="flex flex-col items-center gap-[var(--space-4)]">
            {/* The preview is the control, so this stays a custom dropzone
                rather than the FileUpload primitive. */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--color-border-strong)] bg-[var(--color-canvas)] transition-colors hover:border-[color:var(--color-league-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-league-focus-ring)] lg:h-56 lg:w-56"
              aria-label="Upload team logo"
            >
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="" className="h-full w-full object-contain p-2" />
              ) : (
                <span className="text-5xl font-black text-[color:var(--color-text-primary)]">{initials}</span>
              )}
              <span className="absolute inset-x-3 bottom-3 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white opacity-0 transition-opacity group-hover:opacity-100">
                Replace
              </span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            <div className="min-w-0 self-stretch lg:mt-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--color-league-accent)]">
                {isOwnTeam ? "My Franchise" : "League Team"}
              </p>
              <h1 className="mt-2 truncate text-3xl font-black text-[color:var(--color-text-primary)]">
                {name || team?.name || myTeamRef?.name || "Team"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[color:var(--color-text-secondary)]">
                {isOwnTeam
                  ? "These details are your league-level defaults and carry into draft night unless a commissioner overrides a draft."
                  : "These are this team's league-level defaults, carried into draft night unless a commissioner overrides a draft."}
              </p>
            </div>
          </div>

          {/* Songs only. A separate "Saved" count existed to show the list had
              unsaved picks — the song list now writes itself, so the two
              numbers could never disagree. */}
          <div className="mt-[var(--space-4)] border-t border-[color:var(--color-border-subtle)] pt-[var(--space-4)]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Songs</p>
            <p className="mt-1 text-xl font-black tabular-nums text-[color:var(--color-text-primary)]">
              {walkUpSongs.length}/{MAX_WALK_UP_SONGS}
            </p>
          </div>
        </aside>

        <div className="flex flex-col gap-[var(--space-4)]">
          {canManage && teams.length > 1 && (
            <div className="rounded-[var(--radius-surface)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] px-[var(--space-4)] py-[var(--space-3)]">
              <Field label="Editing team" controlId="team-switcher">
                <Select
                  id="team-switcher"
                  value={selectedTeamId ?? ""}
                  onChange={(e) => selectTeam(e.target.value)}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {myTeamRef && t.id === myTeamRef.id ? " (your team)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {/* No "Team Identity" descriptor. Panel renders description below the
              title, so it read as a subtitle restating the heading — the same
              redundant-eyebrow pattern that was stripped from the dashboard. */}
          <Panel title="Team Details">
            <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
              <Field label="Team Name" controlId="my-team-name" required>
                <Input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setSuccess(false); }}
                />
              </Field>
              <Field label="Short Name" controlId="my-team-short">
                <Input
                  maxLength={10}
                  placeholder="Shown in compact draft views"
                  value={shortName}
                  onChange={(e) => { setShortName(e.target.value); setSuccess(false); }}
                />
              </Field>
            </div>

            <div className="mt-[var(--space-4)]">
              <Field label="Owner Display Name" controlId="my-team-owner-name">
                <Input
                  maxLength={100}
                  placeholder="Optional display name shown during draft night"
                  value={ownerName}
                  onChange={(e) => { setOwnerName(e.target.value); setSuccess(false); }}
                />
              </Field>
            </div>

            <div className="mt-[var(--space-4)] border-t border-[color:var(--color-border-subtle)] pt-[var(--space-4)]">
              <div className="flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-center">
                <label className="group block w-fit cursor-pointer">
                  <input type="file" accept="image/*" className="sr-only" onChange={handleOwnerPhotoChange} />
                  <span className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--color-border-strong)] bg-[var(--color-canvas)] transition-colors group-hover:border-[color:var(--color-league-accent)] group-focus-within:ring-2 group-focus-within:ring-[var(--color-league-focus-ring)]">
                    {ownerPhotoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ownerPhotoPreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-9 w-9 text-[color:var(--color-text-muted)] transition-colors group-hover:text-[color:var(--color-text-secondary)]" aria-hidden="true">
                        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z" />
                      </svg>
                    )}
                    <span className="absolute inset-x-3 bottom-3 rounded-lg bg-black/70 px-2 py-1 text-center text-[10px] font-black uppercase tracking-[0.12em] text-white opacity-0 transition-opacity group-hover:opacity-100">
                      Replace
                    </span>
                  </span>
                </label>

                <div className="min-w-0">
                  <p className="text-sm font-black text-[color:var(--color-text-primary)]">Owner Photo</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--color-text-secondary)]">
                    Add your profile image for draft-night presentation screens. Your team logo stays managed from the franchise card.
                  </p>
                  {uploadingOwnerPhoto && (
                    <p className="mt-1 text-xs font-bold text-[color:var(--color-league-accent)]">
                      Uploading owner photo...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Draft Night"
            description="How the announcer says your team, in every draft the league runs."
          >
            <div className="grid gap-[var(--space-4)]">
              <Field
                label="Text-to-speech name"
                controlId="my-team-tts"
                description="How the announcer says your team. Leave blank to use the team name."
              >
                <div className="flex gap-[var(--space-2)]">
                  <Input
                    maxLength={60}
                    placeholder="Pronunciation for announcer"
                    value={ttsName}
                    onChange={(e) => { setTtsName(e.target.value); setSuccess(false); }}
                  />
                  <button
                    type="button"
                    title="Preview voice"
                    aria-label="Preview how the announcer says your team name"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] text-[color:var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-3)] hover:text-[color:var(--color-text-primary)]"
                    onClick={() => {
                      if (typeof window === "undefined" || !window.speechSynthesis) return;
                      window.speechSynthesis.cancel();
                      window.speechSynthesis.speak(
                        new SpeechSynthesisUtterance(ttsName.trim() || name.trim())
                      );
                    }}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path d="M3 3.5l10 4.5-10 4.5V3.5z" />
                    </svg>
                  </button>
                </div>
              </Field>
            </div>
          </Panel>

          <Panel
            title="Draft Night Walk-Up Songs"
            actions={
              <div className="flex items-center gap-[var(--space-3)]">
                <span
                  className="text-xs text-[color:var(--color-text-muted)]"
                  aria-live="polite"
                >
                  {songSaving ? "Saving…" : "Saved automatically"}
                </span>
                <Button
                  scope="league"
                  onClick={() => setShowSongPicker(true)}
                  disabled={walkUpSongs.length >= MAX_WALK_UP_SONGS || songSaving}
                >
                  Add Song
                </Button>
              </div>
            }
          >
            {walkUpSongs.length === 0 ? (
              <div className="rounded-[var(--radius-surface)] border border-dashed border-[color:var(--color-border-strong)] bg-[var(--color-surface-2)]">
                <EmptyState
                  title="No custom walk-up songs yet"
                  description="DraftHQ will use the default walk-up track until you add your own songs."
                />
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--color-border-subtle)] overflow-hidden rounded-[var(--radius-surface)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)]">
                {walkUpSongs.map((song, index) => (
                  <div key={`${song.platform}-${song.trackId}-${index}`} className="flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)]">
                    {song.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={song.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-3)] text-xs font-black text-[color:var(--color-text-muted)]">
                        {index + 1}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-black text-[color:var(--color-text-primary)]">{song.title}</p>
                        <SongSourceBadge platform={song.platform} />
                        {needsSpotifyReconnect(song, spotifyConnected) && <SongPlaybackBadge />}
                      </div>
                      <p className="truncate text-xs text-[color:var(--color-text-muted)]">{song.artist || "Unknown artist"}</p>
                    </div>
                    <IconButton
                      label={`Remove ${song.title}`}
                      scope="league"
                      onClick={() => removeSong(index)}
                      disabled={songSaving}
                    >
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </IconButton>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {canManage && team && (
            <TeamOwnerPanel
              ownerDisplayName={team.ownerDisplayName}
              members={(workspace?.members ?? []).map((m) => ({
                userId: m.userId,
                displayName: m.displayName ?? "Member",
              }))}
              selectedOwnerUserId={team.ownerUserId ?? ""}
              assigning={assigningOwner}
              inviting={invitingOwner}
              onAssign={handleAssignOwner}
              onInvite={handleInviteOwner}
              statusMessage={ownerStatus}
            />
          )}

          {error && <Alert status="danger">{error}</Alert>}
          {success && (
            <Alert status="success">
              Team profile saved. These defaults will carry into draft night unless a commissioner overrides them for a draft.
            </Alert>
          )}

          {/* Sticky save bar: the form is long enough that the action would
              otherwise scroll out of reach. */}
          <div className="sticky bottom-4 z-10 rounded-[var(--radius-panel)] border border-[color:var(--color-border-subtle)] bg-[var(--color-canvas)]/90 p-[var(--space-2)] shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
            <Button
              scope="league"
              fullWidth
              loading={saving}
              disabled={!name.trim()}
              onClick={() => void handleSave()}
            >
              {saving
                ? uploadingLogo
                  ? "Uploading Logo..."
                  : uploadingOwnerPhoto
                    ? "Uploading Owner Photo..."
                    : "Saving Team..."
                : "Save Team Profile"}
            </Button>
          </div>
        </div>
      </div>

      {showSongPicker && (
        <SongPicker onSelect={addSong} onClose={closeSongPicker} />
      )}
    </>
  );
}
