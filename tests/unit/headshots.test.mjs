import { describe, expect, it } from "vitest";
import { sizedHeadshot, playerImage } from "../../src/lib/headshots.ts";

const STORED =
  "https://static.www.nfl.com/image/upload/f_auto,q_auto/league/qfhvjyssf0lwsh0kienp";

describe("sizedHeadshot", () => {
  it("appends a width to the Cloudinary transform segment", () => {
    expect(sizedHeadshot(STORED, 400)).toBe(
      "https://static.www.nfl.com/image/upload/f_auto,q_auto,w_400/league/qfhvjyssf0lwsh0kienp"
    );
  });

  it("is idempotent — re-sizing replaces the previous width", () => {
    const once = sizedHeadshot(STORED, 400);
    expect(sizedHeadshot(once, 96)).toBe(
      "https://static.www.nfl.com/image/upload/f_auto,q_auto,w_96/league/qfhvjyssf0lwsh0kienp"
    );
  });

  it("inserts a transform segment when the URL has none", () => {
    expect(
      sizedHeadshot(
        "https://static.www.nfl.com/image/upload/league/qfhvjyssf0lwsh0kienp",
        400
      )
    ).toBe(
      "https://static.www.nfl.com/image/upload/w_400/league/qfhvjyssf0lwsh0kienp"
    );
  });

  it("passes through URLs from other hosts untouched", () => {
    const supabase = "https://example.supabase.co/storage/v1/object/public/logos/a.png";
    expect(sizedHeadshot(supabase, 400)).toBe(supabase);
  });

  it("passes through empty or missing values", () => {
    expect(sizedHeadshot(undefined, 400)).toBeUndefined();
    expect(sizedHeadshot("", 400)).toBe("");
  });
});

describe("playerImage", () => {
  it("sizes a real headshot and marks it as a photo", () => {
    expect(
      playerImage({ position: "WR", nflTeam: "PHI", headshotUrl: STORED }, 400)
    ).toEqual({
      url: "https://static.www.nfl.com/image/upload/f_auto,q_auto,w_400/league/qfhvjyssf0lwsh0kienp",
      isTeamLogo: false,
    });
  });

  it("falls back to the club logo for a defense", () => {
    expect(playerImage({ position: "DST", nflTeam: "BAL" }, 400)).toEqual({
      url: "https://static.www.nfl.com/league/api/clubs/logos/BAL.svg",
      isTeamLogo: true,
    });
  });

  it("normalizes defense team abbreviations", () => {
    expect(playerImage({ position: "DST", nflTeam: "jax" }, 400)?.url).toBe(
      "https://static.www.nfl.com/league/api/clubs/logos/JAX.svg"
    );
  });

  it("prefers a headshot over the logo when a defense somehow has one", () => {
    const result = playerImage(
      { position: "DST", nflTeam: "BAL", headshotUrl: STORED },
      400
    );
    expect(result?.isTeamLogo).toBe(false);
  });

  it("returns undefined when there is nothing to show", () => {
    expect(playerImage({ position: "WR", nflTeam: "PHI" }, 400)).toBeUndefined();
    expect(playerImage({ position: "DST" }, 400)).toBeUndefined();
    expect(playerImage(undefined, 400)).toBeUndefined();
  });
});
