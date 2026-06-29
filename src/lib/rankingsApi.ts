export interface EspnRanking {
  espn_player_id: number;
  player_name: string;
  nfl_team: string | null;
  position: string | null;
  rank: number;
}

export async function getRankings(
  scoringType: string,
  year: number = new Date().getFullYear()
): Promise<EspnRanking[]> {
  const res = await fetch(`/api/rankings?type=${scoringType}&year=${year}`);
  if (!res.ok) throw new Error("Failed to fetch rankings");
  const json = await res.json() as { rankings: EspnRanking[] };
  return json.rankings;
}

// Match ESPN rankings to our player list.
// Priority: 1) ESPN player ID, 2) normalized full name, 3) last name + position + team
// Returns a map of our player ID → ESPN rank.
export function buildRankMap(
  players: { id: string; fullName: string; externalId?: string; nflTeam?: string; position?: string }[],
  rankings: EspnRanking[]
): Map<string, number> {
  const map = new Map<string, number>();
  if (!rankings.length) return map;

  const espnById = new Map<string, EspnRanking>();
  const espnByName = new Map<string, EspnRanking>();
  const espnByLastPosTeam = new Map<string, EspnRanking>();

  for (const r of rankings) {
    espnById.set(String(r.espn_player_id), r);
    espnByName.set(normalizeName(r.player_name), r);
    if (r.nfl_team && r.position) {
      const lastName = lastName_(r.player_name);
      espnByLastPosTeam.set(`${lastName}|${r.position}|${r.nfl_team}`, r);
    }
  }

  for (const p of players) {
    const byId = p.externalId ? espnById.get(p.externalId) : undefined;
    const byName = espnByName.get(normalizeName(p.fullName));
    const byLastPosTeam =
      p.nflTeam && p.position
        ? espnByLastPosTeam.get(`${lastName_(p.fullName)}|${p.position}|${p.nflTeam}`)
        : undefined;
    const match = byId ?? byName ?? byLastPosTeam;
    if (match) {
      map.set(p.id, match.rank);
    }
  }

  return map;
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

function normalizeName(name: string): string {
  const parts = name.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/);
  const filtered = parts.filter((p) => !SUFFIXES.has(p));
  return filtered.join("");
}

function lastName_(name: string): string {
  const parts = name.trim().split(/\s+/);
  const filtered = parts.filter((p) => !SUFFIXES.has(p.toLowerCase().replace(/[^a-z]/g, "")));
  return normalizeName(filtered[filtered.length - 1] ?? parts[parts.length - 1]);
}
