export function shouldRefreshDraftOnVisibility(
  visibilityState: DocumentVisibilityState,
  isOnline: boolean
) {
  return visibilityState === "visible" && isOnline;
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
    return "This session can no longer access the draft. Reopen your invitation or join link, then try again.";
  }

  return message || "Unable to refresh the draft room.";
}
