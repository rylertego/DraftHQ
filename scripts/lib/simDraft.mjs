/** Pure helpers for the watchable draft simulation. Kept free of Supabase and
 *  node I/O so they can be unit-tested; the orchestration lives in
 *  scripts/sim-draft.mjs. */

export const SIM_EMAIL_PREFIX = "sim-draft-";

/** Snake order: odd rounds run forwards, even rounds backwards. Matches
 *  getTeamIndex in scripts/test-full-draft.mjs. */
export function snakeTeamIndex(overallPickNumber, teamCount) {
  const round = Math.floor((overallPickNumber - 1) / teamCount) + 1;
  const pickIndex = (overallPickNumber - 1) % teamCount;
  return round % 2 === 1 ? pickIndex : teamCount - pickIndex - 1;
}

/** One console line per pick, shaped so it can be read against the draft board
 *  on screen: round, pick-in-round, overall number, team, player. */
export function formatPickLine({ overallPickNumber, teamCount, teamName, playerName }) {
  const round = Math.floor((overallPickNumber - 1) / teamCount) + 1;
  const pickInRound = ((overallPickNumber - 1) % teamCount) + 1;
  const padded = String(pickInRound).padStart(2, "0");
  return `R${round}.${padded}  overall ${overallPickNumber}  →  ${teamName} picks ${playerName}`;
}

/** Cleanup must be able to find this script's users without a prior run's
 *  bookkeeping, and must never match a real account. */
export function isSimEmail(email) {
  return typeof email === "string" && email.startsWith(SIM_EMAIL_PREFIX);
}
