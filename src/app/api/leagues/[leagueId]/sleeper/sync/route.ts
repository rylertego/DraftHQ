import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SLEEPER_API = "https://api.sleeper.app/v1";
type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function sleeper(path: string) {
  const response = await fetch(`${SLEEPER_API}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 404 ? "Sleeper league not found." : `Sleeper request failed (${response.status}).`);
  return response.json() as Promise<unknown>;
}

async function sleeperOptional(path: string) {
  const response = await fetch(`${SLEEPER_API}${path}`, { cache: "no-store" });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Sleeper request failed (${response.status}).`);
  return response.json() as Promise<unknown>;
}

function normalized(value: unknown) {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

function points(settings: RecordValue, key: "fpts" | "fpts_against") {
  const whole = typeof settings[key] === "number" ? settings[key] as number : 0;
  const decimalKey = `${key}_decimal`;
  const decimal = typeof settings[decimalKey] === "number" ? settings[decimalKey] as number : 0;
  return whole + decimal / 100;
}

export async function POST(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!accessToken) return Response.json({ error: "Authentication is required." }, { status: 401 });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user || authData.user.is_anonymous) return Response.json({ error: "A persistent commissioner account is required." }, { status: 401 });

  const [{ data: league }, { data: commissioner }] = await Promise.all([
    supabaseAdmin.from("leagues").select("id,owner_user_id").eq("id", leagueId).maybeSingle(),
    supabaseAdmin.from("league_members").select("id").eq("league_id", leagueId).eq("user_id", authData.user.id).eq("role", "commissioner").maybeSingle(),
  ]);
  if (!league) return Response.json({ error: "League not found." }, { status: 404 });
  if (league.owner_user_id !== authData.user.id && !commissioner) return Response.json({ error: "Only a league commissioner can connect Sleeper." }, { status: 403 });

  let body: { sleeperLeagueId?: unknown };
  try { body = await request.json() as { sleeperLeagueId?: unknown }; }
  catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const currentId = typeof body.sleeperLeagueId === "string" ? body.sleeperLeagueId.trim() : "";
  if (!/^\d{5,30}$/.test(currentId)) return Response.json({ error: "Enter a valid Sleeper league ID." }, { status: 400 });

  // Use service-role key + user JWT so auth.uid() resolves inside RPCs and RLS is bypassed
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!;
  const authedClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const currentRaw = await sleeper(`/league/${currentId}`);
    if (!isRecord(currentRaw)) throw new Error("Sleeper returned an invalid league.");
    const currentStatus = typeof currentRaw.status === "string" ? currentRaw.status : "";
    const previousId = typeof currentRaw.previous_league_id === "string" ? currentRaw.previous_league_id : "";
    const targetId = currentStatus === "complete" ? currentId : previousId;
    if (!/^\d{5,30}$/.test(targetId)) throw new Error("This Sleeper league does not have a completed previous season yet.");

    const [targetRaw, rostersRaw, usersRaw, bracketRaw] = await Promise.all([
      targetId === currentId ? Promise.resolve(currentRaw) : sleeper(`/league/${targetId}`),
      sleeper(`/league/${targetId}/rosters`),
      sleeper(`/league/${targetId}/users`),
      sleeperOptional(`/league/${targetId}/winners_bracket`),
    ]);
    if (!isRecord(targetRaw) || !Array.isArray(rostersRaw) || !Array.isArray(usersRaw) || !Array.isArray(bracketRaw)) throw new Error("Sleeper returned incomplete season history.");
    const seasonYear = Number(targetRaw.season);
    if (!Number.isInteger(seasonYear)) throw new Error("Sleeper season year is invalid.");

    const [{ data: leagueTeams, error: ltError }, { data: seasons, error: seasonsError }] = await Promise.all([
      authedClient.from("league_teams").select("id,name,owner_name,sleeper_owner_id").eq("league_id", leagueId),
      authedClient.from("league_seasons").select("id,draft_id").eq("league_id", leagueId),
    ]);
    if (ltError) console.error("[sleeper/sync] league_teams query error:", ltError);
    if (seasonsError) console.error("[sleeper/sync] league_seasons query error:", seasonsError);
    const seasonIds = (seasons ?? []).map((row) => row.id);
    const { data: links } = seasonIds.length ? await authedClient.from("league_team_seasons").select("league_team_id,draft_team_id").in("league_season_id", seasonIds) : { data: [] };
    const draftTeamIds = (links ?? []).flatMap((row) => row.draft_team_id ? [row.draft_team_id] : []);
    const { data: draftTeams } = draftTeamIds.length ? await authedClient.from("teams").select("id,name,owner_name,sleeper_roster_id,sleeper_owner_user_id").in("id", draftTeamIds) : { data: [] };
    const leagueTeamByDraftTeam = new Map((links ?? []).map((row) => [row.draft_team_id, row.league_team_id]));
    const byOwner = new Map<string, string>();
    const byRoster = new Map<number, string>();
    const byName = new Map<string, string>();

    // Primary: match by stored Sleeper owner ID (set on first successful sync)
    for (const team of leagueTeams ?? []) {
      if (team.sleeper_owner_id) byOwner.set(team.sleeper_owner_id, team.id);
    }
    // Fallback: match by league team name/owner_name
    for (const team of leagueTeams ?? []) {
      if (team.name) byName.set(normalized(team.name), team.id);
      if (team.owner_name) byName.set(normalized(team.owner_name), team.id);
    }
    // Secondary: match by draft team name/owner (in case league_teams has different names)
    for (const team of draftTeams ?? []) {
      const mapped = leagueTeamByDraftTeam.get(team.id);
      if (!mapped) continue;
      if (team.sleeper_owner_user_id) byOwner.set(team.sleeper_owner_user_id, mapped);
      if (team.sleeper_roster_id) byRoster.set(team.sleeper_roster_id, mapped);
      if (team.name && !byName.has(normalized(team.name))) byName.set(normalized(team.name), mapped);
      if (team.owner_name && !byName.has(normalized(team.owner_name))) byName.set(normalized(team.owner_name), mapped);
    }

    const users = new Map<string, RecordValue>();
    for (const user of usersRaw) if (isRecord(user) && typeof user.user_id === "string") users.set(user.user_id, user);
    const placement = new Map<number, number>();
    let championRosterId: number | null = null;
    for (const match of bracketRaw) {
      if (!isRecord(match) || typeof match.p !== "number") continue;
      if (typeof match.w === "number") placement.set(match.w, match.p);
      if (typeof match.l === "number") placement.set(match.l, match.p + 1);
      if (match.p === 1 && typeof match.w === "number") championRosterId = match.w;
    }

    const parsed = rostersRaw.flatMap((roster) => {
      if (!isRecord(roster) || typeof roster.roster_id !== "number") return [];
      const ownerId = typeof roster.owner_id === "string" ? roster.owner_id : "";
      const user = users.get(ownerId);
      const metadata = user && isRecord(user.metadata) ? user.metadata : {};
      const teamName = typeof metadata.team_name === "string" ? metadata.team_name : (typeof user?.display_name === "string" ? user.display_name : `Roster ${roster.roster_id}`);
      const settings = isRecord(roster.settings) ? roster.settings : {};
      const displayName = typeof user?.display_name === "string" ? user.display_name : "";
      const username = typeof user?.username === "string" ? user.username : "";
      const leagueTeamId = byOwner.get(ownerId) ?? byRoster.get(roster.roster_id) ?? byName.get(normalized(teamName)) ?? byName.get(normalized(displayName)) ?? byName.get(normalized(username)) ?? null;
      return [{ rosterId: roster.roster_id, ownerId, teamName, leagueTeamId, wins: Number(settings.wins ?? 0), losses: Number(settings.losses ?? 0), ties: Number(settings.ties ?? 0), pointsFor: points(settings, "fpts"), pointsAgainst: points(settings, "fpts_against"), playoffFinish: placement.get(roster.roster_id) ?? null }];
    });
    parsed.sort((a, b) => (a.playoffFinish ?? 999) - (b.playoffFinish ?? 999) || b.wins - a.wins || b.pointsFor - a.pointsFor);
    const mapped = parsed
      .map((team, index) => ({ ...team, finalRank: index + 1 }))
      .filter((team) => team.leagueTeamId)
      .map((team) => ({ leagueTeamId: team.leagueTeamId, ownerId: team.ownerId, sleeperRosterId: team.rosterId, finalRank: team.finalRank, wins: team.wins, losses: team.losses, ties: team.ties, pointsFor: team.pointsFor, pointsAgainst: team.pointsAgainst, playoffFinish: team.playoffFinish }));
    const championTeamId = parsed.find((team) => team.rosterId === championRosterId)?.leagueTeamId ?? null;

    const { error: syncError } = await authedClient.rpc("sync_sleeper_league_history", {
      p_league_id: leagueId, p_current_sleeper_league_id: currentId, p_season_year: seasonYear,
      p_season_sleeper_league_id: targetId, p_standings: mapped, p_champion_team_id: championTeamId,
    });
    if (syncError) throw syncError;

    const draftHqTeamNames = (leagueTeams ?? []).map((t) => t.name).filter(Boolean);
    return Response.json({ sleeperLeagueId: currentId, seasonYear, mappedTeams: mapped.length, totalTeams: parsed.length, championMapped: Boolean(championTeamId), unmappedTeams: parsed.filter((team) => !team.leagueTeamId).map((team) => team.teamName), draftHqTeamNames, leagueTeamsError: ltError ? String((ltError as {message?:string}).message ?? JSON.stringify(ltError)) : null, leagueIdUsed: leagueId, syncedAt: new Date().toISOString() });
  } catch (error) {
    const msg = error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ?? "Unable to sync Sleeper league.";
    return Response.json({ error: msg }, { status: 502 });
  }
}
