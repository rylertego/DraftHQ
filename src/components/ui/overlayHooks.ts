"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { sharedOverlayStack } from "./primitiveInternals";

export function useClientMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export function useStableCallback<T extends (...args: never[]) => unknown>(callback: T): T {
  const callbackRef = useLatestRef(callback);
  const stableCallback = useCallback((...args: Parameters<T>) => callbackRef.current(...args), [callbackRef]);
  return stableCallback as T;
}

export function useOverlayToken(open: boolean) {
  const [token] = useState(() => Symbol("ui-overlay"));

  useEffect(() => {
    if (!open) return;
    return sharedOverlayStack.add(token);
  }, [open, token]);

  return token;
}
