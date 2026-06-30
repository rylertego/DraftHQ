"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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

export function LeagueThemeProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [bgColor, setBgColor]         = useState(DEFAULT_BG);

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", accentColor);
  }, [accentColor]);

  return (
    <LeagueThemeContext.Provider value={{ accentColor, setAccentColor, bgColor, setBgColor }}>
      {children}
    </LeagueThemeContext.Provider>
  );
}

export { DEFAULT_ACCENT, DEFAULT_BG };
export const useLeagueTheme = () => useContext(LeagueThemeContext);
