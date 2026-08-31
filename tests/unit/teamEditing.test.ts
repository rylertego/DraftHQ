import { describe, expect, it } from "vitest";
import { resolveInitialTeamId, isTeamProfileDirty } from "@/lib/teamEditing";

describe("resolveInitialTeamId", () => {
  const teams = ["t1", "t2", "t3"];

  it("honours a valid teamId param above everything else", () => {
    expect(resolveInitialTeamId("t3", "t1", teams)).toBe("t3");
  });

  it("ignores a teamId that is not in this league", () => {
    expect(resolveInitialTeamId("other", "t1", teams)).toBe("t1");
  });

  it("falls back to the viewer's own team", () => {
    expect(resolveInitialTeamId(null, "t2", teams)).toBe("t2");
  });

  it("falls back to the first team when the viewer owns none", () => {
    expect(resolveInitialTeamId(null, null, teams)).toBe("t1");
  });

  it("returns null when the league has no teams", () => {
    expect(resolveInitialTeamId(null, null, [])).toBeNull();
  });

  it("ignores an own-team id that is no longer in the league", () => {
    expect(resolveInitialTeamId(null, "deleted", teams)).toBe("t1");
  });
});

describe("isTeamProfileDirty", () => {
  const saved = { name: "Team 8", shortName: "T8", ownerName: "Tyler", ttsName: "Trap Queens" };

  it("is clean when nothing changed", () => {
    expect(isTeamProfileDirty({ ...saved }, saved, false)).toBe(false);
  });

  it("notices an edited field", () => {
    expect(isTeamProfileDirty({ ...saved, name: "Team 9" }, saved, false)).toBe(true);
  });

  it("notices a pending file upload with no text edits", () => {
    expect(isTeamProfileDirty({ ...saved }, saved, true)).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(isTeamProfileDirty({ ...saved, name: "  Team 8  " }, saved, false)).toBe(false);
  });
});
