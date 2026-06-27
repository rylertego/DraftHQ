// Teal source hue is ~174°. Each entry is hue-rotate(Δdeg) to shift to that theme color.
const FILTER_MAP: Record<string, string> = {
  "#14b8a6": "",                    // Teal    — no filter
  "#3b82f6": "hue-rotate(43deg)",   // Royal
  "#10b981": "hue-rotate(-13deg)",  // Emerald
  "#a855f7": "hue-rotate(97deg)",   // Violet
  "#ef4444": "hue-rotate(186deg)",  // Crimson
  "#f59e0b": "hue-rotate(224deg)",  // Gold
  "#f43f5e": "hue-rotate(174deg)",  // Rose
  "#6366f1": "hue-rotate(65deg)",   // Indigo
  "#22d3ee": "hue-rotate(14deg)",   // Cyan
  "#fb923c": "hue-rotate(213deg)",  // Sunset
};

interface Props {
  accentColor?: string;
  className?: string;
}

export default function DraftHQLogo({ accentColor = "#14B8A6", className = "h-24 w-auto" }: Props) {
  const filter = FILTER_MAP[accentColor.toLowerCase()] ?? "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/branding/logo-primary photoroom.png"
      alt="DraftHQ"
      className={className}
      style={filter ? { filter } : undefined}
    />
  );
}
