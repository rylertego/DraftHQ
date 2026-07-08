"use client";

import { useEffect, useRef, useState } from "react";
import DraftHQLogo from "@/components/DraftHQLogo";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import type { Team } from "@/types/draft";

// Full-screen draft-order lottery, 100-yard-rush style: team logos sprint
// down a bright football field in random bursts ("rushes") and the order
// they cross the goal line becomes the draft order.
//
// The entire race — every rush of every team, and therefore the result — is
// simulated the moment Start is clicked. The animation only replays that
// precomputed schedule, so what the room watches can never disagree with
// what gets saved.

interface DraftOrderRaceProps {
  teams: Team[];
  isCommissioner: boolean;
  onLockIn: (orderedTeams: Team[]) => Promise<void> | void;
  onClose: () => void;
}

const AVATAR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6", "#f59e0b"];

// Field geometry (percent of container width)
const PLAY_START = 7; // goal line the racers start behind
const PLAY_END = 90;  // goal line they must fully cross

const YARD_MIN_OPTIONS = [1, 2, 3, 4, 5];
const YARD_MAX_OPTIONS = [6, 7, 8, 9, 10];
const SEC_MIN_OPTIONS = [1, 2, 3, 4];
const SEC_MAX_OPTIONS = [5, 6, 7, 8];

interface MoveLeg {
  /** when this leg's movement begins (ms from race start) */
  beginAtMs: number;
  /** CSS left target for this leg */
  left: string;
  /** how long the glide to the target takes — exactly the gap to the next
   * rush, so racers are always in motion, just at varying speeds */
  durMs: number;
}

interface RaceData {
  /** Final draft order — index 0 gets pick 1 */
  order: Team[];
  /** teamId → pick number (1-based) */
  placement: Map<string, number>;
  /** teamId → continuous movement legs to replay */
  schedule: Map<string, MoveLeg[]>;
  /** teamId → exact ms the box's left edge crosses the goal line */
  finishAtMs: Map<string, number>;
  /** when the last team finishes parking */
  totalMs: number;
}

function ordinal(n: number) {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function yardsToLeft(yards: number): string {
  return `${PLAY_START + (Math.min(yards, 100) / 100) * (PLAY_END - PLAY_START)}%`;
}

/** Simulate the whole race up-front. Every team rushes on its own clock:
 * each rush picks random yards and a random duration, and each leg animates
 * over the full gap to the next rush — so racers are constantly moving, just
 * at different speeds. Legs are linear, which makes the exact moment a box's
 * left edge crosses the goal line computable; that moment is the finish, and
 * finish times define the draft order. */
function simulateRace(
  teams: Team[],
  yardsMin: number,
  yardsMax: number,
  secMin: number,
  secMax: number
): RaceData {
  const schedule = new Map<string, MoveLeg[]>();
  const finishAtMs = new Map<string, number>();
  let totalMs = 0;

  for (const team of teams) {
    const legs: MoveLeg[] = [];
    let tMs = 0;
    let yards = 0;
    while (yards < 100 && legs.length < 400) {
      const durMs = (secMin + Math.random() * (secMax - secMin)) * 1_000;
      const nextYards = yards + yardsMin + Math.random() * (yardsMax - yardsMin);
      if (nextYards >= 100) {
        // Crossing leg: linear motion means the goal line (100 yds) is crossed
        // at the exact fractional time below; the leg glides on into the
        // end-zone parking spot without stopping.
        finishAtMs.set(team.id, tMs + durMs * ((100 - yards) / (nextYards - yards)));
        legs.push({ beginAtMs: tMs, left: `calc(${PLAY_END}% + 8px)`, durMs });
      } else {
        legs.push({ beginAtMs: tMs, left: yardsToLeft(nextYards), durMs });
      }
      tMs += durMs;
      yards = nextYards;
    }
    schedule.set(team.id, legs);
    totalMs = Math.max(totalMs, tMs);
  }

  const order = [...teams].sort(
    (a, b) => (finishAtMs.get(a.id) ?? Infinity) - (finishAtMs.get(b.id) ?? Infinity)
  );
  const placement = new Map(order.map((team, i) => [team.id, i + 1]));
  return { order, placement, schedule, finishAtMs, totalMs };
}

export default function DraftOrderRace({ teams, isCommissioner, onLockIn, onClose }: DraftOrderRaceProps) {
  const { accentColor: primary, bgColor: secondary } = useLeagueTheme();
  const [status, setStatus] = useState<"ready" | "racing" | "done">("ready");
  const [isSaving, setIsSaving] = useState(false);
  const [race, setRace] = useState<RaceData | null>(null);
  // Live replay state: each racer's current movement leg, and who has crossed
  const [moveByTeam, setMoveByTeam] = useState<Record<string, { left: string; durMs: number }>>({});
  const [finishers, setFinishers] = useState<string[]>([]);
  // Settings (reference: 100yardrush) — how far each burst goes and how often
  const [yardsMin, setYardsMin] = useState(1);
  const [yardsMax, setYardsMax] = useState(10);
  const [secMin, setSecMin] = useState(2);
  const [secMax, setSecMax] = useState(7);
  const timeoutsRef = useRef<number[]>([]);

  function clearTimers() {
    for (const id of timeoutsRef.current) window.clearTimeout(id);
    timeoutsRef.current = [];
  }
  useEffect(() => clearTimers, []);

  // Escape closes (except mid-save)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSaving, onClose]);

  function startRace() {
    const data = simulateRace(teams, yardsMin, yardsMax, secMin, secMax);
    setRace(data);
    setStatus("racing");
    setMoveByTeam({});
    setFinishers([]);

    const schedule = (fn: () => void, ms: number) => {
      timeoutsRef.current.push(window.setTimeout(fn, ms));
    };
    // Replay every team's movement legs on its own clock; each leg starts the
    // moment the previous one lands, so nobody ever stands still.
    for (const team of teams) {
      for (const leg of data.schedule.get(team.id) ?? []) {
        schedule(() => {
          setMoveByTeam((prev) => ({ ...prev, [team.id]: { left: leg.left, durMs: leg.durMs } }));
        }, leg.beginAtMs);
      }
      // Finished the exact instant the box fully crosses the goal line
      schedule(() => {
        setFinishers((prev) => (prev.includes(team.id) ? prev : [...prev, team.id]));
      }, data.finishAtMs.get(team.id) ?? 0);
    }
    schedule(() => {
      setStatus("done");
      const cheer = new Audio("/sounds/dragon-studio-crowd-cheer-406646.mp3");
      cheer.volume = 0.6;
      cheer.play().catch(() => {});
    }, data.totalMs + 300);
  }

  function runItBack() {
    clearTimers();
    setMoveByTeam({});
    setFinishers([]);
    setRace(null);
    setStatus("ready");
  }

  const estimatedSeconds = Math.round((100 / ((yardsMin + yardsMax) / 2)) * ((secMin + secMax) / 2));
  const yardNumbers = ["10", "20", "30", "40", "50", "40", "30", "20", "10"];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-slate-950">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-4">
          <DraftHQLogo accentColor={primary} className="h-10 w-auto" />
          <div>
            <p className="text-lg font-black uppercase tracking-wide text-white">Draft Order Race</p>
            <p className="text-xs text-slate-500">
              {status === "ready" && "The order is locked the moment the race starts — the run just reveals it."}
              {status === "racing" && "They're off…"}
              {status === "done" && "Final — that's your draft order."}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={onClose}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          Close
        </button>
      </div>

      {/* Field — DraftHQ dark turf on the brand slate */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0a1122 0%, #0e1830 50%, #0a1122 100%)" }}
      >
        {/* Turf stripes — painted over the play area only, so every stripe
            boundary lands exactly on a yard line */}
        <div
          className="pointer-events-none absolute bottom-0 top-0"
          style={{
            left: `${PLAY_START}%`,
            width: `${PLAY_END - PLAY_START}%`,
            background: `repeating-linear-gradient(90deg, transparent 0 10%, ${primary}0d 10% 20%)`,
          }}
        />

        {/* Yard lines */}
        {yardNumbers.map((_, i) => (
          <div
            key={`line-${i}`}
            className="pointer-events-none absolute bottom-0 top-0 w-px"
            style={{ left: `${PLAY_START + ((i + 1) / 10) * (PLAY_END - PLAY_START)}%`, backgroundColor: `${primary}30` }}
          />
        ))}

        {/* End zones */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 top-0"
          style={{ width: `${PLAY_START}%`, background: `linear-gradient(90deg, ${primary}0d, ${primary}26)` }}
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 top-0"
          style={{ width: `${100 - PLAY_END}%`, background: `linear-gradient(90deg, ${primary}26, ${primary}0d)` }}
        />
        {/* Goal lines */}
        <div className="pointer-events-none absolute bottom-0 top-0 w-0.5" style={{ left: `${PLAY_END}%`, backgroundColor: primary, opacity: 0.7 }} />
        <div className="pointer-events-none absolute bottom-0 top-0 w-0.5" style={{ left: `${PLAY_START}%`, backgroundColor: primary, opacity: 0.7 }} />

        {/* Yard numbers — each centered on its own yard line */}
        {(["top-1.5", "bottom-1.5"] as const).map((edge) =>
          yardNumbers.map((n, i) => (
            <span
              key={`${edge}-${i}`}
              className={`pointer-events-none absolute ${edge} -translate-x-1/2 select-none text-xl font-black tracking-widest opacity-45`}
              style={{ left: `${PLAY_START + ((i + 1) / 10) * (PLAY_END - PLAY_START)}%`, color: primary }}
            >
              {n}
            </span>
          ))
        )}

        {/* Center-field DraftHQ shield */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.09]">
          <DraftHQLogo accentColor={primary} className="h-[45vh] w-auto" />
        </div>

        {/* Lanes — each lane owns its slice of the height; racers size to the
            lane so adjacent logos can never overlap, and the whole race stays
            on one screen with zero scrolling. */}
        <div className="relative flex h-full flex-col py-9">
          {teams.map((team, laneIndex) => {
            const move = moveByTeam[team.id];
            const finished = finishers.includes(team.id);
            // Every racer lives in an identical square box (side = 82% of the
            // lane). The box's LEFT edge is the position marker: at 100 yards
            // the left edge reaches the goal line, meaning the whole box has
            // fully crossed — identical geometry for every team regardless of
            // logo shape. Boxes line up inside the left end zone; each linear
            // movement leg lasts exactly until the next one begins, so racers
            // glide continuously at varying speeds instead of stop-and-go.
            const pick = race?.placement.get(team.id) ?? 0;
            const initials = team.name.trim().slice(0, 2).toUpperCase() || "T";

            return (
              <div key={team.id} className="relative min-h-0 flex-1">
                {/* Racer box */}
                <div
                  className="absolute top-1/2 aspect-square h-[82%] -translate-y-1/2"
                  style={{
                    left: move?.left ?? "0.6%",
                    transition: move ? `left ${move.durMs}ms linear` : "none",
                  }}
                >
                  {team.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={team.logoUrl}
                      alt={team.name}
                      className="h-full w-full object-contain drop-shadow-lg"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full text-base font-black text-white shadow-lg"
                      style={{ backgroundColor: AVATAR_COLORS[laneIndex % AVATAR_COLORS.length] }}
                    >
                      {initials}
                    </div>
                  )}
                  {finished && (
                    <span
                      className="absolute left-1/2 top-full -mt-1 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-px text-[11px] font-black leading-tight shadow-lg"
                      style={
                        pick === 1
                          ? { backgroundColor: "#fbbf24", color: "#1c1917" }
                          : { backgroundColor: "rgba(15,23,42,0.9)", color: "#fff" }
                      }
                    >
                      {ordinal(pick)}
                    </span>
                  )}
                </div>

                {/* Team name beside the box while lined up */}
                {status === "ready" && (
                  <span className="absolute left-[7.5%] top-1/2 -translate-y-1/2 text-xs font-bold text-white/70 drop-shadow">
                    {team.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Start overlay with race settings */}
        {status === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-slate-950/60 backdrop-blur-[2px]">
            <button
              type="button"
              onClick={startRace}
              className="rounded-2xl px-10 py-5 text-2xl font-black uppercase tracking-[0.15em] shadow-2xl transition-transform hover:scale-105"
              style={{ backgroundColor: primary, color: secondary }}
            >
              Start the Race
            </button>

            <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl">
              <div>
                <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.15em] text-slate-400">Yards per rush</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="w-8 text-xs font-bold text-slate-500">Min</span>
                  <div className="flex flex-1 justify-end gap-1">
                    {YARD_MIN_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setYardsMin(n)}
                        className={`h-8 w-8 rounded-lg text-sm font-bold transition-colors ${yardsMin === n ? "" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                        style={yardsMin === n ? { backgroundColor: primary, color: secondary } : undefined}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="w-8 text-xs font-bold text-slate-500">Max</span>
                  <div className="flex flex-1 justify-end gap-1">
                    {YARD_MAX_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setYardsMax(n)}
                        className={`h-8 w-8 rounded-lg text-sm font-bold transition-colors ${yardsMax === n ? "" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                        style={yardsMax === n ? { backgroundColor: primary, color: secondary } : undefined}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.15em] text-slate-400">Seconds per rush</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="w-8 text-xs font-bold text-slate-500">Min</span>
                  <div className="flex flex-1 justify-end gap-1">
                    {SEC_MIN_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSecMin(s)}
                        className={`h-8 w-8 rounded-lg text-sm font-bold transition-colors ${secMin === s ? "" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                        style={secMin === s ? { backgroundColor: primary, color: secondary } : undefined}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="w-8 text-xs font-bold text-slate-500">Max</span>
                  <div className="flex flex-1 justify-end gap-1">
                    {SEC_MAX_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSecMax(s)}
                        className={`h-8 w-8 rounded-lg text-sm font-bold transition-colors ${secMax === s ? "" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                        style={secMax === s ? { backgroundColor: primary, color: secondary } : undefined}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-center text-[11px] leading-snug text-slate-600">
                ≈ {estimatedSeconds}s race · every rush is simulated at kickoff — the run just replays it.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Results footer */}
      <div className="shrink-0 border-t border-white/10 bg-black/40 px-6 py-3">
        {status === "done" && race ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {race.order.map((team, i) => (
                <span key={team.id} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs">
                  <span className="font-black text-slate-500">{i + 1}</span>
                  <span className="font-semibold text-white">{team.name}</span>
                </span>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={runItBack}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Run it back
              </button>
              {isCommissioner && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      await onLockIn(race.order);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="rounded-xl px-5 py-2 text-sm font-black uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: primary, color: secondary }}
                >
                  {isSaving ? "Saving…" : "Lock It In"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-slate-600">
            {teams.length} teams · first across the goal line takes the first overall pick
          </p>
        )}
      </div>
    </div>
  );
}
