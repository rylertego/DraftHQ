import { describe, expect, it, vi } from "vitest";
import { parseYouTubeVideoId } from "@/components/SongPicker";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpotifyConnectionPanel } from "@/app/leagues/[slug]/my-team/MyTeamForm";
import { needsSpotifyReconnect } from "@/lib/spotifyAuth";
import type { WalkUpSong } from "@/types/draft";

vi.mock("@/lib/leagueApi", () => ({
  getLeagueTeams: vi.fn(),
  updateMyLeagueTeamDetails: vi.fn(),
  uploadMyLeagueTeamLogoAsset: vi.fn(),
  uploadMyLeagueTeamOwnerPhotoAsset: vi.fn(),
}));

describe("parseYouTubeVideoId", () => {
  const ID = "dQw4w9WgXcQ";

  it("parses common YouTube URL shapes", () => {
    expect(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://youtube.com/watch?v=${ID}&t=42s`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://music.youtube.com/watch?v=${ID}&list=abc`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://youtu.be/${ID}?si=xyz`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://www.youtube.com/live/${ID}`)).toBe(ID);
  });

  it("accepts a bare 11-character video id", () => {
    expect(parseYouTubeVideoId(ID)).toBe(ID);
    expect(parseYouTubeVideoId(`  ${ID}  `)).toBe(ID);
  });

  it("rejects non-YouTube input", () => {
    expect(parseYouTubeVideoId("never gonna give you up")).toBeNull();
    expect(parseYouTubeVideoId("https://vimeo.com/12345678")).toBeNull();
    expect(parseYouTubeVideoId("https://www.youtube.com/results?search_query=song")).toBeNull();
    expect(parseYouTubeVideoId("https://youtu.be/short")).toBeNull();
    expect(parseYouTubeVideoId("")).toBeNull();
  });
});

describe("SpotifyConnectionPanel", () => {
  it("shows the connect action when the owner has not linked Spotify", () => {
    const html = renderToStaticMarkup(
      createElement(SpotifyConnectionPanel, {
        connected: false,
        connecting: false,
        onConnect: () => undefined,
        onDisconnect: () => undefined,
      }),
    );

    expect(html).toContain("Connect Spotify");
    expect(html).toContain("Link Spotify to search Spotify tracks from this page.");
    expect(html).not.toContain("Disconnect");
  });

  it("shows connected state and a disconnect action after Spotify is linked", () => {
    const html = renderToStaticMarkup(
      createElement(SpotifyConnectionPanel, {
        connected: true,
        connecting: false,
        onConnect: () => undefined,
        onDisconnect: () => undefined,
      }),
    );

    expect(html).toContain("Spotify connected");
    expect(html).toContain("Disconnect");
    expect(html).not.toContain("Connect Spotify");
  });
});

describe("needsSpotifyReconnect", () => {
  const spotifySong: WalkUpSong = {
    platform: "spotify",
    trackId: "abc123",
    url: "https://open.spotify.com/track/abc123",
    title: "Song",
    artist: "Artist",
  };

  it("flags a Spotify song with no fallback while disconnected", () => {
    expect(needsSpotifyReconnect(spotifySong, false)).toBe(true);
  });

  it("does not flag anything while connected", () => {
    expect(needsSpotifyReconnect(spotifySong, true)).toBe(false);
  });

  it("does not flag YouTube songs", () => {
    const ytSong: WalkUpSong = { ...spotifySong, platform: "youtube" };
    expect(needsSpotifyReconnect(ytSong, false)).toBe(false);
  });

  it("does not flag a Spotify song with a YouTube fallback", () => {
    expect(needsSpotifyReconnect({ ...spotifySong, youtubeTrackId: "dQw4w9WgXcQ" }, false)).toBe(false);
  });

  it("does not flag a Spotify song with a preview clip", () => {
    expect(needsSpotifyReconnect({ ...spotifySong, previewUrl: "https://p.scdn.co/mp3/x" }, false)).toBe(false);
  });

  it("treats null fallbacks as absent", () => {
    expect(needsSpotifyReconnect({ ...spotifySong, youtubeTrackId: null, previewUrl: null }, false)).toBe(true);
  });
});
