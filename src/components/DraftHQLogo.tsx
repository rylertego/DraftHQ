// The mark's source cyan is now #22D3EE — the same value as
// --color-product-accent — so the product accent needs no filter at all and
// every other delta is measured from 188°.
//
// This map only exists because `<img src="…svg">` is opaque to the page: CSS
// cannot reach inside it, so hue-rotate is the only lever. It is an
// approximation (it rotates every hue proportionally, and cannot hit an
// arbitrary target exactly) and it has to be recalibrated whenever the source
// art changes. Inlining the SVG and using var(--color-league-accent) deletes
// this whole mechanism — see docs/STATUS.md.
const FILTER_MAP: Record<string, string> = {
  "#22d3ee": "",                    // Cyan    — source, no filter
  "#14b8a6": "hue-rotate(345deg)",  // Teal
  "#3b82f6": "hue-rotate(29deg)",   // Royal
  "#10b981": "hue-rotate(332deg)",  // Emerald
  "#a855f7": "hue-rotate(83deg)",   // Violet
  "#ef4444": "hue-rotate(172deg)",  // Crimson
  "#f59e0b": "hue-rotate(210deg)",  // Gold
  "#f43f5e": "hue-rotate(162deg)",  // Rose
  "#6366f1": "hue-rotate(51deg)",   // Indigo
  "#fb923c": "hue-rotate(199deg)",  // Sunset
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
