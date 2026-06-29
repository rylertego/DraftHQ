import { describe, expect, it } from "vitest";
import { buildByeWeekLookup, canonicalNflTeam, resolveDraftSeasonYear } from "@/lib/nflTeams";

describe("NFL team aliases", () => {
  it("normalizes Arizona and historical team codes", () => {
    expect(canonicalNflTeam("AZ")).toBe("ARI");
    expect(canonicalNflTeam("JAC")).toBe("JAX");
    expect(canonicalNflTeam("WSH")).toBe("WAS");
  });

  it("makes canonical bye weeks available through aliases", () => {
    const lookup = buildByeWeekLookup([{ nfl_team: "ARI", bye_week: 8 }]);
    expect(lookup.get("ARI")).toBe(8);
    expect(lookup.get("AZ")).toBe(8);
    expect(lookup.get("ARZ")).toBe(8);
  });

  it("uses the draft year instead of treating offseason drafts as last season", () => {
    expect(resolveDraftSeasonYear("2026 Draft", null, new Date("2026-06-28T12:00:00Z"))).toBe(2026);
    expect(resolveDraftSeasonYear("Draft Night", "2027-08-20T23:00:00Z")).toBe(2027);
  });
});
