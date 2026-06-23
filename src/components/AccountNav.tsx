"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function AccountNav() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUser(data.session?.user ?? null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) {
          setUser(session?.user ?? null);
        }
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const hasAccount = user && !user.is_anonymous;

  return (
    <header className="border-b border-gray-800 bg-black/30">
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link className="mr-auto font-bold" href="/">
          DraftHQ
        </Link>
        <Link className="hidden text-sm text-gray-300 sm:block" href="/join">
          Join Draft
        </Link>
        {hasAccount ? (
          <>
            <Link className="text-sm text-gray-300" href="/dashboard">
              Dashboard
            </Link>
            <Link className="text-sm text-gray-300" href="/profile">
              Profile
            </Link>
            <button className="text-sm text-gray-300" onClick={signOut}>
              Log Out
            </button>
          </>
        ) : (
          <>
            <Link className="text-sm text-gray-300" href="/login">
              Log In
            </Link>
            <Link
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
              href="/signup"
            >
              <span className="sm:hidden">Sign Up</span>
              <span className="hidden sm:inline">Create Account</span>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
