/**
 * Colour maths for the AI palette generator and accessibility checker.
 * All pure functions — no I/O — so they are unit-tested directly.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Relative luminance per WCAG 2.1 (sRGB). */
export function relativeLuminance({ r, g, b }: RGB): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/** WCAG contrast ratio between two colours, in the range [1, 21]. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export type WcagLevel = 'AAA' | 'AA' | 'AA Large' | 'Fail';

/** Classify a contrast ratio for normal-size text. */
export function wcagLevel(ratio: number, largeText = false): WcagLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (largeText && ratio >= 3) return 'AA Large';
  return 'Fail';
}

// ── HSL helpers for palette generation ─────────────────────────────

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(1, s));
  const lig = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/**
 * Deterministic, aesthetically-reasonable palette from a text seed. Uses the
 * seed to pick a base hue, then derives a harmony (analogous + accent + neutral).
 * Deterministic so the same prompt always yields the same palette (cacheable,
 * testable) — the "AI" seasoning is the harmony selection.
 */
export function generatePalette(seed: string, harmony: 'analogous' | 'complementary' | 'triadic' = 'analogous'): string[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const base = hash % 360;

  switch (harmony) {
    case 'complementary':
      return [
        hslToHex(base, 0.7, 0.55),
        hslToHex(base, 0.5, 0.7),
        hslToHex(base + 180, 0.7, 0.55),
        hslToHex(base, 0.15, 0.95),
        hslToHex(base, 0.2, 0.15),
      ];
    case 'triadic':
      return [
        hslToHex(base, 0.7, 0.55),
        hslToHex(base + 120, 0.7, 0.55),
        hslToHex(base + 240, 0.7, 0.55),
        hslToHex(base, 0.15, 0.95),
        hslToHex(base, 0.2, 0.15),
      ];
    default:
      return [
        hslToHex(base, 0.72, 0.5),
        hslToHex(base + 25, 0.65, 0.6),
        hslToHex(base - 25, 0.6, 0.45),
        hslToHex(base, 0.15, 0.96),
        hslToHex(base, 0.25, 0.14),
      ];
  }
}
