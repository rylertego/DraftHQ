import { NextRequest } from "next/server";

const cache = new Map<string, { url: string; fetchedAt: number }>();
const TTL = 1000 * 60 * 60 * 24; // 24 hours

const KNOWN_APPS: Record<string, { term: string; sellerName: string }> = {
  sleeper: { term: "Sleeper Fantasy Football Draft", sellerName: "Sleeper" },
  espn: { term: "ESPN Fantasy Sports", sellerName: "ESPN Inc." },
  yahoo: { term: "Yahoo Fantasy Sports", sellerName: "Yahoo" },
};

export async function GET(request: NextRequest) {
  const app = request.nextUrl.searchParams.get("app");
  if (!app || !KNOWN_APPS[app]) {
    return Response.json({ error: "Unknown app" }, { status: 400 });
  }

  const cached = cache.get(app);
  if (cached && Date.now() - cached.fetchedAt < TTL) {
    return Response.json({ url: cached.url });
  }

  try {
    const { term, sellerName } = KNOWN_APPS[app];
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=10&country=us`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error("iTunes API error");

    const data = await res.json() as { results: Array<{ artworkUrl512?: string; sellerName?: string }> };
    const match = data.results.find((r) =>
      r.sellerName?.toLowerCase().includes(sellerName.toLowerCase())
    ) ?? data.results[0];

    const url = match?.artworkUrl512 ?? null;
    if (url) cache.set(app, { url, fetchedAt: Date.now() });

    return Response.json({ url });
  } catch {
    return Response.json({ url: null }, { status: 200 });
  }
}
