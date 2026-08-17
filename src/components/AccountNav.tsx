"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import DraftHQLogo from "@/components/DraftHQLogo";
import LeagueInvitationInbox from "@/components/LeagueInvitationInbox";
import { useLeagueTheme, DEFAULT_ACCENT } from "@/context/LeagueThemeContext";
import { LinkButton, Menu } from "@/components/ui";


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
  // Menu owns its own open state, dismissal, and focus handling.

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


  async function signOut() {
    // Menu closes itself on select; no local open state to clear.
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

            {/* Account menu. The shared Menu owns overlay stacking, dismissal,
                and keyboard focus, which the previous hand-rolled dropdown did
                not. Its items are callbacks rather than hrefs, so Profile and
                Dashboard route programmatically — a deliberate trade of
                middle-click/open-in-new-tab for correct menu semantics. */}
            <Menu
              label="Account menu"
              triggerText={shortEmail}
              triggerIcon="chevron-down"
              items={[
                { id: "profile", label: "Profile", onSelect: () => router.push("/profile") },
                { id: "dashboard", label: "Dashboard", onSelect: () => router.push("/dashboard") },
                { id: "signout", label: "Log Out", danger: true, onSelect: () => { void signOut(); } },
              ]}
            />
          </>
        ) : (
          <div className="flex items-center gap-2 py-3">
            <LinkButton href="/login" variant="tertiary" scope="product">
              Log In
            </LinkButton>
            <LinkButton href="/signup" variant="primary" scope="product">
              Sign Up
            </LinkButton>
          </div>
        )}
      </nav>
    </header>
  );
}
