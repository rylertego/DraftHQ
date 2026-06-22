import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildFleaflickerLeaguePreview } from "@/lib/providers/fleaflicker";

const FLEAFLICKER_API = "https://www.fleaflicker.com/api";

async function fetchFleaflicker(path: string) {
  const response = await fetch(`${FLEAFLICKER_API}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "Fleaflicker league not found. Check your league ID."
        : `Fleaflicker request failed (${response.status}).`
    );
  }

  return response.json() as Promise<unknown>;
}

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

  if (!leagueId || !/^\d+$/.test(leagueId)) {
    return Response.json({ error: "Enter a valid Fleaflicker league ID." }, { status: 400 });
  }

  try {
    const [league, rosters] = await Promise.all([
      fetchFleaflicker(`/FetchLeague?sport=NFL&league_id=${leagueId}`),
      fetchFleaflicker(`/FetchLeagueRosters?sport=NFL&league_id=${leagueId}`),
    ]);

    return Response.json({
      preview: buildFleaflickerLeaguePreview(league, rosters),
    });
  } catch (previewError) {
    const message =
      previewError instanceof Error
        ? previewError.message
        : "Unable to preview the Fleaflicker league.";
    return Response.json({ error: message }, { status: 502 });
  }
}
