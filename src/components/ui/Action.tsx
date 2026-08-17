import Link from "next/link";
import type { MouseEvent } from "react";
import type { ActionProps, ButtonProps, IconButtonProps, LinkButtonProps } from "./types";

function joinClassNames(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(" ");
}

function actionClasses({
  variant = "primary",
  scope = "product",
  fullWidth = false,
}: ActionProps) {
  const base = [
    "inline-flex h-[var(--control-height-touch)] items-center justify-center gap-[var(--space-2)] px-[var(--space-3)]",
    "rounded-[var(--radius-control)] transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
    "[font-family:var(--font-family-control)] text-[length:var(--font-size-control)] leading-[var(--line-height-control)] font-[var(--font-weight-control)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    "sm:h-[var(--control-height-md)]",
  ];

  const variantClass =
    variant === "primary"
      ? scope === "league"
        ? "bg-[var(--color-league-accent)] text-[var(--color-league-accent-foreground)] hover:bg-[var(--color-league-accent-hover)]"
        : "bg-[var(--color-product-accent)] text-[var(--color-product-accent-foreground)] hover:bg-[var(--color-product-accent-hover)]"
      : variant === "secondary"
        ? "border border-[color:var(--color-border-strong)] bg-[var(--color-surface-2)] text-[color:var(--color-text-primary)] hover:bg-[var(--color-surface-3)]"
        : variant === "tertiary"
          ? "text-[color:var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[color:var(--color-text-primary)]"
          : "bg-[var(--color-danger)] text-[var(--color-danger-foreground)] hover:bg-[var(--color-danger-hover)] focus-visible:ring-[var(--color-danger-focus-ring)]";

  return joinClassNames(base.join(" "), variantClass, fullWidth && "w-full");
}

function ActionButton({
  variant = "primary",
  scope = "product",
  loading = false,
  fullWidth = false,
  disabled,
  type = "button",
  children,
  iconOnly = false,
  ...props
}: ButtonProps & { iconOnly?: boolean }) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={joinClassNames(
        actionClasses({ variant, scope, fullWidth }),
        iconOnly && "w-[var(--control-height-touch)] shrink-0 px-0 sm:w-[var(--control-height-md)]",
      )}
    >
      {loading ? <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}

export function Button(props: ButtonProps) {
  return <ActionButton {...props} />;
}

export function LinkButton({
  variant = "primary",
  scope = "product",
  loading = false,
  fullWidth = false,
  disabled = false,
  children,
  onClick,
  ...props
}: LinkButtonProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }

    onClick?.(event);
  }

  return (
    <Link
      {...props}
      aria-busy={loading || undefined}
      aria-disabled={disabled || loading || undefined}
      tabIndex={disabled || loading ? -1 : undefined}
      onClick={handleClick}
      className={actionClasses({ variant, scope, fullWidth })}
    >
      {loading ? <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </Link>
  );
}

export function IconButton({ label, children, title, ...props }: IconButtonProps) {
  return (
    <ActionButton
      {...props}
      aria-label={label}
      title={title ?? label}
      iconOnly
    >
      {children}
    </ActionButton>
  );
}

export type { ActionProps, ButtonProps, IconButtonProps, LinkButtonProps } from "./types";
