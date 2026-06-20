import { describe, expect, it } from "vitest";
import {
  getDraftRecoveryError,
  shouldRefreshDraftOnVisibility,
} from "@/lib/draftRecovery";

describe("shouldRefreshDraftOnVisibility", () => {
  it("refreshes when a visible tab is online", () => {
    expect(shouldRefreshDraftOnVisibility("visible", true)).toBe(true);
  });

  it.each([
    ["hidden" as const, true],
    ["visible" as const, false],
  ])("does not refresh for visibility %s and online %s", (state, online) => {
    expect(shouldRefreshDraftOnVisibility(state, online)).toBe(false);
  });
});

describe("getDraftRecoveryError", () => {
  it.each([
    { code: "PGRST116", message: "No rows returned" },
    { code: "42501", message: "Permission denied" },
    { message: "JWT expired" },
  ])("turns access failures into rejoin guidance", (error) => {
    expect(getDraftRecoveryError(error)).toContain("join link");
  });

  it("preserves a useful unexpected error", () => {
    expect(getDraftRecoveryError(new Error("Network request failed"))).toBe(
      "Network request failed"
    );
  });
});
