export type DraftAccentVars = Record<`--dhq-${string}`, string>;

const FALLBACK_ACCENT = "#14b8a6";

function normalizeHexColor(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return FALLBACK_ACCENT;

  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{3}$/.test(withoutHash)) {
    return `#${withoutHash.split("").map((char) => `${char}${char}`).join("")}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(withoutHash)) {
    return `#${withoutHash}`.toLowerCase();
  }
  return FALLBACK_ACCENT;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function channelToLinear(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function getRelativeLuminance(color: string | null | undefined): number {
  const { r, g, b } = hexToRgb(normalizeHexColor(color));
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function getReadableTextColor(backgroundColor: string | null | undefined): "#020617" | "#ffffff" {
  return getRelativeLuminance(backgroundColor) > 0.52 ? "#020617" : "#ffffff";
}

export function buildDraftAccentVars(accentColor: string | null | undefined): DraftAccentVars {
  const accent = normalizeHexColor(accentColor);
  const luminance = getRelativeLuminance(accent);
  const accentText = luminance < 0.2 ? `color-mix(in srgb, ${accent} 36%, white)` : accent;

  return {
    "--dhq-accent": accent,
    "--dhq-accent-text": accentText,
    "--dhq-accent-on": getReadableTextColor(accent),
    "--dhq-accent-surface": `color-mix(in srgb, ${accent} 10%, transparent)`,
    "--dhq-accent-surface-strong": `color-mix(in srgb, ${accent} 20%, transparent)`,
    "--dhq-accent-border": `color-mix(in srgb, ${accent} 34%, transparent)`,
    "--dhq-accent-border-strong": `color-mix(in srgb, ${accent} 70%, transparent)`,
    "--dhq-accent-glow": `color-mix(in srgb, ${accent} 28%, transparent)`,
    "--dhq-accent-glow-strong": `color-mix(in srgb, ${accent} 44%, transparent)`,
  };
}
