"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LeagueAccessDenied from "@/components/LeagueAccessDenied";
import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";
import { LeagueWorkspaceContext } from "@/context/LeagueWorkspaceContext";
import { DEFAULT_ACCENT, DEFAULT_BG, useLeagueTheme } from "@/context/LeagueThemeContext";
import { useEffect } from "react";
import { PageShell } from "@/components/ui";

function SidebarNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const { accentColor: primary } = useLeagueTheme();
  const base = `/leagues/${slug}`;

  const items = [
    {
      href: base,
      label: "Home",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <path d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 18v-6h6v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: `${base}/teams`,
      label: "League",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="14" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 17c0-2.5-1.3-4.6-3.2-5.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: `${base}/my-team`,
      label: "My Team",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <path d="M10 2.5l5.5 2v4.2c0 3.6-2.2 6.8-5.5 8.8-3.3-2-5.5-5.2-5.5-8.8V4.5l5.5-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7.5 10.2l1.7 1.7 3.4-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    // Settings is role-aware: commissioners configure the league, members get
    // a membership screen whose only action is leaving. Both need the entry.
    {
      href: `${base}/settings`,
      label: "Settings",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
            style={
              isActive
                ? { backgroundColor: primary + "1a", color: primary }
                : { color: "var(--color-text-secondary)" }
            }
          >
            <span
              className="transition-colors"
              style={isActive ? { color: primary } : {}}
            >
              {icon}
            </span>
            {label}
            {isActive && (
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: primary }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function BottomMobileNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const { accentColor: primary } = useLeagueTheme();
  const base = `/leagues/${slug}`;

  const items = [
    {
      href: base,
      label: "Home",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <path d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 18v-6h6v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: `${base}/teams`,
      label: "League",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="14" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 17c0-2.5-1.3-4.6-3.2-5.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: `${base}/my-team`,
      label: "My Team",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <path d="M10 2.5l5.5 2v4.2c0 3.6-2.2 6.8-5.5 8.8-3.3-2-5.5-5.2-5.5-8.8V4.5l5.5-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7.5 10.2l1.7 1.7 3.4-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    // Settings is role-aware: commissioners configure the league, members get
    // a membership screen whose only action is leaving. Both need the entry.
    {
      href: `${base}/settings`,
      label: "Settings",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[color:var(--color-border-subtle)] bg-[var(--color-canvas)] sm:hidden">
      {items.map(({ href, label, icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-wide transition-colors"
            style={isActive ? { color: primary } : { color: "var(--color-text-muted)" }}
          >
            {icon}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function WorkspaceLayoutClient({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const ctx = useLeagueWorkspace(slug);
  const { setAccentColor, setBgColor, accentColor: primary, bgColor: secondary } = useLeagueTheme();

  const league = ctx.workspace?.league;

  useEffect(() => {
    if (league) {
      setAccentColor(league.primaryColor ?? DEFAULT_ACCENT);
      setBgColor(league.secondaryColor ?? DEFAULT_BG);
      return;
    }

    if (ctx.failure && !ctx.workspace) {
      setAccentColor(DEFAULT_ACCENT);
      setBgColor(DEFAULT_BG);
    }
  }, [ctx.failure, ctx.workspace, league, setAccentColor, setBgColor]);

  const initials = (league?.name ?? "").slice(0, 2).toUpperCase() || "LG";

  // Replace the whole workspace chrome rather than rendering the denial inside
  // it — the sidebar would otherwise sit there with an empty league identity,
  // and every /leagues/[slug]/* route gets this for free.
  if (ctx.failure && !ctx.workspace) {
    return (
      <LeagueAccessDenied
        failure={ctx.failure}
        detail={ctx.failure === "error" ? ctx.error : undefined}
        onRetry={ctx.reload}
      />
    );
  }

  return (
    <LeagueWorkspaceContext.Provider value={ctx}>
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── Sidebar (desktop) ───────────────────────────────────────────── */}
        <aside
          className="hidden w-60 shrink-0 flex-col border-r border-[color:var(--color-border-subtle)] bg-[var(--color-canvas)] sm:flex"
        >
          <div className="flex h-full flex-col">

            {/* ── Full-bleed identity panel ── */}
            <div
              className="relative flex flex-col items-center overflow-hidden px-4 pb-5 pt-6"
              style={{ backgroundColor: secondary }}
            >
              {/* Banner as blurred bg if available */}
              {league?.bannerUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-20"
                  style={{ backgroundImage: `url(${league.bannerUrl})`, filter: "blur(8px)", transform: "scale(1.1)" }}
                />
              )}

              {/* Gradient overlay — fades to solid secondary at bottom */}
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${primary}33 0%, transparent 70%), linear-gradient(to bottom, transparent 40%, ${secondary} 100%)`,
                }}
              />

              {/* Logo */}
              <div className="relative">
                <div
                  className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl text-2xl font-black text-white"
                  style={{
                    backgroundColor: primary + "22",
                    boxShadow: `0 8px 32px ${primary}33`,
                  }}
                >
                  {league?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={league.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span style={{ color: primary }}>{initials}</span>
                  )}
                </div>
              </div>

              {/* Name + label */}
              <div className="relative mt-3 text-center">
                <p className="text-sm font-bold text-white leading-snug px-1">
                  {league?.name ?? "Loading…"}
                </p>
                <p
                  className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: primary }}
                >
                  {ctx.workspace
                    ? `${ctx.workspace.members.length} member${ctx.workspace.members.length !== 1 ? "s" : ""}`
                    : "League"}
                </p>
              </div>
            </div>

            {/* ── Nav ── */}
            <div className="flex-1 overflow-y-auto p-3 pt-4">
              {ctx.workspace && (
                <SidebarNav slug={slug} />
              )}
            </div>

          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        {/* Width contract for every league route: workspace by default. Form
            routes opt into a readable inner column themselves. pb-20 keeps the
            mobile bottom nav from covering the last row of content. */}
        <div className="min-w-0 flex-1 overflow-y-auto pb-20 sm:pb-0">
          <PageShell width="workspace">{children}</PageShell>
        </div>
      </div>

      {/* ── Bottom nav (mobile) ──────────────────────────────────────────── */}
      {ctx.workspace && (
        <BottomMobileNav slug={slug} />
      )}
    </LeagueWorkspaceContext.Provider>
  );
}
