"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LinkButton } from "@/components/ui/Action";

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
    <main className="flex flex-1 items-center px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-5xl">
        {/* Hero */}
        <div className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--color-product-accent)] mb-4">
            Fantasy Draft Platform
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
            Draft Together.<br />
            <span className="text-[color:var(--color-product-accent)]">Win Forever.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            DraftHQ keeps every owner, pick, timer, and team in sync — across phones and laptops — in real time.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-5 sm:grid-cols-2">
          <section className="rounded-2xl border border-[color:var(--color-product-accent-border)] bg-[var(--color-surface-2)] p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-product-accent)] mb-3">Owners</p>
            <h2 className="text-2xl font-bold text-white">Joining a draft?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Open your invitation link or enter the join code from your commissioner.
            </p>
            <div className="mt-6">
              <LinkButton href="/join" variant="primary" scope="product" fullWidth>
                Join a Draft
              </LinkButton>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Commissioners</p>
            <h2 className="text-2xl font-bold text-white">Running the league?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Log in to create, configure, and control your draft.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <LinkButton href="/login" variant="secondary" scope="product" fullWidth>
                Log In
              </LinkButton>
              <LinkButton href="/login" variant="primary" scope="product" fullWidth>
                Create League
              </LinkButton>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
