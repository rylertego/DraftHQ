import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/teams?spotify_error=1`);
  }

  // Verify HMAC-signed state — rejects forged state (CSRF) and validates returnTo origin
  let returnTo = "/teams";
  try {
    if (!stateParam) throw new Error("missing state");
    const outer = JSON.parse(Buffer.from(stateParam, "base64url").toString()) as { payload?: string; sig?: string };
    if (!outer.payload || !outer.sig) throw new Error("malformed state");
    const expected = createHmac("sha256", clientSecret).update(outer.payload).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(outer.sig, "hex");
    if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
      throw new Error("invalid signature");
    }
    const decoded = JSON.parse(outer.payload) as { returnTo?: string };
    if (decoded.returnTo) returnTo = decoded.returnTo;
  } catch {
    return NextResponse.redirect(`${origin}/teams?spotify_error=1`);
  }

  // Safe error redirect — returnTo already validated in spotify-auth, but be defensive
  const safeErrorDest = returnTo.startsWith("/")
    ? `${origin}${returnTo}?spotify_error=1`
    : `${origin}/teams?spotify_error=1`;

  if (error || !code) {
    return NextResponse.redirect(safeErrorDest);
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/spotify-callback`;

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(safeErrorDest);
  }

  const data = await tokenRes.json() as { access_token: string; refresh_token: string; expires_in: number };

  const fragment = new URLSearchParams({
    spotify_access_token: data.access_token,
    spotify_refresh_token: data.refresh_token,
    spotify_expires_in: String(data.expires_in),
  });

  // returnTo is either a relative path (regular flow) or a validated same-site full URL (popup flow)
  const destination = returnTo.startsWith("http")
    ? `${returnTo}#${fragment}`
    : `${origin}${returnTo}#${fragment}`;

  return NextResponse.redirect(destination);
}
