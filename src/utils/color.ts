import { colord } from "colord";

const rgbaCache = new Map<string, string>();

/**
 * Luminance formula kept from the original implementation: mid-tones must
 * keep choosing the same black/white text as before, which a WCAG luminance
 * (colord's isDark) would not always agree on.
 */
function perceptualLuminance(hex: string): number {
  const { r, g, b } = colord(hex).toRgb();
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export function toRgba(hex: string, opacity: number): string {
  const key = `${hex}|${opacity}`;
  const cached = rgbaCache.get(key);
  if (cached) return cached;
  const value = colord(hex).alpha(opacity).toRgbString();
  rgbaCache.set(key, value);
  return value;
}

export function toHex(color: string): string {
  const parsed = colord(color);
  return parsed.isValid() ? parsed.toHex() : color;
}

export function contrastText(color: string): "#000000" | "#ffffff" {
  return perceptualLuminance(color) >= 128 ? "#000000" : "#ffffff";
}

export function mixToward(
  color: string,
  target: "#ffffff" | "#000000",
  amount = 0.5,
): string {
  const { r, g, b } = colord(color).toRgb();
  const to = target === "#ffffff" ? 255 : 0;
  const blend = (c: number) => Math.round(c + (to - c) * amount);
  return colord({ r: blend(r), g: blend(g), b: blend(b) }).toHex();
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = colord(hex).toRgb();
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  );
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA contrast for badge text, enforced for every pair (including the
 *  brand teal default, which only reaches 2.4:1 with white). */
export const MIN_BADGE_CONTRAST = 4.5;

/** Nudges `color` toward black/white until it reaches `min` contrast on
 *  `background`, keeping as much of the original hue as possible. */
export function ensureContrast(
  color: string,
  background: string,
  min: number = MIN_BADGE_CONTRAST,
): string {
  if (!colord(color).isValid() || !colord(background).isValid()) return color;
  if (contrastRatio(color, background) >= min) return color;

  const target = contrastText(background);
  for (let step = 1; step <= 10; step++) {
    const candidate = mixToward(color, target, step / 10);
    if (contrastRatio(candidate, background) >= min) return candidate;
  }
  return target;
}

export { perceptualLuminance };
