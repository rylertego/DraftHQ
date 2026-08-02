import type { Pick, Team } from "@/types/draft";

// End-of-draft awards, derived entirely from pick data + rankings so every
// client computes the same winners. Value scoring matches the round recap:
// score = overallPickNumber - espnRank (positive = got a ranked player late).
//
// Each award gets its own screen in the ceremony, in the order returned here.

export interface DraftAward {
  id: string;
  title: string;
  /** Teaser line shown before the winner is revealed */
  tagline: string;
  teamName: string;
  teamLogoUrl?: string;
  /** The player the award is about, rendered large when present */
  player?: string;
  /** Main stat line */
  headline: string;
  /** Supporting context line */
  detail: string;
}

export function formatClockDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3_600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  const h = Math.floor(seconds / 3_600);
  const m = Math.round((seconds % 3_600) / 60);
  return `${h}h ${m}m`;
}

export function computeDraftAwards(
  picks: Pick[],
  teams: Team[],
  rankMap: Map<string, number>
): DraftAward[] {
  const awards: DraftAward[] = [];
  if (picks.length === 0 || teams.length === 0) return awards;

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const sorted = [...picks].sort((a, b) => a.overallPickNumber - b.overallPickNumber);
  const team = (id: string) => teamById.get(id);

  const push = (
    id: string,
    title: string,
    tagline: string,
    teamId: string,
    headline: string,
    detail: string,
    player?: string
  ) => {
    const winner = team(teamId);
    if (!winner) return;
    awards.push({
      id, title, tagline,
      teamName: winner.name, teamLogoUrl: winner.logoUrl,
      player, headline, detail,
    });
  };

  // ── Per-pick durations (seconds each pick spent on the clock) ──────────
  const byOverall = new Map(sorted.map((p) => [p.overallPickNumber, p]));
  const durations: { pick: Pick; dt: number }[] = [];
  for (const pick of sorted) {
    const prev = byOverall.get(pick.overallPickNumber - 1);
    if (!prev) continue;
    const dt = (Date.parse(pick.createdAt) - Date.parse(prev.createdAt)) / 1_000;
    if (!Number.isFinite(dt) || dt < 0) continue;
    durations.push({ pick, dt });
  }

  // ── Fastest single pick ────────────────────────────────────────────────
  if (durations.length >= 2) {
    const fastest = durations.reduce((a, b) => (b.dt < a.dt ? b : a));
    const longest = durations.reduce((a, b) => (b.dt > a.dt ? b : a));
    push(
      "fastest-pick", "Fastest Pick",
      "No hesitation. No doubt. No mercy on the clock.",
      fastest.pick.teamId,
      formatClockDuration(fastest.dt),
      `pick #${fastest.pick.overallPickNumber}`,
      fastest.pick.playerName
    );
    if (fastest.pick.id !== longest.pick.id) {
      push(
        "longest-pick", "Longest Pick",
        "The clock was ticking. They used all of it.",
        longest.pick.teamId,
        formatClockDuration(longest.dt),
        `pick #${longest.pick.overallPickNumber}`,
        longest.pick.playerName
      );
    }
  }

  // ── Shortest vs longest total time on the clock ────────────────────────
  const totals = new Map<string, number>();
  for (const { pick, dt } of durations) {
    totals.set(pick.teamId, (totals.get(pick.teamId) ?? 0) + dt);
  }
  const totalEntries = [...totals.entries()];
  if (totalEntries.length >= 2) {
    const quickest = totalEntries.reduce((a, b) => (b[1] < a[1] ? b : a));
    const slowest = totalEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (quickest[0] !== slowest[0]) {
      push(
        "quickest-draft", "Shortest Time Overall",
        "In and out. Barely touched the clock all night.",
        quickest[0],
        formatClockDuration(quickest[1]),
        "Total time on the clock all draft."
      );
      push(
        "slowest-draft", "Longest Time Overall",
        "Add up every pick, and this is where the night went.",
        slowest[0],
        formatClockDuration(slowest[1]),
        "The room aged waiting on these picks."
      );
    }
  }

  // ── Head-to-head: most vs fewest landmines ─────────────────────────────
  const landmineCounts = new Map<string, number>(teams.map((t) => [t.id, 0]));
  let anyLandmines = false;
  for (const pick of sorted) {
    if (pick.isLandmine) {
      anyLandmines = true;
      landmineCounts.set(pick.teamId, (landmineCounts.get(pick.teamId) ?? 0) + 1);
    }
  }
  if (anyLandmines && teams.length >= 2) {
    const counts = [...landmineCounts.entries()];
    const most = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
    const least = counts.reduce((a, b) => (b[1] < a[1] ? b : a));
    if (most[0] !== least[0] && most[1] !== least[1]) {
      push(
        "landmine-magnet", "Most Landmines",
        "Somebody had to step on them…",
        most[0],
        `${most[1]} landmine${most[1] === 1 ? "" : "s"} hit`,
        most[1] === 1 ? "One boom is one too many." : "A walking minefield detector."
      );
      push(
        "lucky-charm", "Fewest Landmines",
        "Walked through the minefield whistling.",
        least[0],
        `${least[1]} landmine${least[1] === 1 ? "" : "s"} hit`,
        least[1] === 0 ? "Danced through untouched." : "Barely singed."
      );
    }
  }

  // ── Head-to-head: steal vs reach (needs rankings) ──────────────────────
  const scoredPicks = sorted
    .filter((p) => rankMap.has(p.playerId))
    .map((p) => ({ pick: p, rank: rankMap.get(p.playerId)!, score: p.overallPickNumber - rankMap.get(p.playerId)! }));

  if (scoredPicks.length > 0) {
    const steal = scoredPicks.reduce((a, b) => (b.score > a.score ? b : a));
    const reach = scoredPicks.reduce((a, b) => (b.score < a.score ? b : a));
    if (reach.score < 0) {
      push(
        "big-reach", "The Big Reach",
        "When you love a player, rankings are just a suggestion.",
        reach.pick.teamId,
        `${Math.abs(reach.score)} spots early`,
        `Ranked #${reach.rank}, drafted #${reach.pick.overallPickNumber}.`,
        reach.pick.playerName
      );
    }
    if (steal.score > 0) {
      push(
        "steal", "Steal of the Draft",
        "While everyone else was talking, somebody was robbing the board.",
        steal.pick.teamId,
        `+${steal.score} value`,
        `Ranked #${steal.rank}, still on the board at #${steal.pick.overallPickNumber}.`,
        steal.pick.playerName
      );
    }
  }

  // ── Solo: The Collector (position hoarding) ────────────────────────────
  const posCounts = new Map<string, Map<string, number>>();
  for (const pick of sorted) {
    const counts = posCounts.get(pick.teamId) ?? new Map<string, number>();
    counts.set(pick.playerPosition, (counts.get(pick.playerPosition) ?? 0) + 1);
    posCounts.set(pick.teamId, counts);
  }
  let collector: { teamId: string; position: string; count: number } | null = null;
  for (const [teamId, counts] of posCounts) {
    for (const [position, count] of counts) {
      if (!collector || count > collector.count) collector = { teamId, position, count };
    }
  }
  if (collector && collector.count >= 4) {
    push(
      "collector", "The Collector",
      "Why draft a balanced roster when you can corner a market?",
      collector.teamId,
      `${collector.count} ${collector.position}s`,
      `Nobody else stood a chance at ${collector.position}.`
    );
  }

  // ── Finale: best and worst overall draft ───────────────────────────────
  const teamScores = new Map<string, number[]>();
  for (const { pick, score } of scoredPicks) {
    const scores = teamScores.get(pick.teamId) ?? [];
    scores.push(score);
    teamScores.set(pick.teamId, scores);
  }
  const grades = [...teamScores.entries()]
    .filter(([, scores]) => scores.length >= 2)
    .map(([teamId, scores]) => ({ teamId, avg: scores.reduce((a, b) => a + b, 0) / scores.length }));
  if (grades.length >= 2) {
    const worst = grades.reduce((a, b) => (b.avg < a.avg ? b : a));
    push(
      "worst-draft", "Worst Draft",
      "Somebody has to keep the waiver wire in business.",
      worst.teamId,
      `${worst.avg >= 0 ? "+" : ""}${worst.avg.toFixed(1)} avg value per pick`,
      "The rankings did not agree with this one."
    );
    // Best draft goes last — it's the closing note of the ceremony.
    const best = grades.reduce((a, b) => (b.avg > a.avg ? b : a));
    if (best.teamId !== worst.teamId) {
      push(
        "best-draft", "Best Draft",
        "The board fell their way all night — or they made it fall.",
        best.teamId,
        `${best.avg >= 0 ? "+" : ""}${best.avg.toFixed(1)} avg value per pick`,
        "Beat the rankings more than anyone in the room."
      );
    }
  }

  return awards;
}

// ── Team draft grades ──────────────────────────────────────────────────────
// Graded on a curve within the league, not against an absolute scale: every
// team drafted from the same board, so the only meaningful question is who beat
// it hardest. Value per pick = (pick slot − player's consensus rank), averaged.

export interface TeamDraftGrade {
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  /** Letter grade, or null when the team has no ranked picks to judge */
  grade: string | null;
  /** Average (pick slot − rank) across ranked picks; positive = value */
  valuePerPick: number;
  rankedPicks: number;
}

const GRADE_LADDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D"];

export function computeTeamGrades(
  picks: Pick[],
  teams: Team[],
  rankMap: Map<string, number>
): TeamDraftGrade[] {
  const scores = new Map<string, number[]>();
  for (const pick of picks) {
    const rank = rankMap.get(pick.playerId);
    if (rank === undefined) continue;
    const list = scores.get(pick.teamId) ?? [];
    list.push(pick.overallPickNumber - rank);
    scores.set(pick.teamId, list);
  }

  const rows: TeamDraftGrade[] = teams.map((team) => {
    const list = scores.get(team.id) ?? [];
    const valuePerPick = list.length > 0 ? list.reduce((a, b) => a + b, 0) / list.length : 0;
    return {
      teamId: team.id,
      teamName: team.name,
      teamLogoUrl: team.logoUrl,
      grade: null,
      valuePerPick,
      rankedPicks: list.length,
    };
  });

  // Best value first; teams with nothing to judge sort last and stay ungraded.
  rows.sort((a, b) => {
    if (a.rankedPicks === 0 || b.rankedPicks === 0) return b.rankedPicks - a.rankedPicks;
    return b.valuePerPick - a.valuePerPick;
  });

  const gradable = rows.filter((r) => r.rankedPicks > 0);
  gradable.forEach((row, i) => {
    const percentile = gradable.length > 1 ? i / (gradable.length - 1) : 0;
    row.grade = GRADE_LADDER[Math.round(percentile * (GRADE_LADDER.length - 1))];
  });

  return rows;
}
