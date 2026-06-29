import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

export const NFLVERSE_PLAYERS_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv";

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);
const EXCLUDED_STATUSES = new Set(["CUT", "RET"]);

const TEAM_ALIASES = {
  AZ: "ARI",
  ARZ: "ARI",
  JAC: "JAX",
  LA: "LAR",
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
  WSH: "WAS",
};

const NFL_TEAMS = [
  ["ARI", "Arizona Cardinals"],
  ["ATL", "Atlanta Falcons"],
  ["BAL", "Baltimore Ravens"],
  ["BUF", "Buffalo Bills"],
  ["CAR", "Carolina Panthers"],
  ["CHI", "Chicago Bears"],
  ["CIN", "Cincinnati Bengals"],
  ["CLE", "Cleveland Browns"],
  ["DAL", "Dallas Cowboys"],
  ["DEN", "Denver Broncos"],
  ["DET", "Detroit Lions"],
  ["GB", "Green Bay Packers"],
  ["HOU", "Houston Texans"],
  ["IND", "Indianapolis Colts"],
  ["JAX", "Jacksonville Jaguars"],
  ["KC", "Kansas City Chiefs"],
  ["LV", "Las Vegas Raiders"],
  ["LAC", "Los Angeles Chargers"],
  ["LAR", "Los Angeles Rams"],
  ["MIA", "Miami Dolphins"],
  ["MIN", "Minnesota Vikings"],
  ["NE", "New England Patriots"],
  ["NO", "New Orleans Saints"],
  ["NYG", "New York Giants"],
  ["NYJ", "New York Jets"],
  ["PHI", "Philadelphia Eagles"],
  ["PIT", "Pittsburgh Steelers"],
  ["SEA", "Seattle Seahawks"],
  ["SF", "San Francisco 49ers"],
  ["TB", "Tampa Bay Buccaneers"],
  ["TEN", "Tennessee Titans"],
  ["WAS", "Washington Commanders"],
];

export function normalizeTeam(value) {
  const team = value?.trim().toUpperCase();

  if (!team) {
    return null;
  }

  return TEAM_ALIASES[team] ?? team;
}

export function transformNflversePlayers(rows) {
  const seasons = rows
    .map((row) => Number(row.last_season))
    .filter(Number.isInteger);
  const season = Math.max(...seasons);

  if (!Number.isFinite(season)) {
    throw new Error("nflverse data does not contain a valid last_season.");
  }

  const playersById = new Map();

  for (const row of rows) {
    const externalId = row.gsis_id?.trim();
    const fullName = row.display_name?.trim();
    const position = row.position?.trim().toUpperCase();
    const status = row.status?.trim().toUpperCase();

    if (
      Number(row.last_season) !== season ||
      !externalId ||
      !fullName ||
      !FANTASY_POSITIONS.has(position) ||
      EXCLUDED_STATUSES.has(status)
    ) {
      continue;
    }

    playersById.set(externalId, {
      external_id: externalId,
      full_name: fullName,
      position,
      nfl_team: normalizeTeam(row.latest_team),
      headshot_url: (row.headshot_url ?? row.headshot)?.trim() || null,
    });
  }

  for (const [team, fullName] of NFL_TEAMS) {
    playersById.set(`DST-${team}`, {
      external_id: `DST-${team}`,
      full_name: fullName,
      position: "DST",
      nfl_team: team,
      headshot_url: null,
    });
  }

  const players = [...playersById.values()].sort((first, second) =>
    first.full_name.localeCompare(second.full_name)
  );

  return {
    season,
    sourceRowCount: rows.length,
    players,
  };
}

export async function downloadAndTransformPlayers(fetchImpl = fetch) {
  const response = await fetchImpl(NFLVERSE_PLAYERS_URL);

  if (!response.ok) {
    throw new Error(
      `Unable to download nflverse players: ${response.status} ${response.statusText}`
    );
  }

  const csv = await response.text();
  const rows = parse(csv, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });

  return transformNflversePlayers(rows);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const result = await downloadAndTransformPlayers();
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await supabase.rpc("replace_nflverse_players", {
    p_players: result.players,
  });

  if (error) {
    throw error;
  }

  console.log(
    `Imported ${data} players for ${result.season} from ${result.sourceRowCount} source rows.`
  );
}

const entryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (entryPoint === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
