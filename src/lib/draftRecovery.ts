export function shouldRefreshDraftOnVisibility(
  visibilityState: DocumentVisibilityState,
  isOnline: boolean
) {
  return visibilityState === "visible" && isOnline;
}

export function hasDraftRevisionChanged(
  currentRevision: string | null,
  latestRevision: string
) {
  return currentRevision !== null && currentRevision !== latestRevision;
}

export function formatLastSyncedAt(lastSyncedAt: number | null) {
  if (!lastSyncedAt) {
    return "Waiting for first sync";
  }

  return `Last synced ${new Date(lastSyncedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

export function getDraftRecoveryError(error: unknown) {
  const details =
    error && typeof error === "object"
      ? (error as { code?: unknown; message?: unknown })
      : null;
  const code = typeof details?.code === "string" ? details.code : "";
  const message =
    typeof details?.message === "string" ? details.message : "";

  if (
    code === "PGRST116" ||
    code === "42501" ||
    /jwt|session|permission|not authorized/i.test(message)
  ) {
    // Reads as a plain fact rather than a fault. The most common causes are
    // deliberate — leaving a league, or being removed — and "this session can
    // no longer access the draft" made an expected outcome look like a bug.
    return "You no longer have access to this draft. If that's unexpected, ask your commissioner for a new invitation or join link.";
  }

  return message || "Unable to refresh the draft room.";
}
