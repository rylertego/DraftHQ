"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandButton, CommandStatusBadge } from "@/components/CommandCenterUI";
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
  const assignedTeamCount = new Set(
    participants.flatMap((participant) =>
      participant.teamId && (participant.role === "owner" || participant.role === "commissioner")
        ? [participant.teamId]
        : []
    )
  ).size;
  const unnamedTeamCount = sortedTeams.filter((team) => !team.name.trim()).length;
  const setupIssues = [
    sortedTeams.length < draft.teamCount ? `${draft.teamCount - sortedTeams.length} teams not created` : null,
    sortedTeams.length > draft.teamCount ? `${sortedTeams.length - draft.teamCount} extra teams configured` : null,
    unnamedTeamCount > 0 ? `${unnamedTeamCount} teams need names` : null,
    assignedTeamCount < draft.teamCount ? `${draft.teamCount - assignedTeamCount} teams need owners` : null,
  ].filter(Boolean) as string[];
  const draftReady = setupIssues.length === 0;
  const connectionReady = onlineUserIds.includes(currentUserId);
  const readinessLabel = isStarting
    ? "Starting draft"
    : draftReady
      ? "Draft ready"
      : "Setup needs attention";
  const readinessTone = isStarting ? "warning" : draftReady ? "ready" : "warning";
  const startDisabledReason = !isCommissioner
    ? "Only the commissioner can start the draft."
    : !draftReady
      ? setupIssues.join(", ")
      : isStarting
        ? "Draft start is in progress."
        : null;

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
      className="fixed inset-0 z-30 flex min-h-0 flex-col overflow-y-auto text-white lg:overflow-hidden"
      style={{ background: `linear-gradient(145deg, ${secondary} 0%, #020617 44%, #050b18 72%, ${secondary} 100%)` }}
    >
      <WalkUpPlayer
        ref={playerRef}
        onPlaying={() => { playbackConfirmedRef.current = true; setAudioBlocked(false); }}
        onPlaybackBlocked={() => setAudioBlocked(true)}
        onEnded={() => { if (advanceMode === "song" && isPlaying) showNext(); }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px opacity-80" style={{ backgroundColor: primary }} />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/[0.04] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-3 px-4 pb-3 pt-4 sm:hidden">
        <Link href={backHref} className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-200 backdrop-blur transition-colors hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500">
          Back
        </Link>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: primary }}>Draft Day Lobby</p>
          <h1 className="text-xl font-black leading-tight text-white">{leagueName ?? draft.name}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-400">{draftYear} Draft Lobby</p>
        </div>
      </div>

      <div className="relative z-10 hidden shrink-0 items-center justify-center px-4 pb-3 pt-5 text-center sm:flex sm:px-6">
        <Link href={backHref} className="absolute left-4 top-1/2 inline-flex min-h-11 -translate-y-1/2 items-center rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 backdrop-blur hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 sm:left-6">
          ← Back
        </Link>
        <div className="mx-auto max-w-[calc(100%_-_12rem)]">
          <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: primary }}>Draft Day Lobby</p>
          <h1 className="mt-1 whitespace-normal break-words text-3xl font-black leading-tight text-white">{leagueName ?? draft.name}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-400">{draftYear} Draft Lobby</p>
        </div>
      </div>

      <div className="relative z-20 shrink-0 px-4 pb-5 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
          <CommandStatusBadge label={readinessLabel} tone={readinessTone} />
          <CommandStatusBadge label={connectionReady ? "Connected" : "Reconnecting"} tone={connectionReady ? "complete" : "warning"} />
          <CommandStatusBadge label={audioBlocked ? "Audio Blocked" : lobbyMuted ? "Audio Muted" : "Audio Ready"} tone={audioBlocked ? "warning" : "neutral"} />
        </div>
      </div>

      <div className="relative z-10 shrink-0 px-4 pb-3 sm:hidden">
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/72 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Players Online</span>
            <span className="flex items-center gap-1.5 text-xs font-black text-white">
              <span className={`h-2 w-2 rounded-full ${onlineOwnerCount === totalTeamCount ? "bg-green-400" : "bg-amber-400"}`} />
              {onlineOwnerCount}/{totalTeamCount}
            </span>
          </div>
          {isCommissioner ? (
            <CommandButton
              type="button"
              variant="secondary"
              disabled={isStarting}
              onClick={onStart}
              title={startDisabledReason ?? "Start the draft"}
              className="mt-3 w-full !border-emerald-400/45 !bg-emerald-500/12 !text-emerald-200 hover:!border-emerald-300/60 hover:!bg-emerald-500/18 focus:ring-emerald-300"
            >
              {isStarting ? "Starting Draft" : "Start Draft"}
            </CommandButton>
          ) : (
            <p className="mt-2 text-xs text-slate-400">Waiting for the draft to start.</p>
          )}
        </div>
      </div>

      <section className="relative z-10 flex flex-none items-center justify-center px-4 pb-0 sm:px-6 lg:min-h-0 lg:flex-1">
        <div className="grid w-full max-w-7xl items-center justify-center gap-4">
          {/* Side league logos — framing only, kept visually quiet */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={leagueDisplayLogo} alt={`${leagueName ?? draft.name} logo`} className="hidden" />
          <div
            key={activeTeam.id}
            className="lobby-team-card grid w-full max-w-6xl items-center justify-self-center gap-5 rounded-xl border border-slate-800/90 bg-slate-900/78 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.26)] backdrop-blur-xl md:grid-cols-[minmax(220px,0.62fr)_minmax(0,1.38fr)] md:p-6 lg:min-h-[360px] lg:gap-8"
          >
          <div className="mx-auto w-full max-w-64">
            <div className="relative left-1/2 mb-3 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-nowrap items-center justify-center gap-2">
              <span className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ backgroundColor: primary + "22", borderColor: primary + "55", color: primary }}>Draft position {activeTeam.draftPosition}</span>
              {activeParticipant?.userId === currentUserId && <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">Your team</span>}
              <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${activeTeamOnlineStatus?.isOnline ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/8 text-slate-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeTeamOnlineStatus?.isOnline ? "bg-green-400" : "bg-slate-600"}`} />
                {activeTeamOnlineStatus?.isOnline ? "Online" : "Not online"}
              </span>
            </div>
            <div className="relative flex aspect-square w-full items-center justify-center rounded-xl border border-slate-800/90 bg-slate-950/55 p-6 shadow-inner">
              <TeamLogo team={activeTeam} fallback={leagueLogoUrl} className="relative h-full w-full rounded-2xl" />
            </div>
          </div>

          <div className="min-w-0 text-center md:text-left">
            <h1 className="text-balance text-4xl font-black tracking-tight sm:text-5xl">{activeTeam.name}</h1>
            <p className="mt-2 text-base font-semibold text-slate-300">Owner: <span className="text-white">{ownerName}</span></p>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <div className="min-h-32 rounded-xl border border-slate-800/90 bg-slate-950/40 px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: primary }}>Pre-Draft Notes</p>
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
                <div className="rounded-xl border border-slate-800/90 bg-slate-950/40 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Last Record</p><p className="mt-1 text-sm font-black">{activeTeam.lastSeasonRecord || "No history"}</p></div>
                <div className="rounded-xl border border-slate-800/90 bg-slate-950/40 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Playoffs</p><p className="mt-1 text-sm font-black">{activeTeam.lastSeasonPlayoffs == null ? "No history" : activeTeam.lastSeasonPlayoffs ? "Qualified" : "Missed"}</p></div>
                <div className="rounded-xl border border-slate-800/90 bg-slate-950/40 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">First Pick</p><p className="mt-1 truncate text-sm font-black">{activeTeam.lastSeasonPickPlayer || (activeTeam.lastSeasonPick ? `Pick ${activeTeam.lastSeasonPick}` : "No history")}</p></div>
              </div>
            </div>
          </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={leagueDisplayLogo} alt="" className="hidden" />
        </div>
      </section>

      {/* Team strip — thumbnails with online/offline dots; hugs the team card above */}
      <section className="relative z-10 shrink-0 px-4 pt-2 pb-2 sm:px-6">
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
                className={`group min-h-20 w-20 shrink-0 rounded-xl border p-2 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 sm:w-24 ${active ? "border-blue-400/60 bg-blue-500/12" : "border-slate-800 bg-slate-950/35 hover:border-slate-700 hover:bg-slate-900/70"}`}
                style={active ? { boxShadow: `0 0 18px ${primary}25` } : undefined}
                aria-label={`Feature ${team.name}`}
              >
                {/* Logo with online dot */}
                <div className="relative mx-auto h-10 w-10 sm:h-11 sm:w-11">
                  <TeamLogo team={team} fallback={leagueLogoUrl} className="h-full w-full rounded-lg" />
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

      <section className="relative z-10 shrink-0 px-4 pb-3 sm:px-6">
        <div className="mx-auto grid w-full max-w-3xl gap-3 rounded-xl border border-slate-800/90 bg-slate-900/72 px-4 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:grid-cols-2 sm:items-center">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Readiness</p>
            <p className={`mt-1 text-sm font-bold ${draftReady ? "text-emerald-200" : "text-amber-200"}`}>{readinessLabel}</p>
          </div>
          <div className="min-w-0 sm:text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Assigned</p>
            <p className="mt-1 font-black text-white">{assignedTeamCount}/{draft.teamCount}</p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 flex shrink-0 flex-col gap-3 border-t border-slate-800/90 bg-slate-900/78 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:flex-row sm:items-center sm:px-6">

        {/* Left: chat + join code (always visible) */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-1 sm:justify-start">
          <button
            type="button"
            onClick={onChatToggle}
            className="relative flex min-h-11 items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs font-bold text-slate-200 hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
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
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-400 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500"
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
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-800/90 bg-slate-950/35 px-3 py-2">
          <span className="hidden text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 xl:inline">Broadcast Controls</span>
          <button type="button" onClick={showPrevious} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg hover:bg-white/10" aria-label="Previous team">‹</button>
          <button type="button" onClick={togglePlayback} className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-black" style={{ backgroundColor: primary, color: secondary }} aria-label={isPlaying ? "Pause introductions" : "Play introductions"}>{isPlaying ? "Ⅱ" : "▶"}</button>
          <button type="button" onClick={showNext} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg hover:bg-white/10" aria-label="Next team">›</button>
          <label className="ml-1 flex min-h-11 items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            Advance
            <select value={advanceMode} onChange={(event) => setAdvanceMode(event.target.value as AdvanceMode)} className="border-0 bg-transparent p-0 text-xs font-bold text-white outline-none">
              {ADVANCE_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-slate-900">{option.label}</option>)}
            </select>
          </label>

          {/* Volume */}
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2">
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

          {audioBlocked && <button type="button" onClick={enableAudio} className="min-h-11 rounded-xl border border-amber-400/35 bg-amber-500/12 px-3 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300">Enable audio</button>}
        </div>

        {/* Right: online count + start/waiting */}
        <div className="flex flex-col items-center gap-2 sm:flex-1 sm:items-end">

          {/* Online count — visible to everyone */}
          <div className="flex w-36 items-center justify-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${onlineOwnerCount === totalTeamCount ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="whitespace-nowrap text-xs font-semibold text-slate-300">
              {onlineOwnerCount} / {totalTeamCount} players online
            </span>
          </div>

          {isCommissioner ? (
            <CommandButton
              type="button"
              variant="secondary"
              disabled={isStarting}
              onClick={onStart}
              title={startDisabledReason ?? "Start the draft"}
              className="min-w-36 !border-emerald-400/45 !bg-emerald-500/12 !text-emerald-200 hover:!border-emerald-300/60 hover:!bg-emerald-500/18 focus:ring-emerald-300"
            >
              {isStarting ? "Starting Draft" : "Start Draft"}
            </CommandButton>
          ) : (
            <p className="text-center text-xs text-slate-500 sm:text-right">Waiting for the draft to start</p>
          )}
        </div>
      </footer>
    </main>
  );
}
