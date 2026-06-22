import type { ProviderLeaguePreview, ProviderTeamPreview } from "./types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(record: UnknownRecord, key: string): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function parseIntField(record: UnknownRecord, key: string): number | null {
  const v = record[key];
  if (typeof v === "number") return Math.floor(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

function normalizeFranchises(raw: unknown): UnknownRecord[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (isRecord(raw)) return [raw];
  return [];
}

export function buildMflLeaguePreview(raw: unknown): ProviderLeaguePreview {
  if (!isRecord(raw)) {
    throw new Error("MFL returned an unexpected response.");
  }

  const league = isRecord(raw.league) ? raw.league : null;
  if (!league) {
    throw new Error(
      "MFL league not found. Check your league ID, year, and API key."
    );
  }

  const leagueName = getString(league, "name")?.trim() || null;
  if (!leagueName) {
    throw new Error("MFL league name is missing.");
  }

  const franchisesContainer = isRecord(league.franchises)
    ? league.franchises
    : {};
  const franchises = normalizeFranchises(franchisesContainer.franchise);

  if (franchises.length < 2 || franchises.length > 20) {
    throw new Error(
      franchises.length === 0
        ? "No franchises found in this MFL league."
        : "MFL league must have between 2 and 20 franchises."
    );
  }

  const warnings: string[] = [];

  let rounds = 15;
  const pickOptions = parseIntField(league, "draftPickOptions");
  const startersObj = isRecord(league.starters) ? league.starters : null;
  const starterCount = startersObj ? parseIntField(startersObj, "count") : null;
  if (pickOptions && pickOptions >= 1 && pickOptions <= 30) {
    rounds = pickOptions;
  } else if (starterCount && starterCount >= 1 && starterCount <= 30) {
    rounds = starterCount;
    warnings.push("Rounds inferred from starter count; adjust if needed.");
  } else {
    warnings.push("Could not determine draft rounds; defaulting to 15.");
  }

  const teams: ProviderTeamPreview[] = franchises.map((franchise, index) => {
    const id = getString(franchise, "id") ?? String(index + 1);
    const name =
      getString(franchise, "name")?.trim() || `Franchise ${index + 1}`;
    const ownerName =
      getString(franchise, "owner_name")?.trim() || "Unassigned Owner";
    return {
      externalId: id,
      ownerName,
      teamName: name,
      draftPosition: index + 1,
    };
  });

  return { leagueName, rounds, teams, warnings };
}
