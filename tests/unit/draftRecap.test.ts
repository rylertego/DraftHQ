import { describe, expect, it } from "vitest";
import {
  buildDraftRecap,
  createDraftRecapEmail,
} from "@/lib/draftRecap";
import type { Pick, Team } from "@/types/draft";
import type { TeamGrade } from "@/lib/draftGrading";

const teams = [
  {
    id: "team-2",
    draftId: "draft-1",
    name: "Team B",
    draftPosition: 2,
    ownerName: "Casey",
  },
  {
    id: "team-1",
    draftId: "draft-1",
    name: "Team A",
    draftPosition: 1,
    ownerName: "Riley",
  },
] satisfies Team[];

const picks = [
  {
    id: "pick-2",
    draftId: "draft-1",
    teamId: "team-2",
    playerId: "player-2",
    round: 1,
    pickNumber: 2,
    overallPickNumber: 2,
    playerName: "Bijan Robinson",
    playerPosition: "RB",
    nflTeam: "ATL",
    isLandmine: false,
    createdAt: "2026-08-31T20:01:00Z",
  },
  {
    id: "pick-1",
    draftId: "draft-1",
    teamId: "team-1",
    playerId: "player-1",
    round: 1,
    pickNumber: 1,
    overallPickNumber: 1,
    playerName: "Keon Coleman",
    playerPosition: "WR",
    nflTeam: "BUF",
    isLandmine: false,
    createdAt: "2026-08-31T20:00:00Z",
  },
] satisfies Pick[];

const teamGrades = [
  {
    teamId: "team-2",
    teamName: "Team B",
    score: 91,
    grade: "A-",
    pickScore: 90,
    constructionScore: 88,
    strategyScore: 94,
    summary: "Great value across the board.",
    strengths: [],
    weaknesses: [],
    picks: [],
  },
] satisfies TeamGrade[];

describe("buildDraftRecap", () => {
  it("sorts teams by draft position, groups picks, and adds grade highlights", () => {
    const recap = buildDraftRecap({
      draftName: "2026 Draft",
      leagueName: "Southcoast",
      teams,
      picks,
      teamGrades,
    });

    expect(recap.totalPicks).toBe(2);
    expect(recap.teamRecaps.map((team) => team.teamName)).toEqual([
      "Team A",
      "Team B",
    ]);
    expect(recap.teamRecaps[0].ownerName).toBe("Riley");
    expect(recap.teamRecaps[0].picks.map((pick) => pick.label)).toEqual([
      "1.1 Keon Coleman WR BUF",
    ]);
    expect(recap.highlights[0]).toEqual({
      label: "Top graded draft",
      value: "Team B",
      detail: "A- - 91",
    });
  });
});

describe("createDraftRecapEmail", () => {
  it("renders escaped recap HTML and plain text with a draft link", () => {
    const recap = buildDraftRecap({
      draftName: "2026 <Draft>",
      leagueName: "Southcoast",
      teams,
      picks,
      teamGrades,
    });

    const email = createDraftRecapEmail({
      recap,
      draftUrl: "https://drafthq.net/draft/test",
    });

    expect(email.subject).toBe("2026 <Draft> recap is ready");
    expect(email.html).toContain("2026 &lt;Draft&gt;");
    expect(email.html).toContain("Keon Coleman");
    expect(email.text).toContain("Team A - Riley");
    expect(email.text).toContain("https://drafthq.net/draft/test");
  });
});
