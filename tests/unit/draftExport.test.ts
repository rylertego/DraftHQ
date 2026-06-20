import { describe, expect, it } from "vitest";
import { createDraftResultsCsv } from "@/lib/draftExport";
import type { Pick, Team } from "@/types/draft";

const teams: Team[] = [
  {
    id: "team-1",
    draftId: "draft-1",
    name: 'Team "Alpha", East',
    draftPosition: 1,
  },
];

const picks: Pick[] = [
  {
    id: "pick-1",
    draftId: "draft-1",
    teamId: "team-1",
    playerId: "player-1",
    round: 1,
    pickNumber: 1,
    overallPickNumber: 1,
    playerName: "Test Player",
    playerPosition: "QB",
    nflTeam: "BUF",
    createdAt: "2026-06-20T12:00:00Z",
  },
];

describe("createDraftResultsCsv", () => {
  it("exports ordered picks and escapes team names", () => {
    const csv = createDraftResultsCsv(teams, picks);

    expect(csv).toContain("Overall Pick,Round,Team,Player,Position,NFL Team");
    expect(csv).toContain('1,1,"Team ""Alpha"", East",Test Player,QB,BUF');
  });
});
