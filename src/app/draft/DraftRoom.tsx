"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PickModal from "@/components/PickModal";
import DraftBoard from "@/components/DraftBoard";
import DraftLobby from "@/components/DraftLobby";
import DraftChat from "@/components/DraftChat";
import DraftTicker from "@/components/DraftTicker";
import { buildRankMap, getRankings } from "@/lib/rankingsApi";
import { buildPositionColorMap, positionCellColors } from "@/lib/positionColors";
import type { EspnRanking } from "@/lib/rankingsApi";
import {
  commissionerEditPick,
  commissionerMakePick,
  configureDraftTimer,
  expireCurrentPick,
  extendClock,
  getByeWeeks,
  makePick,
  pauseDraft,
  resetPickTimer,
  resumeDraft,
  startDraft,
  undoPick,
} from "@/lib/draftApi";
import { createDraftResultsCsv } from "@/lib/draftExport";
import {
  getPickNumberInRound,
  getRoundForPick,
  getTeamOnClock,
} from "@/lib/draftLogic";
import type { Draft, DraftParticipant, Pick as DraftPick, Player, RosterPosition, Team, WalkUpSong } from "@/types/draft";
import {
  getParticipantAccessState,
  getParticipantForUser,
} from "@/lib/participantLogic";
import { useRealtimeDraftRoom } from "@/hooks/useRealtimeDraftRoom";
import { formatLastSyncedAt } from "@/lib/draftRecovery";
import { getDraftClockSeconds, formatDraftClock } from "@/lib/draftTimer";
import { DEFAULT_WALK_UP_SONGS, getDefaultWalkUpSong, getSynchronizedWalkUpIndex, getTeamCumulativeListenSeconds, getWalkUpPlaybackTiming } from "@/lib/draftAudio";
import { generateSnakeDraftOrder } from "@/lib/draftOrder";
import { getLeagueBranding, type LeagueBranding } from "@/lib/leagueApi";
import DraftHQLogo from "@/components/DraftHQLogo";
import WalkUpPlayer, { type WalkUpPlayerHandle } from "@/components/WalkUpPlayer";
import LandmineAnimation from "@/components/LandmineAnimation";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { getAiAnnouncerId, resolveAnnouncerVoice } from "@/lib/speech";
import { fetchAnnouncerClipUrl } from "@/lib/announcerClient";
import { resolveDraftSeasonYear } from "@/lib/nflTeams";

// ── Draft duration helper ──────────────────────────────────────────────────

function computeDraftDuration(picks: DraftPick[]): string | null {
  if (picks.length < 2) return null;
  const sorted = [...picks].sort((a, b) => a.overallPickNumber - b.overallPickNumber);
  const diffMs =
    new Date(sorted[sorted.length - 1].createdAt).getTime() -
    new Date(sorted[0].createdAt).getTime();
  if (diffMs < 60_000) return null;
  const totalMins = Math.round(diffMs / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Draft Complete modal ───────────────────────────────────────────────────

const CONFETTI_COLORS = ["#14b8a6", "#f59e0b", "#6366f1", "#ef4444", "#10b981", "#f97316"];

function DraftCompleteModal({
  draft,
  picks,
  teams,
  leagueSlug,
  myTeamId,
  accentColor,
  onClose,
}: {
  draft: Draft;
  picks: DraftPick[];
  teams: Team[];
  leagueSlug: string | null | undefined;
  myTeamId: string | null;
  accentColor: string | null;
  onClose: () => void;
}) {
  const duration = computeDraftDuration(picks);
  const accent = accentColor ?? "#14b8a6";
  const myPicks = myTeamId
    ? [...picks]
        .filter((p) => p.teamId === myTeamId)
        .sort((a, b) => a.overallPickNumber - b.overallPickNumber)
    : [];

  function downloadCsv() {
    const csv = createDraftResultsCsv(teams, picks);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.name.replace(/\s+/g, "-")}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const particles = Array.from({ length: 24 }, (_, i) => ({
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${(i / 23) * 96 + 2}%`,
    duration: `${1.6 + (i % 5) * 0.28}s`,
    delay: `${(i % 8) * 0.12}s`,
    size: i % 3 === 0 ? 10 : 7,
    round: i % 4 !== 0,
  }));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      {/* Confetti particles */}
      {particles.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none fixed top-0"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: p.round ? "50%" : "2px",
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration} ${p.delay} linear forwards`,
          }}
        />
      ))}

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        {/* Header with radial glow */}
        <div
          className="px-6 pb-5 pt-8 text-center"
          style={{ background: `radial-gradient(ellipse at top, ${accent}22 0%, transparent 65%)` }}
        >
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{ backgroundColor: `${accent}18`, border: `2px solid ${accent}40` }}
          >
            🏆
          </div>
          <h2 className="text-3xl font-black text-white">Draft Complete</h2>
          <p className="mt-1 text-sm text-slate-400">{draft.name}</p>
        </div>

        {/* Stats row */}
        <div className="flex divide-x divide-white/8 border-y border-white/8">
          <div className="flex-1 px-4 py-4 text-center">
            <div className="text-2xl font-black text-white">{picks.length}</div>
            <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Picks</div>
          </div>
          <div className="flex-1 px-4 py-4 text-center">
            <div className="text-2xl font-black text-white">{draft.rounds}</div>
            <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Rounds</div>
          </div>
          <div className="flex-1 px-4 py-4 text-center">
            <div className="text-2xl font-black text-white">{teams.length}</div>
            <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Teams</div>
          </div>
          {duration && (
            <div className="flex-1 px-4 py-4 text-center">
              <div className="text-2xl font-black text-white">{duration}</div>
              <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Duration</div>
            </div>
          )}
        </div>

        {/* Your team picks */}
        {myPicks.length > 0 && (
          <div className="px-5 py-4">
            <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Your Team</p>
            <div className="max-h-44 space-y-0.5 overflow-y-auto [scrollbar-width:thin]">
              {myPicks.map((pick) => (
                <div key={pick.id} className="flex items-center gap-3 rounded-lg px-3 py-1.5 hover:bg-white/[0.03]">
                  <span className="w-8 shrink-0 text-right text-[11px] font-bold text-slate-600">
                    {pick.round}.{pick.pickNumber}
                  </span>
                  <span className="flex-1 truncate text-sm font-semibold text-white">{pick.playerName}</span>
                  <span className="shrink-0 text-[11px] font-black text-slate-400">{pick.playerPosition}</span>
                  <span className="shrink-0 text-[11px] text-slate-600">{pick.nflTeam ?? "FA"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-6 pt-3">
          <button
            type="button"
            onClick={downloadCsv}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition-colors hover:bg-white/10"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
              <path d="M8 2v8M5 7l3 3 3-3M2 12h12" />
            </svg>
            Download Results
          </button>
          {leagueSlug ? (
            <a
              href={`/leagues/${leagueSlug}`}
              className="flex flex-1 items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent, color: "#0f172a" }}
            >
              Return to League
            </a>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent, color: "#0f172a" }}
            >
              View Results
            </button>
          )}
        </div>

        {/* Close */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-3 w-3">
            <path d="M1 1l10 10M11 1L1 11" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── TV / Broadcast mode overlay ────────────────────────────────────────────
// Read-only PRESENTATION view for a TV or projector at a draft party.
// Nobody interacts with this screen — owners draft from their own devices.

function TvModeOverlay({
  draft,
  picks,
  teams,
  players,
  teamOnClock,
  timerSeconds,
  timerColor,
  currentRound,
  currentPickInRound,
  nextUpSlots,
  accentColor,
  leagueName,
  revealActive,
  landmineActive,
  tvMasterVolume,
  tvMuted,
  onTvVolumeChange,
  onTvMuteChange,
  onExit,
}: {
  draft: Draft;
  picks: DraftPick[];
  teams: Team[];
  players: Player[];
  teamOnClock: Team | null | undefined;
  timerSeconds: number;
  timerColor: string;
  currentRound: number | null;
  currentPickInRound: number | null;
  nextUpSlots: { teamName: string; overallPickNumber: number }[];
  accentColor: string | null;
  leagueName: string | undefined;
  revealActive: boolean;
  landmineActive: boolean;
  tvMasterVolume: number;
  tvMuted: boolean;
  onTvVolumeChange: (v: number) => void;
  onTvMuteChange: (muted: boolean) => void;
  onExit: () => void;
}) {
  const [showAudio, setShowAudio] = useState(false);
  const accent = accentColor ?? "#14b8a6";
  const sorted = [...picks].sort((a, b) => a.overallPickNumber - b.overallPickNumber);
  const lastPick = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const lastPickTeam = lastPick ? teams.find((t) => t.id === lastPick.teamId) : null;
  const lastPickHeadshot = lastPick
    ? players.find((p) => p.id === lastPick.playerId)?.headshotUrl
    : undefined;
  const sortedTeamNames = [...teams]
    .sort((a, b) => a.draftPosition - b.draftPosition)
    .map((t) => t.name);

  // Spotlight background radiates from the on-clock team (left side)
  const bgSpotlight = `radial-gradient(ellipse 75% 90% at 28% 45%, ${accent}0d 0%, transparent 65%), radial-gradient(ellipse 40% 60% at 28% 45%, ${accent}07 0%, transparent 50%)`;

  return (
    <div className="fixed inset-0 z-[45] flex flex-col overflow-hidden" style={{ backgroundColor: "#020617" }}>

      {/* ── Header ── */}
      <div
        className="flex shrink-0 items-center justify-between px-5"
        style={{ height: 52, borderBottom: `1px solid ${accent}20`, background: `linear-gradient(to bottom, ${accent}09, transparent)` }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <DraftHQLogo accentColor={accent} className="h-8 w-auto" />
          {leagueName && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-sm font-semibold text-slate-500">{leagueName}</span>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Round / pick badge */}
          {currentRound !== null && draft.status !== "complete" && (
            <div className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Rd</span>
              <span className="text-lg font-black text-white">{currentRound}</span>
              <span className="text-slate-700 mx-0.5">·</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Pk</span>
              <span className="text-lg font-black text-white">{currentPickInRound ?? "—"}</span>
            </div>
          )}

          {/* Audio panel */}
          <div className="relative">
            <button
              type="button"
              title={tvMuted ? "Audio muted" : "TV Audio"}
              onClick={() => setShowAudio((v) => !v)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                showAudio ? "bg-white/10 text-white" : tvMuted ? "text-red-500 hover:text-red-400" : "text-slate-600 hover:text-slate-300"
              }`}
            >
              {tvMuted ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd"/>
                </svg>
              )}
            </button>

            {showAudio && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAudio(false)} />
                <div className="absolute right-0 top-10 z-20 w-60 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                  <div className="border-b border-white/8 px-4 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">TV Audio</p>
                    <p className="mt-0.5 text-[10px] text-slate-700">Controls this screen&apos;s speakers</p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400">Walk-up Music</span>
                        <span className="text-xs font-bold text-slate-600">{tvMuted ? "—" : `${tvMasterVolume}%`}</span>
                      </div>
                      <input
                        type="range" min={0} max={100} value={tvMasterVolume}
                        disabled={tvMuted}
                        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-teal-500 disabled:opacity-30"
                        onInput={(e) => onTvVolumeChange(Number(e.currentTarget.value))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onTvMuteChange(!tvMuted)}
                      className={`w-full rounded-lg py-2 text-sm font-bold transition-colors ${
                        tvMuted ? "bg-teal-500/20 text-teal-400 hover:bg-teal-500/30" : "bg-white/[0.06] text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {tvMuted ? "Unmute" : "Mute All"}
                    </button>
                  </div>
                  <p className="border-t border-white/8 px-4 py-2 text-[9px] text-slate-700">
                    SFX and announcer use system volume.
                  </p>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10"
          >
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-3 w-3">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
            Exit TV Mode
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex min-h-0 flex-1 flex-col">

        {/* PRESENTATION AREA — 55 % of content height */}
        <div
          className="relative flex shrink-0 flex-col overflow-hidden"
          style={{ height: "55%", background: bgSpotlight }}
        >
          {/* Vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: "inset 0 0 140px 24px rgba(2,6,23,0.85)" }}
          />

          {/* HERO ROW — on-clock left, timer right */}
          <div className="relative flex min-h-0 flex-1 items-stretch">

            {/* LEFT: Team on the clock */}
            <div className="flex flex-1 flex-col justify-center px-10 py-6">
              {draft.status === "complete" ? (
                <div
                  className="font-black uppercase leading-none text-green-400"
                  style={{ fontSize: "clamp(2.5rem, 6vw, 8rem)" }}
                >
                  Draft Complete
                </div>
              ) : teamOnClock ? (
                <>
                  <div className="mb-4 text-[10px] font-black uppercase tracking-[0.35em] text-slate-600">
                    On the Clock
                  </div>

                  {/* Logo + name side-by-side so the logo is a dominant TV visual */}
                  <div className="flex min-w-0 items-center gap-6">

                    {/* Logo with animated accent glow */}
                    <div className="relative shrink-0">
                      {/* Outer slow pulse ring */}
                      <div
                        className="absolute rounded-full animate-pulse"
                        style={{
                          inset: -24,
                          background: `radial-gradient(circle, ${accent}30 0%, transparent 70%)`,
                        }}
                      />
                      {/* Inner steady glow */}
                      <div
                        className="absolute rounded-full"
                        style={{
                          inset: -8,
                          background: `radial-gradient(circle, ${accent}25 0%, transparent 65%)`,
                        }}
                      />
                      {teamOnClock.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={teamOnClock.logoUrl}
                          alt=""
                          className="relative h-[clamp(8rem,14vw,16rem)] w-[clamp(8rem,14vw,16rem)] rounded-full object-cover"
                          style={{ boxShadow: `0 0 0 4px ${accent}70, 0 0 48px 12px ${accent}30` }}
                        />
                      ) : (
                        <div
                          className="relative flex h-[clamp(8rem,14vw,16rem)] w-[clamp(8rem,14vw,16rem)] items-center justify-center rounded-full font-black text-white"
                          style={{
                            fontSize: "clamp(2.5rem, 5vw, 6rem)",
                            backgroundColor: `${accent}18`,
                            boxShadow: `0 0 0 4px ${accent}70, 0 0 48px 12px ${accent}30`,
                          }}
                        >
                          {teamOnClock.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Team name + next up stacked to the right of logo */}
                    <div className="min-w-0 flex-1">
                      <div
                        className="line-clamp-2 break-words font-black uppercase leading-tight tracking-wide"
                        style={{ fontSize: "clamp(1.75rem, 3.5vw, 5rem)", color: accent }}
                      >
                        {teamOnClock.name}
                      </div>

                      {/* Next up — visual numbered pills */}
                      {nextUpSlots.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="mr-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-700">
                            Next
                          </span>
                      {nextUpSlots.slice(0, 5).map((slot, i) => {
                        const slotTeam = teams.find((t) => t.name === slot.teamName);
                        return (
                          <div
                            key={slot.overallPickNumber}
                            className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5"
                          >
                            <span className="text-[10px] font-black text-slate-700">{i + 1}</span>
                            {slotTeam?.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={slotTeam.logoUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-bold text-slate-600">
                                {slot.teamName.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <span className="text-sm font-bold text-slate-300">{slot.teamName}</span>
                          </div>
                        );
                      })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xl font-semibold text-slate-600">Waiting to start…</div>
              )}
            </div>

            {/* Divider */}
            <div className="w-px shrink-0 self-stretch" style={{ backgroundColor: `${accent}12` }} />

            {/* RIGHT: TIMER — the dominant focal point */}
            <div
              className="flex w-[45%] shrink-0 flex-col items-center justify-center px-8 py-6"
            >
              {draft.status !== "complete" && (
                <>
                  <div
                    className={`font-mono font-black tabular-nums leading-none ${
                      draft.pickSeconds > 0 ? timerColor : "text-slate-800"
                    }`}
                    style={{ fontSize: "clamp(5rem, 15vw, 20rem)" }}
                  >
                    {draft.pickSeconds > 0 ? formatDraftClock(timerSeconds) : "--:--"}
                  </div>
                  {draft.pickSeconds > 0 && (
                    <div className="mt-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-700">
                      Time Remaining
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* LOWER THIRD — ESPN-style broadcast bar, new pick triggers slide-up */}
          {lastPick && (
            <div
              key={lastPick.overallPickNumber}
              className="relative shrink-0 flex items-center gap-5 overflow-hidden px-8"
              style={{
                height: 80,
                background: `linear-gradient(90deg, ${accent}22 0%, rgba(2,6,23,0.97) 60%)`,
                borderTop: `2px solid ${accent}30`,
                animation: "tv-lower-third-in 0.45s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              {/* Label + pick number */}
              <div className="shrink-0 text-right">
                <div className="text-[8px] font-black uppercase tracking-[0.3em]" style={{ color: accent }}>
                  Last Pick
                </div>
                <div className="text-[10px] font-bold text-slate-700">
                  {lastPick.round}.{lastPick.pickNumber} · #{lastPick.overallPickNumber}
                </div>
              </div>

              <div className="h-10 w-px shrink-0 bg-white/10" />

              {/* Headshot slot — layout-ready; renders image when available */}
              <div
                className="h-14 w-14 shrink-0 overflow-hidden rounded-full"
                style={{ border: `2px solid ${accent}30`, backgroundColor: "rgba(15,23,42,0.6)" }}
              >
                {lastPickHeadshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lastPickHeadshot} alt="" className="h-full w-full object-cover object-top" />
                ) : (
                  <PlayerSilhouette color="#334155" />
                )}
              </div>

              {/* Player info */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[clamp(1.1rem,2.2vw,2rem)] font-black leading-tight text-white">
                  {lastPick.playerName}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span
                    className="rounded px-2 py-0.5 text-xs font-black text-slate-950"
                    style={{ backgroundColor: POSITION_COLORS[lastPick.playerPosition] ?? "#94A3B8" }}
                  >
                    {lastPick.playerPosition}
                  </span>
                  <span className="text-sm font-bold text-slate-400">{lastPick.nflTeam ?? "FA"}</span>
                  {lastPickTeam && (
                    <>
                      <span className="text-slate-700">·</span>
                      <span className="text-sm text-slate-500">
                        Drafted by{" "}
                        <span className="font-semibold text-slate-300">{lastPickTeam.name}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOARD AREA — fills remaining 45 %; fades during reveal or landmine */}
        <div
          className="min-h-0 flex-1 overflow-hidden transition-opacity duration-700"
          style={{
            borderTop: `1px solid ${accent}12`,
            opacity: landmineActive ? 0 : revealActive ? 0.15 : 1,
          }}
        >
          {sortedTeamNames.length > 0 && (
            <DraftBoard
              teams={sortedTeamNames}
              rounds={draft.rounds}
              picks={picks}
              currentPickNumber={draft.currentPick}
              draftStatus={draft.status}
              canMakePick={false}
              canUndoPick={false}
              playerNameSize={5}
              onSlotClick={() => {}}
              onUndoPick={() => {}}
            />
          )}
        </div>

        {/* RECENT PICKS TICKER */}
        {sorted.length > 0 && (
          <div className="shrink-0 border-t border-white/8 bg-black">
            <div className="flex h-11 items-center gap-1 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="mr-3 shrink-0 text-[9px] font-black uppercase tracking-[0.2em] text-slate-700">
                Recent
              </span>
              {[...sorted].reverse().slice(0, 30).map((p) => {
                const pickedBy = teams.find((t) => t.id === p.teamId);
                return (
                  <div
                    key={p.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.03] px-3 py-1"
                  >
                    <span className="text-[10px] font-bold text-slate-700">{p.round}.{p.pickNumber}</span>
                    <span className="text-sm font-semibold text-white">{p.playerName}</span>
                    <span
                      className="text-xs font-black"
                      style={{ color: POSITION_COLORS[p.playerPosition] ?? "#94A3B8" }}
                    >
                      {p.playerPosition}
                    </span>
                    {pickedBy && <span className="text-[10px] text-slate-700">{pickedBy.name}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Roster eligibility ─────────────────────────────────────────────────────

function isPlayerEligible(player: Player, rosterPositions: RosterPosition[] | null): boolean {
  if (!rosterPositions || rosterPositions.length === 0) return true;
  const enabled = new Set(rosterPositions.filter((r) => r.enabled).map((r) => r.id));
  if (enabled.size === 0) return true;
  const pos = player.position;
  if (pos === "QB") return enabled.has("QB");
  if (pos === "RB") return enabled.has("RB") || enabled.has("FLEX");
  if (pos === "WR") return enabled.has("WR") || enabled.has("FLEX");
  if (pos === "TE") return enabled.has("TE") || enabled.has("FLEX");
  if (pos === "K") return enabled.has("K");
  if (pos === "DST") return enabled.has("DST");
  return true;
}

interface DraftRoomProps {
  draftId: string | null;
  leagueSlug?: string | null;
  lobbyOnly?: boolean;
}

export default function DraftRoom({ draftId, leagueSlug, lobbyOnly = false }: DraftRoomProps) {
  const router = useRouter();
  const { setAccentColor, setBgColor } = useLeagueTheme();
  const {
    snapshot,
    status,
    error,
    refresh,
    lastSyncedAt,
    isRefreshing,
    onlineUserIds,
    applyDraftUpdate,
  } = useRealtimeDraftRoom(draftId);
  const [showPickModal, setShowPickModal] = useState(false);
  const [isMakingPick, setIsMakingPick] = useState(false);
  const [pickingPlayerId, setPickingPlayerId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isControllingDraft, setIsControllingDraft] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isExpiringPick, setIsExpiringPick] = useState(false);
  const [leagueBranding, setLeagueBranding] = useState<LeagueBranding | null>(null);
  const [byeWeeks, setByeWeeks] = useState<Map<string, number>>(new Map());
  const [showChat, setShowChat] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [boardView, setBoardView] = useState<"draft" | "players" | "roster" | "rounds">("draft");
  const [compactHeader, setCompactHeader] = useState(false);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [showCommishMenu, setShowCommishMenu] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [showSettings, setShowSettings] = useState(false);
  const [showDraftComplete, setShowDraftComplete] = useState(false);
  const [showTvMode, setShowTvMode] = useState(false);
  const showTvModeRef = useRef(false);
  const [tvMasterVolume, setTvMasterVolume] = useState(() => lsNum("tv:masterVolume", 80));
  const [tvMuted, setTvMuted] = useState(() => lsBool("tv:muted", false));
  const tvMasterVolumeRef = useRef(
    typeof window !== "undefined" && localStorage.getItem("tv:muted") === "true" ? 0
      : typeof window !== "undefined" && localStorage.getItem("tv:masterVolume") !== null
        ? Number(localStorage.getItem("tv:masterVolume")) : 80
  );

  // ── Persisted settings (localStorage) ─────────────────────────────────
  function lsBool(key: string, def: boolean) {
    if (typeof window === "undefined") return def;
    const v = localStorage.getItem(key);
    return v !== null ? v === "true" : def;
  }
  function lsNum(key: string, def: number) {
    if (typeof window === "undefined") return def;
    const v = localStorage.getItem(key);
    return v !== null ? Number(v) : def;
  }
  function lsStr<T extends string>(key: string, def: T) {
    if (typeof window === "undefined") return def;
    return (localStorage.getItem(key) as T | null) ?? def;
  }
  function persist(key: string, value: string | number | boolean) {
    try { localStorage.setItem(key, String(value)); } catch {}
  }

  const [showCommishControls, setShowCommishControls] = useState(() => lsBool("dr:commishControls", true));
  const [showPickReveal, setShowPickReveal] = useState(() => lsBool("dr:pickReveal", true));
  const [announcePickEnabled, setAnnouncePickEnabled] = useState(() => lsBool("dr:announcer", true));
  const [clockSoundEnabled, setClockSoundEnabled] = useState(() => lsBool("dr:clockSound", true));
  const [walkUpMusicEnabled, setWalkUpMusicEnabled] = useState(() => lsBool("dr:walkUpMusic", true));
  const [musicVolume, setMusicVolume] = useState(() => lsNum("dr:musicVolume", 55));
  const [playerNameSize, setPlayerNameSize] = useState(() => lsNum("dr:playerNameSize", 4));
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioUnlockTick, setAudioUnlockTick] = useState(0);
  const lastTickSecRef = useRef(-1);
  const isInitialLoadRef = useRef(true); // suppress sounds on first snapshot tick
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [tickerMode, setTickerMode] = useState<"ticker" | "nav">(() => lsStr<"ticker" | "nav">("dr:tickerMode", "ticker"));
  // card context menu
  const [cardMenu, setCardMenu] = useState<{ playerId: string; x: number; y: number } | null>(null);
  // queue & staged player (session-local)
  const [queue, setQueue] = useState<string[]>([]);
  const [stagedPlayerId, setStagedPlayerId] = useState<string | null>(null);
  // ESPN rankings
  const [espnRankings, setEspnRankings] = useState<EspnRanking[]>([]);
  // edit pick modal (commissioner)
  const [editingPick, setEditingPick] = useState<DraftPick | null>(null);
  const [showClockEdit, setShowClockEdit] = useState(false);
  const [clockEditMin, setClockEditMin] = useState(1);
  const [clockEditSec, setClockEditSec] = useState(30);
  // landmine animation
  const [landminePick, setLandminePick] = useState<{ playerName: string; teamName: string } | null>(null);
  // pick reveal modal
  const [revealPick, setRevealPick] = useState<DraftPick | null>(null);
  const revealInitRef = useRef(false);
  const lastRevealedPickNumRef = useRef(0);
  const announcementUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const announcementCloseTimerRef = useRef<number | null>(null);
  const nextAnnouncementTimerRef = useRef<number | null>(null);
  const announcerClipAudioRef = useRef<HTMLAudioElement | null>(null);
  const headshotPreloadRef = useRef<Map<string, Promise<void>>>(new Map());
  // end-of-round recap
  const [roundRecap, setRoundRecap] = useState<{ round: number; picks: DraftPick[] } | null>(null);
  const [suppressRecap, setSuppressRecap] = useState(false);
  const lastRecapRoundRef = useRef(0);
  const recapPrevLengthRef = useRef(0);
  const recapInitializedRef = useRef(false);
  const prevDraftStatusRef = useRef<string | null>(null);
  const draftStartAudioRef = useRef<HTMLAudioElement | null>(null);
  const walkUpPlayerRef = useRef<WalkUpPlayerHandle>(null);
  const walkUpDefaultAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevOnClockTeamIdRef = useRef<string | null>(null);
  const walkUpDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioLifecycleActiveRef = useRef(true);
  const [landmineActive, setLandmineActive] = useState(false);
  const walkUpPrevPicksLenRef = useRef(0);
  const musicVolumeRef = useRef(typeof window !== "undefined" && localStorage.getItem("dr:musicVolume") !== null ? Number(localStorage.getItem("dr:musicVolume")) : 55);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerExpiredFiredRef = useRef(false);

  function cancelPickAnnouncement() {
    if (announcementCloseTimerRef.current) clearTimeout(announcementCloseTimerRef.current);
    if (nextAnnouncementTimerRef.current) clearTimeout(nextAnnouncementTimerRef.current);
    announcementCloseTimerRef.current = null;
    nextAnnouncementTimerRef.current = null;
    announcementUtteranceRef.current = null;
    if (announcerClipAudioRef.current) {
      announcerClipAudioRef.current.pause();
      announcerClipAudioRef.current = null;
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  function preloadHeadshot(url: string) {
    const existing = headshotPreloadRef.current.get(url);
    if (existing) return existing;

    const pending = new Promise<void>((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      image.onload = finish;
      image.onerror = finish;
      image.src = url;
      if (image.complete) finish();
      window.setTimeout(finish, 1_500);
    });
    headshotPreloadRef.current.set(url, pending);
    return pending;
  }

  useEffect(() => {
    musicVolumeRef.current = musicVolume;
    walkUpPlayerRef.current?.setVolume(musicVolume);
    if (walkUpDefaultAudioRef.current) {
      walkUpDefaultAudioRef.current.volume = musicVolume / 100;
    }
  }, [musicVolume]);

  // Keep showTvModeRef in sync so audio closures read the current value.
  useEffect(() => { showTvModeRef.current = showTvMode; }, [showTvMode]);

  const revealActiveRef = useRef(false);
  useEffect(() => { revealActiveRef.current = revealPick !== null; }, [revealPick]);

  // Mirrors landmineActive for delayed-start closures. Also set synchronously in
  // the landmine detection branch: the walk-up effect runs in the same commit
  // (before the state update lands) and would otherwise schedule a song start.
  const landmineActiveRef = useRef(false);
  useEffect(() => { landmineActiveRef.current = landmineActive; }, [landmineActive]);

  // True once the user has clicked through the audio-unlock overlay this session.
  const audioUnlockedOnceRef = useRef(false);

  // ── Walk-up resume mode (commissioner setting) ──────────────────────────
  // Mode mirror for the onEnded closure.
  const walkUpMusicModeRef = useRef<"restart" | "resume">("restart");
  useEffect(() => {
    walkUpMusicModeRef.current = snapshot?.draft.walkUpMusicMode ?? "restart";
  }, [snapshot?.draft.walkUpMusicMode]);
  // The custom song currently scheduled/playing for the on-clock team, so the
  // natural-end handler knows what to loop. Cleared implicitly: guards check
  // the team is still on the clock before acting.
  const walkUpTurnRef = useRef<{
    teamId: string;
    songs: WalkUpSong[];
    songIndex: number;
    cumulative: number;
    anchorMs: number;
    graceMs: number;
    serverTimeOffsetMs: number;
  } | null>(null);
  // Which playlist index each team is currently on in resume mode (advances
  // when a song ends naturally). Client-local; late joiners start at 0 and
  // converge via the natural-end handler.
  const walkUpResumeIndexRef = useRef(new Map<string, number>());
  // Client-local wrap points: when a team's song ends naturally, everything
  // consumed so far is banked here so the replay starts from 0 instead of
  // re-deriving an offset beyond the end of the track. Approximate across
  // clients by design; converges because all clients hear the end near the
  // same moment.
  const walkUpWrapBaseRef = useRef(new Map<string, number>());

  // Duck walk-up while pick reveal is shown; restart cleanly when it dismisses.
  useEffect(() => {
    if (revealPick) {
      // Cancel any pending song start so it doesn't interrupt the reveal card.
      if (walkUpDelayRef.current) { clearTimeout(walkUpDelayRef.current); walkUpDelayRef.current = null; }
      // Reset team tracking so the walk-up effect treats the current team as "new" on reveal dismiss.
      prevOnClockTeamIdRef.current = null;
      walkUpPlayerRef.current?.duck();
      if (walkUpDefaultAudioRef.current) {
        walkUpDefaultAudioRef.current.volume = Math.min(0.04, musicVolumeRef.current / 100);
      }
    } else {
      // Reveal dismissed — unduck any still-playing audio and re-trigger walk-up for the current team.
      walkUpPlayerRef.current?.unduck();
      if (walkUpDefaultAudioRef.current) {
        walkUpDefaultAudioRef.current.volume = (musicVolumeRef.current / 100) *
          (showTvModeRef.current ? tvMasterVolumeRef.current / 100 : 1);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAudioUnlockTick((n) => n + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealPick]);

  // TV master volume — persists per device, independent of per-user music volume.
  useEffect(() => {
    const effective = tvMuted ? 0 : tvMasterVolume;
    tvMasterVolumeRef.current = effective;
    persist("tv:masterVolume", tvMasterVolume);
    persist("tv:muted", tvMuted);
    const mul = effective / 100;
    if (showTvMode) {
      if (walkUpDefaultAudioRef.current) {
        walkUpDefaultAudioRef.current.volume = (musicVolumeRef.current / 100) * mul;
      }
      walkUpPlayerRef.current?.setVolume(Math.round(musicVolumeRef.current * mul));
    } else {
      // Restore normal volume when TV mode is off or just exited.
      if (walkUpDefaultAudioRef.current) {
        walkUpDefaultAudioRef.current.volume = musicVolumeRef.current / 100;
      }
      walkUpPlayerRef.current?.setVolume(musicVolumeRef.current);
    }
  }, [tvMasterVolume, tvMuted, showTvMode]);

  useEffect(() => {
    if (!draftId) {
      router.replace("/create");
    }
  }, [draftId, router]);

  useEffect(() => {
    if (!lobbyOnly || !snapshot || snapshot.draft.status === "setup" || !draftId) return;
    const params = new URLSearchParams({ draftId });
    if (leagueSlug) params.set("leagueSlug", leagueSlug);
    router.replace(`/draft?${params.toString()}`);
  }, [draftId, leagueSlug, lobbyOnly, router, snapshot]);

  useEffect(() => {
    if (leagueSlug) {
      void getLeagueBranding(leagueSlug).then((b) => {
        setLeagueBranding(b);
        if (b?.primaryColor) setAccentColor(b.primaryColor);
        if (b?.secondaryColor) setBgColor(b.secondaryColor);
      });
    }
  }, [leagueSlug, setAccentColor, setBgColor]);

  // Load bye weeks + ESPN rankings for the current NFL season year
  useEffect(() => {
    if (!snapshot) return;
    const seasonYear = resolveDraftSeasonYear(
      snapshot.draft.name,
      snapshot.draft.scheduledAt
    );
    void getByeWeeks(seasonYear).then(setByeWeeks).catch(() => {});
    void getRankings(snapshot.draft.scoringType, seasonYear)
      .then(setEspnRankings)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.draft.id, snapshot?.draft.name, snapshot?.draft.scheduledAt, snapshot?.draft.scoringType]);

  async function handleMakePick(playerId: string) {
    if (!draftId || !snapshot) {
      return;
    }

    if (status !== "connected") {
      setActionError(
        "Drafting is disabled until the room reconnects and refreshes."
      );
      return;
    }

    setActionError("");
    setIsMakingPick(true);
    setPickingPlayerId(playerId);

    const teamOnClockId = getTeamOnClock(
      snapshot.teams,
      snapshot.draft.currentPick,
      snapshot.draft.rounds
    )?.id;
    const isOwnerOnClock =
      accessState.kind === "assigned" &&
      accessState.teamId === teamOnClockId;

    try {
      if (!isOwnerOnClock) {
        // Commissioner picking on behalf of any team
        await commissionerMakePick(
          draftId,
          playerId,
          snapshot.draft.currentPick
        );
      } else {
        await makePick(draftId, playerId, snapshot.draft.currentPick);
      }
      await refresh();
      setShowPickModal(false);
    } catch (pickError) {
      setActionError(
        pickError instanceof Error
          ? pickError.message
          : (pickError as { message?: string })?.message ?? "Unable to make pick."
      );
    } finally {
      setIsMakingPick(false);
      setPickingPlayerId(null);
    }
  }

  async function handleUndoPick() {
    if (!draftId) {
      return;
    }

    setActionError("");
    setIsUndoing(true);

    try {
      await undoPick(draftId);
      await refresh();
    } catch (undoError) {
      setActionError(
        undoError instanceof Error ? undoError.message : "Unable to undo pick."
      );
    } finally {
      setIsUndoing(false);
    }
  }


  async function handleDraftControl(action: () => Promise<Draft>) {
    setActionError("");
    setIsControllingDraft(true);

    try {
      const updatedDraft = await action();
      applyDraftUpdate(updatedDraft);
      await refresh();
    } catch (controlError) {
      setActionError(
        controlError instanceof Error
          ? controlError.message
          : (controlError as { message?: string })?.message ?? "Unable to update the draft."
      );
    } finally {
      setIsControllingDraft(false);
    }
  }

  const handleTimerExpired = useCallback(() => {
    if (!draftId || !snapshot || isExpiringPick) return;
    if (status !== "connected") return;
    if (snapshot.currentUserId !== snapshot.draft.commissionerUserId) return;

    const expectedPick = snapshot.draft.currentPick;
    setIsExpiringPick(true);

    void expireCurrentPick(draftId, expectedPick)
      .then((updatedDraft) => {
        applyDraftUpdate(updatedDraft);
        return refresh();
      })
      .catch((err: unknown) => {
        setActionError(
          err instanceof Error ? err.message : "Unable to expire pick."
        );
      })
      .finally(() => {
        setIsExpiringPick(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, snapshot?.draft.currentPick, snapshot?.currentUserId, snapshot?.draft.commissionerUserId, isExpiringPick, status]);

  function handleSkipPick() {
    setShowCommishMenu(false);
    handleTimerExpired();
  }

  async function handleExtendClock() {
    if (!draftId || !snapshot) return;
    try {
      const updatedDraft = await extendClock(draftId, snapshot.draft.currentPick);
      applyDraftUpdate(updatedDraft);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to extend clock."
      );
    }
  }

  useEffect(() => {
    timerExpiredFiredRef.current = false;
    lastTickSecRef.current = -1;
  }, [snapshot?.draft.currentPick]);

  // Keep a rolling cache of likely upcoming selections. This avoids loading
  // hundreds of images at once while making normal ranked picks appear
  // instantly in the reveal modal.
  useEffect(() => {
    if (!snapshot || typeof window === "undefined") return;
    const draftedPlayerIds = new Set(snapshot.picks.map((pick) => pick.playerId));
    const preloadRankMap = buildRankMap(snapshot.players, espnRankings);
    snapshot.players
      .filter((player) => player.headshotUrl && !draftedPlayerIds.has(player.id))
      .sort((a, b) =>
        (preloadRankMap.get(a.id) ?? a.rank ?? Number.MAX_SAFE_INTEGER) -
        (preloadRankMap.get(b.id) ?? b.rank ?? Number.MAX_SAFE_INTEGER)
      )
      .slice(0, 40)
      .forEach((player) => { void preloadHeadshot(player.headshotUrl!); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.players, snapshot?.picks, espnRankings]);

  // Detect newly confirmed picks and show the reveal modal
  const lastRevealedPickIdRef = useRef<string | null>(null);
  const prevPicksLengthRef = useRef(0);
  useEffect(() => {
    if (!snapshot) return;
    const currentLength = snapshot.picks.length;
    if (!revealInitRef.current) {
      revealInitRef.current = true;
      prevPicksLengthRef.current = currentLength;
      lastRevealedPickNumRef.current = snapshot.draft.currentPick - 1;
      const newest = [...snapshot.picks].sort((a, b) => b.overallPickNumber - a.overallPickNumber)[0];
      if (newest) lastRevealedPickIdRef.current = newest.id;
      return;
    }
    const newest = [...snapshot.picks].sort((a, b) => b.overallPickNumber - a.overallPickNumber)[0];
    // Only show reveal when a pick was added (not undone)
    const cp = snapshot.draft.currentPick;
    const isRoundEnd = cp > 1 && (cp - 1) % snapshot.draft.teamCount === 0;
    if (currentLength > prevPicksLengthRef.current && newest && newest.id !== lastRevealedPickIdRef.current) {
      lastRevealedPickNumRef.current = newest.overallPickNumber;
      lastRevealedPickIdRef.current = newest.id;
      // Landmine animation takes priority over pick reveal
      if (newest.isLandmine) {
        const team = snapshot.teams.find((t) => t.id === newest.teamId);
        setLandmineActive(true);
        landmineActiveRef.current = true;
        if (walkUpDelayRef.current) { clearTimeout(walkUpDelayRef.current); walkUpDelayRef.current = null; }
        walkUpPlayerRef.current?.stop();
        if (walkUpDefaultAudioRef.current) { walkUpDefaultAudioRef.current.pause(); walkUpDefaultAudioRef.current.currentTime = 0; }
        setLandminePick({ playerName: newest.playerName, teamName: team?.name ?? "a team" });
      } else if (showPickReveal && !isRoundEnd) {
        const headshotUrl = snapshot.players.find((player) => player.id === newest.playerId)?.headshotUrl;
        if (headshotUrl) {
          const revealId = newest.id;
          void preloadHeadshot(headshotUrl).then(() => {
            if (lastRevealedPickIdRef.current === revealId) setRevealPick(newest);
          });
        } else {
          setRevealPick(newest);
        }
      } else if (isRoundEnd && announcePickEnabled && typeof window !== "undefined" && window.speechSynthesis) {
        // No reveal card at round end, but still announce the pick via TTS
        const team = snapshot.teams.find((t) => t.id === newest.teamId);
        const text = `With pick ${newest.overallPickNumber}, ${team?.name ?? "a team"} selects ${newest.playerName}`;
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 0.85; utt.pitch = 0.95;
        const voice = resolveAnnouncerVoice(
          window.speechSynthesis.getVoices(),
          snapshot.draft.announcerVoiceUri
        );
        if (voice) utt.voice = voice;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utt);
      }
    } else if (currentLength <= prevPicksLengthRef.current) {
      // Undo: update the id ref so the next real pick triggers correctly
      if (newest) lastRevealedPickIdRef.current = newest.id;
    }
    prevPicksLengthRef.current = currentLength;
  }, [snapshot?.picks.length, showPickReveal, announcePickEnabled]);

  // End-of-round recap detection — uses currentPick (not picks.length) so skipped picks don't break round boundaries
  useEffect(() => {
    if (!snapshot) return;
    const { picks, draft } = snapshot;
    const tc = draft.teamCount;
    const cp = draft.currentPick;

    // On first load, silently initialize to the current completed round so we don't replay past recaps on refresh
    if (!recapInitializedRef.current) {
      recapInitializedRef.current = true;
      lastRecapRoundRef.current = Math.floor((cp - 1) / tc);
      recapPrevLengthRef.current = picks.length;
      return;
    }

    // On undo (picks decrease), roll back the round ref so the recap triggers again if picks are re-made
    const prevLen = recapPrevLengthRef.current;
    recapPrevLengthRef.current = picks.length;
    if (picks.length < prevLen) {
      lastRecapRoundRef.current = Math.max(0, Math.floor((cp - 1) / tc) - 1);
      return;
    }

    if (suppressRecap) return;
    if (!(draft.showRoundSlide ?? true)) return;

    // currentPick is 1-indexed; when it equals tc*n+1, round n just finished
    if (cp <= 1 || (cp - 1) % tc !== 0) return;
    const completedRound = Math.floor((cp - 1) / tc);
    if (completedRound <= lastRecapRoundRef.current) return;
    lastRecapRoundRef.current = completedRound;
    const roundPicks = picks.filter((p) => p.round === completedRound);
    setRoundRecap({ round: completedRound, picks: roundPicks });
  }, [snapshot?.draft.currentPick, snapshot?.picks.length, suppressRecap]);

  // "The pick is in" sound when user stages a player
  const prevStagedRef = useRef<string | null>(null);
  const pickIsInAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (stagedPlayerId && stagedPlayerId !== prevStagedRef.current) {
      prevStagedRef.current = stagedPlayerId;
      const pickIsInEnabled = snapshot?.draft.pickIsInEnabled ?? true;
      const isLastPickOfRound = !!snapshot && snapshot.draft.currentPick % snapshot.draft.teamCount === 0;
      if (typeof window !== "undefined" && pickIsInEnabled && !isLastPickOfRound) {
        const customUrl = snapshot?.draft.pickIsInSfxUrl;
        const src = customUrl ?? "/sounds/the-pick-is-in.mp3";
        if (!pickIsInAudioRef.current || pickIsInAudioRef.current.src !== src) {
          pickIsInAudioRef.current = new Audio(src);
          pickIsInAudioRef.current.volume = 0.5;
        }
        const audio = pickIsInAudioRef.current;
        audio.currentTime = 0;
        walkUpPlayerRef.current?.duck();
        if (walkUpDefaultAudioRef.current) walkUpDefaultAudioRef.current.volume = Math.min(0.07, musicVolumeRef.current / 100);
        const restoreWalkUpVolume = () => {
          // A reveal or landmine now owns the mix — leave their duck/stop in place.
          if (revealActiveRef.current || landmineActiveRef.current) return;
          walkUpPlayerRef.current?.unduck();
          if (walkUpDefaultAudioRef.current) {
            walkUpDefaultAudioRef.current.volume = (musicVolumeRef.current / 100) *
              (showTvModeRef.current ? tvMasterVolumeRef.current / 100 : 1);
          }
        };
        audio.onended = restoreWalkUpVolume;
        audio.play().catch(() => {
          restoreWalkUpVolume();
          if (!customUrl) {
            // Built-in file not found — fall back to TTS
            const utt = new SpeechSynthesisUtterance("The pick is in");
            utt.rate = 0.85; utt.pitch = 0.95;
            window.speechSynthesis?.cancel();
            window.speechSynthesis?.speak(utt);
          }
        });
      }
    }
    if (!stagedPlayerId) prevStagedRef.current = null;
  }, [stagedPlayerId, snapshot?.draft.pickIsInEnabled, snapshot?.draft.pickIsInSfxUrl]);

  // TTS announcer after pick reveal appears
  useEffect(() => {
    if (!revealPick || !snapshot) return;
    const revealedPickId = revealPick.id;
    cancelPickAnnouncement();

    // The reveal should never require a manual dismissal. When announcements
    // are disabled (or unavailable), keep it visible long enough to read.
    if (!announcePickEnabled || typeof window === "undefined" ||
        (!window.speechSynthesis && !getAiAnnouncerId(snapshot.draft.announcerVoiceUri))) {
      if (typeof window !== "undefined") {
        announcementCloseTimerRef.current = window.setTimeout(() => {
          announcementCloseTimerRef.current = null;
          setRevealPick((current) => current?.id === revealedPickId ? null : current);
        }, 6_000);
      }
      return;
    }

    const team = snapshot.teams.find((t) => t.id === revealPick.teamId);
    const allSlots = generateSnakeDraftOrder(snapshot.teams, snapshot.draft.rounds);
    const nextSlot = allSlots
      .filter((s) => s.overallPickNumber > revealPick.overallPickNumber)
      .sort((a, b) => a.overallPickNumber - b.overallPickNumber)[0];
    const nextTeam = nextSlot ? snapshot.teams.find((t) => t.id === nextSlot.teamId) : null;
    const text = `With pick ${revealPick.overallPickNumber}, ${team?.name ?? "a team"} selects ${revealPick.playerName}.`;
    const nextText = nextTeam ? `${nextTeam.name} is now on the clock.` : null;
    const voiceUri = snapshot.draft.announcerVoiceUri;
    // House persona or ElevenLabs custom voice — either resolves to a clip id.
    const aiAnnouncerId = getAiAnnouncerId(voiceUri);

    const applyConfiguredVoice = (utterance: SpeechSynthesisUtterance) => {
      const voice = resolveAnnouncerVoice(window.speechSynthesis.getVoices(), voiceUri);
      if (voice) utterance.voice = voice;
    };

    let finished = false;
    // Prefetched in parallel with the main clip so the on-the-clock follow-up
    // plays seamlessly after the reveal dismisses.
    let nextClipUrl: string | null = null;

    const playClip = (url: string, onDone: () => void) => {
      const audio = new Audio(url);
      audio.volume = 0.9;
      announcerClipAudioRef.current = audio;
      audio.onended = () => {
        if (announcerClipAudioRef.current === audio) announcerClipAudioRef.current = null;
        onDone();
      };
      return audio.play();
    };

    const finishSelectionAnnouncement = () => {
      if (finished) return;
      finished = true;
      if (announcementCloseTimerRef.current) clearTimeout(announcementCloseTimerRef.current);
      announcementCloseTimerRef.current = null;

      // Only dismiss the reveal this announcement belongs to. A very fast next
      // pick must not be able to close a newer reveal.
      setRevealPick((current) => current?.id === revealedPickId ? null : current);

      if (nextText) {
        nextAnnouncementTimerRef.current = window.setTimeout(() => {
          nextAnnouncementTimerRef.current = null;
          if (aiAnnouncerId && nextClipUrl) {
            void playClip(nextClipUrl, () => {}).catch(() => {});
          } else if (window.speechSynthesis) {
            const nextUtt = new SpeechSynthesisUtterance(nextText);
            nextUtt.rate = 0.85; nextUtt.pitch = 0.95;
            applyConfiguredVoice(nextUtt);
            nextUtt.onend = () => { announcementUtteranceRef.current = null; };
            announcementUtteranceRef.current = nextUtt;
            window.speechSynthesis.speak(nextUtt);
          }
        }, 150);
      } else {
        announcementUtteranceRef.current = null;
      }
    };

    const speakViaDevice = () => {
      if (finished || !window.speechSynthesis) return; // fallback timer closes the reveal
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.85; utt.pitch = 0.95;
      applyConfiguredVoice(utt);
      utt.onend = finishSelectionAnnouncement;
      // Retaining the utterance prevents Chromium from garbage-collecting it
      // before it emits `end`. The timer is a defensive fallback for browser
      // speech engines that never emit that event.
      announcementUtteranceRef.current = utt;
      window.speechSynthesis.speak(utt);
    };

    const fallbackMs = Math.max(6_000, text.split(/\s+/).length * 900 + 1_500);
    announcementCloseTimerRef.current = window.setTimeout(finishSelectionAnnouncement, fallbackMs);

    if (aiAnnouncerId) {
      // AI announcer: fetch the cached/generated clip; fall back to the device
      // voice on any failure so the reveal is never silent.
      void fetchAnnouncerClipUrl(text, aiAnnouncerId, draftId).then((url) => {
        if (finished) return;
        if (!url) { speakViaDevice(); return; }
        playClip(url, finishSelectionAnnouncement).catch(() => {
          if (!finished) speakViaDevice();
        });
      });
      if (nextText) {
        void fetchAnnouncerClipUrl(nextText, aiAnnouncerId, draftId).then((url) => { nextClipUrl = url; });
      }
    } else {
      speakViaDevice();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealPick?.overallPickNumber, announcePickEnabled]);

  // Draft start audio + draft complete detection — fires on status transitions
  useEffect(() => {
    if (!snapshot) return;
    const prev = prevDraftStatusRef.current;
    const cur = snapshot.draft.status;
    prevDraftStatusRef.current = cur;
    if (prev !== null && prev !== "active" && cur === "active") {
      const url = snapshot.draft.draftStartAudioUrl;
      if (url && typeof window !== "undefined") {
        if (!draftStartAudioRef.current || draftStartAudioRef.current.src !== url) {
          draftStartAudioRef.current = new Audio(url);
          draftStartAudioRef.current.volume = 0.7;
        }
        draftStartAudioRef.current.currentTime = 0;
        draftStartAudioRef.current.play().catch(() => {});
      }
    }
    if (prev !== null && prev !== "complete" && cur === "complete") {
      setShowDraftComplete(true);
    }
  }, [snapshot?.draft.status]);

  // Computed early so walk-up effect can include it in deps (declared after effects below, this shadows it)
  const teamOnClockEarly = snapshot
    ? getTeamOnClock(snapshot.teams, snapshot.draft.currentPick, snapshot.draft.rounds)
    : undefined;

  // Walk-up: every browser derives the same track and playback position from shared draft data.
  useEffect(() => {
    if (!snapshot) return;
    if (landmineActive) return;
    if (!walkUpMusicEnabled || snapshot.draft.status !== "active") {
      if (walkUpDelayRef.current) { clearTimeout(walkUpDelayRef.current); walkUpDelayRef.current = null; }
      walkUpPlayerRef.current?.stop();
      if (walkUpDefaultAudioRef.current) { walkUpDefaultAudioRef.current.pause(); walkUpDefaultAudioRef.current.currentTime = 0; }
      // Re-entering the active state (or locally re-enabling music) should
      // resume this shared pick at its authoritative playback position.
      prevOnClockTeamIdRef.current = null;
      return;
    }

    const teamId = teamOnClockEarly?.id ?? null;
    const picksLen = snapshot.picks.length;

    // On first load, seed picksLen so pickMade/pickUndone aren't falsely triggered,
    // but leave prevOnClockTeamIdRef as null so isNewTeam=true and music starts immediately
    const isInitialLoad = prevOnClockTeamIdRef.current === null;
    if (isInitialLoad && walkUpPrevPicksLenRef.current === 0 && picksLen > 0) {
      walkUpPrevPicksLenRef.current = picksLen;
    }

    const isNewTeam = teamId !== prevOnClockTeamIdRef.current;
    const pickMade = picksLen > walkUpPrevPicksLenRef.current;
    const pickUndone = picksLen < walkUpPrevPicksLenRef.current;

    walkUpPrevPicksLenRef.current = picksLen;

    // Pick was made — duck; new song starts when next team detected
    if (pickMade && !isNewTeam) {
      if (walkUpDelayRef.current) { clearTimeout(walkUpDelayRef.current); walkUpDelayRef.current = null; }
      walkUpPlayerRef.current?.duck();
      if (walkUpDefaultAudioRef.current) walkUpDefaultAudioRef.current.volume = Math.min(0.07, musicVolumeRef.current / 100);
      return;
    }

    // Nothing changed — leave any pending timeout alone
    if (!isNewTeam) return;

    // New team on clock — cancel pending timeout and start fresh
    if (walkUpDelayRef.current) { clearTimeout(walkUpDelayRef.current); walkUpDelayRef.current = null; }
    prevOnClockTeamIdRef.current = teamId;

    // If a pick was just confirmed in the same Supabase event, duck briefly before cutting
    if (pickMade) {
      walkUpPlayerRef.current?.duck();
      if (walkUpDefaultAudioRef.current) walkUpDefaultAudioRef.current.volume = Math.min(0.07, musicVolumeRef.current / 100);
    }
    walkUpPlayerRef.current?.stop();
    if (walkUpDefaultAudioRef.current) {
      walkUpDefaultAudioRef.current.pause();
      walkUpDefaultAudioRef.current.currentTime = 0;
    }

    if (!teamId || !teamOnClockEarly) return;
    const songs = Array.isArray(teamOnClockEarly.walkUpSongs) ? teamOnClockEarly.walkUpSongs : [];

    const precedingPick = snapshot.picks.find(
      (pick) => pick.overallPickNumber === snapshot.draft.currentPick - 1
    );
    const playbackAnchor = precedingPick?.createdAt ?? snapshot.draft.updatedAt;
    const graceMs = pickUndone ? 0 : 2_000;
    const serverTimeOffsetMs = snapshot.serverTimeOffsetMs;
    const timing = getWalkUpPlaybackTiming(
      playbackAnchor,
      Date.now() + serverTimeOffsetMs,
      graceMs
    );
    const delay = timing.delayMs;
    const synchronizedIndex = getSynchronizedWalkUpIndex(snapshot.draft.currentPick, songs.length || DEFAULT_WALK_UP_SONGS.length);

    // Resume mode: the team's song continues from where it left off on its
    // previous turn. Position = derived cumulative listening time across
    // completed turns, minus any banked wrap point, plus elapsed this turn.
    const resumeMode = (snapshot.draft.walkUpMusicMode ?? "restart") === "resume";
    const cumulative = resumeMode ? getTeamCumulativeListenSeconds(snapshot.picks, teamId) : 0;

    // Recomputed at fire time: background tabs throttle timers, so the offset
    // captured at schedule time can be stale by the time the timeout runs.
    const offsetAtFireTime = () =>
      getWalkUpPlaybackTiming(playbackAnchor, Date.now() + serverTimeOffsetMs, graceMs).offsetSeconds;
    const positionAtFireTime = () => {
      const wrapBase = resumeMode ? (walkUpWrapBaseRef.current.get(teamId) ?? 0) : 0;
      return Math.max(0, cumulative - wrapBase + offsetAtFireTime());
    };

    if (songs.length === 0) {
      walkUpDelayRef.current = setTimeout(() => {
        walkUpDelayRef.current = null;
        if (revealActiveRef.current || landmineActiveRef.current) return;
        walkUpTurnRef.current = null; // default track loops itself; nothing to advance
        // Resume mode pins each team to a stable default track (by draft
        // position) so its position is continuous; restart mode keeps the
        // per-pick rotation.
        const src = resumeMode
          ? getDefaultWalkUpSong(teamOnClockEarly.draftPosition)
          : DEFAULT_WALK_UP_SONGS[synchronizedIndex];
        const prev = walkUpDefaultAudioRef.current;
        if (!prev || prev.src !== window.location.origin + src) {
          if (prev) { prev.pause(); prev.currentTime = 0; }
          walkUpDefaultAudioRef.current = new Audio(src);
          walkUpDefaultAudioRef.current.loop = true;
        }
        const audio = walkUpDefaultAudioRef.current;
        if (!audio) return;
        audio.volume = (musicVolumeRef.current / 100) *
          (showTvModeRef.current ? tvMasterVolumeRef.current / 100 : 1);
        const start = () => {
          if (!audioLifecycleActiveRef.current || walkUpDefaultAudioRef.current !== audio) return;
          if (revealActiveRef.current || landmineActiveRef.current) return;
          if (audio.duration && Number.isFinite(audio.duration)) {
            audio.currentTime = positionAtFireTime() % audio.duration;
          }
          audio.play().catch(() => { setAudioBlocked(true); });
        };
        if (audio.readyState >= 1) start();
        else audio.addEventListener("loadedmetadata", start, { once: true });
      }, delay);
      return;
    }

    // Resume mode plays the playlist sequentially from where the team left
    // off; restart mode keeps the per-pick rotation.
    const songIndex = resumeMode
      ? Math.min(walkUpResumeIndexRef.current.get(teamId) ?? 0, songs.length - 1)
      : synchronizedIndex;
    const song = songs[songIndex];

    walkUpDelayRef.current = setTimeout(() => {
      walkUpDelayRef.current = null;
      if (revealActiveRef.current || landmineActiveRef.current) return;
      walkUpTurnRef.current = resumeMode
        ? { teamId, songs, songIndex, cumulative, anchorMs: Date.parse(playbackAnchor), graceMs, serverTimeOffsetMs }
        : null;
      walkUpPlayerRef.current?.play(song, positionAtFireTime());
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.draft.currentPick, snapshot?.draft.status, snapshot?.picks.length, walkUpMusicEnabled, teamOnClockEarly?.id, audioUnlockTick, landmineActive, snapshot?.draft.walkUpMusicMode]);

  // Route changes unmount the room while delayed/default audio may still be
  // loading. Tear down every locally-owned audio source so returning to the
  // draft cannot leave an old looping track playing underneath the new room.
  useEffect(() => {
    audioLifecycleActiveRef.current = true;
    return () => {
      audioLifecycleActiveRef.current = false;
      if (walkUpDelayRef.current) {
        clearTimeout(walkUpDelayRef.current);
        walkUpDelayRef.current = null;
      }
      for (const audio of [
        walkUpDefaultAudioRef.current,
        pickIsInAudioRef.current,
        draftStartAudioRef.current,
      ]) {
        if (!audio) continue;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      walkUpDefaultAudioRef.current = null;
      pickIsInAudioRef.current = null;
      draftStartAudioRef.current = null;
      cancelPickAnnouncement();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Round slide auto-close timer
  useEffect(() => {
    if (!roundRecap || !snapshot) return;
    const seconds = snapshot.draft.roundSlideSeconds ?? 7;
    const timer = setTimeout(() => setRoundRecap(null), seconds * 1000);
    return () => clearTimeout(timer);
  }, [roundRecap, snapshot?.draft.roundSlideSeconds]);

  function getAudioCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }
  function playClockTick() {
    try {
      const ctx = getAudioCtx();
      const t = ctx.currentTime;
      // High click body
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = "square"; osc1.frequency.setValueAtTime(1100, t);
      g1.gain.setValueAtTime(0.55, t);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      osc1.connect(g1); g1.connect(ctx.destination);
      osc1.start(t); osc1.stop(t + 0.055);
      // Sub thump for weight
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = "sine"; osc2.frequency.setValueAtTime(220, t);
      g2.gain.setValueAtTime(0.45, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.start(t); osc2.stop(t + 0.04);
    } catch { /* AudioContext blocked */ }
  }
  function playClockBuzzer() {
    const audio = new Audio("/sounds/SHOT CLOCK SOUND EFFECT HD (NO COPYRIGHT).mp3");
    audio.volume = 0.3;
    audio.currentTime = 1.0;
    audio.addEventListener("loadedmetadata", () => {
      setTimeout(() => audio.pause(), (audio.duration - 1.0 - 0.4) * 1000);
    });
    audio.play().catch(() => {});
  }

  useEffect(() => {
    if (!snapshot) return;
    const tick = () => {
      const s = getDraftClockSeconds(snapshot.draft, Date.now(), snapshot.serverTimeOffsetMs);
      setTimerSeconds(s);
      if (s === 0 && snapshot.draft.status === "active" && snapshot.draft.pickDeadlineAt &&
          snapshot.draft.timerBehavior !== "nothing" && !timerExpiredFiredRef.current) {
        timerExpiredFiredRef.current = true;
        handleTimerExpired();
      }
      // Clock sounds — skip on the very first tick to avoid firing buzzer on page load
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        lastTickSecRef.current = s; // seed so first real change is detected correctly
      } else if (clockSoundEnabled && snapshot.draft.status === "active" && snapshot.draft.pickDeadlineAt) {
        if (s > 0 && s <= 7 && s !== lastTickSecRef.current) {
          lastTickSecRef.current = s;
          playClockTick();
        } else if (s === 0 && lastTickSecRef.current !== 0) {
          lastTickSecRef.current = 0;
          playClockBuzzer();
        }
      }
    };
    tick();
    if (snapshot.draft.status !== "active") return;
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.draft, snapshot?.serverTimeOffsetMs, handleTimerExpired]);

  if (error && !snapshot) {
    return <main className="p-8 text-red-500">{error}</main>;
  }

  if (!snapshot) {
    return <main className="p-8">Connecting to draft room...</main>;
  }

  if (lobbyOnly && snapshot.draft.status !== "setup") {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">Opening the live draft board...</main>;
  }

  const teamNames = snapshot.teams.map((team) => team.name);
  const currentParticipant = getParticipantForUser(
    snapshot.participants,
    snapshot.currentUserId
  );
  const accessState = getParticipantAccessState(currentParticipant);
  const teamOnClock = getTeamOnClock(
    snapshot.teams,
    snapshot.draft.currentPick,
    snapshot.draft.rounds
  );
  const draftAcceptsPicks = snapshot.draft.status === "active";
  const isCommissioner =
    snapshot.currentUserId === snapshot.draft.commissionerUserId;
  const canMakePick =
    status === "connected" &&
    draftAcceptsPicks &&
    (
      (accessState.kind === "assigned" && accessState.teamId === teamOnClock?.id) ||
      isCommissioner
    );
  const canUndoPick = isCommissioner;
  const assignedTeamCount = new Set(
    snapshot.participants.flatMap((participant) =>
      participant.teamId &&
      (participant.role === "commissioner" || participant.role === "owner")
        ? [participant.teamId]
        : []
    )
  ).size;
  const allTeamsAssigned = assignedTeamCount === snapshot.draft.teamCount;
  const currentParticipantId = currentParticipant?.id ?? null;

  // Show lobby before the draft starts
  if (snapshot.draft.status === "setup") {
    return (
      <>
        {actionError && (
          <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-800 bg-red-950 px-5 py-3 text-sm text-red-300 shadow-xl">
            {actionError}
          </div>
        )}
        <DraftLobby
          draft={snapshot.draft}
          participants={snapshot.participants}
          teams={snapshot.teams}
          onlineUserIds={onlineUserIds}
          currentUserId={snapshot.currentUserId}
          leagueSlug={leagueSlug ?? undefined}
          leagueLogoUrl={leagueBranding?.logoUrl ?? undefined}
          leagueName={leagueBranding?.name ?? (leagueSlug ? leagueSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : undefined)}
          isCommissioner={isCommissioner}
          isStarting={isControllingDraft}
          chatUnread={chatUnread}
          onChatToggle={() => setShowChat((value) => !value)}
          onStart={() =>
            void handleDraftControl(() => startDraft(draftId as string))
          }
        />
        <DraftChat
          draftId={draftId as string}
          participantId={currentParticipantId}
          isCommissioner={isCommissioner}
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          onUnreadChange={setChatUnread}
          participants={snapshot.participants}
          onlineUserIds={onlineUserIds}
        />
      </>
    );
  }

  const draftedPlayerIds = new Set(
    snapshot.picks.map((pick) => pick.playerId)
  );
  const availablePlayers = snapshot.players.filter(
    (player) => !draftedPlayerIds.has(player.id) && isPlayerEligible(player, snapshot.draft.rosterPositions)
  );

  // Merge ESPN rankings into player rank field (overrides static rank when available)
  const espnRankMap = buildRankMap(snapshot.players, espnRankings);
  const rankedAvailablePlayers = availablePlayers.map((p) => ({
    ...p,
    rank: espnRankMap.get(p.id) ?? p.rank,
  }));
  const currentRound = teamOnClock
    ? getRoundForPick(snapshot.draft.currentPick, snapshot.draft.teamCount)
    : null;
  const currentPickInRound = teamOnClock
    ? getPickNumberInRound(
        snapshot.draft.currentPick,
        snapshot.draft.teamCount
      )
    : null;


  const primaryColor = leagueBranding?.primaryColor ?? null;
  const secondaryColor = leagueBranding?.secondaryColor ?? null;
  const leagueLogoUrl = leagueBranding?.logoUrl ?? null;

  // Next-up queue: next 10 teams in pick order after the current pick
  const allSlots = generateSnakeDraftOrder(snapshot.teams, snapshot.draft.rounds);
  const nextUpSlots = allSlots
    .filter((s) => s.overallPickNumber > snapshot.draft.currentPick)
    .sort((a, b) => a.overallPickNumber - b.overallPickNumber)
    .slice(0, 12);

  // Positions enabled in roster settings — drives filter buttons on player board
  const PLAYER_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
  const enabledPositions: string[] = snapshot.draft.rosterPositions?.length
    ? PLAYER_POSITIONS.filter((pos) =>
        snapshot.draft.rosterPositions!.some((r) => r.id === pos && r.enabled)
      )
    : [...PLAYER_POSITIONS];

  // Staged player lookup
  const stagedPlayer = stagedPlayerId
    ? snapshot.players.find((p) => p.id === stagedPlayerId) ?? null
    : null;

  // Position colors derived from roster settings
  const posColorMap = buildPositionColorMap(snapshot.draft.rosterPositions, DEFAULT_POSITION_ACCENTS);
  function getCard(position: string) {
    return posColorMap.get(position) ?? positionCellColors(DEFAULT_POSITION_ACCENTS[position] ?? "#94A3B8");
  }

  // Timer display
  const timerUrgent = timerSeconds <= 10 && snapshot.draft.status === "active" && Boolean(snapshot.draft.pickDeadlineAt);
  const timerWarn = timerSeconds <= 30 && !timerUrgent && snapshot.draft.status === "active" && Boolean(snapshot.draft.pickDeadlineAt);
  const timerColor = timerUrgent ? "text-red-400" : timerWarn ? "text-amber-400" : "text-white";

  const headerGradient = primaryColor
    ? { background: `linear-gradient(135deg, ${primaryColor}18 0%, ${secondaryColor ?? primaryColor}08 100%)` }
    : { background: "linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(15,23,42,0) 100%)" };

  const accentStyle = primaryColor ? { backgroundColor: primaryColor, color: secondaryColor ?? "#0f172a" } : {};

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-white">
      <WalkUpPlayer
        ref={walkUpPlayerRef}
        onPlaybackBlocked={() => {
          // Before the first unlock gesture this is the browser autoplay policy —
          // show the unlock overlay. After it, a block means a broken/unavailable
          // track; stay silent rather than looping a modal at the draft party.
          if (!audioUnlockedOnceRef.current) setAudioBlocked(true);
        }}
        onPlaying={() => setAudioBlocked(false)}
        onEnded={() => {
          // Resume mode: the on-clock team's song finished naturally. Bank the
          // total consumed time as this team's wrap point and continue with the
          // next song in its playlist from the top. Restart mode keeps the
          // current behavior (silence until the next turn).
          if (walkUpMusicModeRef.current !== "resume") return;
          const turn = walkUpTurnRef.current;
          if (!turn) return;
          if (revealActiveRef.current || landmineActiveRef.current) return;
          if (turn.teamId !== prevOnClockTeamIdRef.current) return;
          const elapsed = Math.max(
            0,
            (Date.now() + turn.serverTimeOffsetMs - turn.anchorMs - turn.graceMs) / 1_000
          );
          walkUpWrapBaseRef.current.set(turn.teamId, turn.cumulative + elapsed);
          const nextIndex = (turn.songIndex + 1) % turn.songs.length;
          walkUpResumeIndexRef.current.set(turn.teamId, nextIndex);
          walkUpTurnRef.current = { ...turn, songIndex: nextIndex };
          walkUpPlayerRef.current?.play(turn.songs[nextIndex], 0);
        }}
      />

      {/* Audio unlock overlay — browser requires a user gesture before autoplay */}
      {audioBlocked && walkUpMusicEnabled && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-slate-800/90 px-10 py-8 text-center shadow-2xl">
            <p className="text-xl font-bold text-white">Walk-Up Music Autoplay enabled.</p>
            <p className="text-sm text-slate-400">Click OK to proceed.</p>
            <button
              type="button"
              onClick={() => {
                audioUnlockedOnceRef.current = true;
                setAudioBlocked(false);
                if (walkUpDefaultAudioRef.current) {
                  walkUpDefaultAudioRef.current.play().catch(() => {});
                }
                prevOnClockTeamIdRef.current = null;
                setAudioUnlockTick((n) => n + 1);
              }}
              className="mt-1 rounded bg-blue-600 px-8 py-2 text-sm font-bold text-white hover:bg-blue-500 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── ROW 1: Timer · On Clock · Next Up ── */}
      {compactHeader ? (
        /* Compact bar — large readable text, single row */
        <div className="shrink-0 flex items-center gap-4 border-b border-white/5 bg-slate-950 px-4" style={{ height: "56px" }}>
          {/* Commissioner controls */}
          {isCommissioner && showCommishControls && snapshot.draft.status !== "complete" && (
            <div className="flex items-center gap-1.5">
              {snapshot.draft.status === "active" ? (
                <button type="button" title="Pause" disabled={isControllingDraft}
                  className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
                  onClick={() => void handleDraftControl(() => pauseDraft(draftId as string))}>
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5"><rect x="1.5" y="1" width="3" height="10" rx="0.75"/><rect x="7.5" y="1" width="3" height="10" rx="0.75"/></svg>
                </button>
              ) : (
                <button type="button" title="Resume" disabled={isControllingDraft}
                  className="flex h-8 w-8 items-center justify-center rounded bg-green-700/60 text-green-300 hover:bg-green-700 disabled:opacity-40"
                  onClick={() => void handleDraftControl(() => resumeDraft(draftId as string))}>
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5"><polygon points="2,1 11,6 2,11"/></svg>
                </button>
              )}
              <button type="button" title="Reset timer" disabled={isControllingDraft || !["active","paused"].includes(snapshot.draft.status) || snapshot.draft.pickSeconds === 0}
                className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                onClick={() => void handleDraftControl(() => resetPickTimer(draftId as string))}>
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5"><path d="M6 2a4 4 0 1 0 3.46 2h-1.2A2.8 2.8 0 1 1 6 3.2V2.5L8 1 6 0v2z"/></svg>
              </button>
            </div>
          )}

          {/* Timer */}
          <span className={`font-mono text-4xl font-black tabular-nums leading-none ${timerColor}`}>
            {snapshot.draft.pickSeconds > 0 ? formatDraftClock(timerSeconds) : "--:--"}
          </span>

          <span className="h-8 w-px bg-white/8" />

          {/* Round */}
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Round</span>
            <span className="text-5xl font-black leading-none text-white">{currentRound ?? "1"}</span>
          </div>

          {/* Pick */}
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Pick</span>
            <span className="text-5xl font-black leading-none text-white">{currentPickInRound ?? "—"}</span>
          </div>

          {teamOnClock && snapshot.draft.status !== "complete" && (
            <>
              <span className="h-8 w-px bg-white/8" />
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">On the clock</span>
                <span className="text-3xl font-black uppercase leading-none" style={canMakePick && primaryColor ? { color: primaryColor } : { color: "#67e8f9" }}>
                  {teamOnClock.name}
                </span>
              </div>
            </>
          )}
        </div>
      ) : (
      <div className="shrink-0 border-b border-white/5" style={headerGradient}>
        <div className="flex items-stretch divide-x divide-white/5 overflow-hidden">

          {/* Timer block */}
          <div className="flex shrink-0 items-center gap-4 px-4 py-3">
            {/* Commissioner clock controls */}
            {isCommissioner && showCommishControls && snapshot.draft.status !== "complete" && (
              <div className="flex flex-col gap-1.5">
                {snapshot.draft.status === "active" ? (
                  <button type="button" title="Pause draft" disabled={isControllingDraft}
                    className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 transition-colors"
                    onClick={() => void handleDraftControl(() => pauseDraft(draftId as string))}>
                    <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5">
                      <rect x="1.5" y="1" width="3" height="10" rx="0.75"/>
                      <rect x="7.5" y="1" width="3" height="10" rx="0.75"/>
                    </svg>
                  </button>
                ) : (
                  <button type="button" title="Resume draft" disabled={isControllingDraft}
                    className="flex h-7 w-7 items-center justify-center rounded bg-green-700/60 text-green-300 hover:bg-green-700 hover:text-white disabled:opacity-40 transition-colors"
                    onClick={() => void handleDraftControl(() => resumeDraft(draftId as string))}>
                    <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5">
                      <polygon points="2,1 11,6 2,11"/>
                    </svg>
                  </button>
                )}
                {/* Edit clock button — opens set-clock popup */}
                <div className="relative">
                  <button type="button" title="Set pick clock"
                    className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    onClick={() => {
                      const cur = snapshot.draft.pickSeconds;
                      setClockEditMin(Math.floor(cur / 60));
                      setClockEditSec(cur % 60);
                      setShowClockEdit((v) => !v);
                    }}>
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z"/>
                    </svg>
                  </button>
                  {showClockEdit && (
                    <div className="absolute left-full top-0 z-50 ml-2 flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 shadow-2xl">
                      <select
                        value={clockEditMin}
                        onChange={(e) => setClockEditMin(Number(e.target.value))}
                        className="rounded border border-slate-700 bg-slate-800 px-1.5 py-1 text-sm font-bold text-white focus:outline-none"
                      >
                        {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                      </select>
                      <span className="font-black text-slate-500">:</span>
                      <select
                        value={clockEditSec}
                        onChange={(e) => setClockEditSec(Number(e.target.value))}
                        className="rounded border border-slate-700 bg-slate-800 px-1.5 py-1 text-sm font-bold text-white focus:outline-none"
                      >
                        {[0, 15, 30, 45].map((s) => <option key={s} value={s}>{String(s).padStart(2, "0")}</option>)}
                      </select>
                      <button type="button"
                        disabled={clockEditMin === 0 && clockEditSec === 0}
                        className="rounded bg-teal-600 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-white hover:bg-teal-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => {
                          const secs = clockEditMin * 60 + clockEditSec;
                          setShowClockEdit(false);
                          void handleDraftControl(() => configureDraftTimer(draftId as string, secs));
                        }}>
                        Set
                      </button>
                    </div>
                  )}
                </div>
                <button type="button" title="Reset timer" disabled={isControllingDraft || !["active","paused"].includes(snapshot.draft.status) || snapshot.draft.pickSeconds === 0}
                  className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
                  onClick={() => void handleDraftControl(() => resetPickTimer(draftId as string))}>
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M6 2a4 4 0 1 0 3.46 2h-1.2A2.8 2.8 0 1 1 6 3.2V2.5L8 1 6 0v2z"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Clock display */}
            <div className="flex flex-col items-center gap-1.5">
              <span className={`font-mono text-6xl font-black tabular-nums leading-none ${timerColor}`}>
                {snapshot.draft.pickSeconds > 0 ? formatDraftClock(timerSeconds) : "--:--"}
              </span>
              {/* Extension slots */}
              {isCommissioner && showCommishControls && snapshot.draft.maxClockExtensions > 0 && snapshot.draft.status !== "complete" && (
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: snapshot.draft.maxClockExtensions }, (_, i) => {
                    const teamUsed = teamOnClock?.clockExtensionsUsed ?? 0;
                    const used = i < teamUsed;
                    const canUse = !used && snapshot.draft.status === "active" && !isControllingDraft && teamUsed === i;
                    return (
                      <button key={i} type="button"
                        title={used ? "Extension used" : `+${snapshot.draft.clockExtensionSeconds}s`}
                        disabled={!canUse}
                        onClick={() => void handleExtendClock()}
                        className={`h-2.5 w-8 rounded-full transition-all ${used ? "bg-white/10" : canUse ? "cursor-pointer opacity-100 hover:opacity-80" : "opacity-30"}`}
                        style={!used ? { backgroundColor: primaryColor ?? "#14b8a6" } : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Round / Pick */}
          <div className="flex shrink-0 items-center gap-5 px-5 py-3">
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Round</div>
              <div className="text-5xl font-black leading-none">{currentRound ?? (snapshot.draft.status === "complete" ? "—" : "1")}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pick</div>
              <div className="text-5xl font-black leading-none">{currentPickInRound ?? "—"}</div>
            </div>
          </div>

          {/* Team on clock + Next Up stacked */}
          {teamOnClock && snapshot.draft.status !== "complete" && (
            <div className="flex min-w-0 flex-1 items-center gap-4 px-5 py-2">
              {/* Logo / avatar always shown */}
              {teamOnClock.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={teamOnClock.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white/10" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xl font-black text-slate-300">
                  {teamOnClock.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
                {stagedPlayer && canMakePick ? (
                  /* "THE PICK IS IN..." mode */
                  <>
                    <div className="text-5xl font-black italic uppercase leading-none tracking-wide text-white animate-pulse">
                      THE PICK IS IN...
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-400">
                      {stagedPlayer.fullName}
                      <span className="ml-2 text-slate-600">{stagedPlayer.position}{stagedPlayer.nflTeam ? `/${stagedPlayer.nflTeam}` : ""}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none mb-0.5">
                      {canMakePick ? "Your pick" : "On the clock"}
                    </div>
                    <div className="text-5xl font-black uppercase leading-none tracking-wide" style={canMakePick && primaryColor ? { color: primaryColor } : { color: "#fff" }}>
                      {teamOnClock.name}
                    </div>
                  </>
                )}
                {nextUpSlots.length > 0 && (
                  <div className="flex items-center gap-4 mt-1.5 overflow-hidden whitespace-nowrap">
                    <span className="shrink-0 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Next Up:</span>
                    {nextUpSlots.map((slot, i) => (
                      <span key={slot.overallPickNumber} className={`shrink-0 text-sm font-bold ${i === 0 ? "text-slate-200" : "text-slate-500"}`}>
                        {slot.teamName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {snapshot.draft.status === "complete" && (
            <div className="flex shrink-0 items-center px-5 py-3">
              <span className="text-3xl font-black text-green-400">Draft Complete</span>
            </div>
          )}

        </div>
      </div>
      )} {/* end compactHeader conditional */}


      {/* ── Alerts strip (connection issues / errors) ── */}
      {(status !== "connected" || error || actionError) && (
        <div className="shrink-0 border-b border-white/5">
          {status !== "connected" && (
            <div className="flex items-center gap-3 bg-yellow-950/60 px-4 py-2">
              <p className="flex-1 text-xs font-semibold text-yellow-300">{status === "connecting" ? "Reconnecting..." : "Connection interrupted — picks paused"} · {formatLastSyncedAt(lastSyncedAt)}</p>
              <button type="button" disabled={isRefreshing} className="text-xs text-yellow-400 hover:text-yellow-200 disabled:opacity-50 transition-colors" onClick={() => void refresh()}>
                {isRefreshing ? "..." : "Retry"}
              </button>
            </div>
          )}
          {(error || actionError) && (
            <p className="bg-red-950/60 px-4 py-2 text-xs font-semibold text-red-300">{actionError || error}</p>
          )}
        </div>
      )}


      {/* ── ROW 2: Board switcher toolbar ── */}
      {/* Close menus when clicking elsewhere */}
      {(showBoardMenu || showCommishMenu) && (
        <div className="fixed inset-0 z-30" onClick={() => { setShowBoardMenu(false); setShowCommishMenu(false); }} />
      )}
      <div className="relative z-40 shrink-0 grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-white/5 bg-slate-900/90 px-3 py-1.5">
        {/* ── Left: board dropdown + commish menu ── */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button type="button"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10 transition-colors"
              onClick={() => { setShowBoardMenu((v) => !v); setShowCommishMenu(false); }}>
              {boardView === "draft" ? "Draft Board" : boardView === "players" ? "Player Board" : boardView === "roster" ? "Roster Board" : "Round Summary"}
              <svg viewBox="0 0 10 6" fill="currentColor" className="h-2 w-2.5 text-slate-500"><path d="M0 0l5 6 5-6z"/></svg>
            </button>
            {showBoardMenu && (
              <div className="absolute top-full left-0 mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                {(["draft","players","roster","rounds"] as const).map((v) => {
                  const labels = { draft: "Draft Board", players: "Player Board", roster: "Roster Board", rounds: "Round Summary" };
                  return (
                    <button key={v} type="button"
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${boardView === v ? "bg-white/10 font-semibold text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                      onClick={() => { setBoardView(v); setShowBoardMenu(false); }}>
                      {labels[v]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isCommissioner && (
            <div className="relative">
              <button type="button"
                className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm font-bold text-slate-300 hover:bg-white/10 transition-colors"
                onClick={() => { setShowCommishMenu((v) => !v); setShowBoardMenu(false); }}>
                ···
              </button>
              {showCommishMenu && (
                <div className="absolute top-full left-0 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                  {canUndoPick && snapshot.picks.length > 0 && (
                    <button type="button" disabled={isUndoing}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-40 transition-colors"
                      onClick={() => { setShowCommishMenu(false); void handleUndoPick(); }}>
                      Undo previous pick <span className="text-slate-600">↩</span>
                    </button>
                  )}
                  {snapshot.draft.status === "active" && teamOnClock && (
                    <button type="button" disabled={isExpiringPick || status !== "connected"}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-40 transition-colors"
                      onClick={handleSkipPick}>
                      Skip pick <span className="text-slate-600">⏭</span>
                    </button>
                  )}
                  <div className="mx-3 my-1 border-t border-white/5" />
                  {snapshot.draft.status === "active" && (
                    <button type="button" disabled={isControllingDraft}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-40 transition-colors"
                      onClick={() => { setShowCommishMenu(false); void handleDraftControl(() => pauseDraft(draftId as string)); }}>
                      Take a Draft Break <span className="text-slate-600">⏸</span>
                    </button>
                  )}
                  {snapshot.draft.status === "paused" && (
                    <button type="button" disabled={isControllingDraft}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-green-400 hover:bg-white/5 hover:text-green-300 disabled:opacity-40 transition-colors"
                      onClick={() => { setShowCommishMenu(false); void handleDraftControl(() => resumeDraft(draftId as string)); }}>
                      Resume Draft <span className="text-slate-600">▶</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Center: search dropdown + Draft Player ── */}
        <div className="flex items-center justify-center gap-2">
          <div className="relative">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" style={{ left: "10px" }}>
              <circle cx="6.5" cy="6.5" r="4"/><path d="M11 11l3 3"/>
            </svg>
            <input
              type="text"
              placeholder={stagedPlayer ? `${stagedPlayer.fullName} ${stagedPlayer.position}/${stagedPlayer.nflTeam ?? "FA"}` : "Search players..."}
              value={playerSearch}
              className="w-52 rounded-lg border bg-white/5 py-1.5 pr-8 text-xs placeholder:text-slate-400 focus:outline-none focus:w-72 transition-all"
              style={{
                paddingLeft: "32px",
                borderColor: stagedPlayer && !playerSearch ? "#14b8a6" : "rgba(255,255,255,0.08)",
                color: stagedPlayer && !playerSearch ? "#5eead4" : "#e2e8f0",
              }}
              onChange={(e) => setPlayerSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setPlayerSearch(""); setStagedPlayerId(null); }
              }}
            />
            {(playerSearch || stagedPlayer) && (
              <button type="button" onClick={() => { setPlayerSearch(""); setStagedPlayerId(null); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
              </button>
            )}
            {/* Dropdown results */}
            {playerSearch.trim().length > 0 && (
              <div className="absolute top-full left-0 z-50 mt-1 w-80 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                {rankedAvailablePlayers
                  .filter((p) => p.fullName.toLowerCase().includes(playerSearch.toLowerCase()))
                  .slice(0, 8)
                  .map((p) => {
                    const posColor = ({ QB:"#38bdf8", RB:"#fbbf24", WR:"#fb923c", TE:"#a78bfa", K:"#4ade80", DST:"#f87171" } as Record<string,string>)[p.position] ?? "#94a3b8";
                    const nameParts = p.fullName.split(" ");
                    const last = nameParts.slice(1).join(" ") || nameParts[0];
                    const first = nameParts.length > 1 ? nameParts[0] : "";
                    return (
                      <button key={p.id} type="button"
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                        onClick={() => {
                          setStagedPlayerId(p.id);
                          setPlayerSearch("");
                        }}>
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black"
                          style={{ backgroundColor: `${posColor}25`, color: posColor }}
                        >{p.position}</span>
                        <span className="flex-1 text-sm font-semibold text-white">
                          {last}{first && <span className="text-slate-500">, {first}</span>}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-slate-500">{p.nflTeam ?? "FA"}</span>
                      </button>
                    );
                  })}
                {rankedAvailablePlayers.filter((p) => p.fullName.toLowerCase().includes(playerSearch.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-xs text-slate-600">No players found</div>
                )}
              </div>
            )}
          </div>

          {canMakePick && snapshot.draft.status === "active" && (
            <button type="button"
              className="rounded-lg px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all hover:opacity-90"
              style={stagedPlayer
                ? { backgroundColor: "#14b8a6", color: "#0f172a", boxShadow: "0 0 14px #14b8a660" }
                : (accentStyle.backgroundColor ? { ...accentStyle, opacity: 0.65 } : { backgroundColor: "#14b8a6", color: "#0f172a", opacity: 0.65 })
              }
              onClick={() => {
                setActionError("");
                if (stagedPlayer) {
                  void handleMakePick(stagedPlayer.id);
                  setStagedPlayerId(null);
                } else {
                  setShowPickModal(true);
                }
              }}>
              {stagedPlayer ? "Draft Player" : "Pick Player"}
            </button>
          )}
        </div>

        {/* ── Right: connection dot · sound · fullscreen toggle · settings ── */}
        <div className="flex items-center justify-end gap-0.5">
          <div className={`h-2 w-2 rounded-full mr-2 ${status === "connected" ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`} title={status} />

          {/* Sound menu */}
          <div className="relative">
            <button type="button" title="Sound effects"
              onClick={() => setShowSoundMenu((v) => !v)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${showSoundMenu ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M10 3L5.5 7H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.5L10 17V3zm4.243 1.757a8 8 0 0 1 0 11.314l-1.415-1.414a6 6 0 0 0 0-8.486l1.415-1.414zm-2.829 2.829a4 4 0 0 1 0 5.656l-1.414-1.414a2 2 0 0 0 0-2.828l1.414-1.414z"/>
              </svg>
            </button>

            {showSoundMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSoundMenu(false)} />
                <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
                  {/* Volume slider — placeholder for walk-up songs */}
                  <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2.5">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-slate-500">
                      <path d="M8 2L4.5 5.5H2a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h2.5L8 14V2zm3.354 1.146a6 6 0 0 1 0 9.708l-1.06-1.06a4.5 4.5 0 0 0 0-7.588l1.06-1.06z"/>
                    </svg>
                    <input type="range" min={0} max={100} value={musicVolume}
                      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-teal-500"
                      title="Walk-up music volume"
                      onInput={(e) => {
                        const v = Number(e.currentTarget.value);
                        setMusicVolume(v);
                        persist("dr:musicVolume", v);
                      }} />
                  </div>

                  {/* Sound buttons */}
                  <div className="p-2 space-y-1">
                    <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-600">Reactions</p>

                    <div className="grid grid-cols-2 gap-1">
                      {/* Positive */}
                      <button type="button"
                        onClick={() => {
                          const reactions = snapshot.draft.posReactions?.length
                            ? snapshot.draft.posReactions
                            : ["That was a great pick!", "What a steal!", "Excellent choice!"];
                          const phrase = reactions[Math.floor(Math.random() * reactions.length)];
                          const utt = new SpeechSynthesisUtterance(phrase);
                          window.speechSynthesis?.cancel();
                          window.speechSynthesis?.speak(utt);
                        }}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/8 hover:text-white transition-colors">
                        <span>👍</span> Positive
                      </button>

                      {/* Negative */}
                      <button type="button"
                        onClick={() => {
                          const reactions = snapshot.draft.negReactions?.length
                            ? snapshot.draft.negReactions
                            : ["Oh no! What were you thinking?", "Really? You chose him?", "That was a horrible pick!"];
                          const phrase = reactions[Math.floor(Math.random() * reactions.length)];
                          const utt = new SpeechSynthesisUtterance(phrase);
                          window.speechSynthesis?.cancel();
                          window.speechSynthesis?.speak(utt);
                        }}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/8 hover:text-white transition-colors">
                        <span>👎</span> Negative
                      </button>

                      {/* Cheer */}
                      <button type="button" onClick={playApplause}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/8 hover:text-white transition-colors">
                        <span>😄</span> Cheer
                      </button>

                      {/* Boo */}
                      <button type="button" onClick={playBoo}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/8 hover:text-white transition-colors">
                        <span>😤</span> Boo
                      </button>

                      {/* SFX 1 */}
                      <button type="button"
                        disabled={!snapshot.draft.sfx1Url}
                        onClick={() => { const u = snapshot.draft.sfx1Url; if (u) { const a = new Audio(u); a.volume = 0.7; a.play().catch(() => {}); } }}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/8 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 shrink-0"><path d="M3.5 5H2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1.5L7 12V2L3.5 5zm6.5-.5a3.5 3.5 0 0 1 0 5"/></svg>
                        Sound 1
                      </button>

                      {/* SFX 2 */}
                      <button type="button"
                        disabled={!snapshot.draft.sfx2Url}
                        onClick={() => { const u = snapshot.draft.sfx2Url; if (u) { const a = new Audio(u); a.volume = 0.7; a.play().catch(() => {}); } }}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/8 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 shrink-0"><path d="M3.5 5H2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1.5L7 12V2L3.5 5zm6.5-.5a3.5 3.5 0 0 1 0 5"/></svg>
                        Sound 2
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Compact / fullscreen toggle */}
          <button type="button" title={compactHeader ? "Expand header" : "Compact header"}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${compactHeader ? "bg-white/10 text-slate-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            onClick={() => setCompactHeader((v) => !v)}>
            {compactHeader ? (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-5 w-5">
                <path d="M7 2H3a1 1 0 0 0-1 1v4M13 2h4a1 1 0 0 1 1 1v4M7 18H3a1 1 0 0 1-1-1v-4M13 18h4a1 1 0 0 0 1-1v-4"/>
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-5 w-5">
                <path d="M2 7V3a1 1 0 0 1 1-1h4M18 7V3a1 1 0 0 0-1-1h-4M2 13v4a1 1 0 0 0 1 1h4M18 13v4a1 1 0 0 1-1 1h-4"/>
              </svg>
            )}
          </button>

          {/* TV / Broadcast mode toggle */}
          <button type="button" title="TV Mode — project on screen"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${showTvMode ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            onClick={() => { setShowSettings(false); setShowTvMode((v) => !v); }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <rect x="2" y="3" width="16" height="11" rx="1.5" fill="none"/>
              <path d="M7 17h6M10 14v3"/>
            </svg>
          </button>

          {/* Settings — proper cog icon */}
          <button type="button" title="Settings"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${showSettings ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            onClick={() => setShowSettings((v) => !v)}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Board area (fills remaining space) ── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {boardView === "draft" && (
          <DraftBoard
            teams={teamNames}
            rounds={snapshot.draft.rounds}
            picks={snapshot.picks}
            currentPickNumber={snapshot.draft.currentPick}
            draftStatus={snapshot.draft.status}
            canMakePick={canMakePick && !isMakingPick}
            canUndoPick={canUndoPick && !isUndoing}
            byeWeeks={byeWeeks.size > 0 ? byeWeeks : undefined}
            playerNameSize={playerNameSize}
            myTeamName={
              accessState.kind === "assigned"
                ? snapshot.teams.find((t) => t.id === accessState.teamId)?.name
                : undefined
            }
            teamMap={new Map(snapshot.teams.map((t) => [t.id, t.name]))}
            rosterPositions={snapshot.draft.rosterPositions}
            onSlotClick={() => { setActionError(""); setShowPickModal(true); }}
            onUndoPick={handleUndoPick}
            onEditPick={isCommissioner ? (pick) => setEditingPick(pick) : undefined}
          />
        )}

        {boardView === "players" && (
          <PlayerListView
            players={rankedAvailablePlayers}
            search={playerSearch}
            onSearchChange={setPlayerSearch}
            posFilter={posFilter}
            onPosFilterChange={setPosFilter}
            enabledPositions={enabledPositions}
            playerNameSize={playerNameSize}
            canPick={canMakePick && !isMakingPick}
            pickingPlayerId={pickingPlayerId}
            queue={queue}
            stagedPlayerId={stagedPlayerId}
            byeWeeks={byeWeeks}
            onCardClick={(id, rect) => {
              const x = Math.min(rect.left, window.innerWidth - 192);
              const y = rect.bottom + 6;
              setCardMenu({ playerId: id, x, y });
            }}
            posColorMap={posColorMap}
          />
        )}

        {boardView === "roster" && (
          <RosterBoardView teams={snapshot.teams} picks={snapshot.picks} />
        )}

        {boardView === "rounds" && (
          <RoundSummaryView
            draftId={draftId as string}
            teams={snapshot.teams}
            picks={snapshot.picks}
            players={snapshot.players}
            currentPickNumber={snapshot.draft.currentPick}
            rounds={snapshot.draft.rounds}
            byeWeeks={byeWeeks}
            isCommissioner={isCommissioner}
            onUndoPick={handleUndoPick}
          />
        )}
      </div>

      {/* ── Mobile pick bar (hidden on desktop) ── */}
      {canMakePick && (
        <div className="shrink-0 border-t border-white/5 bg-slate-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <button type="button" className="w-full rounded-xl py-3 text-sm font-black uppercase tracking-wider text-slate-950 transition-opacity hover:opacity-90"
            style={accentStyle.backgroundColor ? accentStyle : { backgroundColor: "#14b8a6", color: "#0f172a" }}
            onClick={() => { setActionError(""); setShowPickModal(true); }}>
            Draft Player — {teamOnClock?.name}
          </button>
        </div>
      )}

      {/* ── Ticker / nav bar ── */}
      <DraftTicker
        draftName={snapshot.draft.name}
        leagueName={leagueBranding?.name ?? undefined}
        picks={snapshot.picks}
        teams={snapshot.teams}
        unread={chatUnread}
        isChatOpen={showChat}
        onChatToggle={() => setShowChat((v) => !v)}
        accentColor={primaryColor ?? undefined}
        mode={tickerMode}
        boardView={boardView}
        onBoardViewChange={setBoardView}
        posFilter={posFilter}
        onPosFilterChange={setPosFilter}
        enabledPositions={enabledPositions}
      />

      {showPickModal && (
        <PickModal
          title={`Draft Player — ${teamOnClock?.name ?? "Team"}`}
          players={availablePlayers}
          isSaving={isMakingPick}
          error={actionError}
          onClose={() => { if (!isMakingPick) { setShowPickModal(false); setActionError(""); } }}
          onSave={handleMakePick}
        />
      )}

      <DraftChat
        draftId={draftId as string}
        participantId={currentParticipantId}
        isCommissioner={isCommissioner}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        onUnreadChange={setChatUnread}
        participants={snapshot.participants}
        onlineUserIds={onlineUserIds}
      />

      {/* ── Card context menu ── */}
      {cardMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCardMenu(null)} />
          <div
            className="fixed z-50 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
            style={{ top: cardMenu.y, left: cardMenu.x, width: 180 }}>
            <button type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              onClick={() => {
                setQueue((q) => q.includes(cardMenu.playerId) ? q : [...q, cardMenu.playerId]);
                setCardMenu(null);
              }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-4 w-4 shrink-0 text-slate-500">
                <path d="M3 4h10M3 8h10M3 12h6"/>
                <path d="M12 10v4M10 12h4" strokeWidth="1.5"/>
              </svg>
              Add to Queue
              {queue.includes(cardMenu.playerId) && (
                <span className="ml-auto text-[10px] font-black text-teal-400">✓</span>
              )}
            </button>
            <button type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors border-t border-white/5"
              onClick={() => {
                setStagedPlayerId((s) => s === cardMenu.playerId ? null : cardMenu.playerId);
                setCardMenu(null);
              }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-slate-500">
                <path d="M8 2l1.5 3 3.5.5-2.5 2.5.6 3.5L8 10l-3.1 1.5.6-3.5L3 5.5l3.5-.5z"/>
              </svg>
              Stage Player
              {stagedPlayerId === cardMenu.playerId && (
                <span className="ml-auto text-[10px] font-black text-amber-400">✓</span>
              )}
            </button>
            {canMakePick && !isMakingPick && (
              <button type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-black text-white hover:bg-teal-500/20 transition-colors border-t border-white/5"
                onClick={() => {
                  setActionError("");
                  void handleMakePick(cardMenu.playerId);
                  setCardMenu(null);
                }}>
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0 text-teal-400">
                  <path d="M3 8l4 4 6-7" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Draft Player
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Landmine animation ── */}
      {landminePick && (
        <LandmineAnimation
          key={`${landminePick.playerName}-${landminePick.teamName}`}
          playerName={landminePick.playerName}
          teamName={landminePick.teamName}
          onDismiss={() => { prevOnClockTeamIdRef.current = null; setLandmineActive(false); setLandminePick(null); }}
        />
      )}

      {/* ── Pick reveal modal ── */}
      {revealPick && (
        <PickRevealModal
          pick={revealPick}
          teams={snapshot.teams}
          draftName={snapshot.draft.name}
          leagueLogoUrl={leagueLogoUrl ?? undefined}
          playerHeadshotUrl={snapshot.players.find((player) => player.id === revealPick.playerId)?.headshotUrl}
          canUndo={isCommissioner && snapshot.draft.status !== "complete"}
          onUndo={() => { cancelPickAnnouncement(); void handleUndoPick(); setRevealPick(null); }}
          onClose={() => { cancelPickAnnouncement(); setRevealPick(null); }}
          sfx1Url={snapshot.draft.sfx1Url}
          sfx2Url={snapshot.draft.sfx2Url}
          posReactions={snapshot.draft.posReactions}
          negReactions={snapshot.draft.negReactions}
        />
      )}

      {/* ── Edit pick modal (commissioner) ── */}
      {editingPick && (
        <EditPickModal
          pick={editingPick}
          teams={snapshot.teams}
          allPlayers={snapshot.players}
          draftedPlayerIds={draftedPlayerIds}
          draftId={draftId!}
          onClose={() => setEditingPick(null)}
          onSaved={() => { setEditingPick(null); void refresh(); }}
        />
      )}

      {/* ── End-of-round recap modal ── */}
      {roundRecap && !revealPick && (
        <RoundRecapModal
          round={roundRecap.round}
          totalRounds={snapshot.draft.rounds}
          picks={roundRecap.picks}
          teams={snapshot.teams}
          espnRankMap={espnRankMap}
          nextTeam={getTeamOnClock(snapshot.teams, snapshot.draft.currentPick, snapshot.draft.rounds) ?? null}
          suppressRecap={suppressRecap}
          onToggleSuppress={() => setSuppressRecap((v) => !v)}
          onResume={() => setRoundRecap(null)}
        />
      )}

      {/* ── TV / Broadcast mode overlay (z-[45] — below pick reveal at z-50) ── */}
      {showTvMode && (
        <TvModeOverlay
          draft={snapshot.draft}
          picks={snapshot.picks}
          teams={snapshot.teams}
          players={snapshot.players}
          teamOnClock={teamOnClock}
          timerSeconds={timerSeconds}
          timerColor={timerColor}
          currentRound={currentRound}
          currentPickInRound={currentPickInRound}
          nextUpSlots={nextUpSlots}
          accentColor={primaryColor}
          leagueName={leagueBranding?.name ?? undefined}
          revealActive={revealPick !== null}
          landmineActive={landmineActive}
          tvMasterVolume={tvMasterVolume}
          tvMuted={tvMuted}
          onTvVolumeChange={(v) => { setTvMasterVolume(v); persist("tv:masterVolume", v); }}
          onTvMuteChange={(m) => { setTvMuted(m); persist("tv:muted", m); }}
          onExit={() => setShowTvMode(false)}
        />
      )}

      {/* ── Draft Complete modal ── */}
      {showDraftComplete && snapshot.draft.status === "complete" && (
        <DraftCompleteModal
          draft={snapshot.draft}
          picks={snapshot.picks}
          teams={snapshot.teams}
          leagueSlug={leagueSlug}
          myTeamId={accessState.kind === "assigned" ? accessState.teamId : null}
          accentColor={primaryColor}
          onClose={() => setShowDraftComplete(false)}
        />
      )}

      {/* ── Settings popup ── */}
      {showSettings && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
          {/* popup card — positioned below the toolbar row */}
          <div className="fixed right-2 top-24 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"
            style={{ width: "min(300px, calc(100vw - 16px))", maxHeight: "calc(100dvh - 120px)" }}>

            {/* header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Settings</span>
              <button type="button" aria-label="Close"
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-white/10 hover:text-white transition-colors"
                onClick={() => setShowSettings(false)}>
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-3 w-3"><path d="M1 1l10 10M11 1L1 11"/></svg>
              </button>
            </div>

            <div className="overflow-y-auto">

              {/* DISPLAY */}
              <div className="px-4 pb-0.5 pt-3">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Display</span>
              </div>

              {isCommissioner && (
                <SettingsToggleRow
                  label="Commish Mode"
                  description="Show clock controls in header"
                  value={showCommishControls}
                  onChange={(v) => { setShowCommishControls(v); persist("dr:commishControls", v); }}
                />
              )}

              <SettingsToggleRow
                label="Pick Reveal"
                description="Show selection card after each pick"
                value={showPickReveal}
                onChange={(v) => { setShowPickReveal(v); persist("dr:pickReveal", v); }}
              />

              <SettingsToggleRow
                label="Pos Menu (bottom bar)"
                description="Swap ticker for board nav buttons"
                value={tickerMode === "nav"}
                onChange={(v) => { const m = v ? "nav" : "ticker"; setTickerMode(m); persist("dr:tickerMode", m); }}
              />

              {/* Player Name Size */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0 pr-4">
                  <p className="text-sm font-semibold text-white">Player Name Size</p>
                  <p className="text-[11px] text-slate-500">Last name on player cards</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => setPlayerNameSize((s) => { const n = Math.max(1, s - 1); persist("dr:playerNameSize", n); return n; })}
                    className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-30"
                    disabled={playerNameSize <= 1}>
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M2 3.5l3 3 3-3"/></svg>
                  </button>
                  <button type="button" onClick={() => setPlayerNameSize((s) => { const n = Math.min(10, s + 1); persist("dr:playerNameSize", n); return n; })}
                    className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-30"
                    disabled={playerNameSize >= 10}>
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M2 6.5l3-3 3 3"/></svg>
                  </button>
                </div>
              </div>

              {/* AUDIO */}
              <div className="px-4 pb-0.5 pt-4">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Audio</span>
              </div>

              <SettingsToggleRow
                label="Pick Announcer"
                description="Read each pick aloud after it's made"
                value={announcePickEnabled}
                onChange={(v) => { setAnnouncePickEnabled(v); persist("dr:announcer", v); }}
              />

              <SettingsToggleRow
                label="Clock Sound"
                description="Tick at 7s, buzzer at zero"
                value={clockSoundEnabled}
                onChange={(v) => { setClockSoundEnabled(v); persist("dr:clockSound", v); }}
              />

              <SettingsToggleRow
                label="Walk-up Music"
                description="Auto-play team songs when on the clock"
                value={walkUpMusicEnabled}
                onChange={(v) => { setWalkUpMusicEnabled(v); persist("dr:walkUpMusic", v); }}
              />

              {/* LEAGUE */}
              <div className="px-4 pb-0.5 pt-4">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">League</span>
              </div>

              {leagueSlug && isCommissioner && (
                <a href={`/teams?draftId=${draftId}&tab=settings&fromDraft=1${leagueSlug ? `&leagueSlug=${leagueSlug}` : ""}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                  onClick={() => setShowSettings(false)}>
                  Draft Settings
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 text-slate-600"><path d="M2 6h8M6 2l4 4-4 4"/></svg>
                </a>
              )}

              <button type="button"
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => {
                  const csv = createDraftResultsCsv(snapshot.teams, snapshot.picks);
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${snapshot.draft.name.replace(/\s+/g, "-")}-results.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                Draft Reports
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 text-slate-600"><path d="M6 1v7M3 6l3 3 3-3M2 11h8"/></svg>
              </button>

              {/* back / exit */}
              <div className="border-t border-white/5 mt-1">
                {leagueSlug ? (
                  <a href={`/leagues/${leagueSlug}`}
                    className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white">
                    Back to League
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 text-slate-600"><path d="M8 2H4a2 2 0 00-2 2v4a2 2 0 002 2h4M7 4l2 2-2 2M9 6H5"/></svg>
                  </a>
                ) : (
                  <a href="/dashboard"
                    className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white">
                    Leave Draft
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 text-slate-600"><path d="M8 2H4a2 2 0 00-2 2v4a2 2 0 002 2h4M7 4l2 2-2 2M9 6H5"/></svg>
                  </a>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function PlayerSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full opacity-20" aria-hidden="true">
      {/* Head */}
      <ellipse cx="24" cy="16" rx="10" ry="11" fill={color}/>
      {/* Shoulders / body */}
      <path d="M4 72 C4 48 10 40 24 38 C38 40 44 48 44 72Z" fill={color}/>
    </svg>
  );
}

function SettingsToggleRow({
  label, description, value, onChange,
}: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button"
      className="flex w-full items-start justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
      onClick={() => onChange(!value)}>
      <div className="min-w-0 pr-4">
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        <p className="text-[11px] text-slate-600">{description}</p>
      </div>
      {/* Toggle pill */}
      <div className={`relative mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${value ? "bg-teal-500" : "bg-slate-700"}`}>
        <span className={`absolute h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
      </div>
    </button>
  );
}

// ── Inline board views ──────────────────────────────────────────────────────

const POSITION_COLORS: Record<string, string> = {
  QB: "#67E8F9", RB: "#FCD34D", WR: "#F97316",
  TE: "#A78BFA", K: "#4ADE80", DST: "#F87171",
};

const DEFAULT_POSITION_ACCENTS: Record<string, string> = {
  QB: "#67E8F9", RB: "#FCD34D", WR: "#FB923C",
  TE: "#A78BFA", K: "#4ADE80", DST: "#FCA5A5",
};

// Position sort priority (standard draft value order)
const POS_ORDER: Record<string, number> = { RB: 0, WR: 1, QB: 2, TE: 3, K: 4, DST: 5 };

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) return { first: "", last: parts[0] };
  // If the last part is a suffix (Jr., III, etc.), keep it with the surname before it
  const last = parts[parts.length - 1];
  if (parts.length >= 3 && NAME_SUFFIXES.has(last.toLowerCase().replace(".", ""))) {
    return { first: parts.slice(0, -2).join(" "), last: parts.slice(-2).join(" ") };
  }
  return { first: parts.slice(0, -1).join(" "), last };
}

const NAME_SIZE_REM = [0.8, 1.0, 1.25, 1.5, 1.75, 2.0, 2.35, 2.75, 3.2, 3.75];

function PlayerListView({
  players, search, onSearchChange, posFilter, onPosFilterChange,
  enabledPositions, playerNameSize = 6, canPick, pickingPlayerId, queue, stagedPlayerId, byeWeeks, onCardClick, posColorMap,
}: {
  players: Player[];
  search: string;
  onSearchChange: (s: string) => void;
  posFilter: string;
  onPosFilterChange: (pos: string) => void;
  enabledPositions: string[];
  playerNameSize?: number;
  canPick: boolean;
  pickingPlayerId: string | null;
  queue: string[];
  stagedPlayerId: string | null;
  byeWeeks: Map<string, number>;
  onCardClick: (id: string, rect: DOMRect) => void;
  posColorMap: Map<string, import("@/lib/positionColors").PositionCellColors>;
}) {
  const [sort, setSort] = useState<"rank" | "name" | "position">("rank");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const hasRankings = players.some((p) => p.rank != null);
  function getCard(position: string) {
    return posColorMap.get(position) ?? positionCellColors(DEFAULT_POSITION_ACCENTS[position] ?? "#94A3B8");
  }

  const positions = ["ALL", ...enabledPositions];
  const q = search.trim().toLowerCase();

  const visible = players
    .filter((p) => {
      if (posFilter !== "ALL" && p.position !== posFilter) return false;
      if (!q) return true;
      return [p.fullName, p.position, p.nflTeam ?? ""].join(" ").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === "rank") {
        if (a.rank != null && b.rank != null) return a.rank - b.rank;
        if (a.rank != null) return -1;
        if (b.rank != null) return 1;
        return (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9);
      }
      if (sort === "name") return a.fullName.localeCompare(b.fullName);
      return (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9);
    });

  return (
    <div className="flex h-full flex-col">
      {/* Filter / sort bar */}
      <div className="shrink-0 flex items-center gap-2 border-b border-white/5 bg-slate-950/80 px-3 py-2">
        {/* Position pills */}
        <div className="flex gap-1 overflow-x-auto">
          {positions.map((pos) => {
            const card = pos !== "ALL" ? getCard(pos) : null;
            return (
              <button key={pos} type="button"
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  posFilter === pos
                    ? "border-white/30 bg-white text-slate-950"
                    : "border-white/5 bg-white/5 hover:bg-white/10 hover:text-white"
                }`}
                style={posFilter !== pos && card ? { color: card.sub } : {}}
                onClick={() => onPosFilterChange(pos)}>
                {pos === "ALL" ? "All" : pos}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Sort dropdown */}
        <div className="relative">
          <button type="button"
            className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-400 hover:bg-white/10 transition-colors"
            onClick={() => setShowSortMenu((v) => !v)}>
            {sort === "rank" ? "By Rank" : sort === "name" ? "By Name" : "By Position"}
            <svg viewBox="0 0 8 5" fill="currentColor" className="h-2 w-2"><path d="M0 0l4 5 4-5z"/></svg>
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-xl">
                {(["rank", "name", "position"] as const).map((s) => (
                  <button key={s} type="button"
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${sort === s ? "bg-white/10 font-semibold text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                    onClick={() => { setSort(s); setShowSortMenu(false); }}>
                    {s === "rank" ? "By Rank" : s === "name" ? "By Name" : "By Position"}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <span className="shrink-0 text-[10px] text-slate-700">{visible.length} available</span>
      </div>

      {/* Rankings notice */}
      {!hasRankings && (
        <div className="shrink-0 border-b border-white/5 bg-amber-950/20 px-4 py-1.5">
          <p className="text-[11px] text-amber-600">Rankings not imported — showing players by position group. Import rankings via the league settings to enable rank ordering.</p>
        </div>
      )}

      {/* Card grid — edge-to-edge, no gaps, FanDraft style */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-600">No players match your filter.</p>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: "1px", backgroundColor: "#0f172a" }}>
            {visible.slice(0, 300).map((p) => {
              const { first, last } = splitName(p.fullName);
              const card = getCard(p.position);
              const isPicking = pickingPlayerId === p.id;
              const isStaged = stagedPlayerId === p.id;
              const queueIdx = queue.indexOf(p.id);
              const isQueued = queueIdx !== -1;
              const isClickable = !pickingPlayerId;
              const byeWeek = p.nflTeam ? (byeWeeks.get(p.nflTeam) ?? null) : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isPicking}
                  onClick={(e) => {
                    if (!isClickable) return;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    onCardClick(p.id, rect);
                  }}
                  style={{ backgroundColor: card.bg }}
                  className={`group relative overflow-hidden text-left transition-all duration-100 ${
                    isStaged ? "brightness-125 ring-2 ring-inset ring-white/50"
                    : isQueued ? "ring-2 ring-inset ring-white/40"
                    : ""
                  } ${isClickable ? "cursor-pointer hover:brightness-110 active:brightness-90" : "cursor-default opacity-40"}`}
                >
                  {/* Queue badge */}
                  {isQueued && !isStaged && (
                    <span className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/40 text-[9px] font-black text-white">
                      {queueIdx + 1}
                    </span>
                  )}
                  {/* Staged badge */}
                  {isStaged && (
                    <span className="absolute right-1 top-1 z-10 rounded bg-black/30 px-1 py-0.5 text-[8px] font-black uppercase text-white">
                      ★
                    </span>
                  )}

                  {/* Card body — matches DraftBoard cell layout */}
                  <div className="px-1.5 pt-1.5 pb-2">
                    {/* Row 1: first name · rank team pos */}
                    <div className="flex items-center justify-between gap-1 leading-none mb-0.5">
                      <span className="truncate text-[10px] font-semibold uppercase leading-none" style={{ color: card.sub, opacity: 0.7 }}>
                        {first}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold leading-none whitespace-nowrap" style={{ color: card.sub, opacity: 0.75 }}>
                        {byeWeek && <span className="mr-0.5">{byeWeek}</span>}
                        <span>{p.nflTeam ?? "FA"}</span>
                        <span className="font-black ml-0.5">{p.position}</span>
                      </span>
                    </div>
                    {/* Row 2: LAST NAME */}
                    <p className="truncate font-black leading-tight tracking-tight" style={{ color: card.text, fontSize: `${NAME_SIZE_REM[playerNameSize - 1]}rem` }}>
                      {last}
                    </p>
                  </div>

                  {isPicking && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function playApplause() {
  const audio = new Audio("/sounds/dragon-studio-crowd-cheer-406646.mp3");
  audio.volume = 0.7;
  audio.play().catch(() => {});
}

function playBoo() {
  const audio = new Audio("/sounds/bad-pick.mp3");
  audio.volume = 0.7;
  audio.addEventListener("loadedmetadata", () => {
    setTimeout(() => audio.pause(), (audio.duration - 0.2) * 1000);
  });
  audio.play().catch(() => {});
}

function EditPickModal({
  pick, teams, allPlayers, draftedPlayerIds, draftId, onClose, onSaved,
}: {
  pick: DraftPick;
  teams: Team[];
  allPlayers: Player[];
  draftedPlayerIds: Set<string>;
  draftId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [teamId, setTeamId] = useState(pick.teamId);
  const [search, setSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState(pick.playerId);
  const [selectedPlayerName, setSelectedPlayerName] = useState(pick.playerName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = search.trim()
    ? allPlayers.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.fullName.toLowerCase().includes(q) ||
          p.position?.toLowerCase().includes(q) ||
          p.nflTeam?.toLowerCase().includes(q)
        );
      }).slice(0, 12)
    : [];

  async function handleSubmit() {
    setIsSaving(true);
    setError("");
    try {
      const changedTeam = teamId !== pick.teamId ? teamId : undefined;
      await commissionerEditPick(draftId, pick.overallPickNumber, selectedPlayerId, changedTeam);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update pick");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedTeam = teams.find((t) => t.id === teamId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg rounded-2xl bg-slate-950 border border-white/10 shadow-2xl overflow-hidden mx-4">
        {/* Header */}
        <div className="border-b border-white/8 bg-black/40 px-6 py-4">
          <h2 className="font-black text-white">
            Edit Pick{" "}
            <span className="text-teal-400">Round {pick.round} | Pick {pick.pickNumber}</span>
          </h2>
        </div>

        <div className="p-6 space-y-5">
          {/* Team selector */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Team</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Player search */}
          <div className="relative">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Player</label>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0 text-slate-500">
                <circle cx="6.5" cy="6.5" r="4"/><path d="m10.5 10.5 3 3"/>
              </svg>
              <input
                type="text"
                value={search || selectedPlayerName}
                onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setSelectedPlayerName(pick.playerName); }}
                onFocus={(e) => { setSearch(e.target.value === selectedPlayerName ? "" : e.target.value); }}
                placeholder="Search players…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); setSelectedPlayerName(pick.playerName); setSelectedPlayerId(pick.playerId); }}
                  className="text-slate-500 hover:text-white">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L8 6.586l2.293-2.293a1 1 0 1 1 1.414 1.414L9.414 8l2.293 2.293a1 1 0 0 1-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L6.586 8 4.293 5.707a1 1 0 0 1 0-1.414z" clipRule="evenodd"/></svg>
                </button>
              )}
            </div>

            {/* Dropdown results */}
            {search && filtered.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-slate-900 shadow-xl">
                {filtered.map((p) => {
                  const isDrafted = draftedPlayerIds.has(p.id) && p.id !== pick.playerId;
                  return (
                    <button key={p.id} type="button" disabled={isDrafted}
                      onClick={() => { setSelectedPlayerId(p.id); setSelectedPlayerName(p.fullName); setSearch(""); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed">
                      <span className="text-sm font-semibold text-white">{p.fullName}</span>
                      <span className="ml-auto shrink-0 text-xs text-slate-500">{p.position} · {p.nflTeam}</span>
                      {isDrafted && <span className="text-[10px] text-slate-600">Drafted</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-white/8 bg-black/40 px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSaving || !selectedPlayerId}
            className="rounded-lg bg-teal-500 px-5 py-2 text-sm font-black uppercase tracking-wider text-black hover:bg-teal-400 disabled:opacity-50 transition-colors">
            {isSaving ? "Saving…" : "Submit Pick Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

const RECAP_POSITION_COLORS: Record<string, string> = {
  QB: "#ef4444", RB: "#22c55e", WR: "#3b82f6", TE: "#f97316", K: "#a855f7", DST: "#64748b",
};

function PickCard({ pick, team, label, accent }: { pick: DraftPick; team: Team | undefined; label: string; accent: string }) {
  const posColor = RECAP_POSITION_COLORS[pick.playerPosition] ?? "#94a3b8";
  return (
    <div className="flex-1 rounded-xl border p-4" style={{ borderColor: accent + "50", backgroundColor: accent + "15" }}>
      <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: accent }}>{label}</p>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
          {team?.logoUrl
            ? <img src={team.logoUrl} alt={team.name} className="h-10 w-10 rounded-full object-cover" />
            : <span className="text-xs font-black text-slate-400">{team?.name?.slice(0,2).toUpperCase() ?? "?"}</span>
          }
        </div>
        <div>
          <p className="text-xl font-black uppercase leading-tight text-white">{pick.playerName}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: posColor }}>
              {pick.playerPosition}
            </span>
            {pick.nflTeam && <span className="text-xs font-bold text-slate-400">{pick.nflTeam}</span>}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {team?.name ?? "Unknown"} • RND {pick.round}, PK {pick.pickNumber}
          </p>
        </div>
      </div>
    </div>
  );
}

function RoundRecapModal({
  round, totalRounds, picks, teams, espnRankMap, nextTeam, suppressRecap, onToggleSuppress, onResume,
}: {
  round: number;
  totalRounds: number;
  picks: DraftPick[];
  teams: Team[];
  espnRankMap: Map<string, number>;
  nextTeam: Team | null;
  suppressRecap: boolean;
  onToggleSuppress: () => void;
  onResume: () => void;
}) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // Unranked players get the worst possible rank — if you draft someone ESPN didn't rank, you deserve to be ridiculed
  const UNRANKED_PENALTY = 99999;
  const scoredPicks = picks.map((p) => {
    const rank = espnRankMap.get(p.playerId) ?? UNRANKED_PENALTY;
    return { pick: p, score: p.overallPickNumber - rank };
  });

  const bestPick = scoredPicks.length
    ? scoredPicks.reduce((a, b) => (b.score > a.score ? b : a))
    : null;
  const worstPick = scoredPicks.length
    ? scoredPicks.reduce((a, b) => (b.score < a.score ? b : a))
    : null;
  const lastPick = picks[picks.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-950 border border-white/10 shadow-2xl overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-lg font-black uppercase tracking-wider text-white">
            End of Round{" "}
            <span className="mx-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-sm font-black text-black">{round}</span>
            {" "}Recap
          </h2>
          <button type="button" onClick={onResume}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>

        {/* Best / Worst */}
        <div className="flex gap-4 p-4">
          {bestPick && <PickCard pick={bestPick.pick} team={teamMap.get(bestPick.pick.teamId)} label="Best Pick of the Round" accent="#22c55e" />}
          {worstPick && worstPick.pick.id !== bestPick?.pick.id && (
            <PickCard pick={worstPick.pick} team={teamMap.get(worstPick.pick.teamId)} label="Worst Pick of the Round" accent="#ef4444" />
          )}
        </div>

        {/* Last pick + next on clock */}
        {lastPick && (
          <div className="flex items-center justify-between border-t border-white/5 bg-white/3 px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-slate-700 shrink-0 flex items-center justify-center">
                {teamMap.get(lastPick.teamId)?.logoUrl
                  ? <img src={teamMap.get(lastPick.teamId)!.logoUrl!} alt="" className="h-8 w-8 rounded-full object-cover" />
                  : <span className="text-[10px] font-black text-slate-400">{teamMap.get(lastPick.teamId)?.name?.slice(0,2).toUpperCase()}</span>
                }
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Previous Pick</p>
                <p className="text-sm text-slate-400">{teamMap.get(lastPick.teamId)?.name ?? "?"} selected</p>
                <p className="font-black text-white">{lastPick.playerName}{" "}
                  <span className="rounded px-1 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: POSITION_COLORS[lastPick.playerPosition] ?? "#64748b" }}>
                    {lastPick.playerPosition}
                  </span>
                  {lastPick.nflTeam && <span className="ml-1 font-bold text-slate-400">{lastPick.nflTeam}</span>}
                </p>
              </div>
            </div>
            {nextTeam && round < totalRounds && (
              <div className="flex items-center gap-3 text-right">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">On the Clock</p>
                  <p className="font-black text-white">{nextTeam.name}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-slate-700 shrink-0 flex items-center justify-center">
                  {nextTeam.logoUrl
                    ? <img src={nextTeam.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    : <span className="text-[10px] font-black text-slate-400">{nextTeam.name.slice(0,2).toUpperCase()}</span>
                  }
                </div>
              </div>
            )}
          </div>
        )}

        <p className="px-6 py-2 text-[10px] uppercase tracking-wider text-slate-600">
          Best/worst picks are decided based on optimal value in spot taken compared with player rankings
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/8 bg-black/40 px-6 py-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400 select-none">
            <input type="checkbox" checked={suppressRecap} onChange={onToggleSuppress}
              className="h-4 w-4 rounded accent-teal-500" />
            Turn off &ldquo;End of Round Break&rdquo; for remainder of draft
          </label>
          <button type="button" onClick={onResume}
            className="rounded-lg bg-white px-5 py-2 text-sm font-black text-black hover:bg-slate-200 transition-colors">
            Resume Draft
          </button>
        </div>
      </div>
    </div>
  );
}

function PickRevealModal({
  pick, teams, draftName, leagueLogoUrl, playerHeadshotUrl, canUndo, onUndo, onClose, sfx1Url, sfx2Url, posReactions, negReactions,
}: {
  pick: DraftPick;
  teams: Team[];
  draftName: string;
  leagueLogoUrl?: string;
  playerHeadshotUrl?: string;
  canUndo: boolean;
  onUndo: () => void;
  onClose: () => void;
  sfx1Url?: string | null;
  sfx2Url?: string | null;
  posReactions?: string[] | null;
  negReactions?: string[] | null;
}) {
  const team = teams.find((t) => t.id === pick.teamId);
  const card = positionCellColors(DEFAULT_POSITION_ACCENTS[pick.playerPosition] ?? "#94A3B8");
  const { first, last } = splitName(pick.playerName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ maxWidth: 720 }}>

        {/* Top accent bar */}
        <div className="flex items-center justify-between px-6 py-2.5" style={{ background: `linear-gradient(90deg, ${card.sub}40, transparent)`, borderBottom: `2px solid ${card.sub}50` }}>
          <div className="flex items-center gap-2">
            {leagueLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={leagueLogoUrl} alt="League" className="h-5 w-5 rounded-full object-cover opacity-70 ring-1 ring-white/20" />
            )}
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">{draftName}</span>
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: card.sub }}>Selection Has Been Made</span>
        </div>

        {/* Main section */}
        <div className="relative flex items-stretch bg-slate-950" style={{ minHeight: 220 }}>
          {/* Left — player info */}
          <div className="flex flex-1 flex-col justify-center px-8 py-8">
            <p className="mb-1 text-xs font-black uppercase tracking-[0.25em]" style={{ color: card.sub }}>Selected</p>
            <div className="leading-none">
              <p className="text-3xl font-black uppercase text-white/80 leading-tight">{first}</p>
              <p className="text-6xl font-black uppercase text-white leading-none tracking-tight">{last}</p>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <span className="rounded-lg px-3 py-1.5 text-sm font-black text-slate-950" style={{ backgroundColor: card.sub }}>{pick.playerPosition}</span>
              <span className="rounded-lg border border-white/15 bg-white/8 px-3 py-1.5 text-sm font-bold text-slate-300">{pick.nflTeam ?? "FA"}</span>
            </div>
          </div>

          {/* Right — player image slot + team logo */}
          <div className="relative flex w-56 shrink-0 items-end justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, transparent 30%, ${card.sub}20 100%)` }}>
            {/* Drafting team logo — upper-right, the primary identity during reveal */}
            {team && (
              <div className="absolute right-3 top-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-slate-900/80" style={{ boxShadow: `0 0 0 2px ${card.sub}40, 0 8px 32px rgba(0,0,0,0.5)` }}>
                {team.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={team.logoUrl} alt={team.name} className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="text-2xl font-black text-white">{team.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
            )}
            {playerHeadshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={playerHeadshotUrl}
                alt={pick.playerName}
                className="h-full w-full object-contain object-bottom"
              />
            ) : (
              <svg viewBox="0 0 96 144" fill="none" className="h-full w-full opacity-15" aria-hidden="true">
                <ellipse cx="48" cy="36" rx="22" ry="24" fill={card.sub}/>
                <path d="M6 144 C6 96 18 80 48 76 C78 80 90 96 90 144Z" fill={card.sub}/>
              </svg>
            )}
          </div>
        </div>

        {/* Team section */}
        <div className="flex items-center gap-5 border-t border-white/8 bg-slate-900/70 px-8 py-5">
          {/* Team avatar */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/8 p-1 text-xl font-black text-white">
            {team?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logoUrl} alt={`${team.name} logo`} className="h-full w-full object-contain" />
            ) : (
              team?.name?.charAt(0).toUpperCase() ?? "?"
            )}
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-black uppercase tracking-tight text-white">{team?.name ?? "—"}</p>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Round {pick.round} · Pick {pick.pickNumber}
            </p>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">Overall</p>
            <p className="text-3xl font-black text-slate-400">#{pick.overallPickNumber}</p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-white/5 bg-black/40 px-6 py-3">
          {/* Reaction sound buttons */}
          <div className="flex items-center gap-2">
            <button type="button" title="Applause"
              onClick={() => {
                playApplause();
                if (posReactions?.length) {
                  const phrase = posReactions[Math.floor(Math.random() * posReactions.length)];
                  const utt = new SpeechSynthesisUtterance(phrase);
                  window.speechSynthesis?.cancel();
                  window.speechSynthesis?.speak(utt);
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 bg-white/5 text-lg hover:bg-white/10 transition-colors">
              😄
            </button>
            <button type="button" title="Boo"
              onClick={() => {
                playBoo();
                if (negReactions?.length) {
                  const phrase = negReactions[Math.floor(Math.random() * negReactions.length)];
                  const utt = new SpeechSynthesisUtterance(phrase);
                  window.speechSynthesis?.cancel();
                  window.speechSynthesis?.speak(utt);
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 bg-white/5 text-lg hover:bg-white/10 transition-colors">
              😤
            </button>
            <span className="mx-1 h-5 w-px bg-white/10" />
            {([{ label: "SFX 1", url: sfx1Url }, { label: "SFX 2", url: sfx2Url }]).map(({ label, url }) => (
              <button key={label} type="button" title={url ? label : "No sound configured"}
                disabled={!url}
                onClick={() => { if (url) { const a = new Audio(url); a.volume = 0.7; a.play().catch(() => {}); } }}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                  url
                    ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                    : "border-white/5 bg-white/5 text-slate-700 opacity-40 cursor-not-allowed"
                }`}>
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3"><path d="M5 2.5a2.5 2.5 0 110 7M8 4a4 4 0 010 4"/></svg>
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {canUndo && (
              <button type="button"
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-5 py-2.5 text-sm font-black uppercase tracking-wider text-white hover:bg-white/15 transition-colors"
                onClick={onUndo}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M3 7l-3 3 3 3"/><path d="M0 10h9a4 4 0 000-8H6"/>
                </svg>
                Undo Pick
              </button>
            )}
            <button type="button"
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black uppercase tracking-wider text-slate-950 transition-opacity hover:opacity-90"
              style={{ backgroundColor: card.sub }}
              onClick={onClose}>
              Next Pick
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ROUND_POS_COLORS: Record<string, string> = {
  QB: "#38bdf8", RB: "#fbbf24", WR: "#fb923c",
  TE: "#a78bfa", K: "#4ade80", DST: "#f87171",
};

function RoundSummaryView({
  draftId, teams, picks, players, currentPickNumber, rounds, byeWeeks, isCommissioner, onUndoPick,
}: {
  draftId: string;
  teams: Team[];
  picks: DraftPick[];
  players: Player[];
  currentPickNumber: number;
  rounds: number;
  byeWeeks?: Map<string, number>;
  isCommissioner: boolean;
  onUndoPick: () => void;
}) {
  const currentRound = getRoundForPick(currentPickNumber, teams.length);
  const [viewRound, setViewRound] = useState(currentRound);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editSearch, setEditSearch] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const pickedPlayerIds = new Set(picks.map((p) => p.playerId));
  const slots = generateSnakeDraftOrder(teams, rounds).filter((s) => s.round === viewRound);
  const orderedSlots = slots.sort((a, b) => a.overallPickNumber - b.overallPickNumber);

  const editResults = editSearch.trim().length > 1
    ? players
        .filter((p) => !pickedPlayerIds.has(p.id) && p.fullName.toLowerCase().includes(editSearch.toLowerCase()))
        .slice(0, 8)
    : [];

  async function handleEditConfirm(overallPickNumber: number, newPlayerId: string) {
    setIsSaving(true);
    setEditError("");
    try {
      await commissionerEditPick(draftId, overallPickNumber, newPlayerId);
      setEditingSlot(null);
      setEditSearch("");
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update pick.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Round selector tabs */}
      <div className="shrink-0 flex items-center gap-1 overflow-x-auto border-b border-white/5 bg-slate-950/80 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setViewRound(r)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              viewRound === r ? "bg-white text-slate-950" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Round {r}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-slate-950">
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 w-10">#</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Team</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Player</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Position</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Bye Wk</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Pick</th>
              {isCommissioner && (
                <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-500">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {orderedSlots.map((slot, idx) => {
              const pick = picks.find((p) => p.overallPickNumber === slot.overallPickNumber);
              const posColor = pick ? (ROUND_POS_COLORS[pick.playerPosition] ?? "#94a3b8") : null;
              const byeWeek = pick?.nflTeam ? (byeWeeks?.get(pick.nflTeam) ?? null) : null;
              const isEven = idx % 2 === 1;
              const isEditing = editingSlot === slot.overallPickNumber;

              return (
                <tr
                  key={slot.overallPickNumber}
                  className="border-b border-white/5"
                  style={{ backgroundColor: isEditing ? "rgba(20,184,166,0.06)" : isEven ? "rgba(255,255,255,0.02)" : "transparent" }}
                >
                  <td className="px-4 py-3 text-xs font-bold text-slate-600">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-300">{slot.teamName}</td>
                  <td className="px-4 py-3 font-semibold text-white">
                    {isEditing ? (
                      <div className="relative">
                        <input
                          autoFocus
                          type="text"
                          value={editSearch}
                          onChange={(e) => setEditSearch(e.target.value)}
                          placeholder="Search player…"
                          className="w-full rounded-lg border border-teal-500/40 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-500"
                        />
                        {editResults.length > 0 && (
                          <div className="absolute top-full left-0 z-50 mt-1 w-72 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                            {editResults.map((p) => {
                              const pc = ROUND_POS_COLORS[p.position] ?? "#94a3b8";
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleEditConfirm(slot.overallPickNumber, p.id)}
                                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/5 disabled:opacity-50"
                                >
                                  <span className="text-sm font-semibold text-white">{p.fullName}</span>
                                  <span className="text-xs font-black ml-2" style={{ color: pc }}>{p.position}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {editError && <p className="mt-1 text-xs text-red-400">{editError}</p>}
                      </div>
                    ) : pick ? pick.playerName : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {pick && !isEditing ? (
                      <span className="rounded px-2 py-0.5 text-xs font-black" style={{ color: posColor ?? "#94a3b8", backgroundColor: `${posColor}18` }}>
                        {pick.playerPosition}
                      </span>
                    ) : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {!isEditing && (byeWeek ?? <span className="text-slate-700">—</span>)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-bold">
                    {viewRound}.{idx + 1}
                  </td>
                  {isCommissioner && (
                    <td className="px-4 py-3 text-right">
                      {pick && (
                        isEditing ? (
                          <button
                            type="button"
                            onClick={() => { setEditingSlot(null); setEditSearch(""); setEditError(""); }}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-400 transition-colors hover:bg-white/10"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingSlot(slot.overallPickNumber); setEditSearch(""); setEditError(""); }}
                            className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-black text-teal-400 transition-colors hover:bg-teal-500/20"
                          >
                            Edit
                          </button>
                        )
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RosterBoardView({ teams, picks }: { teams: Team[]; picks: DraftPick[] }) {
  const picksByTeam = new Map(teams.map((t) => [t.id, picks.filter((p) => p.teamId === t.id).sort((a, b) => a.round - b.round)]));
  return (
    <div className="overflow-x-auto p-3">
      <div className="flex gap-3" style={{ minWidth: `${teams.length * 160}px` }}>
        {teams.map((team) => {
          const roster = picksByTeam.get(team.id) ?? [];
          return (
            <div key={team.id} className="w-40 shrink-0 rounded-xl border border-white/8 bg-slate-900/60 overflow-hidden">
              <div className="border-b border-white/8 px-3 py-2">
                <p className="truncate text-xs font-black uppercase tracking-wide text-slate-200">{team.name}</p>
                <p className="text-[10px] text-slate-600">{roster.length} picks</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {roster.map((pick) => (
                  <div key={pick.id} className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold" style={{ color: POSITION_COLORS[pick.playerPosition] ?? "#94a3b8" }}>{pick.playerPosition}</span>
                      <span className="text-[10px] text-slate-600">Rd {pick.round}</span>
                    </div>
                    <p className="truncate text-xs font-semibold text-white">{pick.playerName}</p>
                    <p className="text-[10px] text-slate-600">{pick.nflTeam ?? "FA"}</p>
                  </div>
                ))}
                {roster.length === 0 && <p className="px-3 py-3 text-[11px] text-slate-700">No picks yet</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
