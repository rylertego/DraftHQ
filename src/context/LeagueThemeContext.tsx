"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { deriveAccentTokens } from "@/lib/uiColor";

const DEFAULT_ACCENT = "#14B8A6";
const DEFAULT_BG     = "#020617";

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

export function LeagueThemeProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [bgColor, setBgColor]         = useState(DEFAULT_BG);
  const pathname = usePathname();
  const accentTokens = useMemo(
    () => deriveAccentTokens(accentColor, DEFAULT_ACCENT),
    [accentColor],
  );
  const isLeagueWorkspace = pathname.startsWith("/leagues/");
  const themeStyle: LeagueThemeStyle = {
    display: "contents",
    "--color-league-accent": accentTokens.base,
    "--color-league-accent-hover": accentTokens.hover,
    "--color-league-accent-muted": accentTokens.muted,
    "--color-league-accent-border": accentTokens.border,
    "--color-league-accent-foreground": accentTokens.foreground,
    "--league-accent": accentTokens.base,
    "--league-accent-hover": accentTokens.hover,
    "--league-accent-muted": accentTokens.muted,
    "--league-accent-border": accentTokens.border,
    "--league-accent-foreground": accentTokens.foreground,
    "--league-focus-ring": accentTokens.focus,
    "--color-focus-ring": isLeagueWorkspace
      ? accentTokens.focus
      : "var(--color-product-focus-ring)",
  };

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", accentColor);
  }, [accentColor]);

  return (
    <LeagueThemeContext.Provider value={{ accentColor, setAccentColor, bgColor, setBgColor }}>
      <div style={themeStyle}>{children}</div>
    </LeagueThemeContext.Provider>
  );
}

export { DEFAULT_ACCENT, DEFAULT_BG };
export const useLeagueTheme = () => useContext(LeagueThemeContext);
