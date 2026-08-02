"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WalkUpPlayer, { type WalkUpPlayerHandle } from "@/components/WalkUpPlayer";
import { computeDraftAwards, computeTeamGrades, type DraftAward } from "@/lib/draftAwards";
import type { Pick, Team, WalkUpSong } from "@/types/draft";

// Full-screen end-of-draft awards ceremony. Each award gets its own screen:
// a teaser (name + tagline), then the winner reveal — advancing on click or
// auto-timer. Awards are computed deterministically from pick data so every
// device shows the same winners.

interface DraftAwardsCeremonyProps {
  picks: Pick[];
  teams: Team[];
  rankMap: Map<string, number>;
  draftName: string;
  accentColor: string | null;
  /** Commissioner-chosen ceremony song; null = the built-in default track */
  awardsSong: WalkUpSong | null;
  /** Mirrors the draft room's music volume slider (0-100) */
  musicVolume: number;
  leagueLogoUrl?: string;
  onClose: () => void;
}

const CONFETTI_COLORS = ["#14b8a6", "#f59e0b", "#6366f1", "#ef4444", "#10b981", "#f97316"];
const DEFAULT_AWARDS_TRACK = "/sounds/awards.mp3";

const TEASE_MS = 3_400;
const REVEAL_MS = 7_000;
const INTRO_MS = 3_400;

type Slide =
  | { type: "intro" }
  | { type: "award"; award: DraftAward; index: number }
  | { type: "finale" };

/** Letter-grade chip colouring: A green, B blue, C amber, D red */
function gradeStyle(grade: string): React.CSSProperties {
  const letter = grade[0];
  const palette: Record<string, [string, string]> = {
    A: ["#10b98122", "#34d399"],
    B: ["#3b82f622", "#60a5fa"],
    C: ["#f59e0b22", "#fbbf24"],
    D: ["#ef444422", "#f87171"],
  };
  const [bg, fg] = palette[letter] ?? ["#94a3b822", "#cbd5e1"];
  return { backgroundColor: bg, color: fg };
}

/** Small "AWARD 03 / 08" plate that gives the ceremony a sense of progression */
function AwardPlate({ index, total, accent }: { index: number; total: number; accent: string }) {
  return (
    <span
      className="inline-block rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] sm:text-xs"
      style={{ borderColor: `${accent}40`, color: `${accent}cc` }}
    >
      Award {String(index + 1).padStart(2, "0")} <span className="opacity-50">/ {String(total).padStart(2, "0")}</span>
    </span>
  );
}

function WinnerPanel({
  award, accent, index, total,
}: { award: DraftAward; accent: string; index: number; total: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <AwardPlate index={index} total={total} accent={accent} />
      <p
        className="mt-4 text-2xl font-black uppercase leading-tight tracking-[0.14em] sm:text-4xl"
        style={{ color: accent }}
      >
        {award.title}
      </p>
      <div className="relative mt-6 h-40 w-40 sm:h-56 sm:w-56">
        <div
          className="absolute rounded-full animate-pulse"
          style={{ inset: -24, background: `radial-gradient(circle, ${accent}35 0%, transparent 70%)` }}
        />
        {award.teamLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={award.teamLogoUrl} alt="" className="relative h-full w-full object-contain drop-shadow-2xl" />
        ) : (
          <div
            className="relative flex h-full w-full items-center justify-center rounded-full text-5xl font-black text-white"
            style={{ backgroundColor: `${accent}20`, boxShadow: `0 0 0 3px ${accent}60` }}
          >
            {award.teamName.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      {/* Winner is the largest thing on screen. White, so the accent stays on
          the award title and the stat rather than becoming a wall of colour. */}
      <h2 className="mt-5 w-full break-words text-4xl font-black uppercase tracking-wide text-white sm:text-6xl">
        {award.teamName}
      </h2>
      {award.player && (
        <p className="mt-3 w-full break-words text-3xl font-black text-slate-200 sm:text-5xl">
          {award.player}
        </p>
      )}
      <p className="mt-3 text-xl font-black sm:text-3xl" style={{ color: accent }}>
        {award.headline}
      </p>
      <p className="mt-2 max-w-sm text-sm sm:text-base text-slate-400">{award.detail}</p>
    </div>
  );
}

export default function DraftAwardsCeremony({
  picks,
  teams,
  rankMap,
  draftName,
  accentColor,
  awardsSong,
  musicVolume,
  leagueLogoUrl,
  onClose,
}: DraftAwardsCeremonyProps) {
  const accent = accentColor ?? "#14b8a6";
  const playerRef = useRef<WalkUpPlayerHandle>(null);
  const allAwards = useMemo(() => computeDraftAwards(picks, teams, rankMap), [picks, teams, rankMap]);
  const teamGrades = useMemo(() => computeTeamGrades(picks, teams, rankMap), [picks, teams, rankMap]);
  // One award per screen — each gets its own tease and reveal.
  const slides = useMemo<Slide[]>(
    () => [
      { type: "intro" },
      ...allAwards.map((award, index): Slide => ({ type: "award", award, index })),
      { type: "finale" },
    ],
    [allAwards]
  );

  const [slideIndex, setSlideIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  // Set when the commissioner's custom song can't be played (blocked embed,
  // dead video, offline) — the built-in track takes over.
  const [fallbackToDefault, setFallbackToDefault] = useState(false);
  const musicStartedRef = useRef(false);
  const defaultAudioRef = useRef<HTMLAudioElement | null>(null);
  const slide = slides[Math.min(slideIndex, slides.length - 1)];

  function advance() {
    // Every advance is a chance to (re)start the music. If autoplay was
    // refused on open, the first click both moves the ceremony along and
    // satisfies the browser's gesture requirement.
    startCeremonyMusic();
    if (slide.type === "award" && !revealed) {
      setRevealed(true);
      return;
    }
    if (slideIndex < slides.length - 1) {
      setRevealed(false);
      setSlideIndex((i) => i + 1);
    }
  }

  // Auto-advance pacing (a click always skips ahead)
  useEffect(() => {
    if (slide.type === "finale") return;
    const ms = slide.type === "intro" ? INTRO_MS : revealed ? REVEAL_MS : TEASE_MS;
    const timer = window.setTimeout(advance, ms);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex, revealed, slide.type]);

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Ceremony music — commissioner's chosen song, or the built-in default.
  // The default track is a real <audio> element in the tree (below) rather
  // than a `new Audio()` we create and tear down: React owns its lifecycle, so
  // there is no create/destroy race to get wrong. Keyed on a stable string
  // because `snapshot.draft` is rebuilt on every realtime update — depending on
  // the song object's identity would stop and restart the track constantly.
  const songKey = awardsSong ? `${awardsSong.platform}:${awardsSong.trackId}` : "default";

  function playDefaultTrack() {
    const audio = defaultAudioRef.current;
    if (!audio) return;
    audio.volume = (muted ? 0 : musicVolume) / 100;
    if (!audio.paused) return;
    audio.play().then(() => setAudioBlocked(false)).catch((err: unknown) => {
      // An AbortError just means a newer play() superseded this one; anything
      // else is an autoplay refusal, recoverable via the Enable-audio button.
      if (!(err instanceof DOMException) || err.name !== "AbortError") setAudioBlocked(true);
    });
  }

  /** Safe to call repeatedly: it only ever starts music that isn't already
   * playing. Advancing a slide must never restart the track — WalkUpPlayer's
   * play() reloads the video from the top. */
  function startCeremonyMusic() {
    if (musicStartedRef.current) return;
    if (awardsSong && !fallbackToDefault) {
      playerRef.current?.setVolume(muted ? 0 : musicVolume);
      playerRef.current?.play(awardsSong);
      return;
    }
    playDefaultTrack();
  }

  useEffect(() => {
    musicStartedRef.current = false;
    startCeremonyMusic();
    if (!awardsSong) return () => { playerRef.current?.stop(); };
    // A custom song can be silently unavailable — a blocked YouTube embed
    // (ad blocker / tracking protection), a deleted video, no network. If
    // nothing is actually playing shortly after we ask, fall back to the
    // built-in track so the ceremony is never silent.
    const timer = window.setTimeout(() => {
      if (!musicStartedRef.current) setFallbackToDefault(true);
    }, 4_000);
    return () => {
      window.clearTimeout(timer);
      playerRef.current?.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songKey]);

  // Once we've given up on the custom song, start the built-in one
  useEffect(() => {
    if (fallbackToDefault) playDefaultTrack();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackToDefault]);

  // Mute and the draft room's volume slider apply to whichever source is playing
  useEffect(() => {
    const volume = muted ? 0 : musicVolume;
    playerRef.current?.setVolume(volume);
    if (defaultAudioRef.current) defaultAudioRef.current.volume = volume / 100;
  }, [muted, musicVolume]);

  const confetti = (count: number) =>
    Array.from({ length: count }, (_, i) => (
      <span
        key={i}
        aria-hidden
        className="pointer-events-none absolute top-0"
        style={{
          left: `${(i / (count - 1)) * 96 + 2}%`,
          width: i % 3 === 0 ? 10 : 7,
          height: i % 3 === 0 ? 10 : 7,
          borderRadius: i % 4 !== 0 ? "50%" : "2px",
          backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animation: `confetti-fall ${1.6 + (i % 5) * 0.28}s ${(i % 8) * 0.12}s linear forwards`,
        }}
      />
    ));

  return (
    <div
      className="fixed inset-0 z-[220] flex cursor-pointer flex-col overflow-hidden bg-slate-950"
      onClick={advance}
      style={{
        background: `radial-gradient(ellipse 70% 60% at 50% 30%, ${accent}14 0%, transparent 60%), linear-gradient(180deg, #020617 0%, #0a1122 100%)`,
      }}
    >
      {/* Built-in ceremony track — always in the tree so it can take over the
          moment a custom song turns out to be unplayable. autoPlay covers the
          normal case; the play() calls in advance() cover a browser that
          refuses autoplay until it sees a gesture. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={defaultAudioRef}
        src={DEFAULT_AWARDS_TRACK}
        loop
        autoPlay={!awardsSong}
        preload="auto"
        onPlaying={() => { musicStartedRef.current = true; setAudioBlocked(false); }}
      />
      {/* Custom song engine — dropped once we fall back, so a blocked embed
          can't keep retrying underneath the default track */}
      {awardsSong && !fallbackToDefault && (
        <WalkUpPlayer
          ref={playerRef}
          onPlaying={() => { musicStartedRef.current = true; setAudioBlocked(false); }}
          onPlaybackBlocked={() => setFallbackToDefault(true)}
          // The ceremony can outlast a short clip — loop it from the top
          onEnded={() => {
            musicStartedRef.current = false;
            playerRef.current?.play(awardsSong);
          }}
        />
      )}

      {/* Header — league identity persists across every slide */}
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {leagueLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={leagueLogoUrl} alt="League" className="h-9 w-9 rounded-full object-cover ring-1 ring-white/15" />
          )}
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-600">
            {draftName} · Draft Awards
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Autoplay refused — one tap starts the music */}
          {audioBlocked && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); startCeremonyMusic(); }}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              Enable audio
            </button>
          )}
          <button
            type="button"
            aria-label={muted ? "Unmute music" : "Mute music"}
            title={muted ? "Unmute music" : "Mute music"}
            onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-colors hover:bg-white/10 ${muted ? "text-red-400" : "text-slate-300"}`}
          >
            {muted ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd"/>
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10"
          >
            {slide.type === "finale" ? "Close" : "Skip"}
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 pb-16 sm:px-10">
        {/* Flanking league logos — frame every slide, lobby-style */}
        {leagueLogoUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={leagueLogoUrl}
              alt=""
              className="pointer-events-none absolute left-8 top-1/2 hidden h-48 w-48 -translate-y-1/2 object-contain opacity-40 drop-shadow-2xl lg:block xl:h-60 xl:w-60"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={leagueLogoUrl}
              alt=""
              className="pointer-events-none absolute right-8 top-1/2 hidden h-48 w-48 -translate-y-1/2 object-contain opacity-40 drop-shadow-2xl lg:block xl:h-60 xl:w-60"
            />
          </>
        )}
        {slide.type === "intro" && (
          <div className="text-center" style={{ animation: "lobby-team-in 0.4s ease-out" }}>
            <h1
              className="text-6xl font-black uppercase leading-none tracking-wide sm:text-8xl"
              style={{ color: accent, textShadow: `0 0 40px ${accent}50` }}
            >
              Draft Awards
            </h1>
            <p className="mt-4 text-sm sm:text-base font-semibold uppercase tracking-[0.25em] text-slate-500">
              {allAwards.length} awards · one night of glory
            </p>
          </div>
        )}

        {slide.type === "award" && (
          <div
            key={`${slideIndex}-${revealed}`}
            className="w-full max-w-6xl text-center"
            style={{ animation: "lobby-team-in 0.35s ease-out" }}
          >
            {!revealed ? (
              <>
                <AwardPlate index={slide.index} total={allAwards.length} accent={accent} />
                {/* No icon — the award name is the graphic */}
                <h2 className="mt-7 text-5xl font-black uppercase leading-none tracking-wide text-white sm:text-7xl">
                  {slide.award.title}
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-lg italic leading-relaxed text-slate-400 sm:text-xl">
                  {slide.award.tagline}
                </p>
                <p className="mt-10 text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-slate-600 animate-pulse">
                  And the award goes to…
                </p>
              </>
            ) : (
              <>
                {confetti(16)}
                <WinnerPanel
                  award={slide.award}
                  accent={accent}
                  index={slide.index}
                  total={allAwards.length}
                />
              </>
            )}
          </div>
        )}

        {slide.type === "finale" && (
          <div className="w-full max-w-6xl py-6" style={{ animation: "lobby-team-in 0.4s ease-out" }}>
            {confetti(24)}
            <h2 className="text-center text-4xl font-black uppercase tracking-wide text-white sm:text-5xl">
              That&apos;s a wrap
            </h2>
            <p className="mt-3 text-center text-sm sm:text-base text-slate-500">Good luck.</p>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              {/* Award winners */}
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.3em] text-slate-600">
                  Award Winners
                </p>
                <div className="space-y-2">
                  {allAwards.map((award, i) => (
                    <div key={award.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5">
                      <span className="w-6 shrink-0 text-right text-xs font-black tabular-nums" style={{ color: `${accent}99` }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="w-36 shrink-0 truncate text-[11px] font-black uppercase tracking-wider text-slate-500">
                        {award.title}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{award.teamName}</span>
                    </div>
                  ))}
                  {allAwards.length === 0 && (
                    <p className="text-sm text-slate-500">Not enough draft data for awards this time.</p>
                  )}
                </div>
              </div>

              {/* Draft grades — curved within the league */}
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.3em] text-slate-600">
                  Draft Grades
                </p>
                <div className="space-y-2">
                  {teamGrades.map((row) => (
                    <div key={row.teamId} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2">
                      {row.teamLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.teamLogoUrl} alt="" className="h-7 w-7 shrink-0 object-contain" />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-black text-slate-300">
                          {row.teamName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{row.teamName}</span>
                      {row.grade ? (
                        <>
                          <span className="shrink-0 text-[11px] tabular-nums text-slate-600">
                            {row.valuePerPick >= 0 ? "+" : ""}{row.valuePerPick.toFixed(1)}
                          </span>
                          <span
                            className="w-12 shrink-0 rounded-lg py-1 text-center text-sm font-black"
                            style={gradeStyle(row.grade)}
                          >
                            {row.grade}
                          </span>
                        </>
                      ) : (
                        <span className="w-12 shrink-0 text-center text-xs text-slate-600">—</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-snug text-slate-600">
                  Graded on a curve: average draft slot vs. each player&apos;s consensus rank.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5">
        {slides.map((s, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full transition-colors"
            style={{ backgroundColor: i === slideIndex ? accent : "rgba(148,163,184,0.25)" }}
          />
        ))}
      </div>

      {/* Tap hint */}
      {slide.type !== "finale" && (
        <p className="absolute bottom-5 right-6 text-[10px] text-slate-700">click to advance</p>
      )}
    </div>
  );
}
