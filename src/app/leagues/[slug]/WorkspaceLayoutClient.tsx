"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLeagueWorkspace } from "@/hooks/useLeagueWorkspace";
import { LeagueWorkspaceContext } from "@/context/LeagueWorkspaceContext";
import { useLeagueTheme } from "@/context/LeagueThemeContext";
import { useEffect } from "react";

function SidebarNav({ slug, canManage }: { slug: string; canManage: boolean }) {
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
      label: "Teams",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="14" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 17c0-2.5-1.3-4.6-3.2-5.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    ...(canManage
      ? [
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
        ]
      : []),
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
                : { color: "#94a3b8" }
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

function BottomMobileNav({ slug, canManage }: { slug: string; canManage: boolean }) {
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
      label: "Teams",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="14" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 17c0-2.5-1.3-4.6-3.2-5.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    ...(canManage
      ? [
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
        ]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-800 bg-slate-950 sm:hidden">
      {items.map(({ href, label, icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-wide transition-colors"
            style={isActive ? { color: primary } : { color: "#64748b" }}
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
      setAccentColor(league.primaryColor ?? "#14B8A6");
      setBgColor(league.secondaryColor ?? "#0D1F1E");
    }
  }, [league, setAccentColor, setBgColor]);

  const initials = (league?.name ?? "").slice(0, 2).toUpperCase() || "LG";

  return (
    <LeagueWorkspaceContext.Provider value={ctx}>
      <div className="flex flex-1">

        {/* ── Sidebar (desktop) ───────────────────────────────────────────── */}
        <aside
          className="hidden sm:flex w-60 shrink-0 flex-col border-r border-slate-800/60 bg-slate-950"
          style={{ minHeight: "calc(100vh - 64px)" }}
        >
          <div className="sticky top-0 flex flex-col h-screen max-h-[calc(100vh-64px)]">

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
                <SidebarNav slug={slug} canManage={ctx.workspace.canManage} />
              )}
            </div>

            {/* ── Back to dashboard ── */}
            <div className="border-t border-slate-800/60 p-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-400 transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                All Leagues
              </Link>
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 p-4 sm:p-6 pb-20 sm:pb-6">
          {children}
        </div>
      </div>

      {/* ── Bottom nav (mobile) ──────────────────────────────────────────── */}
      {ctx.workspace && (
        <BottomMobileNav slug={slug} canManage={ctx.workspace.canManage} />
      )}
    </LeagueWorkspaceContext.Provider>
  );
}
