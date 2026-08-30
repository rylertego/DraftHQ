import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  buildEspnLeaguePreview: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      getUser: mocks.getUser,
    },
  },
}));

vi.mock("@/lib/providers/espn", () => ({
  buildEspnLeaguePreview: mocks.buildEspnLeaguePreview,
}));

import { GET } from "@/app/api/providers/espn/preview/route";

describe("ESPN provider preview route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1", is_anonymous: false } },
      error: null,
    });
  });

  it("uses the ESPN read API host for league preview requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ settings: { name: "Test League" }, teams: [{ id: 1 }, { id: 2 }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    mocks.buildEspnLeaguePreview.mockReturnValue({ leagueName: "Test League", teams: [], warnings: [] });

    await GET(
      new Request("https://drafthq.test/api/providers/espn/preview?leagueId=1932913091&year=2025", {
        headers: { Authorization: "Bearer token" },
      })
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl"),
      expect.any(Object)
    );
  });

  it("returns a useful error when ESPN serves HTML instead of JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!DOCTYPE html><html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=UTF-8" },
        })
      )
    );

    const response = await GET(
      new Request("https://drafthq.test/api/providers/espn/preview?leagueId=1932913091&year=2025", {
        headers: { Authorization: "Bearer token" },
      })
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(502);
    expect(body.error).toContain("ESPN did not return league data");
    expect(body.error).not.toContain("Unexpected token");
  });
});
