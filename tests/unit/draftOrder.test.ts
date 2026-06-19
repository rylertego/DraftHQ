import { describe, expect, it } from "vitest";
import { generateSnakeDraftOrder } from "@/lib/draftOrder";
import { Team } from "@/types/draft";

describe("generateSnakeDraftOrder", () => {
  it("creates snake draft order for 4 teams and 2 rounds", () => {
    const teams: Team[] = [
      { id: "1", draftId: "d1", name: "Team 1", draftPosition: 1 },
      { id: "2", draftId: "d1", name: "Team 2", draftPosition: 2 },
      { id: "3", draftId: "d1", name: "Team 3", draftPosition: 3 },
      { id: "4", draftId: "d1", name: "Team 4", draftPosition: 4 },
    ];

    const slots = generateSnakeDraftOrder(teams, 2);

    expect(slots.length).toBe(8);

    expect(slots[0].teamName).toBe("Team 1");
    expect(slots[1].teamName).toBe("Team 2");
    expect(slots[2].teamName).toBe("Team 3");
    expect(slots[3].teamName).toBe("Team 4");

    expect(slots[4].teamName).toBe("Team 4");
    expect(slots[5].teamName).toBe("Team 3");
    expect(slots[6].teamName).toBe("Team 2");
    expect(slots[7].teamName).toBe("Team 1");
  });

  it("creates correct number of picks for a 12 team 15 round draft", () => {
  const teams: Team[] = Array.from({ length: 12 }, (_, i) => ({
    id: `${i + 1}`,
    draftId: "d1",
    name: `Team ${i + 1}`,
    draftPosition: i + 1,
  }));

  const slots = generateSnakeDraftOrder(teams, 15);

  expect(slots.length).toBe(180);
});

it("reverses draft order on even rounds", () => {
  const teams: Team[] = [
    { id: "1", draftId: "d1", name: "Team 1", draftPosition: 1 },
    { id: "2", draftId: "d1", name: "Team 2", draftPosition: 2 },
    { id: "3", draftId: "d1", name: "Team 3", draftPosition: 3 },
  ];

  const slots = generateSnakeDraftOrder(teams, 2);

  expect(slots[3].teamName).toBe("Team 3");
  expect(slots[4].teamName).toBe("Team 2");
  expect(slots[5].teamName).toBe("Team 1");
});
});