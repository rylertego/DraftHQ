import { describe, expect, it } from "vitest";
import { getSynchronizedWalkUpIndex, getWalkUpPlaybackTiming } from "@/lib/draftAudio";

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
