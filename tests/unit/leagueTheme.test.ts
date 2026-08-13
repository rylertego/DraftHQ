import { describe, expect, it } from "vitest";
import { isLeagueFocusRoute } from "@/lib/leagueTheme";

describe("isLeagueFocusRoute", () => {
  it.each([
    ["/leagues/example", false],
    ["/leagues/example/settings", false],
    ["/teams", true],
    ["/draft", true],
    ["/draft/lobby", true],
  ])("gives league focus to %s with league context", (pathname, hasLeagueSlug) => {
    expect(isLeagueFocusRoute(pathname, hasLeagueSlug)).toBe(true);
  });

  it.each([
    ["/teams", false],
    ["/draft", false],
    ["/draft/lobby", false],
    ["/draft/recap", true],
    ["/dashboard", true],
  ])("keeps product focus on %s without an approved league scope", (pathname, hasLeagueSlug) => {
    expect(isLeagueFocusRoute(pathname, hasLeagueSlug)).toBe(false);
  });
});
