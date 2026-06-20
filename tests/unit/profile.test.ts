import { describe, expect, it } from "vitest";
import { normalizeProfileInput } from "@/lib/profile";

describe("normalizeProfileInput", () => {
  it("trims profile values and converts blanks to null", () => {
    expect(
      normalizeProfileInput({
        displayName: "  Draft Boss  ",
        avatarUrl: " ",
        bio: " ",
      })
    ).toEqual({
      displayName: "Draft Boss",
      avatarUrl: null,
      bio: null,
    });
  });

  it("accepts an HTTPS avatar URL", () => {
    expect(
      normalizeProfileInput({
        displayName: "Owner",
        avatarUrl: "https://example.com/avatar.jpg",
        bio: "Defending champion",
      }).avatarUrl
    ).toBe("https://example.com/avatar.jpg");
  });

  it.each([
    { displayName: "", avatarUrl: "", bio: "" },
    { displayName: "Owner", avatarUrl: "javascript:alert(1)", bio: "" },
    { displayName: "Owner", avatarUrl: "", bio: "x".repeat(281) },
  ])("rejects invalid profile input", (input) => {
    expect(() => normalizeProfileInput(input)).toThrow();
  });
});
