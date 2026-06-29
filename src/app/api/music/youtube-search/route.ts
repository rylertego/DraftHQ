import { NextRequest, NextResponse } from "next/server";

export interface YouTubeSearchResult {
  trackId: string;
  title: string;
  artist: string;
  thumbnail: string;
  url: string;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YouTube API key not configured" }, { status: 503 });
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoCategoryId", "10"); // Music category
  url.searchParams.set("maxResults", "8");
  url.searchParams.set("q", q);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!res.ok) {
    return NextResponse.json({ error: "YouTube search failed" }, { status: 502 });
  }

  const data = await res.json() as {
    items: Array<{
      id: { videoId: string };
      snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } };
    }>;
  };

  const results: YouTubeSearchResult[] = (data.items ?? []).map((item) => ({
    trackId: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.default.url,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));

  return NextResponse.json({ results });
}
