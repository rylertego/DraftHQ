"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user && !data.user.is_anonymous);
    });
  }, []);

  return (
    <main className="flex flex-1 items-center px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-5xl">
        {/* Hero */}
        <div className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-400 mb-4">
            Fantasy Draft Platform
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
            Draft Together.<br />
            <span className="text-teal-400">Win Forever.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            DraftHQ keeps every owner, pick, timer, and team in sync — across phones and laptops — in real time.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-5 sm:grid-cols-2">
          <section className="rounded-2xl border border-teal-800/50 bg-teal-950/20 p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-500 mb-3">Owners</p>
            <h2 className="text-2xl font-bold text-white">Joining a draft?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Open your invitation link or enter the join code from your commissioner.
            </p>
            <Link
              href="/join"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-teal-400 transition-colors"
            >
              Join a Draft
            </Link>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Commissioners</p>
            <h2 className="text-2xl font-bold text-white">Running the league?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {isLoggedIn
                ? "Create a draft, manage your league, or enter your draft room."
                : "Log in to create, configure, and control your draft."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href={isLoggedIn ? "/dashboard" : "/login"}
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-center text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                {isLoggedIn ? "Dashboard" : "Log In"}
              </Link>
              <Link
                href="/create"
                className="rounded-xl bg-teal-500 px-4 py-3 text-center text-sm font-bold text-slate-950 hover:bg-teal-400 transition-colors"
              >
                Create Draft
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
