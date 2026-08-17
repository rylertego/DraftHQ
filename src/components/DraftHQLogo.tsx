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
    // Proportions are taken from the official lockup, measured off the artwork:
    // within its 504-unit box the mark is 384 tall (76%) and the wordmark 145
    // (29%), with a gap of 43 units. Sizing the mark to the full container
    // instead — the obvious reading of "h-24" — makes the shield about a third
    // larger than the lockup ever drew it.
    // The gap is a fixed 8px rather than proportional: CSS percentage gaps
    // resolve against the container's width, which is content-derived here, so
    // a percentage would be circular. 8px matches the lockup's ratio at the
    // nav's h-24 and is only slightly generous at the draft room's h-8.
    <span className={`inline-flex items-center gap-2 ${className}`} style={style}>
      <DraftHQMark className="h-[76%] w-auto" title="" />
      {/* The lockup does not centre these on each other: its wordmark sits
          12.5 units (3.26% of mark height) below the mark's centre, which
          items-center was flattening out. Expressed against the wordmark's own
          height so it holds at any size. */}
      <DraftHQWordmark className="h-[29%] w-auto translate-y-[8.5%]" title="DraftHQ" />
    </span>
  );
}
