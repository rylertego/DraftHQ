import Link from "next/link";
import type { League } from "@/types/league";

interface LeagueWorkspaceHeaderProps {
  league: League;
  canManage: boolean;
}

export default function LeagueWorkspaceHeader({
  league,
  canManage,
}: LeagueWorkspaceHeaderProps) {
  const basePath = `/leagues/${league.slug}`;

  return (
    <header
      className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-950"
      style={{ borderColor: league.primaryColor ?? undefined }}
    >
      {league.bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={league.bannerUrl}
          alt=""
          className="h-32 w-full object-cover"
        />
      )}
      <div className="flex items-center gap-4 p-5">
        {league.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={league.logoUrl}
            alt={`${league.name} logo`}
            className="h-16 w-16 rounded-lg border border-gray-700 object-cover"
          />
        )}
        <div>
          <p className="text-sm uppercase tracking-widest text-gray-400">
            League workspace
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">{league.name}</h1>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-gray-800 p-2">
        <Link className="rounded px-3 py-2 text-sm hover:bg-gray-800" href={basePath}>
          Home
        </Link>
        <Link className="rounded px-3 py-2 text-sm hover:bg-gray-800" href={`${basePath}/members`}>
          Members
        </Link>
        <Link className="rounded px-3 py-2 text-sm hover:bg-gray-800" href={`${basePath}/seasons`}>
          Seasons
        </Link>
        {canManage && (
          <Link className="rounded px-3 py-2 text-sm hover:bg-gray-800" href={`${basePath}/settings`}>
            Settings
          </Link>
        )}
      </nav>
    </header>
  );
}
