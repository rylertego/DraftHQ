import Link from "next/link";
import type { League } from "@/types/league";

interface LeagueWorkspaceHeaderProps {
  league: League;
  canManage: boolean;
}

export default function LeagueWorkspaceHeader({ league, canManage }: LeagueWorkspaceHeaderProps) {
  const basePath = `/leagues/${league.slug}`;

  return (
    <header
      className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
      style={{ borderColor: league.primaryColor ?? undefined }}
    >
      {league.bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={league.bannerUrl} alt="" className="h-32 w-full object-cover" />
      )}
      <div className="flex items-center gap-4 p-5">
        {league.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={league.logoUrl}
            alt={`${league.name} logo`}
            className="h-16 w-16 rounded-xl border border-slate-700 object-cover"
          />
        )}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">League workspace</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{league.name}</h1>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-slate-800 p-2">
        {[
          { href: basePath, label: "Home" },
          { href: `${basePath}/members`, label: "Members" },
          ...(canManage ? [{ href: `${basePath}/settings`, label: "Settings" }] : []),
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
