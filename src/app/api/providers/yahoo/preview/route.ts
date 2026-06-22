import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";
import {
  fetchYahooLeaguePreview,
  refreshYahooTokens,
  type YahooTokens,
} from "@/lib/providers/yahoo";

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

  const cookieStore = await cookies();
  const tokensCookie = cookieStore.get("yahoo_tokens")?.value;

  if (!tokensCookie) {
    return Response.json(
      { error: "Yahoo account not connected. Please authorize via Yahoo first." },
      { status: 401 }
    );
  }

  let tokens: YahooTokens;
  try {
    tokens = JSON.parse(tokensCookie) as YahooTokens;
  } catch {
    return Response.json({ error: "Yahoo session is invalid. Please reconnect." }, { status: 401 });
  }

  // Refresh if within 5 minutes of expiry
  if (Date.now() > tokens.expiresAt - 300_000) {
    try {
      tokens = await refreshYahooTokens(tokens.refreshToken);
      cookieStore.set("yahoo_tokens", JSON.stringify(tokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      });
    } catch {
      cookieStore.delete("yahoo_tokens");
      return Response.json(
        { error: "Yahoo session expired. Please reconnect your Yahoo account." },
        { status: 401 }
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const leagueKey = searchParams.get("leagueKey")?.trim();

  if (!leagueKey || !/^\d+\.l\.\d+$/.test(leagueKey)) {
    return Response.json(
      { error: 'Enter a valid Yahoo league key (e.g. "423.l.123456").' },
      { status: 400 }
    );
  }

  try {
    const preview = await fetchYahooLeaguePreview(leagueKey, tokens.accessToken);
    return Response.json({ preview });
  } catch (previewError) {
    const message =
      previewError instanceof Error
        ? previewError.message
        : "Unable to preview the Yahoo league.";
    return Response.json({ error: message }, { status: 502 });
  }
}
