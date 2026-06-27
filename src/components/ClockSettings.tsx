"use client";

import type { Draft, TimerBehavior } from "@/types/draft";

const PICK_CLOCK_OPTIONS = [
  { seconds: 30, label: "30 seconds" },
  { seconds: 45, label: "45 seconds" },
  { seconds: 60, label: "1 minute" },
  { seconds: 90, label: "1:30" },
  { seconds: 120, label: "2 minutes" },
  { seconds: 180, label: "3 minutes" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 600, label: "10 minutes" },
];

const EXTENSION_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5];
const EXTENSION_TIME_OPTIONS = [
  { seconds: 30, label: "0:30" },
  { seconds: 60, label: "1:00" },
  { seconds: 90, label: "1:30" },
  { seconds: 120, label: "2:00" },
  { seconds: 180, label: "3:00" },
];

const TIMER_BEHAVIORS: { value: TimerBehavior; label: string; description: string }[] = [
  { value: "nothing", label: "Nothing happens", description: "The pick stays open until the commissioner acts." },
  { value: "skip", label: "Skip pick", description: "The pick is forfeited and the draft advances." },
  { value: "auto_draft", label: "Auto-draft", description: "The first available player is drafted automatically." },
];

interface ClockSettingsProps {
  draft: Draft;
  disabled?: boolean;
  onSave: (settings: {
    pickSeconds: number;
    timerBehavior: TimerBehavior;
    clockExtensionSeconds: number;
    maxClockExtensions: number;
  }) => void;
}

export default function ClockSettings({ draft, disabled = false, onSave }: ClockSettingsProps) {
  function emitChange(overrides: Partial<{
    pickSeconds: number;
    timerBehavior: TimerBehavior;
    clockExtensionSeconds: number;
    maxClockExtensions: number;
  }>) {
    onSave({
      pickSeconds: draft.pickSeconds,
      timerBehavior: draft.timerBehavior,
      clockExtensionSeconds: draft.clockExtensionSeconds,
      maxClockExtensions: draft.maxClockExtensions,
      ...overrides,
    });
  }

  return (
    <section>
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Pick Clock */}
        <div>
          <p className="mb-2 text-sm font-semibold text-white">Pick Clock</p>
          <div className="flex gap-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Minutes</p>
              <select
                disabled={disabled}
                className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm disabled:opacity-50"
                value={Math.floor(draft.pickSeconds / 60)}
                onChange={(e) => emitChange({ pickSeconds: Number(e.target.value) * 60 + (draft.pickSeconds % 60) })}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Seconds</p>
              <select
                disabled={disabled}
                className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm disabled:opacity-50"
                value={draft.pickSeconds % 60}
                onChange={(e) => emitChange({ pickSeconds: Math.floor(draft.pickSeconds / 60) * 60 + Number(e.target.value) })}
              >
                {[0, 15, 30, 45].map((s) => (
                  <option key={s} value={s}>{String(s).padStart(2, "0")}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Clock Extensions */}
        <div>
          <p className="mb-2 text-sm font-semibold text-white">Clock Extensions</p>
          <div className="flex gap-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Count</p>
              <select
                disabled={disabled}
                className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm disabled:opacity-50"
                value={draft.maxClockExtensions}
                onChange={(e) => emitChange({ maxClockExtensions: Number(e.target.value) })}
              >
                {EXTENSION_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Time</p>
              <select
                disabled={disabled || draft.maxClockExtensions === 0}
                className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm disabled:opacity-50"
                value={draft.clockExtensionSeconds}
                onChange={(e) => emitChange({ clockExtensionSeconds: Number(e.target.value) })}
              >
                {EXTENSION_TIME_OPTIONS.map((o) => (
                  <option key={o.seconds} value={o.seconds}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* When clock hits zero */}
        <div>
          <p className="mb-2 text-sm font-semibold text-white">
            When clock hits zero{" "}
            <span
              className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-400"
              title="What happens when the pick timer runs out"
            >
              ?
            </span>
          </p>
          <div className="space-y-2">
            {TIMER_BEHAVIORS.map((b) => (
              <label key={b.value} className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="timer-behavior"
                  value={b.value}
                  disabled={disabled}
                  checked={draft.timerBehavior === b.value}
                  onChange={() => emitChange({ timerBehavior: b.value })}
                  className="mt-0.5 disabled:opacity-50"
                />
                <span className="text-sm leading-tight">
                  <span className="font-medium text-white">{b.label}</span>
                  <span className="ml-1 text-xs text-slate-400">{b.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

}
