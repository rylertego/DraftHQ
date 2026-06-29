import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let refresh_token: string | undefined;
  try {
    const body = await req.json() as { refresh_token?: string };
    refresh_token = body.refresh_token;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!refresh_token) return NextResponse.json({ error: "Missing refresh_token" }, { status: 400 });

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Missing Spotify config" }, { status: 500 });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token }),
  });

  if (!res.ok) return NextResponse.json({ error: "Refresh failed" }, { status: 401 });
  const data = await res.json();
  return NextResponse.json(data);
}
