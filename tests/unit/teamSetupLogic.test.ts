import { describe, expect, it } from "vitest";
import { moveDraftTeam, reorderDraftTeams } from "@/lib/teamSetupLogic";

describe("moveDraftTeam", () => {
  it("moves a team up or down one draft slot", () => {
    expect(moveDraftTeam(["A", "B", "C"], 1, -1)).toEqual(["B", "A", "C"]);
    expect(moveDraftTeam(["A", "B", "C"], 1, 1)).toEqual(["A", "C", "B"]);
  });

  it("leaves the order unchanged at its boundaries", () => {
    expect(moveDraftTeam(["A", "B"], 0, -1)).toEqual(["A", "B"]);
    expect(moveDraftTeam(["A", "B"], 1, 1)).toEqual(["A", "B"]);
  });
});

describe("reorderDraftTeams", () => {
  const teams = ["a", "b", "c", "d", "e"];

  it("moves an item down and shifts the rest up", () => {
    expect(reorderDraftTeams(teams, 0, 3)).toEqual(["b", "c", "d", "a", "e"]);
  });

  it("moves an item up and shifts the rest down", () => {
    expect(reorderDraftTeams(teams, 4, 1)).toEqual(["a", "e", "b", "c", "d"]);
  });

  it("shifts rather than swaps", () => {
    // The distinction from moveDraftTeam: everything between the two positions
    // moves along, instead of one team teleporting to where the dragged one was.
    expect(reorderDraftTeams(teams, 0, 4)).toEqual(["b", "c", "d", "e", "a"]);
    expect(reorderDraftTeams(teams, 0, 4)).not.toEqual(["e", "b", "c", "d", "a"]);
  });

  it("returns an unchanged copy for a no-op or out-of-range move", () => {
    expect(reorderDraftTeams(teams, 2, 2)).toEqual(teams);
    expect(reorderDraftTeams(teams, -1, 2)).toEqual(teams);
    expect(reorderDraftTeams(teams, 2, 99)).toEqual(teams);
    expect(reorderDraftTeams(teams, 2, 2)).not.toBe(teams);
  });

  it("never drops or duplicates a team", () => {
    for (let from = 0; from < teams.length; from++) {
      for (let to = 0; to < teams.length; to++) {
        const result = reorderDraftTeams(teams, from, to);
        expect(result).toHaveLength(teams.length);
        expect([...result].sort()).toEqual([...teams].sort());
      }
    }
  });
});
