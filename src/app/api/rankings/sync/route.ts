import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ESPN_URL =
  "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leaguedefaults/3?view=kona_player_info";

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

// X-Fantasy-Filter to get top 600 draftable players sorted by standard rank
const FANTASY_FILTER = JSON.stringify({
  players: {
    limit: 600,
    sortDraftRanks: { sortPriority: 100, sortAsc: true, value: "STANDARD" },
    filterSlotIds: { value: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 23, 24] },
  },
});

export async function POST(request: Request) {
  const secret = process.env.RANKINGS_SYNC_SECRET;
  if (!secret) {
    // Fail closed in production: RANKINGS_SYNC_SECRET must be set in Vercel env vars.
    // In local development (NODE_ENV !== 'production') the route remains open for convenience.
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "Sync endpoint is not configured. Set RANKINGS_SYNC_SECRET." },
        { status: 503 }
      );
    }
  } else {
    const provided = request.headers.get("x-rankings-sync-secret");
    if (provided !== secret) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const rawYear = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const currentYear = new Date().getFullYear();
  if (isNaN(rawYear) || rawYear < 2020 || rawYear > currentYear + 1) {
    return Response.json({ error: "Invalid year." }, { status: 400 });
  }
  const year = rawYear;

  const url = ESPN_URL.replace("{year}", String(year));

  let raw: { players?: EspnEntry[] };
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        "X-Fantasy-Filter": FANTASY_FILTER,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return Response.json({ error: `ESPN returned ${res.status}`, body: body.slice(0, 200) }, { status: 502 });
    }
    raw = await res.json();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "ESPN fetch failed" },
      { status: 502 }
    );
  }

  const entries = raw.players ?? [];
  if (entries.length === 0) {
    return Response.json({ error: "ESPN returned no players" }, { status: 502 });
  }

  const rows: EspnRankingRow[] = [];
  const now = new Date().toISOString();

  for (const entry of entries) {
    const p = entry.player;
    if (!p) continue;

    const espnId = p.id ?? entry.id;
    const name = p.fullName ?? "Unknown";
    const nflTeam = ESPN_TEAM[p.proTeamId ?? 0] ?? null;
    const position = ESPN_POS[p.defaultPositionId ?? 0] ?? null;
    const ranks = p.draftRanksByRankType ?? {};

    const standardRank = ranks["STANDARD"]?.rank;
    const pprRank = ranks["PPR"]?.rank;

    if (standardRank) {
      rows.push({ season_year: year, scoring_type: "standard", espn_player_id: espnId, player_name: name, nfl_team: nflTeam, position, rank: standardRank, fetched_at: now });
    }
    if (pprRank) {
      rows.push({ season_year: year, scoring_type: "ppr", espn_player_id: espnId, player_name: name, nfl_team: nflTeam, position, rank: pprRank, fetched_at: now });
    }
    // Derive HALF_PPR by averaging standard and PPR ranks
    if (standardRank && pprRank) {
      rows.push({ season_year: year, scoring_type: "half_ppr", espn_player_id: espnId, player_name: name, nfl_team: nflTeam, position, rank: Math.round((standardRank + pprRank) / 2), fetched_at: now });
    }
    // Superflex: same as standard but QBs are boosted (re-ranked below)
    if (standardRank) {
      rows.push({ season_year: year, scoring_type: "superflex", espn_player_id: espnId, player_name: name, nfl_team: nflTeam, position, rank: standardRank, fetched_at: now });
    }
  }

  // Re-rank superflex: interleave QBs roughly every 3rd pick
  const sfRows = rows.filter((r) => r.scoring_type === "superflex");
  const qbRows = sfRows.filter((r) => r.position === "QB").sort((a, b) => a.rank - b.rank);
  const nonQbRows = sfRows.filter((r) => r.position !== "QB").sort((a, b) => a.rank - b.rank);
  let sfRank = 1;
  const qbIter = qbRows[Symbol.iterator]();
  const nonQbIter = nonQbRows[Symbol.iterator]();
  let qbNext = qbIter.next();
  let nonQbNext = nonQbIter.next();
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
    console.error("[rankings/sync] Supabase upsert error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ synced: rows.length, year });
}

interface EspnEntry {
  id: number;
  onTeamId?: number;
  player?: {
    id?: number;
    fullName?: string;
    defaultPositionId?: number;
    proTeamId?: number;
    draftRanksByRankType?: Record<string, { rank?: number }>;
  };
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
