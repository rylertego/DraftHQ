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
  type RefObject,
} from "react";
import {
  useClientMounted,
  useLatestRef,
  useOverlayToken,
  useStableCallback,
} from "./overlayHooks";
import { resolveRovingTabValue, sharedOverlayStack } from "./primitiveInternals";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

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
  const activeValue = resolveRovingTabValue(tabs, value);

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
        const selected = tab.id === activeValue;
        return (
          <button
            key={tab.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={`${generatedId}-${tab.id}-tab`}
            type="button"
            role="tab"
            className="ui-tabs__tab"
            data-selected={selected || undefined}
            aria-selected={selected}
            aria-controls={tab.panelId}
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
type TriggerIconName = "chevron-down" | "info" | "mail" | "more-horizontal";
/** Unread count rendered on the trigger. Omitted or 0 renders nothing.
 *  A number, not a node, so a badge cannot become a nested control. */
type TriggerBadge = { badgeCount?: number };
type TriggerVisual = TriggerBadge &
  (
    | { triggerText: string; triggerIcon?: TriggerIconName }
    | { triggerText?: never; triggerIcon: TriggerIconName }
  );

type PrimitiveTriggerProps = {
  triggerText?: string;
  triggerIcon?: TriggerIconName;
  badgeCount?: number;
  label: string;
  className: "ui-overlay-trigger" | "ui-tooltip-trigger";
  expanded?: boolean;
  controls?: string;
  popup?: "menu" | "dialog";
  describedBy?: string;
  anchorRef: RefObject<HTMLButtonElement | null>;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

function SemanticTriggerIcon({ name }: { name: TriggerIconName }) {
  const commonProps = {
    "aria-hidden": true,
    fill: "none",
    focusable: "false" as const,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  if (name === "chevron-down") {
    return <svg {...commonProps}><path d="m6 9 6 6 6-6" /></svg>;
  }

  if (name === "mail") {
    return (
      <svg {...commonProps}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="m2 8 10 6 10-6" />
      </svg>
    );
  }

  if (name === "info") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PrimitiveTrigger({
  label,
  triggerText,
  triggerIcon,
  badgeCount,
  className,
  expanded,
  controls,
  popup,
  describedBy,
  anchorRef,
  ...events
}: PrimitiveTriggerProps) {
  return (
    <button
      ref={anchorRef}
      type="button"
      className={className}
      aria-label={label}
      aria-haspopup={popup}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-describedby={describedBy}
      {...events}
    >
      {/* Label first, affordance after. A chevron is a disclosure hint and
          conventionally trails what it discloses; leading it reads as a stray
          glyph in front of the text. Icon-only triggers are unaffected. */}
      {triggerText ? <span>{triggerText}</span> : null}
      {triggerIcon ? (
        <span className="ui-overlay-trigger__icon" aria-hidden="true">
          <SemanticTriggerIcon name={triggerIcon} />
        </span>
      ) : null}
      {badgeCount && badgeCount > 0 ? (
        <span className="ui-overlay-trigger__badge">{badgeCount > 9 ? "9+" : badgeCount}</span>
      ) : null}
    </button>
  );
}

function useOverlayPosition(open: boolean, placement: Placement, gap = 6) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const overlay = overlayRef.current;
    if (!anchor || !overlay) return;

    const margin = 8;
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const anchorRect = anchor.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const prefersTop = placement.startsWith("top");
    const alignsEnd = placement.endsWith("end");
    const roomBelow = viewportBottom - anchorRect.bottom;
    const roomAbove = anchorRect.top - viewportTop;
    const useTop = prefersTop
      ? roomAbove >= overlayRect.height + gap || roomAbove > roomBelow
      : roomBelow < overlayRect.height + gap && roomAbove > roomBelow;
    const rawTop = useTop ? anchorRect.top - overlayRect.height - gap : anchorRect.bottom + gap;
    const rawLeft = alignsEnd ? anchorRect.right - overlayRect.width : anchorRect.left;

    setPosition({
      position: "fixed",
      top: Math.max(viewportTop + margin, Math.min(rawTop, viewportBottom - overlayRect.height - margin)),
      left: Math.max(viewportLeft + margin, Math.min(rawLeft, viewportRight - overlayRect.width - margin)),
      visibility: "visible",
    });
  }, [gap, placement]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    const viewport = window.visualViewport;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (overlayRef.current) observer?.observe(overlayRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, [open, update]);

  return { anchorRef, overlayRef, position };
}

function useDismissableOverlay(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  anchorRef: RefObject<HTMLElement | null>,
  overlayRef: RefObject<HTMLElement | null>,
  restoreOnEscape = true,
) {
  const token = useOverlayToken(open);
  const onOpenChangeRef = useLatestRef(onOpenChange);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!sharedOverlayStack.isTop(token)) return;
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !overlayRef.current?.contains(target)) {
        onOpenChangeRef.current(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || !sharedOverlayStack.isTop(token)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onOpenChangeRef.current(false);
      if (restoreOnEscape) anchorRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onOpenChangeRef, open, overlayRef, restoreOnEscape, token]);
}

function useControllableOpen(open: boolean | undefined, onOpenChange: ((open: boolean) => void) | undefined) {
  const [internalOpen, setInternalOpen] = useState(false);
  const onOpenChangeRef = useLatestRef(onOpenChange);
  const isOpen = open ?? internalOpen;
  const setOpen = useStableCallback((next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChangeRef.current?.(next);
  });
  return [isOpen, setOpen] as const;
}

export interface MenuItem {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface MenuBaseProps {
  label: string;
  items: readonly MenuItem[];
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export type MenuProps = MenuBaseProps & TriggerVisual;

export function Menu({
  triggerText,
  triggerIcon,
  badgeCount,
  label,
  items,
  placement = "bottom-end",
  open,
  onOpenChange,
}: MenuProps) {
  const mounted = useClientMounted();
  const [isOpen, setOpen] = useControllableOpen(open, onOpenChange);
  const { anchorRef, overlayRef, position } = useOverlayPosition(isOpen && mounted, placement);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useDismissableOverlay(isOpen, setOpen, anchorRef, overlayRef);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    const frame = window.requestAnimationFrame(() => itemRefs.current.find((item) => item && !item.disabled)?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, mounted]);

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
      <PrimitiveTrigger
        anchorRef={anchorRef}
        className="ui-overlay-trigger"
        label={label}
        triggerText={triggerText}
        triggerIcon={triggerIcon}
        badgeCount={badgeCount}
        popup="menu"
        expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
      />
      {mounted && isOpen
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

interface PopoverBaseProps {
  triggerLabel: string;
  children: ReactNode;
  label?: string;
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export type PopoverProps = PopoverBaseProps & TriggerVisual;

export function Popover({
  triggerText,
  triggerIcon,
  badgeCount,
  triggerLabel,
  children,
  label,
  placement = "bottom-start",
  open,
  onOpenChange,
}: PopoverProps) {
  const mounted = useClientMounted();
  const [isOpen, setOpen] = useControllableOpen(open, onOpenChange);
  const { anchorRef, overlayRef, position } = useOverlayPosition(isOpen && mounted, placement);
  const id = useId();
  const interactive = Boolean(label);
  useDismissableOverlay(isOpen, setOpen, anchorRef, overlayRef);

  useEffect(() => {
    if (!isOpen || !mounted || !interactive) return;
    const anchor = anchorRef.current;
    const frame = window.requestAnimationFrame(() => {
      const target = overlayRef.current?.querySelector<HTMLElement>(focusableSelector) ?? overlayRef.current;
      target?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      anchor?.focus();
    };
  }, [anchorRef, interactive, isOpen, mounted, overlayRef]);

  return (
    <>
      <PrimitiveTrigger
        anchorRef={anchorRef}
        className="ui-overlay-trigger"
        label={triggerLabel}
        triggerText={triggerText}
        triggerIcon={triggerIcon}
        badgeCount={badgeCount}
        popup={interactive ? "dialog" : undefined}
        expanded={isOpen}
        controls={isOpen ? id : undefined}
        onClick={() => setOpen(!isOpen)}
      />
      {mounted && isOpen
        ? createPortal(
            <div
              ref={overlayRef}
              id={id}
              role={interactive ? "dialog" : undefined}
              aria-label={label}
              className="ui-popover"
              style={position}
              tabIndex={-1}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

interface TooltipBaseProps {
  triggerLabel: string;
  content: ReactNode;
  placement?: Placement;
}

export type TooltipProps = TooltipBaseProps & TriggerVisual;

export function Tooltip({ triggerText, triggerIcon, triggerLabel, content, placement = "top-start" }: TooltipProps) {
  const mounted = useClientMounted();
  const [open, setOpen] = useState(false);
  const { anchorRef, overlayRef, position } = useOverlayPosition(open && mounted, placement, 4);
  const id = useId();
  const token = useOverlayToken(open);

  useEffect(() => {
    if (!open) return;
    function close(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && sharedOverlayStack.isTop(token)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open, token]);

  return (
    <>
      <PrimitiveTrigger
        anchorRef={anchorRef}
        className="ui-tooltip-trigger"
        label={triggerLabel}
        triggerText={triggerText}
        triggerIcon={triggerIcon}
        describedBy={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {mounted && open
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
