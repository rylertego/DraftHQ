import { describe, expect, it } from "vitest";
import { contrastRatio, deriveAccentTokens } from "@/lib/uiColor";

describe("deriveAccentTokens", () => {
  it.each([undefined, null, "", "not-a-color"])("falls back for %s", (input) => {
    expect(deriveAccentTokens(input, "#22d3ee").base).toBe("#22d3ee");
  });

  it.each(["#ffffff", "#050505", "#777777", "#ffff00"])(
    "chooses readable text for %s",
    (input) => {
      const tokens = deriveAccentTokens(input, "#22d3ee");
      expect(contrastRatio(tokens.base, tokens.foreground)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("returns distinct hover, muted, border, and focus values", () => {
    const tokens = deriveAccentTokens("#7c3aed", "#22d3ee");
    expect(new Set(Object.values(tokens)).size).toBeGreaterThan(3);
  });
});
