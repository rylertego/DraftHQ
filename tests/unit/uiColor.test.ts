import { describe, expect, expectTypeOf, it } from "vitest";
import { contrastRatio, deriveAccentTokens } from "@/lib/uiColor";

const DARK_CANVAS = "#020617";

describe("deriveAccentTokens", () => {
  it.each([undefined, null, "", "not-a-color"])("falls back for %s", (input) => {
    expect(deriveAccentTokens(input, "#22d3ee").base).toBe("#22d3ee");
  });

  it("normalizes shorthand and uppercase input", () => {
    expect(deriveAccentTokens("#AbC", "#22d3ee").base).toBe("#aabbcc");
  });

  it("normalizes a valid fallback and uses the product fallback for malformed colors", () => {
    expect(deriveAccentTokens(undefined, "#0F0").base).toBe("#00ff00");
    expect(deriveAccentTokens("bad-input", "bad-fallback").base).toBe("#22d3ee");
  });

  it("emits only the approved foreground literals", () => {
    const lightTokens = deriveAccentTokens("#ffffff", "#22d3ee");
    const darkTokens = deriveAccentTokens("#000000", "#22d3ee");

    expect(lightTokens.foreground).toBe("#020617");
    expect(darkTokens.foreground).toBe("#ffffff");
    expectTypeOf(lightTokens.foreground).toEqualTypeOf<"#020617" | "#ffffff">();
  });

  it.each(["#000000", "#ffffff", "#020617", "#006eff", "#777777", "#ffff00"])(
    "keeps base and hover readable for %s",
    (input) => {
      const tokens = deriveAccentTokens(input, "#22d3ee");
      expect(contrastRatio(tokens.base, tokens.foreground)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.hover, tokens.foreground)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("adjusts the narrow contrast gap toward a valid base", () => {
    const tokens = deriveAccentTokens("#006eff", "#22d3ee");

    expect(tokens.foreground).toBe("#ffffff");
    expect(tokens.base).not.toBe("#006eff");
    expect(contrastRatio(tokens.base, tokens.foreground)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["#000000", "#ffffff"])("keeps all tokens distinct for %s", (input) => {
    const tokens = deriveAccentTokens(input, "#22d3ee");
    expect(new Set(Object.values(tokens)).size).toBe(6);
  });

  it.each(["#000000", "#ffffff", "#020617"])(
    "keeps focus and border visible against the dark canvas for %s",
    (input) => {
      const tokens = deriveAccentTokens(input, "#22d3ee");

      expect(tokens.focus).not.toBe(tokens.border);
      expect(contrastRatio(tokens.focus, DARK_CANVAS)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(tokens.border, DARK_CANVAS)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("contrastRatio", () => {
  it("handles shorthand and extreme contrast", () => {
    expect(contrastRatio("#000", "#fff")).toBe(21);
    expect(contrastRatio("#FFF", "#ffffff")).toBe(1);
  });
});
