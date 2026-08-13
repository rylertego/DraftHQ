"use client";

import { createPortal } from "react-dom";
import { useEffect, type ReactNode } from "react";
import { useClientMounted, useLatestRef } from "./overlayHooks";
import { resolveToastDuration } from "./primitiveInternals";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface StatusBadgeProps {
  children: ReactNode;
  status?: StatusTone;
  dot?: boolean;
}

export function StatusBadge({ children, status = "neutral", dot = false }: StatusBadgeProps) {
  return (
    <span className="ui-status-badge" data-status={status}>
      {dot ? <span className="ui-status-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export type Role = "commissioner" | "co-commissioner" | "owner" | "member";

const roleLabels: Record<Role, string> = {
  commissioner: "Commissioner",
  "co-commissioner": "Co-commissioner",
  owner: "Owner",
  member: "Member",
};

export interface RoleBadgeProps {
  role: Role;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return <span className="ui-role-badge" data-role={role}>{roleLabels[role]}</span>;
}

interface MessageProps {
  title?: ReactNode;
  children: ReactNode;
  status?: Exclude<StatusTone, "neutral">;
  action?: ReactNode;
}

export type AlertProps = MessageProps;

export function Alert({ title, children, status = "info", action }: AlertProps) {
  return (
    <div className="ui-alert" data-status={status} role={status === "danger" ? "alert" : "status"}>
      <span className="ui-alert__icon" aria-hidden="true" />
      <div className="ui-alert__copy">
        {title ? <p className="ui-alert__title">{title}</p> : null}
        <div className="ui-alert__description">{children}</div>
      </div>
      {action ? <div className="ui-alert__action">{action}</div> : null}
    </div>
  );
}

export type InlineNoticeProps = MessageProps;

export function InlineNotice({ title, children, status = "info", action }: InlineNoticeProps) {
  return (
    <div className="ui-inline-notice" data-status={status}>
      <div className="ui-alert__copy">
        {title ? <p className="ui-alert__title">{title}</p> : null}
        <div className="ui-alert__description">{children}</div>
      </div>
      {action ? <div className="ui-alert__action">{action}</div> : null}
    </div>
  );
}

export interface ToastProps extends MessageProps {
  open: boolean;
  onDismiss: () => void;
  duration?: number;
  persistent?: boolean;
}

export function Toast({
  open,
  onDismiss,
  duration,
  persistent = false,
  title,
  children,
  status = "info",
  action,
}: ToastProps) {
  const mounted = useClientMounted();
  const onDismissRef = useLatestRef(onDismiss);
  const timeoutDuration = resolveToastDuration(duration, persistent);

  useEffect(() => {
    if (!open || timeoutDuration === null) return;
    const timeout = window.setTimeout(() => onDismissRef.current(), timeoutDuration);
    return () => window.clearTimeout(timeout);
  }, [onDismissRef, open, timeoutDuration]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="ui-toast" data-status={status} role={status === "danger" ? "alert" : "status"} aria-live={status === "danger" ? "assertive" : "polite"}>
      <div className="ui-alert__copy">
        {title ? <p className="ui-alert__title">{title}</p> : null}
        <div className="ui-alert__description">{children}</div>
      </div>
      {action ? <div className="ui-alert__action">{action}</div> : null}
      <button type="button" className="ui-toast__dismiss" aria-label="Dismiss notification" onClick={() => onDismissRef.current()}>{"\u00d7"}</button>
    </div>,
    document.body,
  );
}

export interface ProgressProps {
  label: string;
  value?: number;
  max?: number;
  valueLabel?: string;
}

export function Progress({ label, value, max = 100, valueLabel }: ProgressProps) {
  const determinate = value !== undefined;
  const safeMax = Math.max(1, max);
  const normalized = determinate ? Math.min(safeMax, Math.max(0, value)) : undefined;
  const percentage = normalized === undefined ? 0 : (normalized / safeMax) * 100;
  const text = valueLabel ?? (determinate ? `${Math.round(percentage)}%` : "In progress");

  return (
    <div className="ui-progress">
      <div className="ui-progress__label-row">
        <span>{label}</span>
        <span>{text}</span>
      </div>
      <div
        className="ui-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? safeMax : undefined}
        aria-valuenow={normalized}
        aria-valuetext={text}
      >
        <span
          className="ui-progress__bar"
          data-indeterminate={!determinate || undefined}
          style={determinate ? { width: `${percentage}%` } : undefined}
        />
      </div>
    </div>
  );
}
