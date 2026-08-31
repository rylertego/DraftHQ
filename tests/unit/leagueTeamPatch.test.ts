import { describe, expect, it } from "vitest";
import { buildLeagueTeamPatch } from "@/lib/leagueTeamPatch";

describe("buildLeagueTeamPatch", () => {
  it("omits every field that was not supplied", () => {
    expect(buildLeagueTeamPatch({})).toEqual({});
  });

  it("maps supplied fields to snake_case columns", () => {
    expect(buildLeagueTeamPatch({ name: "  Trap Queens  ", ttsName: " Queens " })).toEqual({
      name: "Trap Queens",
      tts_name: "Queens",
    });
  });

  it("treats a blank tts name as clearing it", () => {
    expect(buildLeagueTeamPatch({ ttsName: "   " })).toEqual({ tts_name: null });
  });

  it("passes an explicit null through as a clear", () => {
    expect(buildLeagueTeamPatch({ ttsName: null })).toEqual({ tts_name: null });
  });

  it("carries walk-up songs and photo fields untouched", () => {
    const songs = [{ platform: "youtube" as const, trackId: "a", url: "u", title: "t" }];
    expect(buildLeagueTeamPatch({ walkUpSongs: songs, ownerPhotoUrl: null })).toEqual({
      walk_up_songs: songs,
      owner_photo_url: null,
    });
  });
});
