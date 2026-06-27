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

// Match ESPN rankings to our player list by name similarity.
// Returns a map of our player ID → ESPN rank.
export function buildRankMap(
  players: { id: string; fullName: string; nflTeam?: string; position?: string }[],
  rankings: EspnRanking[]
): Map<string, number> {
  const map = new Map<string, number>();
  if (!rankings.length) return map;

  // Index ESPN rankings by normalized name
  const espnByName = new Map<string, EspnRanking>();
  for (const r of rankings) {
    espnByName.set(normalizeName(r.player_name), r);
  }

  for (const p of players) {
    const key = normalizeName(p.fullName);
    const match = espnByName.get(key);
    if (match) {
      map.set(p.id, match.rank);
    }
  }

  return map;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}
