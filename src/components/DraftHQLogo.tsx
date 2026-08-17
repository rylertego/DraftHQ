// The mark is now an SVG whose source cyan is #00E6F9 — hue ~185°, not the
// ~174° teal these deltas were originally calibrated against. Every entry was
// recomputed against the new source; leaving the old ones would have tinted
// every league theme about 11° off, and the teal entry (formerly "no filter")
// would have rendered cyan.
const FILTER_MAP: Record<string, string> = {
  "#22d3ee": "hue-rotate(3deg)",    // Cyan    — closest to source
  "#14b8a6": "hue-rotate(349deg)",  // Teal
  "#3b82f6": "hue-rotate(33deg)",   // Royal
  "#10b981": "hue-rotate(336deg)",  // Emerald
  "#a855f7": "hue-rotate(86deg)",   // Violet
  "#ef4444": "hue-rotate(175deg)",  // Crimson
  "#f59e0b": "hue-rotate(213deg)",  // Gold
  "#f43f5e": "hue-rotate(165deg)",  // Rose
  "#6366f1": "hue-rotate(54deg)",   // Indigo
  "#fb923c": "hue-rotate(202deg)",  // Sunset
};

interface Props {
  accentColor?: string;
  className?: string;
}

export default function DraftHQLogo({ accentColor = "#22D3EE", className = "h-24 w-auto" }: Props) {
  const filter = FILTER_MAP[accentColor.toLowerCase()] ?? "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/branding/lockup.svg"
      alt="DraftHQ"
      className={className}
      style={filter ? { filter } : undefined}
    />
  );
}
