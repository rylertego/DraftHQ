import type { ProviderLeaguePreview, ProviderTeamPreview } from "./types";

const YAHOO_API = "https://fantasysports.yahooapis.com/fantasy/v2";
const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

export interface YahooTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(record: UnknownRecord, key: string): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function getNumber(record: UnknownRecord, key: string): number | null {
  const v = record[key];
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }
  return null;
}

function normalizeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value !== null && value !== undefined) return [value];
  return [];
}

export function buildYahooAuthUrl(state: string): string {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const redirectUri = process.env.YAHOO_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("Yahoo OAuth is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "fspt-r",
    state,
  });

  return `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`;
}

export async function exchangeYahooCode(code: string): Promise<YahooTokens> {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;
  const redirectUri = process.env.YAHOO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Yahoo OAuth is not configured.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Yahoo token exchange failed: ${body}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshYahooTokens(refreshToken: string): Promise<YahooTokens> {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Yahoo OAuth is not configured.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Yahoo token refresh failed. Please reconnect your Yahoo account.");
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function yahooFetch(path: string, accessToken: string): Promise<unknown> {
  const response = await fetch(`${YAHOO_API}${path}?format=json`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) {
    throw new Error("Yahoo authorization expired. Please reconnect.");
  }

  if (!response.ok) {
    throw new Error(`Yahoo API request failed (${response.status}).`);
  }

  return response.json();
}

export async function fetchYahooLeaguePreview(
  leagueKey: string,
  accessToken: string
): Promise<ProviderLeaguePreview> {
  const [leagueData, teamsData] = await Promise.all([
    yahooFetch(`/league/${leagueKey}/settings`, accessToken),
    yahooFetch(`/league/${leagueKey}/teams`, accessToken),
  ]);

  return buildYahooLeaguePreview(leagueData, teamsData);
}

export function buildYahooLeaguePreview(
  leagueRaw: unknown,
  teamsRaw: unknown
): ProviderLeaguePreview {
  // Yahoo wraps everything in fantasy_content.league
  const fc = isRecord(leagueRaw) ? leagueRaw.fantasy_content : null;
  const leagueArr = isRecord(fc) ? normalizeArray(fc.league) : [];
  const leagueMeta = leagueArr.find(isRecord) ?? null;

  if (!leagueMeta) {
    throw new Error("Yahoo returned an unexpected league response.");
  }

  const leagueName = getString(leagueMeta, "name")?.trim() || null;
  if (!leagueName) {
    throw new Error("Yahoo league name is missing. Check your league key.");
  }

  // Draft positions come from settings
  const settingsArr = isRecord(leagueMeta.settings) ? [] : normalizeArray(leagueMeta.settings);
  const settings = settingsArr.find(isRecord) ?? (isRecord(leagueMeta.settings) ? leagueMeta.settings : null);
  const numTeams = (settings && getNumber(settings as UnknownRecord, "num_teams")) ?? 0;

  // Roster positions for rounds count
  let rounds = 15;
  if (settings && isRecord(settings)) {
    const rosterPositions = normalizeArray((settings as UnknownRecord).roster_positions);
    let total = 0;
    for (const rp of rosterPositions) {
      if (isRecord(rp)) {
        const rpInner = normalizeArray(rp.roster_position).find(isRecord);
        if (rpInner) {
          const count = getNumber(rpInner, "count") ?? 1;
          const pos = getString(rpInner, "position");
          if (pos && pos !== "IR" && pos !== "BNil") total += count;
        }
      }
    }
    if (total >= 1 && total <= 30) rounds = total;
  }

  // Teams
  const fcTeams = isRecord(teamsRaw) ? teamsRaw.fantasy_content : null;
  const teamsLeagueArr = isRecord(fcTeams) ? normalizeArray(fcTeams.league) : [];
  const teamsLeague = teamsLeagueArr.find((v) => isRecord(v) && "teams" in (v as UnknownRecord)) as UnknownRecord | undefined;
  const teamsContainer = teamsLeague ? teamsLeague.teams : null;

  const teamEntries: UnknownRecord[] = [];
  if (isRecord(teamsContainer)) {
    const count = getNumber(teamsContainer, "count") ?? 0;
    for (let i = 0; i < count; i++) {
      const entry = (teamsContainer as UnknownRecord)[String(i)];
      if (isRecord(entry)) {
        const teamArr = normalizeArray((entry as UnknownRecord).team);
        const teamMeta = teamArr.find(isRecord);
        if (teamMeta) teamEntries.push(teamMeta as UnknownRecord);
      }
    }
  }

  if (teamEntries.length < 2 || (numTeams > 0 && teamEntries.length !== numTeams)) {
    if (teamEntries.length < 2) {
      throw new Error(
        "No teams found in this Yahoo league. Make sure you authorized the correct account."
      );
    }
  }

  const warnings: string[] = [];

  const teams: ProviderTeamPreview[] = teamEntries.map((teamData, index) => {
    // Yahoo team data is an array: [metaArray, rosterArray]
    // metaArray contains objects with team_key, name, managers etc.
    const fields = normalizeArray(teamData).filter(isRecord);

    let teamKey = "";
    let teamName = `Team ${index + 1}`;
    let ownerName = "Unassigned Owner";
    let draftPosition = index + 1;

    for (const field of fields) {
      if (getString(field, "team_key")) teamKey = getString(field, "team_key") ?? teamKey;
      if (getString(field, "name")) teamName = getString(field, "name")?.trim() ?? teamName;
      if (getNumber(field, "draft_position") !== null) {
        draftPosition = getNumber(field, "draft_position") ?? draftPosition;
      }
      const managers = normalizeArray((field as UnknownRecord).managers);
      for (const mgr of managers) {
        if (!isRecord(mgr)) continue;
        const managerArr = normalizeArray((mgr as UnknownRecord).manager);
        const manager = managerArr.find(isRecord);
        if (manager) {
          ownerName = getString(manager as UnknownRecord, "nickname")?.trim() ?? ownerName;
          break;
        }
      }
    }

    return { externalId: teamKey || String(index + 1), ownerName, teamName, draftPosition };
  });

  // Sort by draft position
  teams.sort((a, b) => a.draftPosition - b.draftPosition);
  const draftPositions = teams.map((t) => t.draftPosition);
  const hasValidOrder =
    new Set(draftPositions).size === teams.length &&
    draftPositions.every((p) => p >= 1 && p <= teams.length);

  if (!hasValidOrder) {
    warnings.push("Yahoo draft order unavailable; teams sorted by default order.");
    teams.forEach((team, i) => { team.draftPosition = i + 1; });
  }

  return { leagueName, rounds, teams, warnings };
}
