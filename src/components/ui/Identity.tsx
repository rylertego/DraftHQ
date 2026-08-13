import type { ReactNode } from "react";

export type IdentitySize = "small" | "medium" | "large" | "display";

const sizePixels: Record<IdentitySize, number> = {
  small: 24,
  medium: 36,
  large: 48,
  display: 72,
};

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return `${words[0]?.[0] ?? ""}${words.length > 1 ? words[words.length - 1]?.[0] ?? "" : ""}`.toUpperCase();
}

interface IdentityMarkProps {
  name: string;
  src?: string | null;
  size?: IdentitySize;
  framed?: boolean;
  kind: "avatar" | "team" | "league";
}

function IdentityMark({ name, src, size = "medium", framed = false, kind }: IdentityMarkProps) {
  const pixels = sizePixels[size];
  return (
    <span
      className="ui-identity-mark"
      data-kind={kind}
      data-size={size}
      data-framed={framed || undefined}
      role={src ? undefined : "img"}
      aria-label={src ? undefined : name}
    >
      {src ? (
        // Identity assets may come from league-configured storage URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={pixels}
          height={pixels}
          className="ui-identity-mark__image"
        />
      ) : (
        <span className="ui-identity-mark__fallback" aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: IdentitySize;
}

export function Avatar(props: AvatarProps) {
  return <IdentityMark {...props} kind="avatar" />;
}

export interface TeamMarkProps extends AvatarProps {
  framed?: boolean;
}

export function TeamMark(props: TeamMarkProps) {
  return <IdentityMark {...props} kind="team" />;
}

export interface LeagueMarkProps extends AvatarProps {
  framed?: boolean;
}

export function LeagueMark(props: LeagueMarkProps) {
  return <IdentityMark {...props} kind="league" />;
}

export interface EmptyStateProps {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  identity?: ReactNode;
}

export function EmptyState({ title, description, action, identity }: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      {identity ? <div className="ui-empty-state__identity">{identity}</div> : null}
      <h3 className="ui-empty-state__title">{title}</h3>
      <div className="ui-empty-state__description">{description}</div>
      {action ? <div className="ui-empty-state__action">{action}</div> : null}
    </div>
  );
}

export type SkeletonWidth = "full" | "three-quarter" | "half" | "quarter";
export type SkeletonHeight = "caption" | "body" | "control" | "row" | "mark-small" | "mark-medium" | "mark-large";

export interface SkeletonProps {
  width?: SkeletonWidth;
  height?: SkeletonHeight;
  shape?: "line" | "square" | "circle";
  label?: string;
}

export function Skeleton({ width = "full", height = "body", shape = "line", label }: SkeletonProps) {
  return (
    <span
      className="ui-skeleton"
      data-width={width}
      data-height={height}
      data-shape={shape}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
