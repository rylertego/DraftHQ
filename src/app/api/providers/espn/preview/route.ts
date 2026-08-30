import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildEspnLeaguePreview } from "@/lib/providers/espn";

const ESPN_API = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";
const ESPN_AUTH_ERROR =
  "ESPN did not return league data. This league may be private or unavailable for that season — provide your espn_s2 and SWID cookies, then try again.";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user || data.user.is_anonymous) {
    return Response.json(
      { error: "A persistent commissioner account is required." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const leagueId = searchParams.get("leagueId")?.trim();
  const year = searchParams.get("year")?.trim();

  if (!leagueId || !/^\d+$/.test(leagueId)) {
    return Response.json({ error: "Enter a valid ESPN league ID." }, { status: 400 });
  }

  const seasonYear = year && /^\d{4}$/.test(year) ? year : String(new Date().getFullYear());

  const espnS2 = request.headers.get("x-espn-s2");
  const swid = request.headers.get("x-espn-swid");

  const cookieHeader = [
    espnS2 ? `espn_s2=${espnS2}` : null,
    swid ? `SWID=${swid}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const headers: Record<string, string> = { Accept: "application/json" };
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  try {
    const url =
      `${ESPN_API}/seasons/${seasonYear}/segments/0/leagues/${leagueId}` +
      "?view=mTeam&view=mSettings";

    const response = await fetch(url, { headers, next: { revalidate: 300 } });

    if (response.status === 401 || response.status === 403) {
      return Response.json(
        {
          error: ESPN_AUTH_ERROR,
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return Response.json(
        {
          error:
            response.status === 404
              ? "ESPN league not found. Check your league ID and year."
              : `ESPN request failed (${response.status}).`,
        },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return Response.json(
        {
          error: ESPN_AUTH_ERROR,
        },
        { status: 502 }
      );
    }

    const raw = await response.json();
    return Response.json({ preview: buildEspnLeaguePreview(raw) });
  } catch (previewError) {
    const message =
      previewError instanceof Error
        ? previewError.message
        : "Unable to preview the ESPN league.";
    return Response.json({ error: message }, { status: 502 });
  }
}
