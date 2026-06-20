"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDraftRoomSnapshot,
  type DraftRoomSnapshot,
} from "@/lib/draftApi";
import {
  subscribeToDraft,
  type DraftConnectionStatus,
} from "@/lib/draftRealtime";
import { createSnapshotRefreshQueue } from "@/lib/refreshQueue";
import { ensureAnonymousUser } from "@/lib/supabase";
import {
  getDraftRecoveryError,
  shouldRefreshDraftOnVisibility,
} from "@/lib/draftRecovery";

export function useRealtimeDraftRoom(draftId: string | null) {
  const [snapshot, setSnapshot] = useState<DraftRoomSnapshot | null>(null);
  const [status, setStatus] =
    useState<DraftConnectionStatus>("connecting");
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const statusRef = useRef<DraftConnectionStatus>("connecting");

  useEffect(() => {
    if (!draftId) {
      return;
    }

    let cancelled = false;
    let unsubscribe: () => void = () => undefined;
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

    const subscribe = () => {
      if (!presenceUserId) {
        return () => undefined;
      }

      return subscribeToDraft(
        draftId,
        presenceUserId,
        () => void requestRefresh(),
        setOnlineUserIds,
        updateStatus
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
        unsubscribe();
        unsubscribe = subscribe();
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

        unsubscribe = subscribe();
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
      unsubscribe();
      window.removeEventListener("online", handleRecovery);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleRecovery);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      refreshRef.current = async () => undefined;
    };
  }, [draftId]);

  const refresh = useCallback(() => refreshRef.current(), []);

  return {
    snapshot,
    status,
    error,
    refresh,
    lastSyncedAt,
    isRefreshing,
    onlineUserIds,
  };
}
