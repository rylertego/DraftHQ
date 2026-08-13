"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
  panelId?: string;
}

export interface TabsProps {
  tabs: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
}

export function Tabs({ tabs, value, onValueChange, label }: TabsProps) {
  const generatedId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function moveFocus(currentIndex: number, direction: 1 | -1) {
    for (let offset = 1; offset <= tabs.length; offset += 1) {
      const index = (currentIndex + direction * offset + tabs.length) % tabs.length;
      if (!tabs[index]?.disabled) {
        tabRefs.current[index]?.focus();
        onValueChange(tabs[index].id);
        return;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocus(index, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocus(index, -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const enabled = tabs.map((tab, tabIndex) => ({ tab, tabIndex })).filter(({ tab }) => !tab.disabled);
      const target = event.key === "Home" ? enabled[0] : enabled[enabled.length - 1];
      if (target) {
        tabRefs.current[target.tabIndex]?.focus();
        onValueChange(target.tab.id);
      }
    }
  }

  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        const tabId = `${generatedId}-${tab.id}-tab`;
        return (
          <button
            key={tab.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={tabId}
            type="button"
            role="tab"
            className="ui-tabs__tab"
            data-selected={selected || undefined}
            aria-selected={selected}
            aria-controls={tab.panelId ?? `${generatedId}-${tab.id}-panel`}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onValueChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined ? <span className="ui-tabs__count" aria-label={`${tab.count} items`}>{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

function useOverlayPosition(open: boolean, placement: Placement, gap = 6) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const overlay = overlayRef.current;
    if (!anchor || !overlay) return;

    const margin = 8;
    const anchorRect = anchor.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const prefersTop = placement.startsWith("top");
    const alignsEnd = placement.endsWith("end");
    const roomBelow = window.innerHeight - anchorRect.bottom;
    const roomAbove = anchorRect.top;
    const useTop = prefersTop ? roomAbove >= overlayRect.height + gap || roomAbove > roomBelow : roomBelow < overlayRect.height + gap && roomAbove > roomBelow;
    const rawTop = useTop ? anchorRect.top - overlayRect.height - gap : anchorRect.bottom + gap;
    const rawLeft = alignsEnd ? anchorRect.right - overlayRect.width : anchorRect.left;

    setPosition({
      position: "fixed",
      top: Math.max(margin, Math.min(rawTop, window.innerHeight - overlayRect.height - margin)),
      left: Math.max(margin, Math.min(rawLeft, window.innerWidth - overlayRect.width - margin)),
      visibility: "visible",
    });
  }, [gap, placement]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return { anchorRef, overlayRef, position };
}

function useDismissableOverlay(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  anchorRef: React.RefObject<HTMLElement | null>,
  overlayRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !overlayRef.current?.contains(target)) {
        onOpenChange(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        anchorRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onOpenChange, open, overlayRef]);
}

function useControllableOpen(open: boolean | undefined, onOpenChange: ((open: boolean) => void) | undefined) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = useCallback((next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange, open]);
  return [isOpen, setOpen] as const;
}

export interface MenuItem {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export interface MenuProps {
  trigger: ReactNode;
  label: string;
  items: readonly MenuItem[];
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Menu({ trigger, label, items, placement = "bottom-end", open, onOpenChange }: MenuProps) {
  const [isOpen, setOpen] = useControllableOpen(open, onOpenChange);
  const { anchorRef, overlayRef, position } = useOverlayPosition(isOpen, placement);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useDismissableOverlay(isOpen, setOpen, anchorRef, overlayRef);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => itemRefs.current.find((item) => item && !item.disabled)?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled));
    if (enabled.length === 0) return;
    const current = enabled.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === "ArrowDown") next = (current + 1) % enabled.length;
    if (event.key === "ArrowUp") next = (current - 1 + enabled.length) % enabled.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = enabled.length - 1;
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (next >= 0) {
      event.preventDefault();
      enabled[next]?.focus();
    }
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="ui-overlay-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
      >
        {trigger}
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={overlayRef}
              role="menu"
              aria-label={label}
              className="ui-menu"
              style={position}
              onKeyDown={handleMenuKeyDown}
            >
              {items.map((item, index) => (
                <button
                  key={item.id}
                  ref={(element) => { itemRefs.current[index] = element; }}
                  type="button"
                  role="menuitem"
                  className="ui-menu__item"
                  data-danger={item.danger || undefined}
                  disabled={item.disabled}
                  tabIndex={-1}
                  onClick={() => {
                    item.onSelect();
                    setOpen(false);
                    anchorRef.current?.focus();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export interface PopoverProps {
  trigger: ReactNode;
  triggerLabel: string;
  children: ReactNode;
  label?: string;
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({
  trigger,
  triggerLabel,
  children,
  label,
  placement = "bottom-start",
  open,
  onOpenChange,
}: PopoverProps) {
  const [isOpen, setOpen] = useControllableOpen(open, onOpenChange);
  const { anchorRef, overlayRef, position } = useOverlayPosition(isOpen, placement);
  const id = useId();
  useDismissableOverlay(isOpen, setOpen, anchorRef, overlayRef);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="ui-overlay-trigger"
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        onClick={() => setOpen(!isOpen)}
      >
        {trigger}
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div ref={overlayRef} id={id} role={label ? "dialog" : undefined} aria-label={label} className="ui-popover" style={position} tabIndex={-1}>
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  placement?: Placement;
}

export function Tooltip({ children, content, placement = "top-start" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const { anchorRef, overlayRef, position } = useOverlayPosition(open, placement, 4);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function close(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="ui-tooltip-trigger"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div ref={overlayRef} id={id} role="tooltip" className="ui-tooltip" style={position}>
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
