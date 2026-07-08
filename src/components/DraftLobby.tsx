"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WalkUpPlayer, { type WalkUpPlayerHandle } from "@/components/WalkUpPlayer";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { getDefaultWalkUpSong } from "@/lib/draftAudio";
import type { Draft, DraftParticipant, Team } from "@/types/draft";

type AdvanceMode = "song" | "15" | "30" | "45" | "60";

interface DraftLobbyProps {
  draft: Draft;
  participants: DraftParticipant[];
  teams: Team[];
  onlineUserIds: string[];
  currentUserId: string;
  leagueLogoUrl?: string;
  leagueName?: string;
  leagueSlug?: string;
  isCommissioner: boolean;
  isStarting: boolean;
  chatUnread: number;
  onChatToggle: () => void;
  onStart: () => void;
}

const ADVANCE_OPTIONS: Array<{ value: AdvanceMode; label: string }> = [
  { value: "song", label: "End of song" },
  { value: "15", label: "15 seconds" },
  { value: "30", label: "30 seconds" },
  { value: "45", label: "45 seconds" },
  { value: "60", label: "60 seconds" },
];

function createDefaultAudio(
  url: string,
  onEnded: () => void,
  onBlocked: () => void,
  volume = 0.55
) {
  const audio = new Audio(url);
  audio.volume = volume;
  audio.onended = onEnded;
  audio.onerror = onBlocked;
  return audio;
}

function getPreDraftNoteItems(notes?: string) {
  if (!notes?.trim()) return [];
  const lines = notes.includes("\n")
    ? notes.split(/\r?\n/)
    : notes.split(/\s+[–—-]\s+/);
  return lines
    .map((line) => line.replace(/^\s*[•–—-]\s*/, "").trim())
    .filter(Boolean);
}

function TeamLogo({ team, fallback, className }: { team: Team; fallback?: string; className: string }) {
  const src = team.logoUrl || fallback || "/branding/logo-Photoroom.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`${team.name} logo`} className={`${className} object-contain`} />
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 8l4 4 6-7" />
    </svg>
  );
}

export default function DraftLobby({
  draft,
  participants,
  teams,
  onlineUserIds,
  currentUserId,
  leagueLogoUrl,
  leagueName,
  leagueSlug,
  isCommissioner,
  isStarting,
  chatUnread,
  onChatToggle,
  onStart,
}: DraftLobbyProps) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const playerRef = useRef<WalkUpPlayerHandle>(null);
  const defaultAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(true);
  const playbackConfirmedRef = useRef(false);
  const [copied, setCopied] = useState(false);
  // Lobby volume — per device, persisted, applied to both custom songs and
  // the default intro tracks.
  const [lobbyVolume, setLobbyVolume] = useState(() => {
    if (typeof window === "undefined") return 55;
    const v = localStorage.getItem("lobby:volume");
    return v !== null ? Number(v) : 55;
  });
  const [lobbyMuted, setLobbyMuted] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("lobby:muted") === "true"
  );
  const effectiveVolume = lobbyMuted ? 0 : lobbyVolume;
  const effectiveVolumeRef = useRef(effectiveVolume);
  useEffect(() => {
    effectiveVolumeRef.current = effectiveVolume;
    playerRef.current?.setVolume(effectiveVolume);
    if (defaultAudioRef.current) defaultAudioRef.current.volume = effectiveVolume / 100;
    try {
      localStorage.setItem("lobby:volume", String(lobbyVolume));
      localStorage.setItem("lobby:muted", String(lobbyMuted));
    } catch {}
  }, [effectiveVolume, lobbyVolume, lobbyMuted]);
  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.draftPosition - b.draftPosition),
    [teams]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [restartKey, setRestartKey] = useState(0);
  const [advanceMode, setAdvanceMode] = useState<AdvanceMode>("song");
  const [isPlaying, setIsPlaying] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const activeTeam = sortedTeams[activeIndex] ?? null;
  const activeSong = activeTeam?.walkUpSongs?.[0] ?? null;
  const defaultSongUrl = activeTeam ? getDefaultWalkUpSong(activeTeam.draftPosition) : null;
  const activeParticipant = activeTeam
    ? participants.find((participant) => participant.teamId === activeTeam.id)
    : null;
  const ownerName = activeTeam?.ownerName || activeParticipant?.displayName || "Owner not assigned";
  const preDraftNoteItems = getPreDraftNoteItems(activeTeam?.preDraftNotes);
  const yearInName = draft.name.match(/\b(20\d{2})\b/)?.[1];
  const draftYear = draft.scheduledAt
    ? new Date(draft.scheduledAt).getFullYear()
    : yearInName ?? new Date(draft.createdAt).getFullYear();
  const backHref = `/teams?draftId=${draft.id}&tab=settings${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`;
  const leagueDisplayLogo = leagueLogoUrl || "/branding/logo-Photoroom.png";

  // ── Online presence ────────────────────────────────────────────────────────
  // Cross-reference onlineUserIds with participants to compute per-team status.
  const teamOnlineStatus = useMemo(() => {
    return sortedTeams.map((team) => {
      const participant = participants.find(
        (p) => p.teamId === team.id && (p.role === "owner" || p.role === "commissioner")
      );
      const isOnline = !!participant?.userId && onlineUserIds.includes(participant.userId);
      return { team, participant, isOnline };
    });
  }, [sortedTeams, participants, onlineUserIds]);

  const onlineOwnerCount = teamOnlineStatus.filter((s) => s.isOnline).length;
  const totalTeamCount = sortedTeams.length;

  // Offline list — shown to commissioner so they know who is missing.
  const offlineTeamNames = teamOnlineStatus
    .filter((s) => !s.isOnline)
    .map((s) => s.team.name);

  const activeTeamOnlineStatus = teamOnlineStatus.find((s) => s.team.id === activeTeam?.id);

  // ── Join code copy ─────────────────────────────────────────────────────────
  function copyJoinCode() {
    void navigator.clipboard.writeText(draft.joinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const activateTeam = useCallback((index: number) => {
    if (sortedTeams.length === 0) return;
    const wrapped = (index + sortedTeams.length) % sortedTeams.length;
    setActiveIndex(wrapped);
    setRestartKey((value) => value + 1);
    setIsPlaying(true);
    isPlayingRef.current = true;
    playbackConfirmedRef.current = false;
    setAudioBlocked(false);
  }, [sortedTeams.length]);

  const showPrevious = useCallback(() => activateTeam(activeIndex - 1), [activateTeam, activeIndex]);
  const showNext = useCallback(() => activateTeam(activeIndex + 1), [activateTeam, activeIndex]);

  useEffect(() => {
    playerRef.current?.stop();
    if (defaultAudioRef.current) {
      defaultAudioRef.current.pause();
      defaultAudioRef.current.currentTime = 0;
      defaultAudioRef.current = null;
    }
    if (!isPlayingRef.current) return;
    playbackConfirmedRef.current = false;
    if (activeSong) {
      playerRef.current?.play(activeSong);
    } else if (defaultSongUrl) {
      const audio = createDefaultAudio(defaultSongUrl, showNext, () => setAudioBlocked(true), effectiveVolumeRef.current / 100);
      defaultAudioRef.current = audio;
      void audio.play().then(() => {
        playbackConfirmedRef.current = true;
        setAudioBlocked(false);
      }).catch(() => setAudioBlocked(true));
    }
    const blockedTimer = window.setTimeout(() => {
      if (!playbackConfirmedRef.current) setAudioBlocked(true);
    }, 2200);
    return () => {
      window.clearTimeout(blockedTimer);
      if (defaultAudioRef.current) {
        defaultAudioRef.current.pause();
        defaultAudioRef.current = null;
      }
    };
  }, [activeSong, activeIndex, defaultSongUrl, restartKey, showNext]);

  useEffect(() => {
    if (!isPlaying || sortedTeams.length < 2) return;
    if (advanceMode === "song" && (activeSong || defaultSongUrl) && !audioBlocked) return;
    const seconds = advanceMode === "song" ? 15 : Number(advanceMode);
    const timer = window.setTimeout(showNext, seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, activeSong, advanceMode, audioBlocked, defaultSongUrl, isPlaying, restartKey, showNext, sortedTeams.length]);

  function togglePlayback() {
    if (isPlaying) {
      playerRef.current?.pause();
      defaultAudioRef.current?.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      playerRef.current?.resume();
      if (!activeSong && defaultAudioRef.current) {
        void defaultAudioRef.current.play().catch(() => setAudioBlocked(true));
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
      setAudioBlocked(false);
    }
  }

  function enableAudio() {
    if (activeSong) {
      playerRef.current?.play(activeSong);
    } else if (defaultSongUrl) {
      const audio = defaultAudioRef.current ?? createDefaultAudio(defaultSongUrl, showNext, () => setAudioBlocked(true), effectiveVolumeRef.current / 100);
      defaultAudioRef.current = audio;
      void audio.play().then(() => {
        playbackConfirmedRef.current = true;
        setAudioBlocked(false);
      }).catch(() => setAudioBlocked(true));
    }
    setIsPlaying(true);
    isPlayingRef.current = true;
    setAudioBlocked(false);
  }

  if (!activeTeam) {
    return (
      <main className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950 p-6 text-center">
        <div>
          <h1 className="text-2xl font-black text-white">The pre-draft lobby is waiting on teams</h1>
          <p className="mt-2 text-sm text-slate-400">Add teams and configure the draft order before opening the lobby.</p>
          <Link href={backHref} className="mt-6 inline-block rounded-xl border border-slate-700 px-5 py-3 text-sm font-bold text-slate-200">Back to setup</Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="fixed inset-0 z-30 flex min-h-0 flex-col overflow-hidden text-white"
      style={{ background: `linear-gradient(145deg, ${secondary} 0%, #020617 48%, ${secondary} 100%)` }}
    >
      <WalkUpPlayer
        ref={playerRef}
        onPlaying={() => { playbackConfirmedRef.current = true; setAudioBlocked(false); }}
        onPlaybackBlocked={() => setAudioBlocked(true)}
        onEnded={() => { if (advanceMode === "song" && isPlaying) showNext(); }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-12 h-80 w-80 rounded-full blur-[100px] opacity-20" style={{ backgroundColor: primary }} />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full blur-[130px] opacity-15" style={{ backgroundColor: primary }} />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      <div className="relative z-10 flex min-h-28 shrink-0 items-center justify-center px-4 pb-2 pt-8 text-center sm:min-h-32 sm:px-6 sm:pb-3 sm:pt-10">
        <Link href={backHref} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 backdrop-blur hover:bg-white/10 sm:left-6">
          ← Back
        </Link>
        <div className="mx-auto max-w-[calc(100%_-_12rem)]">
          <h1 className="whitespace-normal break-words text-[clamp(1.75rem,2.8vw,3rem)] font-black uppercase leading-tight tracking-[0.08em]" style={{ color: primary, textShadow: `0 0 28px ${primary}45` }}>{leagueName ?? draft.name}</h1>
          <p className="mt-2 text-xl font-black uppercase tracking-[0.22em] text-slate-300 sm:text-2xl lg:text-3xl">{draftYear} Draft</p>
        </div>
      </div>

      <section className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-0 sm:px-8">
        <div className="grid w-full max-w-[1720px] items-center justify-center gap-5 lg:grid-cols-[160px_minmax(0,1fr)_160px] xl:grid-cols-[210px_minmax(0,1fr)_210px] xl:gap-8">
          {/* Side league logos — framing only, kept visually quiet */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={leagueDisplayLogo} alt={`${leagueName ?? draft.name} logo`} className="mx-auto hidden h-36 w-36 object-contain opacity-35 lg:block xl:h-44 xl:w-44" />
          <div
            key={activeTeam.id}
            className="grid w-full max-w-6xl justify-self-center items-center gap-5 rounded-[2rem] border border-white/10 bg-black/30 p-5 shadow-2xl backdrop-blur-xl md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)] md:p-8 lg:min-h-[430px] lg:gap-10 lg:py-10"
            style={{ animation: "lobby-team-in 0.2s ease-out" }}
          >
          <div className="relative mx-auto flex aspect-square w-full max-w-64 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 shadow-inner lg:max-w-72">
            <div className="absolute inset-4 rounded-[1.5rem] opacity-20 blur-2xl" style={{ backgroundColor: primary }} />
            <TeamLogo team={activeTeam} fallback={leagueLogoUrl} className="relative h-full w-full rounded-2xl" />

            {/* Online status dot on the active team card */}
            <span
              title={activeTeamOnlineStatus?.isOnline ? "Owner is online" : "Owner is not online"}
              className={`absolute bottom-3 right-3 h-4 w-4 rounded-full ring-2 ring-black/60 ${activeTeamOnlineStatus?.isOnline ? "bg-green-400" : "bg-slate-600"}`}
            />
          </div>

          <div className="min-w-0 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ backgroundColor: primary + "22", color: primary }}>Draft position {activeTeam.draftPosition}</span>
              {activeParticipant?.userId === currentUserId && <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">Your team</span>}
              {/* Online badge on the featured team */}
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${activeTeamOnlineStatus?.isOnline ? "bg-green-500/15 text-green-400" : "bg-white/8 text-slate-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeTeamOnlineStatus?.isOnline ? "bg-green-400" : "bg-slate-600"}`} />
                {activeTeamOnlineStatus?.isOnline ? "Online" : "Not online"}
              </span>
            </div>
            <h1 className="mt-3 truncate text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">{activeTeam.name}</h1>
            <p className="mt-2 text-base font-semibold text-slate-300">{ownerName}</p>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <div className="min-h-36 rounded-xl border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: primary }}>Pre-Draft Notes</p>
                {preDraftNoteItems.length > 0 ? (
                  <ul className="mt-2.5 space-y-2 text-sm leading-relaxed text-slate-300">
                    {preDraftNoteItems.map((note, index) => (
                      <li key={`${index}-${note}`} className="flex gap-2.5">
                        <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: primary }} />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2.5 text-sm italic leading-relaxed text-slate-600">No pre-draft notes have been added for this team.</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Last record</p><p className="mt-1 text-sm font-black">{activeTeam.lastSeasonRecord || "No history"}</p></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Playoffs</p><p className="mt-1 text-sm font-black">{activeTeam.lastSeasonPlayoffs == null ? "No history" : activeTeam.lastSeasonPlayoffs ? "Qualified" : "Missed"}</p></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">First pick</p><p className="mt-1 truncate text-sm font-black">{activeTeam.lastSeasonPickPlayer || (activeTeam.lastSeasonPick ? `Pick ${activeTeam.lastSeasonPick}` : "No history")}</p></div>
              </div>
            </div>
          </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={leagueDisplayLogo} alt="" className="mx-auto hidden h-36 w-36 object-contain opacity-35 lg:block xl:h-44 xl:w-44" />
        </div>
      </section>

      {/* Team strip — thumbnails with online/offline dots; hugs the team card above */}
      <section className="relative z-10 shrink-0 px-4 pt-1 pb-2 sm:px-8">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:thin] lg:justify-center">
          {sortedTeams.map((team, index) => {
            const active = index === activeIndex;
            const status = teamOnlineStatus.find((s) => s.team.id === team.id);
            const isOnline = status?.isOnline ?? false;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => activateTeam(index)}
                className={`group w-20 shrink-0 rounded-2xl border bg-black/25 p-2 text-center backdrop-blur transition-all sm:w-24 ${active ? "scale-105" : "border-white/10 opacity-65 hover:opacity-100"}`}
                style={active ? { borderColor: primary, boxShadow: `0 0 22px ${primary}45` } : undefined}
                aria-label={`Feature ${team.name}`}
              >
                {/* Logo with online dot */}
                <div className="relative mx-auto h-11 w-11 sm:h-13 sm:w-13">
                  <TeamLogo team={team} fallback={leagueLogoUrl} className="h-full w-full rounded-xl" />
                  <span
                    title={isOnline ? "Online" : "Not online"}
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-black/70 ${isOnline ? "bg-green-400" : "bg-slate-600"}`}
                  />
                </div>
                <p className="mt-1.5 truncate text-[10px] font-bold text-white">{team.name}</p>
                <p className="text-[9px] text-slate-500">Pick {team.draftPosition}</p>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="relative z-10 flex shrink-0 flex-col gap-3 border-t border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:px-6">

        {/* Left: chat + join code (always visible) */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-1 sm:justify-start">
          <button
            type="button"
            onClick={onChatToggle}
            className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
              <path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h9A2.5 2.5 0 0 1 17 4.5v6a2.5 2.5 0 0 1-2.5 2.5H9l-4.5 3v-3A2.5 2.5 0 0 1 2 10.5v-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            Chat
            {chatUnread > 0 && (
              <span className="flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black" style={{ backgroundColor: primary, color: secondary }}>
                {chatUnread > 99 ? "99+" : chatUnread}
              </span>
            )}
          </button>

          {/* Join code — visible on all screen sizes with copy button */}
          <button
            type="button"
            onClick={copyJoinCode}
            title={copied ? "Copied!" : "Copy join code"}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Join code</span>
            <span className="font-mono font-black text-slate-300">{draft.joinCode}</span>
            {copied
              ? <CheckIcon className="h-3.5 w-3.5 text-green-400" />
              : <CopyIcon className="h-3.5 w-3.5" />
            }
          </button>
        </div>

        {/* Center: playback controls */}
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={showPrevious} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg hover:bg-white/10" aria-label="Previous team">‹</button>
          <button type="button" onClick={togglePlayback} className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-black" style={{ backgroundColor: primary, color: secondary }} aria-label={isPlaying ? "Pause introductions" : "Play introductions"}>{isPlaying ? "Ⅱ" : "▶"}</button>
          <button type="button" onClick={showNext} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg hover:bg-white/10" aria-label="Next team">›</button>
          <label className="ml-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
            Advance
            <select value={advanceMode} onChange={(event) => setAdvanceMode(event.target.value as AdvanceMode)} className="border-0 bg-transparent p-0 text-xs font-bold text-white outline-none">
              {ADVANCE_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-slate-900">{option.label}</option>)}
            </select>
          </label>

          {/* Volume */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <button
              type="button"
              onClick={() => setLobbyMuted((m) => !m)}
              aria-label={lobbyMuted ? "Unmute" : "Mute"}
              title={lobbyMuted ? "Unmute" : "Mute"}
              className={lobbyMuted ? "text-red-400 hover:text-red-300" : "text-slate-400 hover:text-white"}
            >
              {lobbyMuted ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd"/>
                </svg>
              )}
            </button>
            <input
              type="range" min={0} max={100} value={lobbyVolume}
              disabled={lobbyMuted}
              aria-label="Lobby music volume"
              onInput={(e) => setLobbyVolume(Number(e.currentTarget.value))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-slate-700 accent-teal-500 disabled:opacity-30"
            />
          </div>

          {audioBlocked && <button type="button" onClick={enableAudio} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">Enable audio</button>}
        </div>

        {/* Right: online count + start/waiting */}
        <div className="flex flex-col items-center gap-1.5 sm:flex-1 sm:items-end">

          {/* Online count — visible to everyone */}
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${onlineOwnerCount === totalTeamCount ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="text-xs font-semibold text-slate-300">
              {onlineOwnerCount} / {totalTeamCount} owners online
            </span>
          </div>

          {/* Commissioner: list of who is missing */}
          {isCommissioner && offlineTeamNames.length > 0 && (
            <p className="max-w-48 text-right text-[10px] leading-snug text-slate-600">
              Not here yet:{" "}
              <span className="text-slate-500">
                {offlineTeamNames.slice(0, 3).join(", ")}
                {offlineTeamNames.length > 3 && ` +${offlineTeamNames.length - 3} more`}
              </span>
            </p>
          )}

          {isCommissioner ? (
            <button
              type="button"
              disabled={isStarting}
              onClick={onStart}
              className="w-full rounded-xl px-6 py-3 text-sm font-black uppercase tracking-[0.14em] shadow-lg transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50 sm:w-auto"
              style={{ backgroundColor: primary, color: secondary }}
            >
              {isStarting ? "Starting draft..." : "Start Draft"}
            </button>
          ) : (
            <p className="text-center text-xs text-slate-500 sm:text-right">Waiting for the commissioner</p>
          )}
        </div>
      </footer>
    </main>
  );
}
