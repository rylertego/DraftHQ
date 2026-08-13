import { describe, expect, it } from "vitest";
import { utcToZonedWallClock, zonedWallClockToUtc } from "@/lib/draftSchedule";

describe("zonedWallClockToUtc", () => {
  it("applies the selected zone rather than the browser's", () => {
    // 7:00 PM Eastern on a summer date is EDT (UTC-4) → 23:00Z.
    expect(zonedWallClockToUtc("2026-09-01", "19:00", "America/New_York"))
      .toBe("2026-09-01T23:00:00.000Z");
    // The same wall clock in Pacific is three hours later in absolute time.
    expect(zonedWallClockToUtc("2026-09-01", "19:00", "America/Los_Angeles"))
      .toBe("2026-09-02T02:00:00.000Z");
  });

  it("honours standard time outside daylight saving", () => {
    // January is EST (UTC-5).
    expect(zonedWallClockToUtc("2026-01-15", "19:00", "America/New_York"))
      .toBe("2026-01-16T00:00:00.000Z");
  });

  it("handles a zone that does not observe daylight saving", () => {
    expect(zonedWallClockToUtc("2026-09-01", "19:00", "America/Phoenix"))
      .toBe("2026-09-02T02:00:00.000Z");
    expect(zonedWallClockToUtc("2026-01-15", "19:00", "America/Phoenix"))
      .toBe("2026-01-16T02:00:00.000Z");
  });

  it("handles zones ahead of UTC", () => {
    expect(zonedWallClockToUtc("2026-09-01", "19:00", "Europe/London"))
      .toBe("2026-09-01T18:00:00.000Z");
    expect(zonedWallClockToUtc("2026-09-01", "09:00", "Australia/Sydney"))
      .toBe("2026-08-31T23:00:00.000Z");
  });

  it("resolves times near a daylight-saving transition", () => {
    // US DST ends 2026-11-01. 1:30 AM local that morning is ambiguous; the
    // two-pass offset must still land on a real instant rather than drifting.
    const iso = zonedWallClockToUtc("2026-11-01", "01:30", "America/New_York");
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
    // Evening of the same day is unambiguously EST (UTC-5).
    expect(zonedWallClockToUtc("2026-11-01", "19:00", "America/New_York"))
      .toBe("2026-11-02T00:00:00.000Z");
  });

  it("treats an empty time as midnight", () => {
    expect(zonedWallClockToUtc("2026-09-01", "", "America/New_York"))
      .toBe("2026-09-01T04:00:00.000Z");
  });

  it("rejects an unparseable date", () => {
    expect(() => zonedWallClockToUtc("not-a-date", "19:00", "America/New_York")).toThrow();
  });
});

describe("utcToZonedWallClock", () => {
  it("reads back in the selected zone, not UTC", () => {
    // The old code sliced the ISO string, so this displayed 23:00.
    expect(utcToZonedWallClock("2026-09-01T23:00:00.000Z", "America/New_York"))
      .toEqual({ date: "2026-09-01", time: "19:00" });
  });

  it("rolls the date back when the zone is behind UTC", () => {
    expect(utcToZonedWallClock("2026-09-02T02:00:00.000Z", "America/Los_Angeles"))
      .toEqual({ date: "2026-09-01", time: "19:00" });
  });

  it("rolls the date forward when the zone is ahead of UTC", () => {
    expect(utcToZonedWallClock("2026-08-31T23:00:00.000Z", "Australia/Sydney"))
      .toEqual({ date: "2026-09-01", time: "09:00" });
  });

  it("round-trips every supported zone", () => {
    const zones = [
      "America/New_York", "America/Chicago", "America/Denver",
      "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
      "Pacific/Honolulu", "Europe/London", "Australia/Sydney",
    ];
    for (const zone of zones) {
      for (const [date, time] of [["2026-09-01", "19:00"], ["2026-01-15", "08:30"]]) {
        const iso = zonedWallClockToUtc(date, time, zone);
        expect(utcToZonedWallClock(iso, zone)).toEqual({ date, time });
      }
    }
  });
});
