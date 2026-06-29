import { NextRequest, NextResponse } from "next/server";

export interface SpotifySearchResult {
  trackId: string;
  title: string;
  artist: string;
  thumbnail: string;
  url: string;
  previewUrl: string | null;
}

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
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const token = await getClientToken();

    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", q);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "8");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    });

    if (!res.ok) return NextResponse.json({ error: "Spotify search failed" }, { status: 502 });

    const data = await res.json() as {
      tracks: {
        items: Array<{
          id: string;
          name: string;
          artists: Array<{ name: string }>;
          album: { images: Array<{ url: string }> };
          preview_url: string | null;
          external_urls: { spotify: string };
        }>;
      };
    };

    const results: SpotifySearchResult[] = (data.tracks?.items ?? []).map((track) => ({
      trackId: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      thumbnail: track.album.images[2]?.url ?? track.album.images[0]?.url ?? "",
      url: track.external_urls.spotify,
      previewUrl: track.preview_url,
    }));

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Spotify search failed";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
