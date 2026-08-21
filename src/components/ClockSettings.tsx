"use client";

import type { Draft, TimerBehavior } from "@/types/draft";
import { Field, Radio, Select } from "@/components/ui";

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
  // Every save carries all four values with the caller's override applied on
  // top. configure_draft_timer takes the complete set, so emitting a partial
  // here would blank whichever fields were left out. Unchanged from the
  // pre-migration version on purpose.
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
    <div className="grid gap-[var(--space-5)] lg:grid-cols-3">
      <div>
        <p className="mb-[var(--space-3)] text-sm font-bold text-[color:var(--color-text-primary)]">Pick Clock</p>
        <div className="flex gap-[var(--space-2)]">
          <div className="w-24">
            <Field label="Minutes" controlId="clock-minutes">
              <Select
                disabled={disabled}
                value={Math.floor(draft.pickSeconds / 60)}
                onChange={(e) => emitChange({ pickSeconds: Number(e.target.value) * 60 + (draft.pickSeconds % 60) })}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-24">
            <Field label="Seconds" controlId="clock-seconds">
              <Select
                disabled={disabled}
                value={draft.pickSeconds % 60}
                onChange={(e) => emitChange({ pickSeconds: Math.floor(draft.pickSeconds / 60) * 60 + Number(e.target.value) })}
              >
                {[0, 15, 30, 45].map((s) => (
                  <option key={s} value={s}>{String(s).padStart(2, "0")}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-[var(--space-3)] text-sm font-bold text-[color:var(--color-text-primary)]">Clock Extensions</p>
        <div className="flex gap-[var(--space-2)]">
          <div className="w-24">
            <Field label="Count" controlId="clock-extension-count">
              <Select
                disabled={disabled}
                value={draft.maxClockExtensions}
                onChange={(e) => emitChange({ maxClockExtensions: Number(e.target.value) })}
              >
                {EXTENSION_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-24">
            {/* Still disabled at zero extensions: choosing a duration for
                extensions that cannot happen is a control with no effect. */}
            <Field label="Time" controlId="clock-extension-time">
              <Select
                disabled={disabled || draft.maxClockExtensions === 0}
                value={draft.clockExtensionSeconds}
                onChange={(e) => emitChange({ clockExtensionSeconds: Number(e.target.value) })}
              >
                {EXTENSION_TIME_OPTIONS.map((o) => (
                  <option key={o.seconds} value={o.seconds}>{o.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-[var(--space-3)] text-sm font-bold text-[color:var(--color-text-primary)]">
          When clock hits zero
        </p>
        <div className="flex flex-col gap-[var(--space-2)]">
          {TIMER_BEHAVIORS.map((b) => (
            <Radio
              key={b.value}
              name="timer-behavior"
              value={b.value}
              disabled={disabled}
              checked={draft.timerBehavior === b.value}
              onChange={() => emitChange({ timerBehavior: b.value })}
              label={b.label}
              description={b.description}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
