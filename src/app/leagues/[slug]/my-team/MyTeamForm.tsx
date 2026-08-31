"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import SongPicker from "@/components/SongPicker";
import { MAX_WALK_UP_SONGS } from "@/lib/draftAudio";
import { disconnectSpotify, isSpotifyConnected, needsSpotifyReconnect } from "@/lib/spotifyAuth";
import {
  getLeagueTeams,
  updateMyLeagueTeamDetails,
  uploadMyLeagueTeamLogoAsset,
  uploadMyLeagueTeamOwnerPhotoAsset,
} from "@/lib/leagueApi";
import type { LeagueTeam } from "@/types/league";
import type { WalkUpSong } from "@/types/draft";
import { Alert, Button, EmptyState, Field, IconButton, Input, Panel } from "@/components/ui";

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

interface SpotifyConnectionPanelProps {
  connected: boolean;
  onDisconnect: () => void;
}

/** Status only. Linking happens inside the Add Song picker so there is one
 *  place to connect; this panel just reports state and offers the way out. */
export function SpotifyConnectionPanel({
  connected,
  onDisconnect,
}: SpotifyConnectionPanelProps) {
  return (
    <div className="rounded-[var(--radius-surface)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] px-[var(--space-4)] py-[var(--space-3)]">
      <div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-[var(--space-2)]">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connected ? "bg-[color:var(--color-success)]" : "bg-[color:var(--color-text-muted)]"
              }`}
              aria-hidden="true"
            />
            <p className="text-sm font-black text-[color:var(--color-text-primary)]">
              {connected ? "Spotify connected" : "Spotify not connected"}
            </p>
          </div>
          <p className="mt-1 text-sm leading-6 text-[color:var(--color-text-secondary)]">
            {connected
              ? "Spotify search is available when you add walk-up songs on this device."
              : "Add a song and pick the Spotify tab to link your account."}
          </p>
        </div>

        {connected && (
          <Button variant="secondary" onClick={onDisconnect}>
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
}

export default function MyTeamForm({ slug }: { slug: string }) {
  void slug;
  const { workspace, isLoading } = useWorkspace();
  const { accentColor: primary } = useLeagueTheme();
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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const league = workspace?.league;
  const myTeamRef = workspace?.myTeam;

  useEffect(() => {
    if (!league || !myTeamRef) return;
    let active = true;

    void getLeagueTeams(league.id)
      .then((teams) => {
        if (!active) return;
        const found = teams.find((t) => t.id === myTeamRef.id) ?? null;
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
  }, [league, myTeamRef]);

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

  function removeSong(index: number) {
    setWalkUpSongs((prev) => prev.filter((_, i) => i !== index));
    setSuccess(false);
  }

  function closeSongPicker() {
    setShowSongPicker(false);
    setSpotifyConnected(isSpotifyConnected());
  }

  function addSong(song: WalkUpSong) {
    setWalkUpSongs((prev) => [...prev, song].slice(0, MAX_WALK_UP_SONGS));
    closeSongPicker();
    setSuccess(false);
  }

  function handleSpotifyDisconnect() {
    disconnectSpotify();
    setSpotifyConnected(false);
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

      setTeam(updated);
      setName(updated.name);
      setShortName(updated.shortName ?? "");
      setOwnerName(updated.ownerName ?? "");
      setWalkUpSongs(updated.walkUpSongs);
      setTtsName(updated.ttsName ?? "");
      setLogoPreview(updated.logoUrl);
      setOwnerPhotoPreview(updated.ownerPhotoUrl);
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

  if (!myTeamRef) {
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

  const initials = (team?.name ?? myTeamRef.name).trim().slice(0, 2).toUpperCase() || "T";
  const savedSongCount = team?.walkUpSongs.length ?? 0;

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
                My Franchise
              </p>
              <h1 className="mt-2 truncate text-3xl font-black text-[color:var(--color-text-primary)]">
                {name || myTeamRef.name}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[color:var(--color-text-secondary)]">
                These details are your league-level defaults and carry into draft night unless a commissioner overrides a draft.
              </p>
            </div>
          </div>

          <div className="mt-[var(--space-4)] grid grid-cols-2 gap-[var(--space-3)] border-t border-[color:var(--color-border-subtle)] pt-[var(--space-4)]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Songs</p>
              <p className="mt-1 text-xl font-black tabular-nums text-[color:var(--color-text-primary)]">
                {walkUpSongs.length}/{MAX_WALK_UP_SONGS}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Saved</p>
              <p className="mt-1 text-xl font-black tabular-nums text-[color:var(--color-text-primary)]">{savedSongCount}</p>
            </div>
          </div>
        </aside>

        <div className="flex flex-col gap-[var(--space-4)]">
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
              <Button
                scope="league"
                onClick={() => setShowSongPicker(true)}
                disabled={walkUpSongs.length >= MAX_WALK_UP_SONGS}
              >
                Add Song
              </Button>
            }
          >
            <div className="mb-[var(--space-4)]">
              <SpotifyConnectionPanel
                connected={spotifyConnected}
                onDisconnect={handleSpotifyDisconnect}
              />
            </div>

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
                    <IconButton label={`Remove ${song.title}`} onClick={() => removeSong(index)}>
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </IconButton>
                  </div>
                ))}
              </div>
            )}
          </Panel>

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
