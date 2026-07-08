import { supabaseAdmin } from "@/lib/supabaseAdmin";

const STALE_HOURS = 24;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scoringType = searchParams.get("type") ?? "standard";
  const rawYear = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);

  const validTypes = ["standard", "ppr", "half_ppr", "superflex"];
  if (!validTypes.includes(scoringType)) {
    return Response.json({ error: "Invalid scoring type" }, { status: 400 });
  }

  const currentYear = new Date().getFullYear();
  if (isNaN(rawYear) || rawYear < 2020 || rawYear > currentYear + 1) {
    return Response.json({ error: "Invalid year." }, { status: 400 });
  }
  const year = rawYear;

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

  const syncSecret = process.env.RANKINGS_SYNC_SECRET;
  // In production without RANKINGS_SYNC_SECRET the sync endpoint rejects all callers,
  // so skip the trigger entirely rather than fire a request we know will 503.
  const canTriggerSync = syncSecret || process.env.NODE_ENV !== "production";
  if (isStale && canTriggerSync) {
    const syncUrl = new URL(request.url);
    syncUrl.pathname = "/api/rankings/sync";
    syncUrl.search = `?year=${year}`;
    await fetch(syncUrl.toString(), {
      method: "POST",
      headers: syncSecret ? { "x-rankings-sync-secret": syncSecret } : {},
    });
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
