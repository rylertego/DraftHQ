import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildMflLeaguePreview } from "@/lib/providers/mfl";

export async function POST(request: Request) {
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

  let body: { leagueId?: string; year?: string; apiKey?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const leagueId = body.leagueId?.trim();
  const year = body.year?.trim();
  const apiKey = body.apiKey?.trim() || null;

  if (!leagueId || !/^\d+$/.test(leagueId)) {
    return Response.json({ error: "Enter a valid MFL league ID." }, { status: 400 });
  }

  const seasonYear =
    year && /^\d{4}$/.test(year) ? year : String(new Date().getFullYear());

  const params = new URLSearchParams({
    TYPE: "league",
    L: leagueId,
    JSON: "1",
  });
  if (apiKey) params.set("APIKEY", apiKey);

  try {
    const url = `https://api.myfantasyleague.com/${seasonYear}/export?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return Response.json(
        {
          error:
            response.status === 401
              ? "MFL returned an authorization error. Check your API key."
              : `MFL request failed (${response.status}). Check your league ID and year.`,
        },
        { status: 502 }
      );
    }

    const raw = await response.json();
    return Response.json({ preview: buildMflLeaguePreview(raw) });
  } catch (previewError) {
    const message =
      previewError instanceof Error
        ? previewError.message
        : "Unable to preview the MFL league.";
    return Response.json({ error: message }, { status: 502 });
  }
}
