"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { League } from "@/types/league";
import { useLeagueTheme } from "@/context/LeagueThemeContext";

interface LeagueWorkspaceHeaderProps {
  league: League;
  canManage: boolean;
}

export default function LeagueWorkspaceHeader({ league, canManage }: LeagueWorkspaceHeaderProps) {
  const basePath = `/leagues/${league.slug}`;
  const pathname = usePathname();
  const primary = league.primaryColor ?? "#14B8A6";
  const secondary = league.secondaryColor ?? "#0D1F1E";
  const { setAccentColor, setBgColor } = useLeagueTheme();

  useEffect(() => {
    setAccentColor(primary);
    setBgColor(secondary);
  }, [primary, secondary, setAccentColor, setBgColor]);

  const nav = [
    { href: basePath, label: "Home" },
    { href: `${basePath}/teams`, label: "Teams" },
    ...(canManage ? [{ href: `${basePath}/settings`, label: "Settings" }] : []),
  ];

  return (
    <header className="overflow-hidden rounded-2xl border" style={{ borderColor: primary + "55" }}>

      {/* Hero — fixed height, banner fills and crops */}
      <div className="relative h-52 w-full">
        {league.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={league.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${secondary} 0%, ${primary}55 60%, ${secondary} 100%)` }}
          />
        )}

        {/* Bottom fade into identity row */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(2,6,23,0.92) 100%)" }}
        />

        {/* League name + label pinned to bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-4 px-6 pb-5">
          {league.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={league.logoUrl}
              alt={`${league.name} logo`}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover"
              style={{ boxShadow: `0 8px 32px ${primary}44, 0 0 0 3px ${primary}66` }}
            />
          )}
          <div className="pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: primary }}>
              League workspace
            </p>
            <h1 className="text-2xl font-bold text-white sm:text-4xl leading-tight drop-shadow-lg">{league.name}</h1>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <nav className="flex gap-1 overflow-x-auto border-t px-3 py-2" style={{ borderColor: primary + "22" }}>
        {nav.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={isActive
                ? { backgroundColor: primary + "22", color: primary }
                : { color: "#94a3b8" }
              }
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
