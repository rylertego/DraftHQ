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

  return (
    <section className="rounded-lg border border-gray-700 bg-gray-950 p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-gray-400">
        Pick Clock
      </p>
      <p
        className={`mt-1 font-mono text-4xl font-bold ${
          (seconds <= 10 || isExpired) && draft.status === "active"
            ? "text-red-400"
            : "text-white"
        }`}
      >
        {formatDraftClock(seconds)}
      </p>
      <p
        className={`mt-1 text-sm font-semibold ${
          isExpired ? "text-red-400" : "capitalize text-gray-400"
        }`}
      >
        {isExpired
          ? draft.timerBehavior === "auto_draft"
            ? "Auto-drafting..."
            : draft.timerBehavior === "skip"
            ? "Skipping pick..."
            : "Time expired"
          : draft.status}
      </p>

      {showExtend && (
        <button
          type="button"
          onClick={onExtend}
          className="mt-3 rounded border border-gray-600 px-3 py-1 text-xs text-gray-300 hover:border-gray-400 hover:text-white"
        >
          +{draft.clockExtensionSeconds}s
          {extensionsLeft < draft.maxClockExtensions
            ? ` (${extensionsLeft} left)`
            : ""}
        </button>
      )}
    </section>
  );
}
