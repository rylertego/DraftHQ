"use client";

import { useEffect, useState } from "react";
import { formatDraftClock, getDraftClockSeconds } from "@/lib/draftTimer";
import type { Draft } from "@/types/draft";

export default function DraftTimer({ draft }: { draft: Draft }) {
  const [seconds, setSeconds] = useState(() => getDraftClockSeconds(draft));

  useEffect(() => {
    const updateClock = () => setSeconds(getDraftClockSeconds(draft));
    updateClock();

    if (draft.status !== "active") {
      return;
    }

    const intervalId = window.setInterval(updateClock, 250);
    return () => window.clearInterval(intervalId);
  }, [draft]);

  return (
    <section className="rounded-lg border border-gray-700 bg-gray-950 p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-gray-400">
        Pick Clock
      </p>
      <p
        className={`mt-1 font-mono text-4xl font-bold ${
          seconds <= 10 && draft.status === "active"
            ? "text-red-400"
            : "text-white"
        }`}
      >
        {formatDraftClock(seconds)}
      </p>
      <p className="mt-1 text-sm capitalize text-gray-400">{draft.status}</p>
    </section>
  );
}
