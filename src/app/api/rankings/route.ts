import { supabaseAdmin } from "@/lib/supabaseAdmin";

const STALE_HOURS = 24;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scoringType = searchParams.get("type") ?? "standard";
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);

  const validTypes = ["standard", "ppr", "half_ppr", "superflex"];
  if (!validTypes.includes(scoringType)) {
    return Response.json({ error: "Invalid scoring type" }, { status: 400 });
  }

  // Check freshness: find the most recent fetched_at for this type+year
  const { data: freshCheck } = await supabaseAdmin
    .from("espn_rankings")
    .select("fetched_at")
    .eq("season_year", year)
    .eq("scoring_type", scoringType)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  const isStale =
    !freshCheck ||
    Date.now() - new Date(freshCheck.fetched_at).getTime() > STALE_HOURS * 60 * 60 * 1000;

  if (isStale) {
    // Trigger sync inline (acceptable on first load / once per day)
    const syncUrl = new URL(request.url);
    syncUrl.pathname = "/api/rankings/sync";
    syncUrl.search = `?year=${year}`;
    await fetch(syncUrl.toString(), { method: "POST" });
  }

  const { data: rankings, error } = await supabaseAdmin
    .from("espn_rankings")
    .select("espn_player_id, player_name, nfl_team, position, rank")
    .eq("season_year", year)
    .eq("scoring_type", scoringType)
    .order("rank", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ rankings: rankings ?? [], year, scoringType });
}
