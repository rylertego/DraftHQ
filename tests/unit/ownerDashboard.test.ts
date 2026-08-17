import { describe, expect, it } from "vitest";
import { buildOwnerDashboardView, type OwnerDashboardInput } from "@/lib/ownerDashboard";

function input(overrides: Partial<OwnerDashboardInput> = {}): OwnerDashboardInput {
  return {
    draftExists: true,
    draftStatus: "setup",
    formattedDraftDate: "Sat, Aug 30, 2026, 7:00 PM",
    hasTeam: true,
    teamName: "Sunday Scaries",
    draftSlot: 7,
    teamCount: 12,
    ...overrides,
  };
}

describe("buildOwnerDashboardView", () => {
  it("always gives the owner a way forward, even mid-setup", () => {
    // The commissioner dashboard fell through to `null` here, leaving owners
    // with a readiness checklist and no button at all. There must always be a
    // button — but see below for where it points.
    const view = buildOwnerDashboardView(input({ hasTeam: false, draftSlot: null, formattedDraftDate: null }));
    expect(view.primaryCta.label.length).toBeGreaterThan(0);
  });

  it("keeps owners out of a draft room that is still being set up", () => {
    // A draft row exists but is unscheduled: the commissioner is mid-setup.
    // Owners should not be able to wander into that room.
    const view = buildOwnerDashboardView(input({ draftStatus: "setup", formattedDraftDate: null }));
    expect(view.primaryCta).toEqual({ label: "View League Teams", target: "teams" });
  });

  it("opens the room once the draft is scheduled", () => {
    const view = buildOwnerDashboardView(input({ draftStatus: "setup" }));
    expect(view.primaryCta).toEqual({ label: "Enter Draft Room", target: "room" });
  });

  it("opens the room for a draft already underway even without a date", () => {
    // A live draft is unambiguously real, scheduled or not.
    for (const status of ["active", "paused"] as const) {
      const view = buildOwnerDashboardView(input({ draftStatus: status, formattedDraftDate: null }));
      expect(view.primaryCta).toEqual({ label: "Join Draft Room", target: "room" });
    }
    const done = buildOwnerDashboardView(input({ draftStatus: "complete", formattedDraftDate: null }));
    expect(done.primaryCta).toEqual({ label: "Review Draft", target: "room" });
  });

  it("points at the team list when no draft exists yet", () => {
    const view = buildOwnerDashboardView(input({ draftExists: false, draftStatus: null, formattedDraftDate: null }));
    expect(view.primaryCta).toEqual({ label: "View League Teams", target: "teams" });
    expect(view.statusLabel).toBe("Draft Not Created");
    expect(view.statusTone).toBe("warning");
  });

  it("labels each draft lifecycle state in owner language", () => {
    expect(buildOwnerDashboardView(input({ draftStatus: "active" })).statusLabel).toBe("Draft Live");
    expect(buildOwnerDashboardView(input({ draftStatus: "active" })).statusTone).toBe("live");
    expect(buildOwnerDashboardView(input({ draftStatus: "paused" })).statusLabel).toBe("Draft Paused");
    expect(buildOwnerDashboardView(input({ draftStatus: "complete" })).statusLabel).toBe("Draft Complete");
    expect(buildOwnerDashboardView(input()).statusLabel).toBe("Draft Scheduled");
    expect(buildOwnerDashboardView(input({ formattedDraftDate: null })).statusLabel).toBe("Date TBD");
  });

  it("puts the scheduled date in the headline instead of a setup percentage", () => {
    const view = buildOwnerDashboardView(input());
    expect(view.headline).toContain("Sat, Aug 30, 2026, 7:00 PM");
    expect(view.headline).not.toMatch(/ready|open item/i);
  });

  it("uses join wording while the draft is running", () => {
    expect(buildOwnerDashboardView(input({ draftStatus: "active" })).primaryCta.label).toBe("Join Draft Room");
    expect(buildOwnerDashboardView(input({ draftStatus: "paused" })).primaryCta.label).toBe("Join Draft Room");
    expect(buildOwnerDashboardView(input({ draftStatus: "complete" })).primaryCta.label).toBe("Review Draft");
  });

  it("reports the owner's team and slot", () => {
    const view = buildOwnerDashboardView(input());
    expect(view.teamLabel).toBe("Sunday Scaries");
    expect(view.teamAssigned).toBe(true);
    expect(view.slotLabel).toBe("7 of 12");
    expect(view.note).toBeNull();
  });

  it("explains an unassigned owner rather than showing a checklist", () => {
    const view = buildOwnerDashboardView(input({ hasTeam: false, teamName: null, draftSlot: null }));
    expect(view.teamLabel).toBe("No team yet");
    expect(view.teamState).toBe("Awaiting assignment");
    expect(view.slotLabel).toBe("TBD");
    expect(view.note).toMatch(/not assigned to a team/i);
  });

  it("explains a pending draft order for an assigned owner", () => {
    const view = buildOwnerDashboardView(input({ draftSlot: null }));
    expect(view.note).toMatch(/draft slot is set/i);
  });

  it("drops the slot note once the draft is over", () => {
    const view = buildOwnerDashboardView(input({ draftStatus: "complete", draftSlot: null }));
    expect(view.note).toBeNull();
  });
});
