"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LinkButton, PageShell, Panel } from "@/components/ui";

/** Landing = marketing. A signed-in user has already bought in, so send them
 *  to the dashboard instead of pitching the product to them again. */
type AuthState = "checking" | "signed-out" | "redirecting";

export default function HomePage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      // Anonymous sessions are created for draft guests and are not a real
      // account, so they keep seeing the landing page.
      const signedIn = !!data.user && !data.user.is_anonymous;
      if (signedIn) {
        setAuthState("redirecting");
        // replace, not push: the landing page should not sit in history for a
        // signed-in user, or Back from the dashboard bounces straight here and
        // redirects again.
        router.replace("/dashboard");
        return;
      }
      setAuthState("signed-out");
    });
    return () => {
      active = false;
    };
  }, [router]);

  // Render nothing until the session is known. Showing the marketing hero and
  // then yanking it away is worse than a brief blank frame, and the check
  // resolves from the cached session without a network round trip.
  if (authState !== "signed-out") return null;

  return (
    <main className="flex flex-1 items-center">
      <PageShell width="workspace">
        {/* Hero */}
        <div className="mb-[var(--space-7)] text-center">
          <p className="mb-[var(--space-3)] text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--color-product-accent)]">
            Fantasy Draft Platform
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight text-[color:var(--color-text-primary)] sm:text-7xl">
            Draft Together.<br />
            <span className="text-[color:var(--color-product-accent)]">Win Forever.</span>
          </h1>
          <p className="mx-auto mt-[var(--space-5)] max-w-2xl text-lg leading-8 text-[color:var(--color-text-secondary)]">
            DraftHQ keeps every owner, pick, timer, and team in sync — across phones and laptops — in real time.
          </p>
        </div>

        {/* Two doors: owners arrive with a link or code, commissioners with an
            account. Both cards are the same surface — the difference in weight
            comes from the buttons, not from tinting one card. */}
        <div className="mx-auto grid max-w-4xl gap-[var(--space-4)] sm:grid-cols-2">
          <Panel>
            <p className="mb-[var(--space-2)] text-xs font-bold uppercase tracking-widest text-[color:var(--color-product-accent)]">
              Owners
            </p>
            <h2 className="text-2xl font-bold text-[color:var(--color-text-primary)]">Joining a draft?</h2>
            <p className="mt-[var(--space-2)] text-sm leading-6 text-[color:var(--color-text-secondary)]">
              Open your invitation link or enter the join code from your commissioner.
            </p>
            <div className="mt-[var(--space-5)]">
              <LinkButton href="/join" variant="primary" scope="product" fullWidth>
                Join a Draft
              </LinkButton>
            </div>
          </Panel>

          <Panel>
            <p className="mb-[var(--space-2)] text-xs font-bold uppercase tracking-widest text-[color:var(--color-text-muted)]">
              Commissioners
            </p>
            <h2 className="text-2xl font-bold text-[color:var(--color-text-primary)]">Running the league?</h2>
            <p className="mt-[var(--space-2)] text-sm leading-6 text-[color:var(--color-text-secondary)]">
              Log in to create, configure, and control your draft.
            </p>
            <div className="mt-[var(--space-5)] grid grid-cols-2 gap-[var(--space-3)]">
              <LinkButton href="/login" variant="secondary" scope="product" fullWidth>
                Log In
              </LinkButton>
              <LinkButton href="/login" variant="primary" scope="product" fullWidth>
                Create League
              </LinkButton>
            </div>
          </Panel>
        </div>
      </PageShell>
    </main>
  );
}
