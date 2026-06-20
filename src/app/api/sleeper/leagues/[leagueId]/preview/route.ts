import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildSleeperLeaguePreview,
  normalizeSleeperLeagueId,
} from "@/lib/sleeper";

interface PreviewRouteContext {
  params: Promise<{ leagueId: string }>;
}

const SLEEPER_API_URL = "https://api.sleeper.app/v1";

async function getSleeperJson(path: string) {
  const response = await fetch(`${SLEEPER_API_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "Sleeper league not found."
        : `Sleeper request failed with status ${response.status}.`
    );
  }

  return response.json() as Promise<unknown>;
}

export async function GET(
  request: Request,
  { params }: PreviewRouteContext
) {
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

  const leagueId = normalizeSleeperLeagueId((await params).leagueId);
  if (!leagueId) {
    return Response.json({ error: "Enter a valid Sleeper league ID." }, { status: 400 });
  }

  try {
    const [league, users, rosters, drafts] = await Promise.all([
      getSleeperJson(`/league/${leagueId}`),
      getSleeperJson(`/league/${leagueId}/users`),
      getSleeperJson(`/league/${leagueId}/rosters`),
      getSleeperJson(`/league/${leagueId}/drafts`),
    ]);
    return Response.json({
      preview: buildSleeperLeaguePreview({ league, users, rosters, drafts }),
    });
  } catch (previewError) {
    const message =
      previewError instanceof Error
        ? previewError.message
        : "Unable to preview the Sleeper league.";
    return Response.json({ error: message }, { status: 502 });
  }
}
