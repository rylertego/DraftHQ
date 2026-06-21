import { describe, expect, it } from "vitest";
import { moveDraftTeam } from "@/lib/teamSetupLogic";

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
