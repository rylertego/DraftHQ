"use client";

import type { CSSProperties } from "react";
import DraftHQLockup from "@/components/brand/DraftHQLockup";
import { DEFAULT_ACCENT } from "@/context/LeagueThemeContext";
import { deriveAccentTokens } from "@/lib/uiColor";

// The mark used to be an <img> recoloured with hue-rotate, because CSS cannot
// reach inside an <img src="…svg">. That was an approximation: it rotated every
// hue proportionally, could not hit an arbitrary accent exactly, and needed
// recalibrating each time the source art changed — which it did twice in one
// day. The lockup is inline SVG now, so its fills read the accent tokens
// directly and any colour is exact.
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
      display: "contents",
      "--color-league-accent": tokens.base,
      "--color-league-accent-border": tokens.border,
    };
  }

  if (!style) {
    return <DraftHQLockup className={className} />;
  }

  return (
    <span style={style}>
      <DraftHQLockup className={className} />
    </span>
  );
}
