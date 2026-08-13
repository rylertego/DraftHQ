"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Button } from "./Action";
import { useClientMounted, useLatestRef } from "./overlayHooks";
import { sharedBodyScrollLock, sharedOverlayStack } from "./primitiveInternals";
import type { ActionScope } from "./types";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "small" | "medium" | "large";
  closeLabel?: string;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "medium",
  closeLabel = "Close dialog",
  closeOnEscape = true,
  closeOnOutsideClick = false,
  initialFocusRef,
}: DialogProps) {
  const mounted = useClientMounted();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const tokenRef = useRef<symbol>(Symbol("ui-dialog"));
  const onCloseRef = useLatestRef(onClose);
  const closeOnEscapeRef = useLatestRef(closeOnEscape);
  const initialFocusRefRef = useLatestRef(initialFocusRef);

  useEffect(() => {
    if (!open || !mounted) return;

    const token = tokenRef.current;
    const releaseOverlay = sharedOverlayStack.add(token);
    const body = document.body;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    const releaseScrollLock = sharedBodyScrollLock.acquire(token, body, scrollbarWidth, computedPaddingRight);
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = window.requestAnimationFrame(() => {
      const target = initialFocusRefRef.current?.current
        ?? dialogRef.current?.querySelector<HTMLElement>("[data-dialog-initial]")
        ?? dialogRef.current?.querySelector<HTMLElement>(focusableSelector)
        ?? dialogRef.current;
      target?.focus();
    });

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (!sharedOverlayStack.isTop(token)) return;
      if (event.key === "Escape" && closeOnEscapeRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      const shouldRestoreFocus = sharedOverlayStack.isTop(token);
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      releaseOverlay();
      releaseScrollLock();
      if (shouldRestoreFocus) restoreFocusRef.current?.focus();
    };
  }, [closeOnEscapeRef, initialFocusRefRef, mounted, onCloseRef, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="ui-dialog-backdrop"
      onPointerDown={(event) => {
        if (
          closeOnOutsideClick
          && sharedOverlayStack.isTop(tokenRef.current)
          && event.target === event.currentTarget
        ) {
          onCloseRef.current();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="ui-dialog"
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="ui-dialog__header">
          <div>
            <h2 className="ui-dialog__title" id={titleId}>{title}</h2>
            {description ? <p className="ui-dialog__description" id={descriptionId}>{description}</p> : null}
          </div>
          <button type="button" className="ui-dialog__close" aria-label={closeLabel} onClick={() => onCloseRef.current()}>{"\u00d7"}</button>
        </header>
        <div className="ui-dialog__body">{children}</div>
        {footer ? <footer className="ui-dialog__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  confirmVariant?: "primary" | "danger";
  confirmScope?: ActionScope;
  confirming?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  confirmScope = "product",
  confirming = false,
}: ConfirmDialogProps) {
  const onCloseRef = useLatestRef(onClose);
  const handleClose = useCallback(() => {
    if (!confirming) onCloseRef.current();
  }, [confirming, onCloseRef]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={title}
      closeOnEscape={!confirming}
      footer={
        <>
          <Button data-dialog-initial variant="secondary" disabled={confirming} onClick={handleClose}>{cancelLabel}</Button>
          <Button
            variant={confirmVariant}
            scope={confirmScope}
            loading={confirming}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{description}</p>
    </Dialog>
  );
}
