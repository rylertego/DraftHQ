export interface AccentTokens {
  base: string;
  foreground: string;
  hover: string;
  muted: string;
  border: string;
  focus: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const DEFAULT_PRODUCT_ACCENT = "#22d3ee";
const MINIMUM_TEXT_CONTRAST = 4.5;

function parseHexColor(value: string | null | undefined): Rgb | null {
  if (typeof value !== "string") return null;

  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (!match) return null;

  const digits = match[1].length === 3
    ? match[1].split("").map((digit) => `${digit}${digit}`).join("")
    : match[1];

  return {
    r: Number.parseInt(digits.slice(0, 2), 16),
    g: Number.parseInt(digits.slice(2, 4), 16),
    b: Number.parseInt(digits.slice(4, 6), 16),
  };
}

function channelToHex(channel: number): string {
  return Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0");
}

function toHex({ r, g, b }: Rgb): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * linearize(r)) + (0.7152 * linearize(g)) + (0.0722 * linearize(b));
}

function requireHexColor(value: string): Rgb {
  const color = parseHexColor(value);
  if (!color) throw new Error("Expected a #rgb or #rrggbb color");
  return color;
}

function mixRgb(first: Rgb, second: Rgb, weight: number): Rgb {
  const boundedWeight = Math.max(0, Math.min(1, weight));
  return {
    r: Math.max(0, Math.min(255, first.r + ((second.r - first.r) * boundedWeight))),
    g: Math.max(0, Math.min(255, first.g + ((second.g - first.g) * boundedWeight))),
    b: Math.max(0, Math.min(255, first.b + ((second.b - first.b) * boundedWeight))),
  };
}

function chooseAccessibleBase(base: Rgb): { base: Rgb; foreground: Rgb } {
  const blackContrast = contrastRatio(toHex(base), "#000000");
  const whiteContrast = contrastRatio(toHex(base), "#ffffff");
  const foreground = blackContrast >= whiteContrast ? BLACK : WHITE;

  if (Math.max(blackContrast, whiteContrast) >= MINIMUM_TEXT_CONTRAST) {
    return { base, foreground };
  }

  for (let step = 1; step <= 100; step += 1) {
    const adjusted = mixRgb(base, foreground, step / 100);
    if (contrastRatio(toHex(adjusted), toHex(foreground)) >= MINIMUM_TEXT_CONTRAST) {
      return { base: adjusted, foreground };
    }
  }

  return { base: foreground, foreground };
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(requireHexColor(first));
  const secondLuminance = relativeLuminance(requireHexColor(second));
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function deriveAccentTokens(
  input: string | null | undefined,
  fallback: string,
): AccentTokens {
  const fallbackRgb = parseHexColor(fallback) ?? requireHexColor(DEFAULT_PRODUCT_ACCENT);
  const inputRgb = parseHexColor(input) ?? fallbackRgb;
  const { base, foreground } = chooseAccessibleBase(inputRgb);
  const foregroundHex = toHex(foreground);
  const towardForeground = foreground === WHITE ? BLACK : WHITE;

  return {
    base: toHex(base),
    foreground: foregroundHex,
    hover: toHex(mixRgb(base, towardForeground, 0.12)),
    muted: toHex(mixRgb(base, foreground, 0.55)),
    border: toHex(mixRgb(base, foreground, 0.3)),
    focus: toHex(mixRgb(base, towardForeground, 0.32)),
  };
}
