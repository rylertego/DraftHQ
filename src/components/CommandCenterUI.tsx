import type { ButtonHTMLAttributes, ReactNode } from "react";

export type CommandTone = "neutral" | "ready" | "warning" | "danger" | "complete";

export const commandInputClass =
  "w-full rounded-xl border border-slate-700/80 bg-slate-950/55 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 disabled:cursor-not-allowed disabled:opacity-50";

export const commandLabelClass =
  "mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500";

export const commandHelperClass = "mt-1.5 text-xs leading-relaxed text-slate-500";

const toneClasses: Record<CommandTone, string> = {
  neutral: "border-slate-700 bg-slate-800/70 text-slate-300",
  ready: "border-blue-400/35 bg-blue-500/12 text-blue-200",
  warning: "border-amber-400/35 bg-amber-500/12 text-amber-200",
  danger: "border-red-400/35 bg-red-500/12 text-red-200",
  complete: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
};

export function CommandStatusBadge({ label, tone = "neutral" }: { label: string; tone?: CommandTone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${toneClasses[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function CommandButton({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger"; children: ReactNode }) {
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40";
  const variantClass =
    variant === "primary"
      ? "bg-blue-500 font-black text-white shadow-[0_14px_40px_rgba(59,130,246,0.28)] hover:bg-blue-400 focus:ring-blue-300"
      : variant === "danger"
        ? "bg-red-600 font-black text-white shadow-[0_14px_40px_rgba(220,38,38,0.24)] hover:bg-red-500 focus:ring-red-300"
        : "border border-slate-700/80 bg-slate-900/60 font-bold text-slate-200 hover:border-slate-600 hover:bg-slate-800 focus:ring-slate-500";

  return (
    <button {...props} className={`${base} ${variantClass} ${className}`}>
      {children}
    </button>
  );
}

export function CommandPanel({
  eyebrow,
  title,
  description,
  action,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-800/90 bg-slate-900/72 shadow-[0_18px_50px_rgba(0,0,0,0.22)] ${className}`}>
      <div className="flex flex-col gap-3 border-b border-slate-800/80 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>}
          <h2 className="mt-1 text-base font-bold text-white">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function CommandEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/35 px-5 py-6 text-center">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

export function CommandModal({
  eyebrow,
  title,
  description,
  badge,
  children,
  footer,
  onClose,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/68 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-modal-title"
      onClick={onClose}
    >
      <div
        className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-slate-800/80 px-5 py-4 sm:px-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-blue-500" />
          <div className="flex items-start justify-between gap-4">
            <div>
              {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>}
              <h2 id="command-modal-title" className="mt-1 text-xl font-black text-white">{title}</h2>
              {description && <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>}
            </div>
            {badge}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="border-t border-slate-800/80 px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}
