import { NextRequest, NextResponse } from "next/server";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getClientToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Spotify credentials not configured");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("Failed to get Spotify token");
  const json = await res.json() as { access_token: string; expires_in: number };
  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + json.expires_in * 1000;
  return cachedToken;
}

export async function GET(req: NextRequest) {
  const trackId = req.nextUrl.searchParams.get("trackId")?.trim();
  if (!trackId) return NextResponse.json({ previewUrl: null });

  try {
    const token = await getClientToken();
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return NextResponse.json({ previewUrl: null });
    const data = await res.json() as { preview_url: string | null };
    return NextResponse.json({ previewUrl: data.preview_url });
  } catch {
    return NextResponse.json({ previewUrl: null });
  }
}
