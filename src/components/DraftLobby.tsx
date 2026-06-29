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
  onBlocked: () => void
) {
  const audio = new Audio(url);
  audio.volume = 0.7;
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

export default function DraftLobby({
  draft,
  participants,
  teams,
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
      const audio = createDefaultAudio(defaultSongUrl, showNext, () => setAudioBlocked(true));
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
      const audio = defaultAudioRef.current ?? createDefaultAudio(defaultSongUrl, showNext, () => setAudioBlocked(true));
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

      <section className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-2 sm:px-8">
        <div className="grid w-full max-w-[1720px] items-center justify-center gap-5 lg:grid-cols-[200px_minmax(0,1fr)_200px] xl:grid-cols-[260px_minmax(0,1fr)_260px] xl:gap-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={leagueDisplayLogo} alt={`${leagueName ?? draft.name} logo`} className="mx-auto hidden h-48 w-48 object-contain drop-shadow-2xl lg:block xl:h-60 xl:w-60" />
          <div className="grid w-full max-w-6xl justify-self-center items-center gap-5 rounded-[2rem] border border-white/10 bg-black/30 p-5 shadow-2xl backdrop-blur-xl md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)] md:p-8 lg:min-h-[430px] lg:gap-10 lg:py-10">
          <div className="relative mx-auto flex aspect-square w-full max-w-64 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 shadow-inner lg:max-w-72">
            <div className="absolute inset-4 rounded-[1.5rem] opacity-20 blur-2xl" style={{ backgroundColor: primary }} />
            <TeamLogo team={activeTeam} fallback={leagueLogoUrl} className="relative h-full w-full rounded-2xl" />
          </div>

          <div className="min-w-0 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ backgroundColor: primary + "22", color: primary }}>Draft position {activeTeam.draftPosition}</span>
              {activeParticipant?.userId === currentUserId && <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">Your team</span>}
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
          <img src={leagueDisplayLogo} alt="" className="mx-auto hidden h-48 w-48 object-contain drop-shadow-2xl lg:block xl:h-60 xl:w-60" />
        </div>
      </section>

      <section className="relative z-10 shrink-0 px-4 py-2 sm:px-8">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-1 py-2 [scrollbar-width:thin] lg:justify-center">
          {sortedTeams.map((team, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => activateTeam(index)}
                className={`group w-20 shrink-0 rounded-2xl border bg-black/25 p-2 text-center backdrop-blur transition-all sm:w-24 ${active ? "scale-105" : "border-white/10 opacity-65 hover:opacity-100"}`}
                style={active ? { borderColor: primary, boxShadow: `0 0 22px ${primary}45` } : undefined}
                aria-label={`Feature ${team.name}`}
              >
                <TeamLogo team={team} fallback={leagueLogoUrl} className="mx-auto h-11 w-11 rounded-xl sm:h-13 sm:w-13" />
                <p className="mt-1.5 truncate text-[10px] font-bold text-white">{team.name}</p>
                <p className="text-[9px] text-slate-500">Pick {team.draftPosition}</p>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="relative z-10 flex shrink-0 flex-col gap-3 border-t border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center justify-center gap-3 sm:justify-start lg:min-w-48">
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
          <span className="hidden text-xs text-slate-500 lg:inline">Join code <span className="ml-1 font-mono font-black text-slate-300">{draft.joinCode}</span></span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={showPrevious} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg hover:bg-white/10" aria-label="Previous team">‹</button>
          <button type="button" onClick={togglePlayback} className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-black" style={{ backgroundColor: primary, color: secondary }} aria-label={isPlaying ? "Pause introductions" : "Play introductions"}>{isPlaying ? "Ⅱ" : "▶"}</button>
          <button type="button" onClick={showNext} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg hover:bg-white/10" aria-label="Next team">›</button>
          <label className="ml-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
            Advance
            <select value={advanceMode} onChange={(event) => setAdvanceMode(event.target.value as AdvanceMode)} className="border-0 bg-transparent p-0 text-xs font-bold text-white outline-none">
              {ADVANCE_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-slate-900">{option.label}</option>)}
            </select>
          </label>
          {audioBlocked && <button type="button" onClick={enableAudio} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">Enable audio</button>}
        </div>
        <div className="sm:min-w-48 sm:text-right">
          {isCommissioner ? (
            <button type="button" disabled={isStarting} onClick={onStart} className="w-full rounded-xl px-6 py-3 text-sm font-black uppercase tracking-[0.14em] shadow-lg transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50 sm:w-auto" style={{ backgroundColor: primary, color: secondary }}>
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
