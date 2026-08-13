import type { CSSProperties } from "react";
import type {
  ContentWidth,
  DataSurfaceProps,
  FormLayoutProps,
  PageHeaderProps,
  PageShellProps,
  PanelProps,
  SectionProps,
  SettingsShellProps,
  WorkspaceToolbarProps,
} from "./types";

export const contentWidths = {
  readable: "max-w-[720px]",
  workspace: "max-w-[1600px]",
  full: "max-w-none",
} satisfies Record<ContentWidth, string>;

const pageTitleStyle: CSSProperties = {
  fontFamily: "var(--font-family-page-title)",
  fontSize: "var(--font-size-page-title)",
  fontWeight: "var(--font-weight-page-title)",
  lineHeight: "var(--line-height-page-title)",
};

const sectionTitleStyle: CSSProperties = {
  fontFamily: "var(--font-family-section-title)",
  fontSize: "var(--font-size-section-title)",
  fontWeight: "var(--font-weight-section-title)",
  lineHeight: "var(--line-height-section-title)",
};

const bodyStyle: CSSProperties = {
  fontFamily: "var(--font-family-body)",
  fontSize: "var(--font-size-body)",
  fontWeight: "var(--font-weight-body)",
  lineHeight: "var(--line-height-body)",
};

function joinClassNames(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(" ");
}

function SectionHeading({
  title,
  description,
  actions,
}: Pick<SectionProps, "title" | "description" | "actions">) {
  if (!title && !description && !actions) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {title ? (
          <h2 className="text-[color:var(--color-text-primary)]" style={sectionTitleStyle}>
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="mt-[var(--space-1)] max-w-3xl text-[color:var(--color-text-secondary)]" style={bodyStyle}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-[var(--density-control-gap)]">{actions}</div> : null}
    </div>
  );
}

export function PageShell({
  width = "workspace",
  expression = "operations",
  children,
  className,
  ...props
}: PageShellProps) {
  const expressionClass = expression === "draft-night" ? "max-w-none" : contentWidths[width];

  return (
    <div
      {...props}
      className={joinClassNames("mx-auto w-full px-[var(--space-4)] py-[var(--space-6)] sm:px-[var(--space-6)]", expressionClass, className)}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  eyebrow,
  description,
  identity,
  status,
  actions,
  divider = false,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      {...props}
      className={joinClassNames(
        "flex flex-col gap-[var(--space-4)] pb-[var(--space-4)] sm:flex-row sm:items-start sm:justify-between",
        divider && "border-b border-[color:var(--color-border-subtle)]",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p
            className="text-[color:var(--color-text-muted)] uppercase"
            style={{
              fontFamily: "var(--font-family-eyebrow)",
              fontSize: "var(--font-size-eyebrow)",
              fontWeight: "var(--font-weight-eyebrow)",
              lineHeight: "var(--line-height-eyebrow)",
              letterSpacing: 0,
            }}
          >
            {eyebrow}
          </p>
        ) : null}
        <div className="mt-[var(--space-1)] flex flex-wrap items-center gap-[var(--space-2)]">
          {identity}
          <h1 className="text-[color:var(--color-text-primary)]" style={pageTitleStyle}>
            {title}
          </h1>
          {status}
        </div>
        {description ? (
          <p className="mt-[var(--space-2)] max-w-3xl text-[color:var(--color-text-secondary)]" style={bodyStyle}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-[var(--density-control-gap)]">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  divider = false,
  children,
  className,
  ...props
}: SectionProps) {
  const hasHeading = Boolean(title || description || actions);

  return (
    <section
      {...props}
      className={joinClassNames(divider && "border-t border-[color:var(--color-border-subtle)] pt-[var(--space-4)]", className)}
    >
      <SectionHeading title={title} description={description} actions={actions} />
      <div className={joinClassNames(hasHeading && "mt-[var(--space-4)]")}>{children}</div>
    </section>
  );
}

export function Panel({
  title,
  description,
  actions,
  footer,
  children,
  className,
  ...props
}: PanelProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section
      {...props}
      className={joinClassNames(
        "overflow-hidden border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-1)]",
        "rounded-[var(--radius-panel)]",
        className,
      )}
    >
      {hasHeader ? (
        <div className="border-b border-[color:var(--color-border-subtle)] px-[var(--space-4)] py-[var(--space-3)]">
          <SectionHeading title={title} description={description} actions={actions} />
        </div>
      ) : null}
      <div className="p-[var(--space-4)]">{children}</div>
      {footer ? <div className="border-t border-[color:var(--color-border-subtle)] p-[var(--space-4)]">{footer}</div> : null}
    </section>
  );
}

export function DataSurface({ children, label, className, ...props }: DataSurfaceProps) {
  const ariaLabel = label ?? props["aria-label"];

  return (
    <div
      {...props}
      aria-label={ariaLabel}
      className={joinClassNames(
        "overflow-x-auto border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-1)]",
        "rounded-[var(--radius-surface)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FormLayout({ children, actions, className, ...props }: FormLayoutProps) {
  return (
    <form {...props} className={joinClassNames("flex w-full max-w-[720px] flex-col gap-[var(--space-4)]", className)}>
      {children}
      {actions ? <div className="flex flex-wrap items-center gap-[var(--density-control-gap)] pt-[var(--space-2)]">{actions}</div> : null}
    </form>
  );
}

export function SettingsShell({
  header,
  tabs,
  toolbar,
  children,
  className,
  ...props
}: SettingsShellProps) {
  return (
    <div {...props} className={joinClassNames("flex min-w-0 flex-col gap-[var(--space-6)]", className)}>
      {header}
      {tabs ? <div className="border-b border-[color:var(--color-border-subtle)]">{tabs}</div> : null}
      {toolbar}
      {children}
    </div>
  );
}

export function WorkspaceToolbar({ children, label = "Workspace controls", className, ...props }: WorkspaceToolbarProps) {
  return (
    <div
      {...props}
      role="toolbar"
      aria-label={label}
      className={joinClassNames(
        "flex flex-wrap items-center justify-between gap-[var(--density-control-gap)] border-y border-[color:var(--color-border-subtle)] py-[var(--space-2)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
