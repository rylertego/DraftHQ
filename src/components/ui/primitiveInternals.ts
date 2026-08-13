import type { AriaAttributes } from "react";

export interface OverlayStack {
  add: (token: symbol) => () => void;
  isTop: (token: symbol) => boolean;
}

export function createOverlayStack(): OverlayStack {
  const entries: symbol[] = [];

  return {
    add(token) {
      const previousIndex = entries.indexOf(token);
      if (previousIndex >= 0) entries.splice(previousIndex, 1);
      entries.push(token);
      let active = true;

      return () => {
        if (!active) return;
        active = false;
        const index = entries.indexOf(token);
        if (index >= 0) entries.splice(index, 1);
      };
    },
    isTop(token) {
      return entries.length > 0 && entries[entries.length - 1] === token;
    },
  };
}

interface LockBody {
  style: {
    overflow: string;
    paddingRight: string;
  };
}

export interface BodyScrollLock {
  acquire: (
    token: symbol,
    body: LockBody,
    scrollbarWidth: number,
    computedPaddingRight: number,
  ) => () => void;
}

export function createBodyScrollLock(): BodyScrollLock {
  const locks = new Set<symbol>();
  let snapshot: { body: LockBody; overflow: string; paddingRight: string } | null = null;

  return {
    acquire(token, body, scrollbarWidth, computedPaddingRight) {
      if (locks.size === 0) {
        snapshot = {
          body,
          overflow: body.style.overflow,
          paddingRight: body.style.paddingRight,
        };
        body.style.overflow = "hidden";
        if (scrollbarWidth > 0) {
          body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
        }
      }

      locks.add(token);
      let active = true;

      return () => {
        if (!active) return;
        active = false;
        locks.delete(token);
        if (locks.size === 0 && snapshot) {
          snapshot.body.style.overflow = snapshot.overflow;
          snapshot.body.style.paddingRight = snapshot.paddingRight;
          snapshot = null;
        }
      };
    },
  };
}

export function resolveRovingTabValue(
  tabs: readonly { id: string; disabled?: boolean }[],
  value: string,
) {
  const controlled = tabs.find((tab) => tab.id === value && !tab.disabled);
  return controlled?.id ?? tabs.find((tab) => !tab.disabled)?.id;
}

export function mergeAriaInvalid(
  value: AriaAttributes["aria-invalid"],
  fieldInvalid: boolean,
): AriaAttributes["aria-invalid"] {
  return fieldInvalid ? true : value;
}

export function resolveToastDuration(duration: number | undefined, persistent: boolean) {
  return persistent ? null : Math.max(0, duration ?? 5000);
}

export const sharedOverlayStack = createOverlayStack();
export const sharedBodyScrollLock = createBodyScrollLock();
