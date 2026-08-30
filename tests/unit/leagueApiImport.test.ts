import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const leagueTeamsSelect = vi.fn();
  const leagueTeamsInsert = vi.fn(() => ({ select: leagueTeamsSelect }));
  const leaguesEq = vi.fn();
  const leaguesUpdate = vi.fn(() => ({ eq: leaguesEq }));
  const from = vi.fn((table: string) => {
    if (table === "league_teams") {
      return { insert: leagueTeamsInsert };
    }
    if (table === "leagues") {
      return { update: leaguesUpdate };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    from,
    leagueTeamsInsert,
    leagueTeamsSelect,
    leaguesEq,
    leaguesUpdate,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("@/lib/profileApi", () => ({
  getMyProfile: vi.fn(),
}));

vi.mock("@/lib/draftApi", () => ({
  applyImportedLeagueSettings: vi.fn(),
}));

import { importLeagueTeams } from "@/lib/leagueApi";

describe("importLeagueTeams", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.leagueTeamsInsert.mockClear();
    mocks.leagueTeamsSelect.mockClear();
    mocks.leaguesUpdate.mockClear();
    mocks.leaguesEq.mockClear();
    mocks.leagueTeamsSelect.mockResolvedValue({
      data: [
        {
          id: "team-1",
          league_id: "league-1",
          name: "Imported Team",
          short_name: null,
          logo_url: null,
          owner_photo_url: null,
          owner_user_id: null,
          owner_name: "Imported Owner",
          archived_at: null,
          last_season_pick: null,
          last_season_record: null,
          last_season_playoffs: null,
          last_season_pick_player: null,
          walk_up_songs: [],
          tts_name: null,
          created_at: "2026-08-30T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mocks.leaguesEq.mockResolvedValue({ error: null });
  });

  it("marks the league as connected to the imported provider", async () => {
    await importLeagueTeams(
      "league-1",
      [{ name: "Imported Team", ownerName: "Imported Owner" }],
      "espn"
    );

    expect(mocks.leaguesUpdate).toHaveBeenCalledWith({ active_integration: "espn" });
    expect(mocks.leaguesEq).toHaveBeenCalledWith("id", "league-1");
  });
});
