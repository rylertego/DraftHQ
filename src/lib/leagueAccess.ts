// Why a league failed to load, so the UI can tell "you can't see this" apart
// from "something broke".
//
// RLS on public.leagues is `is_league_member(id)`, so a non-member's SELECT
// returns zero rows rather than a permission error. PostgREST's .single() then
// fails with PGRST116. That means a league you can't see and a league that does
// not exist are indistinguishable — which is the right privacy behaviour, and
// why both land on the same screen rather than confirming a league exists.

export type LeagueAccessFailure =
  /** No session, or an anonymous one. Offer sign-in. */
  | "signed-out"
  /** Signed in, but the league is invisible to this user (or absent). */
  | "no-access"
  /** Anything else — network, server, a real bug. Offer retry. */
  | "error";

interface Postgrestish {
  code?: unknown;
  message?: unknown;
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as Postgrestish).code;
  return typeof code === "string" ? code : null;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const message = (error as Postgrestish).message;
    if (typeof message === "string") return message;
  }
  return typeof error === "string" ? error : "";
}

export function classifyLeagueLoadError(error: unknown): LeagueAccessFailure {
  const message = readMessage(error);
  const code = readCode(error);

  // Thrown by requirePersistentUser() before any query runs.
  if (/sign in with a persistent account/i.test(message)) return "signed-out";
  if (/jwt|not authenticated|auth session missing/i.test(message)) return "signed-out";

  // PGRST116: .single() matched no rows — the RLS-filtered "you can't see it".
  if (code === "PGRST116") return "no-access";
  // 42501 is Postgres insufficient_privilege, in case a policy ever denies outright.
  if (code === "42501") return "no-access";
  if (/multiple \(or no\) rows returned|no rows returned|row-level security/i.test(message)) {
    return "no-access";
  }

  return "error";
}
