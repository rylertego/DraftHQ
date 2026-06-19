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

export function useRealtimeDraftRoom(draftId: string | null) {
  const [snapshot, setSnapshot] = useState<DraftRoomSnapshot | null>(null);
  const [status, setStatus] =
    useState<DraftConnectionStatus>("connecting");
  const [error, setError] = useState("");
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (!draftId) {
      return;
    }

    let cancelled = false;
    let unsubscribe: () => void = () => undefined;

    const requestRefresh = createSnapshotRefreshQueue(async () => {
      try {
        const nextSnapshot = await getDraftRoomSnapshot(draftId);

        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setError("");
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "Unable to refresh the draft room."
          );
        }
      }
    });

    refreshRef.current = requestRefresh;

    async function initialize() {
      try {
        await ensureAnonymousUser();

        if (cancelled) {
          return;
        }

        unsubscribe = subscribeToDraft(
          draftId as string,
          () => void requestRefresh(),
          setStatus
        );
        await requestRefresh();
      } catch (initializeError) {
        if (!cancelled) {
          setStatus("error");
          setError(
            initializeError instanceof Error
              ? initializeError.message
              : "Unable to connect to the draft room."
          );
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      unsubscribe();
      refreshRef.current = async () => undefined;
    };
  }, [draftId]);

  const refresh = useCallback(() => refreshRef.current(), []);

  return { snapshot, status, error, refresh };
}
