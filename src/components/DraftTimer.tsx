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
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center flex flex-col items-center justify-center gap-1">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Pick Clock</p>
      <p className={`font-mono text-5xl font-bold tabular-nums leading-none ${urgent ? "text-red-400" : "text-white"}`}>
        {formatDraftClock(seconds)}
      </p>
      <p className={`text-xs font-semibold capitalize ${isExpired ? "text-red-400" : "text-slate-500"}`}>
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
          className="mt-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
        >
          +{draft.clockExtensionSeconds}s
          {extensionsLeft < draft.maxClockExtensions ? ` (${extensionsLeft} left)` : ""}
        </button>
      )}
    </div>
  );
}
