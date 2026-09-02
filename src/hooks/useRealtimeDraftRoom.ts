"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDraftRevision,
  getDraftRoomSnapshot,
  getDraftServerTimeOffsetMs,
  type DraftRoomSnapshot,
} from "@/lib/draftApi";
import {
  subscribeToDraft,
  type DraftConnectionStatus,
  type DraftSubscription,
  type StagedByUserId,
} from "@/lib/draftRealtime";
import { createSnapshotRefreshQueue } from "@/lib/refreshQueue";
import { ensureAnonymousUser } from "@/lib/supabase";
import type { Draft } from "@/types/draft";
import {
  getDraftRecoveryError,
  hasDraftRevisionChanged,
  shouldRefreshDraftOnVisibility,
} from "@/lib/draftRecovery";

const DRAFT_REVISION_POLL_MS = 10_000;
const SERVER_TIME_SYNC_MS = 120_000;

export function useRealtimeDraftRoom(draftId: string | null) {
  const [snapshot, setSnapshot] = useState<DraftRoomSnapshot | null>(null);
  const [status, setStatus] =
    useState<DraftConnectionStatus>("connecting");
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [stagedByUserId, setStagedByUserId] = useState<StagedByUserId>({});
  // Held outside the subscription so a reconnect can republish it.
  const stagedPlayerRef = useRef<string | null>(null);
  const subscriptionRef = useRef<DraftSubscription | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const statusRef = useRef<DraftConnectionStatus>("connecting");
  const revisionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draftId) {
      return;
    }

    let cancelled = false;
    let subscription: DraftSubscription | null = null;
    let presenceUserId: string | null = null;
    const updateStatus = (nextStatus: DraftConnectionStatus) => {
      statusRef.current = nextStatus;
      setStatus(nextStatus);
    };

    const requestRefresh = createSnapshotRefreshQueue(async () => {
      if (!cancelled) {
        setIsRefreshing(true);
      }

      try {
        const nextSnapshot = await getDraftRoomSnapshot(draftId);

        if (!cancelled) {
          setSnapshot(nextSnapshot);
          revisionRef.current = nextSnapshot.draft.updatedAt;
          setLastSyncedAt(Date.now());
          setError("");
        }
      } catch (refreshError) {
        if (!cancelled) {
          updateStatus(navigator.onLine ? "error" : "disconnected");
          setError(getDraftRecoveryError(refreshError));
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    });

    const subscribe = (): DraftSubscription | null => {
      if (!presenceUserId) {
        return null;
      }

      return subscribeToDraft(
        draftId,
        presenceUserId,
        () => void requestRefresh(),
        setOnlineUserIds,
        (nextStatus) => {
          updateStatus(nextStatus);
          // When the channel errors while the tab is active and online, neither
          // the "online" nor "focus" events fire, so nothing triggers recover().
          // Schedule one reconnect attempt after 3 s so the room self-heals.
          if (nextStatus === "error" && !cancelled) {
            window.setTimeout(() => {
              if (!cancelled && statusRef.current !== "connected") void recover();
            }, 3_000);
          }
        },
        setStagedByUserId,
        () => stagedPlayerRef.current
      );
    };

    const recover = async () => {
      if (!navigator.onLine) {
        updateStatus("disconnected");
        return;
      }

      if (!presenceUserId) {
        presenceUserId = (await ensureAnonymousUser()).id;
      }

      if (statusRef.current !== "connected") {
        updateStatus("connecting");
        subscription?.unsubscribe();
        subscription = subscribe();
        subscriptionRef.current = subscription;
      }

      await requestRefresh();
    };

    refreshRef.current = recover;

    const handleVisibilityChange = () => {
      if (
        shouldRefreshDraftOnVisibility(
          document.visibilityState,
          navigator.onLine
        )
      ) {
        void recover();
      }
    };

    const handleOffline = () => updateStatus("disconnected");
    const handleRecovery = () => void recover();
    let revisionCheckInFlight = false;
    const revisionPollId = window.setInterval(() => {
      if (
        cancelled ||
        revisionCheckInFlight ||
        !shouldRefreshDraftOnVisibility(
          document.visibilityState,
          navigator.onLine
        )
      ) {
        return;
      }

      revisionCheckInFlight = true;
      void getDraftRevision(draftId)
        .then((latestRevision) => {
          if (
            !cancelled &&
            hasDraftRevisionChanged(revisionRef.current, latestRevision)
          ) {
            return requestRefresh();
          }
        })
        .catch(() => undefined)
        .finally(() => {
          revisionCheckInFlight = false;
        });
    }, DRAFT_REVISION_POLL_MS);

    // Periodically re-sync server time offset independently of full refreshes.
    // Keeps the pick clock accurate during long picks with no realtime activity.
    const serverTimeSyncId = window.setInterval(() => {
      if (cancelled || !shouldRefreshDraftOnVisibility(document.visibilityState, navigator.onLine)) return;
      void getDraftServerTimeOffsetMs(draftId).then((offsetMs) => {
        if (!cancelled) {
          setSnapshot((current) => current ? { ...current, serverTimeOffsetMs: offsetMs } : current);
        }
      }).catch(() => undefined);
    }, SERVER_TIME_SYNC_MS);

    window.addEventListener("online", handleRecovery);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleRecovery);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    async function initialize() {
      try {
        presenceUserId = (await ensureAnonymousUser()).id;

        if (cancelled) {
          return;
        }

        subscription = subscribe();
        subscriptionRef.current = subscription;
        await requestRefresh();
      } catch (initializeError) {
        if (!cancelled) {
          updateStatus("error");
          setError(getDraftRecoveryError(initializeError));
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      subscription = null;
      subscriptionRef.current = null;
      window.removeEventListener("online", handleRecovery);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleRecovery);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(revisionPollId);
      window.clearInterval(serverTimeSyncId);
      refreshRef.current = async () => undefined;
    };
  }, [draftId]);

  const refresh = useCallback(() => refreshRef.current(), []);

  /** Share (or clear) the player this client has staged with the room. */
  const publishStagedPlayer = useCallback((playerId: string | null) => {
    stagedPlayerRef.current = playerId;
    subscriptionRef.current?.publishStagedPlayer(playerId);
  }, []);
  const applyDraftUpdate = useCallback((draft: Draft) => {
    revisionRef.current = draft.updatedAt;
    setSnapshot((current) => (current ? { ...current, draft } : current));
    setLastSyncedAt(Date.now());
  }, []);

  return {
    snapshot,
    status,
    error,
    refresh,
    lastSyncedAt,
    isRefreshing,
    onlineUserIds,
    stagedByUserId,
    publishStagedPlayer,
    applyDraftUpdate,
  };
}
