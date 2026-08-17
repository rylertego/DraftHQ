"use client";

import type { CSSProperties } from "react";
import DraftHQMark from "@/components/brand/DraftHQMark";
import DraftHQWordmark from "@/components/brand/DraftHQWordmark";
import { DEFAULT_ACCENT } from "@/context/LeagueThemeContext";
import { deriveAccentTokens } from "@/lib/uiColor";

// Composed from the mark and the wordmark rather than the lockup, because the
// lockup carries the "Draft Together. Win Forever." tagline and there is no
// tagline-free lockup asset. Composing also lets the two parts be sized
// independently, which a single flattened file could not.
//
// The mark used to be an <img> recoloured with hue-rotate, because CSS cannot
// reach inside an <img src="…svg">. That was an approximation: it rotated every
// hue proportionally, could not hit an arbitrary accent exactly, and needed
// recalibrating each time the source art changed. These are inline SVG now, so
// their fills read the accent tokens directly and any colour is exact.
//
// Normally the surrounding LeagueThemeScope supplies those tokens. An explicit
// accentColor scopes them locally instead, for surfaces like the draft room
// that carry their own accent rather than inheriting one.

type ThemeVars = CSSProperties & Record<`--${string}`, string>;

interface Props {
  accentColor?: string;
  className?: string;
}

export default function DraftHQLogo({ accentColor, className = "h-24 w-auto" }: Props) {
  let style: ThemeVars | undefined;

  if (accentColor) {
    const tokens = deriveAccentTokens(accentColor, DEFAULT_ACCENT);
    style = {
      "--color-league-accent": tokens.base,
      "--color-league-accent-border": tokens.border,
    };
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} style={style}>
      <DraftHQMark className="h-full w-auto" title="" />
      <DraftHQWordmark className="h-[38%] w-auto" title="DraftHQ" />
    </span>
  );
}
