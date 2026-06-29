// Derive dark cell colors from a position accent color.

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export interface PositionCellColors {
  bg: string;   // dark saturated background
  text: string; // light pastel text
  sub: string;  // bright accent (the original color)
}

export function positionCellColors(accentHex: string): PositionCellColors {
  const [h, s] = hexToHsl(accentHex);
  const bg   = hslToHex(h, Math.min(s, 90), 17);
  const text = hslToHex(h, Math.min(s * 0.25, 30), 93);
  return { bg, text, sub: accentHex };
}

/** Build a position → PositionCellColors map from draft rosterPositions. */
export function buildPositionColorMap(
  rosterPositions: { id: string; color: string }[] | null | undefined,
  fallbacks: Record<string, string>
): Map<string, PositionCellColors> {
  const map = new Map<string, PositionCellColors>();
  const positions = rosterPositions?.length ? rosterPositions : Object.entries(fallbacks).map(([id, color]) => ({ id, color }));
  for (const p of positions) {
    if (p.color) map.set(p.id, positionCellColors(p.color));
  }
  return map;
}
