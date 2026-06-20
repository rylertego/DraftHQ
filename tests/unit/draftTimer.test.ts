import { describe, expect, it } from "vitest";
import { formatDraftClock, getDraftClockSeconds } from "@/lib/draftTimer";

describe("getDraftClockSeconds", () => {
  const activeClock = {
    status: "active" as const,
    pickSeconds: 90,
    pickDeadlineAt: "2026-06-20T12:01:30.000Z",
    pausedRemainingSeconds: null,
  };

  it("derives an active countdown from the stored deadline", () => {
    expect(
      getDraftClockSeconds(activeClock, Date.parse("2026-06-20T12:00:45Z"))
    ).toBe(45);
  });

  it("never returns a negative countdown", () => {
    expect(
      getDraftClockSeconds(activeClock, Date.parse("2026-06-20T12:02:00Z"))
    ).toBe(0);
  });

  it("uses the stored pause remainder", () => {
    expect(
      getDraftClockSeconds({
        ...activeClock,
        status: "paused",
        pickDeadlineAt: null,
        pausedRemainingSeconds: 27,
      })
    ).toBe(27);
  });

  it("shows the configured duration during setup", () => {
    expect(
      getDraftClockSeconds({
        ...activeClock,
        status: "setup",
        pickDeadlineAt: null,
      })
    ).toBe(90);
  });
});

describe("formatDraftClock", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatDraftClock(90)).toBe("1:30");
    expect(formatDraftClock(5)).toBe("0:05");
  });
});
