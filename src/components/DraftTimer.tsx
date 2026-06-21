"use client";

import { useEffect, useState } from "react";
import {
  formatDraftClock,
  getDraftClockSeconds,
} from "@/lib/draftTimer";
import type { Draft } from "@/types/draft";

export default function DraftTimer({
  draft,
  serverTimeOffsetMs,
}: {
  draft: Draft;
  serverTimeOffsetMs: number;
}) {
  const [seconds, setSeconds] = useState(() =>
    getDraftClockSeconds(draft, Date.now(), serverTimeOffsetMs)
  );

  useEffect(() => {
    const updateClock = () =>
      setSeconds(getDraftClockSeconds(draft, Date.now(), serverTimeOffsetMs));
    updateClock();

    if (draft.status !== "active") {
      return;
    }

    const intervalId = window.setInterval(updateClock, 250);
    return () => window.clearInterval(intervalId);
  }, [draft, serverTimeOffsetMs]);

  const isExpired =
    draft.status === "active" && Boolean(draft.pickDeadlineAt) && seconds === 0;

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
        {isExpired ? "Time expired - pick remains open" : draft.status}
      </p>
    </section>
  );
}
