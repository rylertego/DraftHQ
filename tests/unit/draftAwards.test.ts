import { describe, expect, it } from "vitest";
import { computeDraftAwards, formatClockDuration, type DraftAward } from "@/lib/draftAwards";
import type { Pick, Team } from "@/types/draft";

const BASE = Date.parse("2026-09-01T19:00:00.000Z");

function makeTeam(id: string, name: string): Team {
  return { id, draftId: "d1", name, draftPosition: Number(id.slice(1)) };
}

function makePick(
  overall: number,
  teamId: string,
  playerId: string,
  rest: Partial<Pick> = {}
): Pick {
  return {
    id: `pick-${overall}`,
    draftId: "d1",
    teamId,
    playerId,
    round: 1,
    pickNumber: overall,
    overallPickNumber: overall,
    playerName: `Player ${playerId}`,
    playerPosition: "RB",
    isLandmine: false,
    createdAt: new Date(BASE + overall * 30_000).toISOString(),
    ...rest,
  };
}

function findAward(awards: DraftAward[], id: string): DraftAward | undefined {
  return awards.find((a) => a.id === id);
}

const teams = [makeTeam("t1", "Alpha"), makeTeam("t2", "Bravo")];

describe("formatClockDuration", () => {
  it("formats seconds, minutes, and hours", () => {
    expect(formatClockDuration(42.4)).toBe("42s");
    expect(formatClockDuration(95)).toBe("1m 35s");
    expect(formatClockDuration(3_720)).toBe("1h 2m");
  });
});

describe("computeDraftAwards", () => {
  it("returns nothing for an empty draft", () => {
    expect(computeDraftAwards([], teams, new Map())).toEqual([]);
  });

  it("awards fastest and longest single pick", () => {
    // Pick 2 (Bravo) takes 5s; pick 3 (Alpha) takes 300s; pick 4 (Bravo) takes 60s.
    let t = BASE;
    const timed = [
      { overall: 1, teamId: "t1", dt: 0 },
      { overall: 2, teamId: "t2", dt: 5_000 },
      { overall: 3, teamId: "t1", dt: 300_000 },
      { overall: 4, teamId: "t2", dt: 60_000 },
    ].map(({ overall, teamId, dt }) => {
      t += dt;
      return makePick(overall, teamId, `p${overall}`, { createdAt: new Date(t).toISOString() });
    });
    const slides = computeDraftAwards(timed, teams, new Map());
    const fastest = findAward(slides, "fastest-pick");
    const longest = findAward(slides, "longest-pick");
    expect(fastest?.teamName).toBe("Bravo");
    expect(fastest?.headline).toBe("5s");
    expect(fastest?.player).toBe("Player p2");
    expect(longest?.teamName).toBe("Alpha");
    expect(longest?.headline).toBe("5m 00s");
    expect(longest?.player).toBe("Player p3");
  });

  it("awards shortest and longest total clock time", () => {
    // Alpha total: 300s. Bravo total: 65s.
    let t = BASE;
    const timed = [
      { overall: 1, teamId: "t1", dt: 0 },
      { overall: 2, teamId: "t2", dt: 5_000 },
      { overall: 3, teamId: "t1", dt: 300_000 },
      { overall: 4, teamId: "t2", dt: 60_000 },
    ].map(({ overall, teamId, dt }) => {
      t += dt;
      return makePick(overall, teamId, `p${overall}`, { createdAt: new Date(t).toISOString() });
    });
    const slides = computeDraftAwards(timed, teams, new Map());
    const quickest = findAward(slides, "quickest-draft");
    const slowest = findAward(slides, "slowest-draft");
    expect(quickest?.teamName).toBe("Bravo");
    expect(quickest?.headline).toBe("1m 05s");
    expect(slowest?.teamName).toBe("Alpha");
    expect(slowest?.headline).toBe("5m 00s");
  });

  it("awards most and fewest landmines when counts differ", () => {
    const picks = [
      makePick(1, "t1", "a"),
      makePick(2, "t2", "b", { isLandmine: true }),
      makePick(3, "t1", "c"),
      makePick(4, "t2", "d", { isLandmine: true }),
    ];
    const slides = computeDraftAwards(picks, teams, new Map());
    const most = findAward(slides, "landmine-magnet");
    const least = findAward(slides, "lucky-charm");
    expect(most?.teamName).toBe("Bravo");
    expect(most?.headline).toBe("2 landmines hit");
    expect(least?.teamName).toBe("Alpha");
    expect(least?.headline).toBe("0 landmines hit");
  });

  it("skips the landmine awards when every team hit the same number", () => {
    const picks = [
      makePick(1, "t1", "a", { isLandmine: true }),
      makePick(2, "t2", "b", { isLandmine: true }),
    ];
    const slides = computeDraftAwards(picks, teams, new Map());
    expect(findAward(slides, "landmine-magnet")).toBeUndefined();
    expect(findAward(slides, "lucky-charm")).toBeUndefined();
  });

  it("awards steal and reach from rank differentials", () => {
    const picks = [
      makePick(1, "t1", "a"),
      makePick(2, "t2", "b"),
      makePick(3, "t1", "c"),
      makePick(4, "t2", "d"),
    ];
    // Player d: ranked #1 but drafted #4 → steal. Player a: ranked #40 drafted #1 → reach.
    const rankMap = new Map([["a", 40], ["b", 2], ["c", 3], ["d", 1]]);
    const slides = computeDraftAwards(picks, teams, rankMap);
    const steal = findAward(slides, "steal");
    const reach = findAward(slides, "big-reach");
    expect(steal?.teamName).toBe("Bravo");
    expect(steal?.player).toBe("Player d");
    expect(steal?.headline).toBe("+3 value");
    expect(reach?.teamName).toBe("Alpha");
    expect(reach?.player).toBe("Player a");
    expect(reach?.headline).toBe("39 spots early");
  });

  it("awards best draft to the team beating the rankings on average", () => {
    const picks = [
      makePick(1, "t1", "a"),
      makePick(2, "t2", "b"),
      makePick(3, "t1", "c"),
      makePick(4, "t2", "d"),
    ];
    const rankMap = new Map([["a", 10], ["b", 1], ["c", 20], ["d", 2]]);
    const slides = computeDraftAwards(picks, teams, rankMap);
    expect(findAward(slides, "best-draft")?.teamName).toBe("Bravo");
  });

  it("awards the collector for position hoarding", () => {
    const picks = [
      makePick(1, "t1", "a", { playerPosition: "WR" }),
      makePick(2, "t2", "b"),
      makePick(3, "t1", "c", { playerPosition: "WR" }),
      makePick(4, "t2", "d"),
      makePick(5, "t1", "e", { playerPosition: "WR" }),
      makePick(6, "t2", "f"),
      makePick(7, "t1", "g", { playerPosition: "WR" }),
    ];
    const slides = computeDraftAwards(picks, teams, new Map());
    const collector = findAward(slides, "collector");
    expect(collector?.teamName).toBe("Alpha");
    expect(collector?.headline).toBe("4 WRs");
  });

  it("skips value awards when no players are ranked", () => {
    const picks = [makePick(1, "t1", "a"), makePick(2, "t2", "b")];
    const slides = computeDraftAwards(picks, teams, new Map());
    expect(findAward(slides, "steal")).toBeUndefined();
    expect(findAward(slides, "best-draft")).toBeUndefined();
    expect(findAward(slides, "worst-draft")).toBeUndefined();
  });

  it("awards both best and worst draft", () => {
    const picks = [
      makePick(1, "t1", "a"),
      makePick(2, "t2", "b"),
      makePick(3, "t1", "c"),
      makePick(4, "t2", "d"),
    ];
    // Bravo beats its slots, Alpha reaches badly on both picks.
    const rankMap = new Map([["a", 10], ["b", 1], ["c", 20], ["d", 2]]);
    const slides = computeDraftAwards(picks, teams, rankMap);
    expect(findAward(slides, "best-draft")?.teamName).toBe("Bravo");
    expect(findAward(slides, "worst-draft")?.teamName).toBe("Alpha");
  });
});
