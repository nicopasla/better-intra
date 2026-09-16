import type { VisualUrls } from "./visuals.ts";

/**
 * Visual settings come from other users through the cloud API and are
 * interpolated into <style> text and class names. Anything that is not a
 * plain http(s) URL, a plain colour or a known keyword must be dropped,
 * otherwise a crafted banner URL like `x") } * { display:none } .a { url("`
 * injects arbitrary CSS into the whole Intra page for every viewer.
 */

const BANNER_MODES = new Set(["fill", "fit", "stretch", "center", "tile"]);
const DECORATIONS = new Set(["none", "solid"]);
const AVATAR_BG_KEYWORDS = new Set(["transparent"]);

/**
 * Absolute http(s) URL, normalised by the URL parser (which percent-encodes
 * quotes and whitespace) so that it can never end a CSS url("...") string.
 * Parentheses are left alone: they are harmless inside a quoted url() and
 * common in real image URLs (e.g. Wikimedia "..._(foo).png").
 */
export function sanitizeCssUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    const href = parsed.href;
    if (/["\\\s]/.test(href)) return "";
    return href;
  } catch {
    return "";
  }
}

/** #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba()/hsl()/hsla() with numeric args, or a keyword. */
export function sanitizeCssColor(value: unknown, keywords?: Set<string>): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw;
  if (/^(?:rgba?|hsla?)\(\s*[\d.%\s,/-]+\)$/i.test(raw)) return raw;
  if (keywords?.has(raw.toLowerCase())) return raw.toLowerCase();
  return "";
}

/** Strict 6-digit hex, for values that are further processed (e.g. alpha appended). */
export function sanitizeHexColor(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : "";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeMode(value: unknown): string {
  return typeof value === "string" && BANNER_MODES.has(value) ? value : "fill";
}

export function sanitizeVisualUrls(urls: VisualUrls): VisualUrls {
  const theme =
    urls.theme && typeof urls.theme === "object"
      ? { profileColor: sanitizeHexColor(urls.theme.profileColor) || undefined }
      : null;

  const lt = urls.logtime && typeof urls.logtime === "object" ? urls.logtime : null;
  const logtime = lt
    ? {
        calendarColor: sanitizeHexColor(lt.calendarColor) || undefined,
        labelsColor: sanitizeHexColor(lt.labelsColor) || undefined,
        emoji: typeof lt.emoji === "string" ? lt.emoji.slice(0, 8) : undefined,
        emojiDivisor:
          lt.emojiDivisor !== undefined
            ? clampNumber(lt.emojiDivisor, 0.01, 1_000_000, 8.7)
            : undefined,
        emojiRate:
          lt.emojiRate !== undefined
            ? clampNumber(lt.emojiRate, 0, 1_000_000, 2)
            : undefined,
        rainbowPalette:
          typeof lt.rainbowPalette === "string"
            ? lt.rainbowPalette.slice(0, 64)
            : undefined,
      }
    : null;

  return {
    avatar: sanitizeCssUrl(urls.avatar),
    banner: sanitizeCssUrl(urls.banner),
    bannerMode: sanitizeMode(urls.bannerMode),
    bannerColor: sanitizeCssColor(urls.bannerColor),
    background: sanitizeCssUrl(urls.background),
    backgroundMode: sanitizeMode(urls.backgroundMode),
    backgroundColor: sanitizeCssColor(urls.backgroundColor),
    avatarBg: sanitizeCssColor(urls.avatarBg, AVATAR_BG_KEYWORDS) || "transparent",
    decoration:
      typeof urls.decoration === "string" && DECORATIONS.has(urls.decoration)
        ? urls.decoration
        : "none",
    avatarPosX: clampNumber(urls.avatarPosX, 0, 100, 50),
    avatarPosY: clampNumber(urls.avatarPosY, 0, 100, 50),
    avatarScale: clampNumber(urls.avatarScale, 10, 500, 100),
    badgeBg: sanitizeCssColor(urls.badgeBg),
    theme,
    logtime,
  };
}