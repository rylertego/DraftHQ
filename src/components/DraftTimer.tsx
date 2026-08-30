"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatDraftClock,
  getDraftClockSeconds,
} from "@/lib/draftTimer";
import type { Draft } from "@/types/draft";

interface DraftTimerProps {
  draft: Draft;
  serverTimeOffsetMs: number;
  canExtend?: boolean;
  onExpired?: () => void;
  onExtend?: () => void;
}

export default function DraftTimer({
  draft,
  serverTimeOffsetMs,
  canExtend = false,
  onExpired,
  onExtend,
}: DraftTimerProps) {
  const [seconds, setSeconds] = useState(() =>
    getDraftClockSeconds(draft, Date.now(), serverTimeOffsetMs)
  );
  const expiredFiredRef = useRef(false);

  useEffect(() => {
    expiredFiredRef.current = false;
  }, [draft.currentPick]);

  useEffect(() => {
    const updateClock = () => {
      const s = getDraftClockSeconds(draft, Date.now(), serverTimeOffsetMs);
      setSeconds(s);

      if (
        s === 0 &&
        draft.status === "active" &&
        draft.pickDeadlineAt &&
        draft.timerBehavior !== "nothing" &&
        !expiredFiredRef.current
      ) {
        expiredFiredRef.current = true;
        onExpired?.();
      }
    };

    updateClock();

    if (draft.status !== "active") {
      return;
    }

    const intervalId = window.setInterval(updateClock, 250);
    return () => window.clearInterval(intervalId);
  }, [draft, serverTimeOffsetMs, onExpired]);

  const isExpired =
    draft.status === "active" && Boolean(draft.pickDeadlineAt) && seconds === 0;

  const extensionsLeft = draft.maxClockExtensions - draft.clockExtensionsUsed;
  const showExtend =
    canExtend &&
    draft.maxClockExtensions > 0 &&
    extensionsLeft > 0 &&
    draft.status === "active" &&
    !isExpired;

  const urgent = (seconds <= 10 || isExpired) && draft.status === "active";

  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-[var(--radius-panel)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-1)] p-4 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-text-muted)]">Pick Clock</p>
      <p className={`font-mono text-5xl font-bold tabular-nums leading-none ${urgent ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-text-primary)]"}`}>
        {formatDraftClock(seconds)}
      </p>
      <p className={`text-xs font-semibold capitalize ${isExpired ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-text-muted)]"}`}>
        {isExpired
          ? draft.timerBehavior === "auto_draft"
            ? "Auto-drafting..."
            : draft.timerBehavior === "skip"
              ? "Skipping..."
              : "Time expired"
          : draft.status}
      </p>
      {showExtend && (
        <button
          type="button"
          onClick={onExtend}
          className="mt-2 rounded-[var(--radius-control)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-2)] px-3 py-1 text-xs font-medium text-[color:var(--color-text-secondary)] transition-colors hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-text-primary)]"
        >
          +{draft.clockExtensionSeconds}s
          {extensionsLeft < draft.maxClockExtensions ? ` (${extensionsLeft} left)` : ""}
        </button>
      )}
    </div>
  );
}
