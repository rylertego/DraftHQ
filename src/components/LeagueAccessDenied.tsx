"use client";

import Link from "next/link";
import type { LeagueAccessFailure } from "@/lib/leagueAccess";

// Deliberately shows no league name, logo, or accent colour. RLS hides the
// league's existence from non-members; echoing its branding back would leak
// exactly what the policy is protecting.

const PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-500 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_14px_40px_rgba(20,184,166,0.28)] transition-colors hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:ring-offset-2 focus:ring-offset-slate-950";
const SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/60 px-5 py-3 text-sm font-bold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950";

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function LeagueAccessDenied({
  failure,
  detail,
  onRetry,
}: {
  failure: LeagueAccessFailure;
  /** The raw error, shown only for genuine failures. */
  detail?: string;
  onRetry?: () => void;
}) {
  const signedOut = failure === "signed-out";
  const isError = failure === "error";

  const title = isError
    ? "This league couldn't be loaded"
    : signedOut
      ? "Sign in to view this league"
      : "You don't have access to this league";

  const body = isError
    ? "Something went wrong reaching the league. This is usually temporary."
    : signedOut
      ? "You're not signed in, so we can't tell whether this league is yours. Sign in and try the link again."
      : "This league is private. If you should be in it, ask the commissioner to invite the account you're signed in with.";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/75 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            isError ? "bg-red-500/12 text-red-300" : "bg-amber-500/12 text-amber-300"
          }`}
        >
          <LockIcon />
        </div>

        <h1 className="mt-4 text-xl font-black tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>

        {isError && detail && (
          <p className="mt-3 truncate rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-500">
            {detail}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {isError && onRetry ? (
            <>
              <button type="button" onClick={onRetry} className={PRIMARY}>
                Try again
              </button>
              <Link href="/" className={SECONDARY}>
                Home
              </Link>
            </>
          ) : signedOut ? (
            <>
              <Link href="/login" className={PRIMARY}>
                Sign in
              </Link>
              <Link href="/" className={SECONDARY}>
                Home
              </Link>
            </>
          ) : (
            <>
              <Link href="/" className={PRIMARY}>
                Home
              </Link>
              <Link href="/login" className={SECONDARY}>
                Sign in as someone else
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
