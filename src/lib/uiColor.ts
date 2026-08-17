export interface AccentTokens {
  base: string;
  foreground: "#020617" | "#ffffff";
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

const DARK_INK: Rgb = { r: 2, g: 6, b: 23 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const DARK_INK_HEX = "#020617" as const;
const WHITE_HEX = "#ffffff" as const;
const DEFAULT_PRODUCT_ACCENT = "#22d3ee";
const MINIMUM_TEXT_CONTRAST = 4.5;
const MINIMUM_NON_TEXT_CONTRAST = 3;

type AccentForeground = AccentTokens["foreground"];

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

function foregroundRgb(foreground: AccentForeground): Rgb {
  return foreground === DARK_INK_HEX ? DARK_INK : WHITE;
}

function oppositeEndpoint(foreground: AccentForeground): Rgb {
  return foreground === DARK_INK_HEX ? WHITE : DARK_INK;
}

function chooseAccessibleBase(base: Rgb): { base: Rgb; foreground: AccentForeground } {
  const baseHex = toHex(base);
  const darkContrast = contrastRatio(baseHex, DARK_INK_HEX);
  const whiteContrast = contrastRatio(baseHex, WHITE_HEX);
  const foreground = darkContrast >= whiteContrast ? DARK_INK_HEX : WHITE_HEX;
  const chosenContrast = Math.max(darkContrast, whiteContrast);

  if (chosenContrast >= MINIMUM_TEXT_CONTRAST) {
    return { base, foreground };
  }

  const endpoint = oppositeEndpoint(foreground);
  for (let step = 1; step <= 100; step += 1) {
    const candidateHex = toHex(mixRgb(base, endpoint, step / 100));
    if (contrastRatio(candidateHex, foreground) >= MINIMUM_TEXT_CONTRAST) {
      return { base: requireHexColor(candidateHex), foreground };
    }
  }

  return { base: endpoint, foreground };
}

function deriveReadableHover(base: Rgb, foreground: AccentForeground): string {
  const baseHex = toHex(base);
  const targets = [foregroundRgb(foreground), oppositeEndpoint(foreground)];

  for (const target of targets) {
    for (let step = 8; step <= 100; step += 1) {
      const candidateHex = toHex(mixRgb(base, target, step / 100));
      if (
        candidateHex !== baseHex
        && contrastRatio(candidateHex, foreground) >= MINIMUM_TEXT_CONTRAST
      ) {
        return candidateHex;
      }
    }
  }

  return baseHex;
}

function deriveCanvasVisibleToken(
  base: Rgb,
  canvasMix: number,
  minimumContrast: number,
  excludedColors: readonly string[] = [],
): string {
  const baseHex = toHex(base);
  const excluded = new Set([baseHex, ...excludedColors]);
  const isUsable = (candidateHex: string) => (
    !excluded.has(candidateHex)
    && contrastRatio(candidateHex, DARK_INK_HEX) >= minimumContrast
  );
  const preferredHex = toHex(mixRgb(base, DARK_INK, canvasMix));
  if (isUsable(preferredHex)) {
    return preferredHex;
  }

  for (let step = 1; step <= 100; step += 1) {
    const candidateHex = toHex(mixRgb(base, WHITE, step / 100));
    if (isUsable(candidateHex)) {
      return candidateHex;
    }
  }

  for (let step = 0; step <= 100; step += 1) {
    const candidateHex = toHex(mixRgb(WHITE, DARK_INK, step / 100));
    if (isUsable(candidateHex)) {
      return candidateHex;
    }
  }

  throw new Error("Unable to derive a distinct canvas-visible color");
}

function deriveCanvasBorder(base: Rgb): string {
  return deriveCanvasVisibleToken(base, 0.42, MINIMUM_NON_TEXT_CONTRAST);
}

function deriveCanvasFocus(base: Rgb, border: string): string {
  return deriveCanvasVisibleToken(base, 0.18, MINIMUM_TEXT_CONTRAST, [border]);
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
  const border = deriveCanvasBorder(base);

  return {
    base: toHex(base),
    foreground,
    hover: deriveReadableHover(base, foreground),
    muted: toHex(mixRgb(base, foregroundRgb(foreground), 0.55)),
    border,
    focus: deriveCanvasFocus(base, border),
  };
}
