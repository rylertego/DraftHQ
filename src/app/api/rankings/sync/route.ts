import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ESPN_BASE = "https://fantasy.espn.com/apis/v3/games/ffl";

// ESPN position IDs → fantasy position abbreviation
const ESPN_POS: Record<number, string> = {
  1: "QB", 2: "RB", 4: "WR", 3: "TE", 5: "K", 16: "DST",
};

// ESPN pro team IDs → NFL abbreviation
const ESPN_TEAM: Record<number, string> = {
  1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL",
  7: "DEN", 8: "DET", 9: "GB", 10: "TEN", 11: "IND", 12: "KC",
  13: "LV", 14: "LAR", 15: "MIA", 16: "MIN", 17: "NE", 18: "NO",
  19: "NYG", 20: "NYJ", 21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC",
  25: "SF", 26: "SEA", 27: "TB", 28: "WAS", 29: "CAR", 30: "JAX",
  33: "BAL", 34: "HOU",
};

// ESPN rankType key → our scoring_type
const RANK_TYPE: Record<string, string> = {
  standard: "STANDARD",
  ppr: "PPR",
  half_ppr: "HALF_PPR",
};

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);

  // Fetch the PPR leaguedefaults view — it includes draftRanksByRankType for all formats
  const url =
    `${ESPN_BASE}/seasons/${year}/segments/0/leaguedefaults/3` +
    `?view=kona_player_info`;

  let raw: { players?: EspnPlayer[] };
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // no cache — we want fresh data
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json({ error: `ESPN returned ${res.status}` }, { status: 502 });
    }
    raw = await res.json();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "ESPN fetch failed" },
      { status: 502 }
    );
  }

  const players = raw.players ?? [];
  if (players.length === 0) {
    return Response.json({ error: "ESPN returned no players" }, { status: 502 });
  }

  // Build rows for each scoring type
  const rows: EspnRankingRow[] = [];
  const now = new Date().toISOString();

  for (const p of players) {
    const espnId = p.id;
    const name = p.player?.fullName ?? "Unknown";
    const nflTeam = ESPN_TEAM[p.onTeamId ?? 0] ?? null;
    const position = ESPN_POS[p.player?.defaultPositionId ?? 0] ?? null;
    const ranksByType = p.draftRanksByRankType ?? {};

    for (const [scoringType, espnKey] of Object.entries(RANK_TYPE)) {
      const rank = ranksByType[espnKey]?.rank;
      if (!rank) continue;
      rows.push({
        season_year: year,
        scoring_type: scoringType,
        espn_player_id: espnId,
        player_name: name,
        nfl_team: nflTeam,
        position,
        rank,
        fetched_at: now,
      });
    }

    // Superflex: copy from standard but promote QBs (rank stays same — just tag it)
    const stdRank = ranksByType["STANDARD"]?.rank;
    if (stdRank) {
      rows.push({
        season_year: year,
        scoring_type: "superflex",
        espn_player_id: espnId,
        player_name: name,
        nfl_team: nflTeam,
        position,
        rank: stdRank,
        fetched_at: now,
      });
    }
  }

  // For superflex: re-rank QBs by boosting them toward the top
  const sfRows = rows.filter((r) => r.scoring_type === "superflex");
  const qbRows = sfRows.filter((r) => r.position === "QB").sort((a, b) => a.rank - b.rank);
  const nonQbRows = sfRows.filter((r) => r.position !== "QB").sort((a, b) => a.rank - b.rank);
  // Interleave: every other slot gets a QB until QBs run out
  let sfRank = 1;
  const qbIter = qbRows[Symbol.iterator]();
  const nonQbIter = nonQbRows[Symbol.iterator]();
  let qbNext = qbIter.next();
  let nonQbNext = nonQbIter.next();
  // Put QB roughly every 3rd pick in superflex (approximate)
  while (!qbNext.done || !nonQbNext.done) {
    if (!qbNext.done && (sfRank % 3 === 0 || nonQbNext.done)) {
      qbNext.value.rank = sfRank++;
      qbNext = qbIter.next();
    } else if (!nonQbNext.done) {
      nonQbNext.value.rank = sfRank++;
      nonQbNext = nonQbIter.next();
    }
  }

  const { error } = await supabaseAdmin
    .from("espn_rankings")
    .upsert(rows, { onConflict: "season_year,scoring_type,espn_player_id" });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ synced: rows.length, year });
}

interface EspnPlayer {
  id: number;
  onTeamId?: number;
  player?: {
    fullName?: string;
    defaultPositionId?: number;
  };
  draftRanksByRankType?: Record<string, { rank?: number; auctionValue?: number }>;
}

interface EspnRankingRow {
  season_year: number;
  scoring_type: string;
  espn_player_id: number;
  player_name: string;
  nfl_team: string | null;
  position: string | null;
  rank: number;
  fetched_at: string;
}
