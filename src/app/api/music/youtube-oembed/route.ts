import { NextRequest, NextResponse } from "next/server";

// Resolves a YouTube video id to its title/channel/thumbnail via YouTube's
// public oEmbed endpoint — no API key required (unlike search). Also serves
// as an existence check for pasted links.

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }

  const oembedUrl = new URL("https://www.youtube.com/oembed");
  oembedUrl.searchParams.set("url", `https://www.youtube.com/watch?v=${id}`);
  oembedUrl.searchParams.set("format", "json");

  const res = await fetch(oembedUrl.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Video not found — check the link." },
      { status: res.status === 404 || res.status === 400 ? 404 : 502 }
    );
  }

  const data = (await res.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  return NextResponse.json({
    title: data.title ?? null,
    author: data.author_name ?? null,
    thumbnail: data.thumbnail_url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  });
}
