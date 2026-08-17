"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { isLeagueFocusRoute } from "@/lib/leagueTheme";
import { deriveAccentTokens } from "@/lib/uiColor";

// The product accent. This is the fallback for un-themed pages and for leagues
// that never picked a colour, so it must track the brand: while it was the old
// teal it fed DraftHQLogo's FILTER_MAP and rotated the cyan mark back to teal.
const DEFAULT_ACCENT = "#22D3EE";
const DEFAULT_BG     = "#020617";
const PRODUCT_ACCENT = "#22d3ee";

interface LeagueThemeCtx {
  accentColor: string;
  setAccentColor: (c: string) => void;
  bgColor: string;
  setBgColor: (c: string) => void;
}

const LeagueThemeContext = createContext<LeagueThemeCtx>({
  accentColor: DEFAULT_ACCENT,
  setAccentColor: () => {},
  bgColor: DEFAULT_BG,
  setBgColor: () => {},
});

type LeagueThemeStyle = CSSProperties & Record<`--${string}`, string>;

interface LeagueThemeScopeProps {
  accentTokens: ReturnType<typeof deriveAccentTokens>;
  children: ReactNode;
  isLeagueWorkspace: boolean;
}

function LeagueThemeScope({
  accentTokens,
  children,
  isLeagueWorkspace,
}: LeagueThemeScopeProps) {
  const themeStyle: LeagueThemeStyle = {
    display: "contents",
    "--color-league-accent": accentTokens.base,
    "--color-league-accent-hover": accentTokens.hover,
    "--color-league-accent-muted": accentTokens.muted,
    "--color-league-accent-border": accentTokens.border,
    "--color-league-accent-foreground": accentTokens.foreground,
    "--color-league-focus-ring": accentTokens.focus,
    "--league-accent": accentTokens.base,
    "--league-accent-hover": accentTokens.hover,
    "--league-accent-muted": accentTokens.muted,
    "--league-accent-border": accentTokens.border,
    "--league-accent-foreground": accentTokens.foreground,
    "--league-focus-ring": "var(--color-league-focus-ring)",
    "--color-focus-ring": isLeagueWorkspace
      ? accentTokens.focus
      : "var(--color-product-focus-ring)",
  };

  return <div style={themeStyle}>{children}</div>;
}

function LeagueThemeQueryScope({ accentTokens, children }: Omit<LeagueThemeScopeProps, "isLeagueWorkspace">) {
  const searchParams = useSearchParams();

  return (
    <LeagueThemeScope
      accentTokens={accentTokens}
      isLeagueWorkspace={searchParams.has("leagueSlug")}
    >
      {children}
    </LeagueThemeScope>
  );
}

export function LeagueThemeProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [bgColor, setBgColor]         = useState(DEFAULT_BG);
  const pathname = usePathname();
  const accentTokens = useMemo(
    () => deriveAccentTokens(accentColor, PRODUCT_ACCENT),
    [accentColor],
  );
  const hasPathLeagueFocus = isLeagueFocusRoute(pathname, false);
  const canHaveQueryLeagueFocus = !hasPathLeagueFocus && isLeagueFocusRoute(pathname, true);

  let themeScope = (
    <LeagueThemeScope accentTokens={accentTokens} isLeagueWorkspace={hasPathLeagueFocus}>
      {children}
    </LeagueThemeScope>
  );

  if (canHaveQueryLeagueFocus) {
    themeScope = (
      <Suspense fallback={themeScope}>
        <LeagueThemeQueryScope accentTokens={accentTokens}>{children}</LeagueThemeQueryScope>
      </Suspense>
    );
  }

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", accentColor);
  }, [accentColor]);

  return (
    <LeagueThemeContext.Provider value={{ accentColor, setAccentColor, bgColor, setBgColor }}>
      {themeScope}
    </LeagueThemeContext.Provider>
  );
}

export { DEFAULT_ACCENT, DEFAULT_BG };
export const useLeagueTheme = () => useContext(LeagueThemeContext);
