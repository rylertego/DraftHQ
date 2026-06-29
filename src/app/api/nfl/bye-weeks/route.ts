import { parse } from "csv-parse/sync";
import { deriveByeWeeksFromSchedule, type NflScheduleGame } from "@/lib/byeWeeks";

const NFLVERSE_SCHEDULE_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv";

export async function GET(request: Request) {
  const year = Number(new URL(request.url).searchParams.get("year"));
  const maxYear = new Date().getFullYear() + 2;
  if (!Number.isInteger(year) || year < 2000 || year > maxYear) {
    return Response.json({ error: "Invalid NFL season year." }, { status: 400 });
  }

  try {
    const response = await fetch(NFLVERSE_SCHEDULE_URL, {
      headers: { Accept: "text/csv" },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) {
      throw new Error(`nflverse returned ${response.status}.`);
    }

    const games = parse(await response.text(), {
      columns: true,
      bom: true,
      skip_empty_lines: true,
    }) as NflScheduleGame[];
    const byeWeeks = deriveByeWeeksFromSchedule(games, year);
    if (byeWeeks.length !== 32) {
      throw new Error(`The ${year} NFL schedule is unavailable or incomplete.`);
    }

    return Response.json({ year, byeWeeks, source: "nflverse" });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load NFL bye weeks." },
      { status: 502 }
    );
  }
}

