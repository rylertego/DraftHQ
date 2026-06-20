import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/lib/email";

describe("normalizeEmail", () => {
  it("normalizes a valid address", () => {
    expect(normalizeEmail(" Owner@Example.COM ")).toBe("owner@example.com");
  });

  it.each([null, "", "missing-at.example.com", "owner@example"])(
    "rejects invalid input %s",
    (value) => {
      expect(normalizeEmail(value)).toBeNull();
    }
  );
});
