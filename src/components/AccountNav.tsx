"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import DraftHQLogo from "@/components/DraftHQLogo";
import LeagueInvitationInbox from "@/components/LeagueInvitationInbox";
import { useLeagueTheme, DEFAULT_ACCENT } from "@/context/LeagueThemeContext";


export default function AccountNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { accentColor, setAccentColor } = useLeagueTheme();

  const hideNav = pathname.startsWith("/draft");
  const [user, setUser] = useState<User | null>(null);

  // Reset theme when leaving league pages
  useEffect(() => {
    const isThemedPage =
      (pathname.startsWith("/leagues/") && pathname !== "/leagues/new") ||
      pathname.startsWith("/teams") ||
      pathname.startsWith("/draft");
    if (!isThemedPage) setAccentColor(DEFAULT_ACCENT);
  }, [pathname, setAccentColor]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [dropdownOpen]);

  async function signOut() {
    setDropdownOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const hasAccount = user && !user.is_anonymous;
  const displayEmail = user?.email ?? "";
  const shortEmail = displayEmail.length > 22 ? displayEmail.slice(0, 20) + "…" : displayEmail;

  if (hideNav) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950">
      <nav className="flex items-center gap-6 px-6 py-0">

        {/* Logo */}
        <Link href={hasAccount ? "/dashboard" : "/"} className="flex items-center py-2 hover:opacity-90 transition-opacity">
          <DraftHQLogo accentColor={accentColor} className="h-24 w-auto" />
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side */}
        {hasAccount ? (
          <>
            <Link
              href="/join"
              className="hidden text-sm font-medium text-slate-400 hover:text-white transition-colors sm:block"
            >
              Join Draft
            </Link>

            <LeagueInvitationInbox userId={user.id} />

            {/* User dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
              >
                <span className="hidden sm:block">{shortEmail}</span>
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60 py-1 text-sm">
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    Profile
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    Dashboard
                  </Link>
                  <hr className="my-1 border-slate-800" />
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 16 16" fill="none">
                      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 py-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
