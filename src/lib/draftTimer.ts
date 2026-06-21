import type { DraftStatus } from "@/types/draft";

export interface DraftClockState {
  status: DraftStatus;
  pickSeconds: number;
  pickDeadlineAt: string | null;
  pausedRemainingSeconds: number | null;
}

export function getDraftClockSeconds(
  draft: DraftClockState,
  nowMs = Date.now(),
  serverTimeOffsetMs = 0
) {
  if (draft.status === "complete") {
    return 0;
  }

  if (draft.status === "paused") {
    return draft.pausedRemainingSeconds ?? draft.pickSeconds;
  }

  if (draft.status === "setup") {
    return draft.pickSeconds;
  }

  if (!draft.pickDeadlineAt) {
    return 0;
  }

  const deadlineMs = Date.parse(draft.pickDeadlineAt);

  if (!Number.isFinite(deadlineMs)) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil((deadlineMs - (nowMs + serverTimeOffsetMs)) / 1000)
  );
}

export function isDraftClockExpired(
  draft: DraftClockState,
  nowMs = Date.now(),
  serverTimeOffsetMs = 0
) {
  return (
    draft.status === "active" &&
    Boolean(draft.pickDeadlineAt) &&
    getDraftClockSeconds(draft, nowMs, serverTimeOffsetMs) === 0
  );
}

export function formatDraftClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
