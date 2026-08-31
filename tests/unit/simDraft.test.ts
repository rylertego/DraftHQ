import { describe, expect, it } from "vitest";
import {
  snakeTeamIndex,
  formatPickLine,
  isSimEmail,
  SIM_EMAIL_PREFIX,
} from "../../scripts/lib/simDraft.mjs";

describe("snakeTeamIndex", () => {
  it("runs the first round forwards", () => {
    expect(snakeTeamIndex(1, 10)).toBe(0);
    expect(snakeTeamIndex(10, 10)).toBe(9);
  });

  it("reverses the second round", () => {
    expect(snakeTeamIndex(11, 10)).toBe(9);
    expect(snakeTeamIndex(20, 10)).toBe(0);
  });

  it("turns back again for the third round", () => {
    expect(snakeTeamIndex(21, 10)).toBe(0);
    expect(snakeTeamIndex(30, 10)).toBe(9);
  });

  it("gives the same team back-to-back picks across a turn", () => {
    // pick 10 ends round 1, pick 11 opens round 2 — both team index 9
    expect(snakeTeamIndex(10, 10)).toBe(snakeTeamIndex(11, 10));
  });

  it("covers every team exactly once per round", () => {
    const round = Array.from({ length: 10 }, (_, i) => snakeTeamIndex(i + 1, 10));
    expect([...round].sort((a, b) => a - b)).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });
});

describe("formatPickLine", () => {
  it("labels round and pick-in-round, not just the overall number", () => {
    expect(
      formatPickLine({ overallPickNumber: 27, teamCount: 10, teamName: "Trap Queens", playerName: "Ja'Marr Chase" })
    ).toBe("R3.07  overall 27  →  Trap Queens picks Ja'Marr Chase");
  });

  it("pads the pick-in-round so lines stay aligned", () => {
    expect(
      formatPickLine({ overallPickNumber: 1, teamCount: 10, teamName: "A", playerName: "B" })
    ).toBe("R1.01  overall 1  →  A picks B");
  });
});

describe("isSimEmail", () => {
  it("recognises addresses this script generates", () => {
    expect(isSimEmail(`${SIM_EMAIL_PREFIX}abc@example.com`)).toBe(true);
  });

  it("leaves real accounts alone", () => {
    expect(isSimEmail("rylertego@gmail.com")).toBe(false);
    expect(isSimEmail("full-draft-123@example.com")).toBe(false);
    expect(isSimEmail(null)).toBe(false);
    expect(isSimEmail(undefined)).toBe(false);
  });
});
