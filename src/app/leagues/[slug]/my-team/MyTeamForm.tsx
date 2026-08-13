"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useWorkspace } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import SongPicker from "@/components/SongPicker";
import { MAX_WALK_UP_SONGS } from "@/lib/draftAudio";
import {
  getLeagueTeams,
  updateMyLeagueTeamDetails,
  uploadMyLeagueTeamLogoAsset,
} from "@/lib/leagueApi";
import type { LeagueTeam } from "@/types/league";
import type { WalkUpSong } from "@/types/draft";

function SongSourceBadge({ platform }: { platform: WalkUpSong["platform"] }) {
  return (
    <span className="rounded-full border border-slate-700/80 bg-slate-950/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
      {platform}
    </span>
  );
}

export default function MyTeamForm({ slug }: { slug: string }) {
  void slug;
  const { workspace, isLoading } = useWorkspace();
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [team, setTeam] = useState<LeagueTeam | null>(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [walkUpSongs, setWalkUpSongs] = useState<WalkUpSong[]>([]);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showSongPicker, setShowSongPicker] = useState(false);
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
        setLogoPreview(found.logoUrl);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load your team.");
      });

    return () => {
      active = false;
    };
  }, [league, myTeamRef]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setSuccess(false);
  }

  function removeSong(index: number) {
    setWalkUpSongs((prev) => prev.filter((_, i) => i !== index));
    setSuccess(false);
  }

  function addSong(song: WalkUpSong) {
    setWalkUpSongs((prev) => [...prev, song].slice(0, MAX_WALK_UP_SONGS));
    setShowSongPicker(false);
    setSuccess(false);
  }

  async function handleSave() {
    if (!team || !league || !name.trim()) return;
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      let logoUrl = team.logoUrl;
      if (logoFile) {
        setUploadingLogo(true);
        logoUrl = await uploadMyLeagueTeamLogoAsset(league.id, team.id, logoFile);
        setUploadingLogo(false);
      }

      const updated = await updateMyLeagueTeamDetails(league.id, team.id, {
        name: name.trim(),
        shortName: shortName.trim() || null,
        ownerName: ownerName.trim() || null,
        logoUrl,
        walkUpSongs: walkUpSongs.slice(0, MAX_WALK_UP_SONGS),
      });

      setTeam(updated);
      setName(updated.name);
      setShortName(updated.shortName ?? "");
      setOwnerName(updated.ownerName ?? "");
      setWalkUpSongs(updated.walkUpSongs);
      setLogoPreview(updated.logoUrl);
      setLogoFile(null);
      setSuccess(true);
    } catch (err) {
      setUploadingLogo(false);
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
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
        <div className="h-1" style={{ backgroundColor: primary }} />
        <div className="grid gap-6 p-5 lg:grid-cols-[20rem_1fr] lg:p-6">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-start gap-4 lg:block">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950 transition-colors hover:border-slate-500 focus:outline-none focus:ring-2"
                style={{ ["--tw-ring-color" as string]: primary }}
                aria-label="Upload team logo"
              >
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="" className="h-full w-full object-contain p-2" />
                ) : (
                  <span className="text-3xl font-black text-white">{initials}</span>
                )}
                <span className="absolute inset-x-3 bottom-3 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Replace
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

              <div className="min-w-0 lg:mt-5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: primary }}>
                  My Franchise
                </p>
                <h1 className="mt-2 truncate text-3xl font-black text-white">{name || myTeamRef.name}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  These details are your league-level defaults and carry into draft night unless a commissioner overrides a draft.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-800 pt-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Songs</p>
                <p className="mt-1 text-xl font-black text-white">{walkUpSongs.length}/{MAX_WALK_UP_SONGS}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Saved</p>
                <p className="mt-1 text-xl font-black text-white">{savedSongCount}</p>
              </div>
            </div>
          </aside>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex flex-col gap-1 border-b border-slate-800 pb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: primary }}>
                  Team Identity
                </p>
                <h2 className="text-xl font-black text-white">Team Details</h2>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
                    Team Name <span className="text-red-400">*</span>
                  </span>
                  <input
                    required
                    maxLength={100}
                    className="w-full"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setSuccess(false);
                    }}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">Short Name</span>
                  <input
                    maxLength={10}
                    className="w-full"
                    placeholder="Shown in compact draft views"
                    value={shortName}
                    onChange={(e) => {
                      setShortName(e.target.value);
                      setSuccess(false);
                    }}
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">Owner Display Name</span>
                <input
                  maxLength={100}
                  className="w-full"
                  placeholder="Optional display name shown during draft night"
                  value={ownerName}
                  onChange={(e) => {
                    setOwnerName(e.target.value);
                    setSuccess(false);
                  }}
                />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: primary }}>
                    Walk-Up Playlist
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">Draft Night Walk-Up Songs</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSongPicker(true)}
                  disabled={walkUpSongs.length >= MAX_WALK_UP_SONGS}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-black text-slate-950 transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: primary }}
                >
                  Add Song
                </button>
              </div>

              {walkUpSongs.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-center">
                  <p className="font-bold text-white">No custom walk-up songs yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    DraftHQ will use the default walk-up track until you add your own songs.
                  </p>
                </div>
              ) : (
                <div className="mt-5 divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50">
                  {walkUpSongs.map((song, index) => (
                    <div key={`${song.platform}-${song.trackId}-${index}`} className="flex items-center gap-3 px-4 py-3">
                      {song.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={song.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xs font-black text-slate-500">
                          {index + 1}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-black text-white">{song.title}</p>
                          <SongSourceBadge platform={song.platform} />
                        </div>
                        <p className="truncate text-xs text-slate-500">{song.artist || "Unknown artist"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSong(index)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400"
                        aria-label={`Remove ${song.title}`}
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
                          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</p>
            )}
            {success && (
              <p className="rounded-xl border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
                Team profile saved. These defaults will carry into draft night unless a commissioner overrides them for a draft.
              </p>
            )}

            <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-800 bg-slate-950/90 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
              <button
                type="button"
                disabled={saving || !name.trim()}
                onClick={() => void handleSave()}
                className="min-h-12 w-full rounded-xl text-sm font-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: primary, color: secondary }}
              >
                {saving ? (uploadingLogo ? "Uploading Logo..." : "Saving Team...") : "Save Team Profile"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {showSongPicker && (
        <SongPicker
          onSelect={addSong}
          onClose={() => setShowSongPicker(false)}
        />
      )}
    </div>
  );
}
