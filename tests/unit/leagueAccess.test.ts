import { describe, expect, it } from "vitest";
import { classifyLeagueLoadError } from "@/lib/leagueAccess";

describe("classifyLeagueLoadError", () => {
  it("treats a missing persistent session as signed out", () => {
    expect(classifyLeagueLoadError(new Error("Sign in with a persistent account to manage leagues.")))
      .toBe("signed-out");
    expect(classifyLeagueLoadError({ message: "Auth session missing!" })).toBe("signed-out");
  });

  it("treats an RLS-filtered empty result as no access", () => {
    // What PostgREST returns when .single() matches nothing because the row is
    // invisible to this user — the non-member case.
    expect(classifyLeagueLoadError({
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
    })).toBe("no-access");
  });

  it("treats an outright privilege denial as no access", () => {
    expect(classifyLeagueLoadError({ code: "42501", message: "permission denied for table leagues" }))
      .toBe("no-access");
    expect(classifyLeagueLoadError({ message: "new row violates row-level security policy" }))
      .toBe("no-access");
  });

  it("leaves real failures as errors so they stay retryable", () => {
    expect(classifyLeagueLoadError(new Error("Failed to fetch"))).toBe("error");
    expect(classifyLeagueLoadError({ code: "500", message: "Internal server error" })).toBe("error");
  });

  it("does not throw on junk input", () => {
    expect(classifyLeagueLoadError(null)).toBe("error");
    expect(classifyLeagueLoadError(undefined)).toBe("error");
    expect(classifyLeagueLoadError("some string")).toBe("error");
    expect(classifyLeagueLoadError({ code: 42501 })).toBe("error"); // number, not string
  });
});
