import { describe, expect, it } from "vitest";
import { deriveByeWeeksFromSchedule, type NflScheduleGame } from "@/lib/byeWeeks";

describe("deriveByeWeeksFromSchedule", () => {
  it("finds the missing regular-season week and normalizes team codes", () => {
    const games: NflScheduleGame[] = Array.from({ length: 17 }, (_, index) => ({
      season: 2026,
      game_type: "REG",
      week: index + 1,
      home_team: "LA",
      away_team: "AZ",
    }));

    expect(deriveByeWeeksFromSchedule(games, 2026)).toEqual([
      { nfl_team: "ARI", bye_week: 18 },
      { nfl_team: "LAR", bye_week: 18 },
    ]);
  });

  it("rejects incomplete schedules instead of showing incorrect weeks", () => {
    expect(() => deriveByeWeeksFromSchedule([], 2026)).not.toThrow();
    expect(deriveByeWeeksFromSchedule([], 2026)).toEqual([]);
  });
});

