import { describe, expect, it, vi } from "vitest";

// leagueApi imports the browser Supabase client at module load, which demands
// real env vars; the builder under test touches none of it.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { buildLeagueSettingsRpcArgs } from "@/lib/leagueApi";

const base = {
  name: "  Dynasty  ",
  slug: " dynasty ",
  logoUrl: " https://logo ",
  bannerUrl: "",
  primaryColor: "#111111",
  secondaryColor: "#222222",
  theme: "classic" as const,
};

describe("buildLeagueSettingsRpcArgs", () => {
  it("sends the active team count to the RPC", () => {
    expect(buildLeagueSettingsRpcArgs("league-1", { ...base, teamCount: 10 })).toMatchObject({
      p_league_id: "league-1",
      p_team_count: 10,
    });
  });

  it("leaves the stored count alone when no count was supplied", () => {
    expect(buildLeagueSettingsRpcArgs("league-1", base).p_team_count).toBeNull();
  });

  it("trims the text fields it forwards", () => {
    const args = buildLeagueSettingsRpcArgs("league-1", { ...base, teamCount: 8 });
    expect(args.p_name).toBe("Dynasty");
    expect(args.p_slug).toBe("dynasty");
    expect(args.p_logo_url).toBe("https://logo");
  });
});
