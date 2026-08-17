"use client";

import type { LeagueAccessFailure } from "@/lib/leagueAccess";
import { Button, EmptyState, InlineNotice, LinkButton, PageShell, Panel } from "@/components/ui";

// Deliberately shows no league name, logo, or accent colour, and every action
// is product-scoped rather than league-scoped. RLS hides the league's existence
// from non-members; echoing its branding back would leak exactly what the
// policy is protecting.

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="24" height="24">
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

  const actions = isError && onRetry ? (
    <>
      <Button type="button" onClick={onRetry} variant="primary" scope="product">
        Try again
      </Button>
      <LinkButton href="/" variant="secondary" scope="product">
        Home
      </LinkButton>
    </>
  ) : signedOut ? (
    <>
      <LinkButton href="/login" variant="primary" scope="product">
        Sign in
      </LinkButton>
      <LinkButton href="/" variant="secondary" scope="product">
        Home
      </LinkButton>
    </>
  ) : (
    <>
      <LinkButton href="/" variant="primary" scope="product">
        Home
      </LinkButton>
      <LinkButton href="/login" variant="secondary" scope="product">
        Sign in as someone else
      </LinkButton>
    </>
  );

  return (
    <PageShell width="readable">
      <Panel>
        <EmptyState
          identity={<LockIcon />}
          title={title}
          description={
            <>
              {body}
              {isError && detail ? (
                <InlineNotice status="danger" title="Details">
                  {detail}
                </InlineNotice>
              ) : null}
            </>
          }
          action={actions}
        />
      </Panel>
    </PageShell>
  );
}
