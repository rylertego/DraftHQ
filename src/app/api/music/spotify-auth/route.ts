import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Missing Spotify config" }, { status: 500 });

  // Only allow relative paths or same-site URLs — prevents open redirect + token exfiltration
  const rawReturn = searchParams.get("returnTo") ?? "/teams";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const returnTo =
    rawReturn.startsWith("/") && !rawReturn.startsWith("//")
      ? rawReturn
      : siteUrl && rawReturn.startsWith(siteUrl)
      ? rawReturn
      : "/teams";

  // Sign state with HMAC-SHA256 so the callback can verify it wasn't forged (CSRF protection)
  const nonce = crypto.randomUUID();
  const payload = JSON.stringify({ nonce, returnTo });
  const sig = createHmac("sha256", clientSecret).update(payload).digest("hex");
  const state = Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/spotify-callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: "streaming user-read-email user-read-private",
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
