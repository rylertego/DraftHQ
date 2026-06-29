import { canonicalNflTeam } from "@/lib/nflTeams";

export interface NflScheduleGame {
  season: string | number;
  game_type: string;
  week: string | number;
  home_team: string;
  away_team: string;
}

export function deriveByeWeeksFromSchedule(
  games: NflScheduleGame[],
  seasonYear: number
) {
  const regularSeason = games.filter((game) =>
    Number(game.season) === seasonYear &&
    game.game_type === "REG" &&
    Number(game.week) >= 1 &&
    Number(game.week) <= 18
  );
  const teams = new Set<string>();
  for (const game of regularSeason) {
    teams.add(canonicalNflTeam(game.home_team));
    teams.add(canonicalNflTeam(game.away_team));
  }

  return [...teams].sort().map((team) => {
    const playedWeeks = new Set(
      regularSeason
        .filter((game) =>
          canonicalNflTeam(game.home_team) === team ||
          canonicalNflTeam(game.away_team) === team
        )
        .map((game) => Number(game.week))
    );
    const missingWeeks = Array.from({ length: 18 }, (_, index) => index + 1)
      .filter((week) => !playedWeeks.has(week));

    if (missingWeeks.length !== 1) {
      throw new Error(`Schedule for ${team} does not contain exactly one bye week.`);
    }
    return { nfl_team: team, bye_week: missingWeeks[0] };
  });
}

