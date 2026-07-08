import { describe, expect, it } from "vitest";
import { getSynchronizedWalkUpIndex, getTeamCumulativeListenSeconds, getWalkUpPlaybackTiming } from "@/lib/draftAudio";

describe("synchronized draft audio", () => {
  it("selects the same song from the shared pick number", () => {
    expect(getSynchronizedWalkUpIndex(1, 5)).toBe(0);
    expect(getSynchronizedWalkUpIndex(6, 5)).toBe(0);
    expect(getSynchronizedWalkUpIndex(7, 5)).toBe(1);
  });

  it("waits until the shared start time", () => {
    expect(getWalkUpPlaybackTiming("2026-06-28T12:00:00.000Z", Date.parse("2026-06-28T12:00:01.000Z")))
      .toEqual({ delayMs: 1_000, offsetSeconds: 0 });
  });

  it("seeks late joiners to the shared playback position", () => {
    expect(getWalkUpPlaybackTiming("2026-06-28T12:00:00.000Z", Date.parse("2026-06-28T12:00:07.500Z")))
      .toEqual({ delayMs: 0, offsetSeconds: 5.5 });
  });
});

describe("getTeamCumulativeListenSeconds", () => {
  const at = (seconds: number) =>
    new Date(Date.parse("2026-06-28T12:00:00.000Z") + seconds * 1000).toISOString();
  const pick = (teamId: string, overallPickNumber: number, seconds: number) => ({
    teamId,
    overallPickNumber,
    createdAt: at(seconds),
  });

  it("returns 0 with no picks", () => {
    expect(getTeamCumulativeListenSeconds([], "a")).toBe(0);
  });

  it("counts a single completed turn minus the grace delay", () => {
    // Team B's turn starts at pick 1 (t=0) + 2s grace, ends at its pick (t=92)
    const picks = [pick("a", 1, 0), pick("b", 2, 92)];
    expect(getTeamCumulativeListenSeconds(picks, "b")).toBe(90);
  });

  it("gives the draft's first pick no listening time (anchor unknowable)", () => {
    const picks = [pick("a", 1, 60)];
    expect(getTeamCumulativeListenSeconds(picks, "a")).toBe(0);
  });

  it("accumulates across multiple turns per team", () => {
    // 2-team snake: a, b | b, a
    const picks = [
      pick("a", 1, 0),
      pick("b", 2, 32),   // b turn 1: 32 - 0 - 2 = 30s
      pick("b", 3, 92),   // b turn 2: 92 - 32 - 2 = 58s
      pick("a", 4, 152),  // a turn 2: 152 - 92 - 2 = 58s
    ];
    expect(getTeamCumulativeListenSeconds(picks, "b")).toBe(88);
    expect(getTeamCumulativeListenSeconds(picks, "a")).toBe(58);
  });

  it("rolls back automatically when a pick is undone", () => {
    const before = [pick("a", 1, 0), pick("b", 2, 32), pick("b", 3, 92)];
    const afterUndo = before.slice(0, 2); // pick 3 undone
    expect(getTeamCumulativeListenSeconds(afterUndo, "b")).toBe(30);
  });

  it("clamps instant picks (faster than the grace delay) to zero", () => {
    const picks = [pick("a", 1, 0), pick("b", 2, 1)]; // picked in 1s, before music started
    expect(getTeamCumulativeListenSeconds(picks, "b")).toBe(0);
  });

  it("tolerates a missing preceding pick (skipped/gap in history)", () => {
    const picks = [pick("a", 1, 0), pick("b", 3, 60)]; // pick 2 missing
    expect(getTeamCumulativeListenSeconds(picks, "b")).toBe(0);
  });
});
