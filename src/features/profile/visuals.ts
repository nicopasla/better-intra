import { getConfig, getConfigMany } from "../../config.ts";
import { contrastText, ensureContrast } from "../../utils/color.ts";
import { ensureDocumentStyle } from "../../utils/style.ts";
import { getLoginFromPage } from "../../utils/profile-login.ts";
import { applyProfileLook, clearProfileLook } from "./theme/theme-manager.ts";
import { sanitizeVisualUrls } from "./visuals-sanitize.ts";
import {
  AVATAR_SELECTOR,
  BANNER_SELECTOR,
  BACKGROUND_SELECTOR,
  NAME_BADGE_SELECTOR,
  TITLE_BADGE_SELECTOR,
} from "./selectors.ts";

export interface VisualUrls {
  avatar: string;
  banner: string;
  bannerMode: string;
  bannerColor?: string;
  background: string;
  backgroundMode: string;
  backgroundColor?: string;
  avatarBg?: string;
  avatarShape?: string;
  decoration?: string;
  avatarPosX?: number;
  avatarPosY?: number;
  avatarScale?: number;
  badgeBg?: string;
  nameAlign?: string;
  usernameBadge?: {
    bg?: string;
    text?: string;
    border?: string;
    borderWidth?: number;
    shape?: string;
    titleNewline?: boolean;
    animation?: string;
    padding?: number;
    align?: string;
  } | null;
  theme?: { profileColor?: string } | null;
  look?: { preset?: string; theme?: string } | null;
  logtime?: {
    calendarColor?: string;
    labelsColor?: string;
    emoji?: string;
    emojiDivisor?: string | number;
    emojiRate?: string | number;
    rainbowPalette?: string;
  } | null;
}

// The avatar is hidden only while this class is on <html>: once the watcher
// stops, a re-mounted avatar must show the Intra picture instead of nothing.
export const AVATAR_PENDING_CLASS = "ft-avatar-pending";

export const holdAvatar = (): void => {
  document.documentElement.classList.add(AVATAR_PENDING_CLASS);
};

export const releaseAvatar = (): void => {
  document.documentElement.classList.remove(AVATAR_PENDING_CLASS);
};

const AVATAR_PENDING_STYLE_ID = "ft-avatar-pending-style";

export const injectAvatarPendingRule = (): void => {
  ensureDocumentStyle(
    AVATAR_PENDING_STYLE_ID,
    `html.${AVATAR_PENDING_CLASS} ${AVATAR_SELECTOR} { opacity: 0 !important; }`,
  );
};

let isFetching = false;

/** Logins known to have no cloud visuals, with the time we learned it. */
const noVisualsCache = new Map<string, number>();
const NO_VISUALS_TTL_MS = 10 * 60 * 1000;

let historyListenerInstalled = false;

function addToHistory(url: string, history: string[]): string[] {
  if (!url) return history;
  const filtered = history.filter((h) => h !== url);
  return [url, ...filtered].slice(0, 10);
}

function installHistoryListener(): void {
  if (historyListenerInstalled) return;
  historyListenerInstalled = true;

  const URL_KEYS = [
    "PROFILE_IMAGE_URL",
    "PROFILE_BANNER_URL",
    "PROFILE_BACKGROUND_URL",
  ] as const;
  const HISTORY_KEYS = {
    PROFILE_IMAGE_URL: "PROFILE_IMAGE_HISTORY",
    PROFILE_BANNER_URL: "PROFILE_BANNER_HISTORY",
    PROFILE_BACKGROUND_URL: "PROFILE_BACKGROUND_HISTORY",
  } as const;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of URL_KEYS) {
      if (!(key in changes)) continue;
      const newUrl = changes[key].newValue as string | undefined;
      if (!newUrl) continue;
      const historyKey = HISTORY_KEYS[key];
      chrome.storage.local.get(historyKey).then(async (result) => {
        const history = (result[historyKey] as string[]) || [];
        const updated = addToHistory(newUrl, history);
        if (updated !== history) {
          await chrome.storage.local.set({ [historyKey]: updated });
        }
      });
    }
  });
}
let visualCache: VisualUrls | null = null;
let lastUser: string | null = null;
let showingOriginalAvatar = false;
let originalAvatarUrl: string | null = null;

/** The Intra (42 CDN) avatar, captured before any custom picture is applied. */
export const getOriginalAvatarUrl = (): string | null => originalAvatarUrl;

let lastAppliedUser: string | null = null;
let lastAppliedKey: string | null = null;

const getVisualKey = (urls: VisualUrls) =>
  JSON.stringify({
    avatar: urls.avatar || "",
    banner: urls.banner || "",
    bannerMode: urls.bannerMode || "",
    bannerColor: urls.bannerColor || "",
    background: urls.background || "",
    backgroundMode: urls.backgroundMode || "",
    backgroundColor: urls.backgroundColor || "",
    avatarBg: urls.avatarBg || "transparent",
    avatarShape: urls.avatarShape || "round",
    decoration: urls.decoration || "none",
    avatarPosX: urls.avatarPosX ?? 50,
    avatarPosY: urls.avatarPosY ?? 50,
    avatarScale: urls.avatarScale ?? 100,
    badgeBg: urls.badgeBg || "",
    nameAlign: urls.nameAlign || "left",
    usernameBadge: urls.usernameBadge || null,
    theme: urls.theme || null,
    look: urls.look || null,
    logtime: urls.logtime || null,
  });

const CACHE_PREFIX = "visuals_cache_";
const CACHE_MAINTAINED_KEY = "VISUALS_CACHE_MAINTAINED_AT";
const CACHE_MAX_ENTRIES = 100;
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const CACHE_MAINTAIN_INTERVAL_MS = 60 * 60 * 1000;
const pendingRevalidations = new Set<string>();

type CachedVisuals = { v: 1; ts: number; urls: VisualUrls };

const getCachedVisuals = async (login: string): Promise<VisualUrls | null> => {
  const key = `${CACHE_PREFIX}${login}`;
  const result = (await chrome.storage.local.get(key)) as Record<
    string,
    CachedVisuals | VisualUrls
  >;
  const stored = result[key];
  if (!stored) return null;
  if ("urls" in stored && stored.v === 1) return stored.urls;
  return stored as VisualUrls;
};

const setCachedVisuals = (login: string, urls: VisualUrls) => {
  chrome.storage.local.set({
    [`${CACHE_PREFIX}${login}`]: { v: 1, ts: Date.now(), urls },
  });
};

async function pruneVisualsCache(): Promise<void> {
  try {
    const meta = (await chrome.storage.local.get(CACHE_MAINTAINED_KEY))[
      CACHE_MAINTAINED_KEY
    ] as number | undefined;
    const now = Date.now();
    if (typeof meta === "number" && now - meta < CACHE_MAINTAIN_INTERVAL_MS) {
      return;
    }
    await chrome.storage.local.set({ [CACHE_MAINTAINED_KEY]: now });

    const storage = chrome.storage.local as unknown as {
      getKeys?: () => Promise<string[]>;
    };
    const keys = storage.getKeys
      ? await storage.getKeys()
      : Object.keys(await chrome.storage.local.get(null));
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length === 0) return;

    const all = (await chrome.storage.local.get(cacheKeys)) as Record<
      string,
      CachedVisuals | VisualUrls
    >;
    const entries = cacheKeys
      .map((key) => {
        const value = all[key];
        const ts =
          value && "ts" in value && typeof value.ts === "number" ? value.ts : 0;
        return { key, ts };
      })
      .sort((a, b) => b.ts - a.ts);

    const stale = entries
      .filter(
        (entry, index) =>
          index >= CACHE_MAX_ENTRIES ||
          (entry.ts > 0 && now - entry.ts > CACHE_TTL_MS),
      )
      .map((entry) => entry.key);
    if (stale.length > 0) await chrome.storage.local.remove(stale);
  } catch {
    /* cache maintenance is best-effort */
  }
}

const revalidateVisuals = async (login: string, cached: VisualUrls) => {
  if (pendingRevalidations.has(login)) return;
  pendingRevalidations.add(login);
  try {
    const { fetchUserVisuals } = await import("../account/account.ts");
    const fresh = await fetchUserVisuals(login);
    if (!fresh || login !== lastUser) return;
    const freshKey = getVisualKey(fresh);
    const cachedKey = getVisualKey(cached);
    if (freshKey === cachedKey) {
      setCachedVisuals(login, fresh);
      return;
    }
    visualCache = fresh;
    setCachedVisuals(login, fresh);
    if (
      lastAppliedUser === login &&
      lastAppliedKey === freshKey &&
      !needsReapply(fresh)
    )
      return;
    applyImgs(fresh);
    applyProfileLook(login, fresh.look ?? null);
    lastAppliedUser = login;
    lastAppliedKey = freshKey;
  } finally {
    pendingRevalidations.delete(login);
  }
};

const hasBackground = (el: HTMLElement | null, url?: string) => {
  if (!url) return true;
  if (!el) return false;
  const urlRe = /url\((["']?)(.*?)\1\)/;
  const inline = el.style.backgroundImage || "";
  const computed = window.getComputedStyle(el).backgroundImage || "";
  const inlineMatch = inline.match(urlRe);
  const computedMatch = computed.match(urlRe);
  return inlineMatch?.[2] === url || computedMatch?.[2] === url;
};

export const badgeColorCss = (badgeBg?: string): string => {
  if (!badgeBg) return "";
  return `background-color: ${badgeBg} !important; border-color: ${badgeBg} !important; color: ${contrastText(badgeBg)} !important;`;
};

const BADGE_RADIUS: Record<string, string> = {
  square: "0.25rem",
  rounded: "0.5rem",
  pill: "9999px",
};

const MARQUEE_ATTR = "data-ft-marquee-inner";

/** Gradient angle and tile size for each shimmer direction. `background-size`
 *  must exceed the badge on the sweep axis, otherwise the highlight never fully
 *  crosses it. */
const SHIMMER_STYLES: Record<string, { angle: string; size: string }> = {
  shimmer: { angle: "110deg", size: "250% 100%" },
  "shimmer-reverse": { angle: "110deg", size: "250% 100%" },
  "shimmer-down": { angle: "180deg", size: "100% 250%" },
  "shimmer-up": { angle: "180deg", size: "100% 250%" },
  "shimmer-diagonal": { angle: "135deg", size: "250% 250%" },
};

interface BadgeColors {
  radius: string;
  bg: string;
  text: string;
  border: string;
  pad: number;
}

const clampBadgeSize = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(8, Math.max(0, value))
    : fallback;

function badgeColors(badge: VisualUrls["usernameBadge"]): BadgeColors {
  const radius =
    BADGE_RADIUS[badge?.shape || "rounded"] || BADGE_RADIUS.rounded;
  const bg = badge?.bg || "#4352ff";
  const text = ensureContrast(badge?.text || "#ffffff", bg);
  return {
    radius,
    bg,
    text,
    border: badge?.border || bg,
    pad: clampBadgeSize(badge?.padding, 4),
  };
}

interface BadgeAnimationCss {
  element: string[];
  before: string[];
  after: string[];
}

function badgeAnimationCss(
  badge: VisualUrls["usernameBadge"],
  c: BadgeColors,
): BadgeAnimationCss {
  const element: string[] = [];
  const before: string[] = [];
  const after: string[] = [];

  const ringMask = [
    "padding: 2px",
    "-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    "-webkit-mask-composite: xor",
    "mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    "mask-composite: exclude",
    "pointer-events: none",
  ];

  const animation = badge?.animation ?? "none";

  switch (animation) {
    case "glow":
      element.push(
        `--ft-badge-glow: ${c.border}`,
        "animation: ft-badge-glow 2s ease-in-out infinite !important",
      );
      break;
    case "pulse":
      element.push(
        "transform-origin: center !important",
        "animation: ft-badge-pulse 1.6s ease-in-out infinite !important",
      );
      break;
    case "rainbow":
      element.push("animation: ft-badge-rainbow 4s linear infinite !important");
      break;
    case "shimmer":
    case "shimmer-reverse":
    case "shimmer-down":
    case "shimmer-up":
    case "shimmer-diagonal": {
      const shimmer = SHIMMER_STYLES[animation];
      element.push(
        `background-image: linear-gradient(${shimmer.angle}, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%) !important`,
        `background-size: ${shimmer.size} !important`,
        "background-repeat: no-repeat !important",
        `animation: ft-badge-${animation} 2.2s linear infinite !important`,
      );
      break;
    }
    case "float":
      element.push(
        "animation: ft-badge-float 3s ease-in-out infinite !important",
      );
      break;
    case "wobble":
      element.push(
        "transform-origin: center !important",
        "animation: ft-badge-wobble 2.4s ease-in-out infinite !important",
      );
      break;
    case "bounce":
      element.push(
        "animation: ft-badge-bounce 1.5s cubic-bezier(0.28, 0.84, 0.42, 1) infinite !important",
      );
      break;
    case "heartbeat":
      element.push(
        "transform-origin: center !important",
        `--ft-badge-heartbeat: ${c.border}`,
        "animation: ft-badge-heartbeat 1.4s ease-in-out infinite !important",
      );
      break;
    case "neon":
      element.push(
        `--ft-badge-neon-1: ${c.border}`,
        `--ft-badge-neon-2: ${c.text}`,
        "animation: ft-badge-neon 1.5s ease-in-out infinite alternate !important",
      );
      break;
    case "elastic":
      element.push(
        "transform-origin: center !important",
        "animation: ft-badge-elastic 1.6s ease-in-out infinite !important",
      );
      break;
    case "softblur":
      element.push(
        "transform-origin: center !important",
        `--ft-badge-softblur-1: ${c.border}`,
        `--ft-badge-softblur-2: ${c.text}`,
        "text-shadow: 0 0 0 currentColor, " +
          "0 0 18px color-mix(in srgb, var(--ft-badge-softblur-1) 45%, transparent), " +
          "0 0 34px color-mix(in srgb, var(--ft-badge-softblur-2) 35%, transparent) !important",
        "animation: ft-badge-softblur 3.2s ease-in-out infinite !important",
      );
      break;
    case "echo":
      // Ghost copies are painted from attr(data-text), which the apply path
      // mirrors onto the badge (applyBadgeEchoText).
      element.push(
        "position: relative !important",
        `--ft-badge-echo-1: ${c.border}`,
        `--ft-badge-echo-2: ${c.text}`,
      );
      before.push(
        "content: attr(data-text)",
        "position: absolute",
        "inset: 0",
        "color: var(--ft-badge-echo-1)",
        "pointer-events: none",
        "animation: ft-badge-echo 2s ease-out infinite",
      );
      after.push(
        "content: attr(data-text)",
        "position: absolute",
        "inset: 0",
        "color: var(--ft-badge-echo-2)",
        "pointer-events: none",
        "animation: ft-badge-echo 2s ease-out 1s infinite",
      );
      break;
    case "shake":
      element.push(
        "animation: ft-badge-shake 2.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite !important",
      );
      break;
    case "flash":
      element.push(
        "animation: ft-badge-flash 1.8s ease-in-out infinite !important",
      );
      break;
    case "rotate":
      element.push(
        "transform-origin: center !important",
        "animation: ft-badge-rotate 3s linear 1 !important",
      );
      break;
    case "gradient":
      element.push(
        `background-image: linear-gradient(90deg, ${c.bg}, ${c.border}, ${c.bg}) !important`,
        "background-size: 300% 100% !important",
        "animation: ft-badge-gradient 5s linear infinite !important",
      );
      break;
    case "ping":
      element.push("position: relative !important");
      after.push(
        'content: ""',
        "position: absolute",
        "inset: 0",
        "border-radius: inherit",
        `border: 1px solid ${c.border}`,
        "pointer-events: none",
        "animation: ft-badge-ping 1.8s ease-out infinite",
      );
      break;
    case "ants":
      element.push("position: relative !important");
      after.push(
        'content: ""',
        "position: absolute",
        "inset: 0",
        "border-radius: inherit",
        `background: repeating-linear-gradient(90deg, ${c.border} 0 6px, transparent 6px 12px)`,
        ...ringMask,
        "animation: ft-badge-ants 0.7s linear infinite",
      );
      break;
    case "conic":
      element.push("position: relative !important");
      after.push(
        'content: ""',
        "position: absolute",
        "inset: -2px",
        "border-radius: inherit",
        `background: conic-gradient(from var(--ft-badge-angle, 0deg), ${c.border}, transparent 25%, ${c.border} 50%, transparent 75%, ${c.border})`,
        ...ringMask,
        "animation: ft-badge-conic 3s linear infinite",
      );
      break;
    case "typewriter":
      element.push(
        "mask-image: linear-gradient(90deg, #000 var(--ft-typing, 0%), transparent var(--ft-typing, 0%))",
        "mask-repeat: no-repeat",
        "-webkit-mask-image: linear-gradient(90deg, #000 var(--ft-typing, 0%), transparent var(--ft-typing, 0%))",
        "-webkit-mask-repeat: no-repeat",
        "animation: ft-badge-typing 4s steps(30, end) infinite !important",
      );
      break;
    case "marquee":
      element.push("overflow: hidden !important");
      break;
  }

  // Promote animated layers so the compositor handles them off the main
  // thread (transform/opacity/filter are compositable). Transform animations
  // also need to escape the header's clipping/stacking so the badge is not
  // hidden behind neighbouring elements while it moves.
  if (
    [
      "pulse",
      "float",
      "wobble",
      "bounce",
      "heartbeat",
      "shake",
      "rotate",
      "elastic",
    ].includes(badge?.animation || "")
  ) {
    element.push(
      "will-change: transform",
      "position: relative !important",
      "z-index: 1 !important",
    );
  } else if (badge?.animation === "flash") {
    element.push("will-change: opacity");
  } else if (badge?.animation === "rainbow") {
    element.push("will-change: filter");
  } else if (badge?.animation === "softblur") {
    element.push("will-change: filter, opacity");
  }

  return { element, before, after };
}

export const usernameBadgeCss = (
  badge?: VisualUrls["usernameBadge"],
): string => {
  const c = badgeColors(badge);
  const b = badge ?? {};
  const newline = b.titleNewline !== false;
  const align = b.align === "center" || b.align === "right" ? b.align : "left";
  const lines = [
    "display: flex !important",
    "flex-shrink: 0 !important",
    `margin-left: ${align === "left" ? "0" : "auto"} !important`,
    `margin-right: ${align === "right" ? "0.5rem" : "auto"} !important`,
    newline
      ? "flex-direction: column !important"
      : "align-items: center !important",
    newline ? "align-items: center !important" : "",
    "width: fit-content !important",
    "max-width: 100% !important",
    `padding: ${c.pad}px ${c.pad * 2}px !important`,
    "line-height: 1.2 !important",
    `border-radius: ${c.radius} !important`,
    `background-color: ${c.bg} !important`,
    `color: ${c.text} !important`,
    `border: ${clampBadgeSize(b.borderWidth, 1)}px solid ${c.border} !important`,
    ...badgeAnimationCss(b, c).element,
  ];
  return lines.filter(Boolean).join("; ") + ";";
};

export const usernameBadgeAfterCss = (
  badge?: VisualUrls["usernameBadge"],
): string => {
  const after = badgeAnimationCss(badge, badgeColors(badge)).after;
  return after.length ? after.join("; ") + ";" : "";
};

export const usernameBadgeBeforeCss = (
  badge?: VisualUrls["usernameBadge"],
): string => {
  const before = badgeAnimationCss(badge, badgeColors(badge)).before;
  return before.length ? before.join("; ") + ";" : "";
};

/** Full stylesheet for a badge under `selector` (element + optional pseudos). */
export const usernameBadgeStylesheet = (
  selector: string,
  badge?: VisualUrls["usernameBadge"],
): string => {
  const element = usernameBadgeCss(badge);
  const after = usernameBadgeAfterCss(badge);
  const before = usernameBadgeBeforeCss(badge);
  const colors = badgeColors(badge);
  let css = `${selector} { ${element} }\n`;
  if (after) css += `${selector}::after { ${after} }\n`;
  if (before) css += `${selector}::before { ${before} }\n`;

  // The custom title is a BI-injected span, so it inherits the badge colour by
  // default. Something in the page's own stylesheet wins over inheritance there,
  // which left the title a different colour from the username above it, so set
  // it explicitly to the badge text colour. Descendant, to also cover the
  // marquee wrapper.
  css += `${selector} [${TITLE_LINE_ATTR}] { color: ${colors.text} !important; }\n`;

  // The badge caps its width, so a long username/title must wrap instead of
  // squeezing the dropdown chevron out of the trigger.
  css += `${selector} [role="combobox"] > svg { flex-shrink: 0 !important; }\n`;

  // Marquee needs a real wrapper to translate (text-indent breaks on the
  // two-line column layout); the preview always ships the wrapper with
  // display:contents so layout is unchanged unless marquee is active.
  css += `${selector} > [${MARQUEE_ATTR}] { display: contents; }\n`;
  if (badge?.animation === "marquee") {
    css +=
      `${selector} > [${MARQUEE_ATTR}] { display: inline-flex; white-space: nowrap; will-change: transform; ` +
      (badge?.titleNewline !== false
        ? "flex-direction: column; align-items: center; "
        : "align-items: center; ") +
      "animation: ft-badge-marquee 6s linear infinite; }\n";
  }

  css += `@media (prefers-reduced-motion: reduce) {\n${selector}, ${selector}::before, ${selector}::after, ${selector} > [${MARQUEE_ATTR}] { animation: none !important; }\n}`;

  // While the username/title dropdown is open, freeze the badge (and anything
  // anchored to it) instead of carrying the open menu along with the motion.
  const openSelectors = selector
    .split(",")
    .map((s) => `${s.trim()}:has([role="combobox"][aria-expanded="true"])`);
  const openTargets = openSelectors
    .flatMap((s) => [
      s,
      `${s}::before`,
      `${s}::after`,
      `${s} > [${MARQUEE_ATTR}]`,
    ])
    .join(", ");
  css += `${openTargets} { animation-play-state: paused !important; }\n`;

  // Hovering stops the badge so its text can be selected: transform, filter and
  // opacity animations otherwise keep the glyphs moving under the cursor and
  // leave them squashed or hazy. Resetting those three snaps the badge upright
  // and crisp for as long as the pointer is on it. Touch devices, where hover
  // is sticky or absent, are left alone.
  css += `@media (hover: hover) {\n${selector}:hover, ${selector}:hover::before, ${selector}:hover::after, ${selector}:hover > [${MARQUEE_ATTR}] { animation-play-state: paused !important; }\n${selector}:hover { transform: none !important; filter: none !important; opacity: 1 !important; }\n}`;
  return css;
};

export const BADGE_PROPERTIES = `
@property --ft-badge-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
@property --ft-typing { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
`;

export const BADGE_KEYFRAMES = `
@keyframes ft-badge-glow {
  0%, 100% { box-shadow: 0 0 3px 0 var(--ft-badge-glow, #4352ff); }
  50% { box-shadow: 0 0 16px 4px var(--ft-badge-glow, #4352ff); }
}
@keyframes ft-badge-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.07); }
}
@keyframes ft-badge-rainbow {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}
@keyframes ft-badge-shimmer {
  0% { background-position: -150% 0; }
  100% { background-position: 250% 0; }
}
@keyframes ft-badge-shimmer-reverse {
  0% { background-position: 250% 0; }
  100% { background-position: -150% 0; }
}
@keyframes ft-badge-shimmer-down {
  0% { background-position: 0 250%; }
  100% { background-position: 0 -150%; }
}
@keyframes ft-badge-shimmer-up {
  0% { background-position: 0 -150%; }
  100% { background-position: 0 250%; }
}
@keyframes ft-badge-shimmer-diagonal {
  0% { background-position: 250% 250%; }
  100% { background-position: -150% -150%; }
}
@keyframes ft-badge-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes ft-badge-wobble {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
@keyframes ft-badge-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes ft-badge-heartbeat {
  0%, 100% { transform: scale(1); text-shadow: 0 0 0 transparent; }
  14% {
    transform: scale(1.14);
    text-shadow: 0 0 18px color-mix(in srgb, var(--ft-badge-heartbeat, currentColor) 65%, transparent);
  }
  28% { transform: scale(1); }
  42% {
    transform: scale(1.18);
    text-shadow: 0 0 26px color-mix(in srgb, var(--ft-badge-heartbeat, currentColor) 80%, transparent);
  }
  70% { transform: scale(1); text-shadow: 0 0 0 transparent; }
}
@keyframes ft-badge-neon {
  0% {
    text-shadow:
      0 0 5px var(--ft-badge-neon-1, currentColor),
      0 0 10px var(--ft-badge-neon-1, currentColor),
      0 0 20px var(--ft-badge-neon-1, currentColor),
      0 0 40px var(--ft-badge-neon-1, currentColor),
      0 0 80px var(--ft-badge-neon-1, currentColor);
  }
  100% {
    text-shadow:
      0 0 10px var(--ft-badge-neon-2, currentColor),
      0 0 20px var(--ft-badge-neon-2, currentColor),
      0 0 40px var(--ft-badge-neon-2, currentColor),
      0 0 80px var(--ft-badge-neon-2, currentColor),
      0 0 160px var(--ft-badge-neon-2, currentColor);
  }
}
@keyframes ft-badge-elastic {
  0%, 100% { transform: scale(1, 1); }
  28% { transform: scale(1.28, 0.72); }
  44% { transform: scale(0.78, 1.24); }
  60% { transform: scale(1.12, 0.9); }
  74% { transform: scale(0.96, 1.05); }
  86% { transform: scale(1.02, 0.98); }
}
@keyframes ft-badge-softblur {
  0%, 100% { filter: blur(0); opacity: 1; transform: scale(1); }
  50% { filter: blur(2.4px); opacity: 0.72; transform: scale(1.045); }
}
@keyframes ft-badge-echo {
  0% { opacity: 0.8; transform: scale(1); filter: blur(0); }
  100% { opacity: 0; transform: scale(1.9); filter: blur(3px); }
}
@keyframes ft-badge-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}
@keyframes ft-badge-flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
@keyframes ft-badge-rotate {
  to { transform: rotate(360deg); }
}
@keyframes ft-badge-gradient {
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
@keyframes ft-badge-ping {
  0% { opacity: 0.75; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.7); }
}
@keyframes ft-badge-ants {
  0% { background-position: 0 0; }
  100% { background-position: 12px 0; }
}
@keyframes ft-badge-conic {
  to { --ft-badge-angle: 360deg; }
}
@keyframes ft-badge-typing {
  0% { --ft-typing: 0%; }
  60% { --ft-typing: 100%; }
  100% { --ft-typing: 100%; }
}
@keyframes ft-badge-marquee {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
`;

export function ensureBadgeKeyframes(): void {
  if (document.getElementById("ft-name-badge-keyframes")) return;
  const style = document.createElement("style");
  style.id = "ft-name-badge-keyframes";
  style.textContent = BADGE_PROPERTIES + BADGE_KEYFRAMES;
  document.head.appendChild(style);
}

const TITLE_LINE_ATTR = "data-ft-title-line";
const ECHO_TEXT_ATTR = "data-text";
const ORIG_TEXT_ATTR = "data-ft-orig-text";

const SEPARATORS = "\\s,;·•\\-–—:|/";

const trimSep = (value: string): string =>
  value
    .replace(new RegExp(`^[${SEPARATORS}]+`), "")
    .replace(new RegExp(`[${SEPARATORS}]+$`), "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Splits the username line into two rows (username / custom title) while
 * preserving the original text order. The page login identifies the username;
 * everything else is the title. Falls back to the first comma when the login is
 * unknown.
 */
function splitUsernameTitle(
  text: string,
): { first: string; second: string } | null {
  const login = getLoginFromPage();
  if (login) {
    const escaped = login.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\w])(${escaped})(?=$|[^\\w])`, "i");
    const m = re.exec(text);
    if (m) {
      const start = m.index + m[1].length;
      const username = text.slice(start, start + login.length);
      const before = trimSep(text.slice(0, start));
      const after = trimSep(text.slice(start + login.length));

      if (!before && !after) return null;
      // Keep the original order: whatever comes first stays on the first row.
      if (!before) return { first: username, second: after };
      return {
        first: before,
        second: after ? `${username} ${after}` : username,
      };
    }
  }

  const idx = text.indexOf(",");
  if (idx === -1) return null;
  const first = text.slice(0, idx).trim();
  const second = text.slice(idx + 1).trim();
  if (!first || !second) return null;
  return { first, second };
}

/**
 * The element whose text carries the username / title line. Intra's badge now
 * wraps a dropdown trigger, so the text lives in the trigger's label span:
 * replacing the badge's own children would delete the trigger and its chevron.
 * Older profiles render the text directly in the badge, so fall back to it.
 */
function badgeTextHost(el: HTMLElement): HTMLElement | null {
  const trigger = el.querySelector<HTMLElement>('[role="combobox"]');
  if (!trigger) return el;
  return trigger.querySelector<HTMLElement>("span");
}

/**
 * Puts the custom title on its own row inside the badge (username and title on
 * separate rows, in their original order). The original text is cached so it
 * can be restored when the option is off.
 */
export function applyUsernameTitleLine(newline: boolean): void {
  const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR);
  if (!el) return;
  const split = el.querySelector<HTMLElement>(`[${TITLE_LINE_ATTR}]`);

  if (!newline) {
    // The cached text sits on the text host: the label span on current Intra,
    // the badge itself on older markup. Restore it in place so the dropdown
    // trigger and its chevron survive.
    const hosts: HTMLElement[] = el.hasAttribute(ORIG_TEXT_ATTR) ? [el] : [];
    hosts.push(...el.querySelectorAll<HTMLElement>(`[${ORIG_TEXT_ATTR}]`));
    if (!hosts.length) return;
    for (const host of hosts) {
      const original = host.getAttribute(ORIG_TEXT_ATTR);
      host.replaceChildren(
        document.createTextNode(original ?? host.textContent ?? ""),
      );
      host.removeAttribute(ORIG_TEXT_ATTR);
    }
    return;
  }

  if (split) return;
  const host = badgeTextHost(el);
  if (!host) return;
  const text = host.textContent ?? "";
  const parts = splitUsernameTitle(text);
  if (!parts) return;

  host.setAttribute(ORIG_TEXT_ATTR, text);
  host.replaceChildren(document.createTextNode(parts.first));
  const span = document.createElement("span");
  span.setAttribute(TITLE_LINE_ATTR, "true");
  span.style.display = "block";
  span.textContent = parts.second;
  host.appendChild(span);
}

/**
 * Wraps the badge content in a translating inner span so a marquee scrolls the
 * whole content as one strip (works with either one or two lines). No-op when
 * disabled, and idempotent while the wrapper is already present.
 */
export function applyUsernameMarquee(enabled: boolean): void {
  const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR);
  if (!el) return;
  const wrap = el.querySelector<HTMLElement>(`[${MARQUEE_ATTR}]`);

  if (!enabled) {
    if (!wrap) return;
    while (wrap.firstChild) el.insertBefore(wrap.firstChild, wrap);
    wrap.remove();
    return;
  }
  if (wrap) return;

  const inner = document.createElement("span");
  inner.setAttribute(MARQUEE_ATTR, "true");
  while (el.firstChild) inner.appendChild(el.firstChild);
  el.appendChild(inner);
}

/**
 * The echo effect paints ghost copies from attr(data-text), which CSS cannot
 * derive from element text, so mirror the badge's first line onto the element
 * and drop the attribute for every other animation. Run after the title split
 * and the marquee wrapper, so the first line is final.
 */
export function applyBadgeEchoText(animation: string | undefined): void {
  const el = document.querySelector<HTMLElement>(NAME_BADGE_SELECTOR);
  if (!el) return;
  if (animation !== "echo") {
    el.removeAttribute(ECHO_TEXT_ATTR);
    return;
  }
  const host = badgeTextHost(el) ?? el;
  const first = host.firstChild;
  const text =
    first?.nodeType === Node.TEXT_NODE ? first.textContent : host.textContent;
  el.setAttribute(ECHO_TEXT_ATTR, (text ?? "").trim());
}

export const needsReapply = (urls: VisualUrls) => {
  const avatar = document.querySelector(AVATAR_SELECTOR) as HTMLElement | null;
  const banner = document.querySelector(BANNER_SELECTOR) as HTMLElement | null;
  const background = document.querySelector(
    BACKGROUND_SELECTOR,
  ) as HTMLElement | null;

  // While the profile watcher holds the avatar (holdAvatar), the page sheet
  // keeps it at opacity 0 until we have applied the visuals, and applyImgs()
  // is what reveals it. React handing us a freshly rendered element (no inline
  // opacity) therefore always needs a re-apply - this check is what makes the
  // cheaper checks below safe to trust.
  if (avatar && !showingOriginalAvatar && avatar.style.opacity !== "1")
    return true;
  if (
    urls?.avatar &&
    !showingOriginalAvatar &&
    !hasBackground(avatar, urls.avatar)
  )
    return true;
  if (urls.avatar && avatar) {
    const pos = avatar.style.getPropertyValue("background-position");
    const size = avatar.style.getPropertyValue("background-size");
    const expectedPos = `${urls.avatarPosX ?? 50}% ${urls.avatarPosY ?? 50}%`;
    const expectedSize = `${urls.avatarScale ?? 100}%`;
    if (pos !== expectedPos || size !== expectedSize) return true;
    const expectedSquare =
      urls.avatarShape === "square" && !showingOriginalAvatar;
    if (avatar.classList.contains("ft-avatar-square") !== expectedSquare) {
      return true;
    }
  }
  if (urls?.banner && !hasBackground(banner, urls.banner)) return true;
  if (urls?.bannerColor && banner) {
    const style = document.getElementById("ft-banner-style");
    const expectedColor = `background-color: ${urls.bannerColor} !important; background-image: none !important;`;
    if (
      !style ||
      style.textContent !== `${BANNER_SELECTOR} { ${expectedColor} }`
    )
      return true;
  }
  if (urls?.background && !hasBackground(background, urls.background))
    return true;
  if (urls?.backgroundColor && background) {
    const style = document.getElementById("ft-bg-style");
    const expectedColor = `background-color: ${urls.backgroundColor} !important; background-image: none !important;`;
    if (
      !style ||
      style.textContent !== `${BACKGROUND_SELECTOR} { ${expectedColor} }`
    )
      return true;
  }
  {
    const badgeCss = badgeColorCss(urls.badgeBg);
    const style = document.getElementById("ft-badge-color-style");
    if (
      (style?.textContent || "") !==
      (badgeCss ? `${TITLE_BADGE_SELECTOR} { ${badgeCss} }` : "")
    )
      return true;
  }
  {
    const expected = usernameBadgeStylesheet(
      NAME_BADGE_SELECTOR,
      urls.usernameBadge,
    );
    const style = document.getElementById("ft-name-badge-style");
    if ((style?.textContent || "") !== expected) return true;
  }
  return false;
};

export const injectCustomStyles = () => {
  injectAvatarPendingRule();
  ensureBadgeKeyframes();
  ensureDocumentStyle(
    "ft-profile-host-styles",
    `
    .bg-ft-gray b,
      .bg-ft-gray span {font-size: 1.2rem !important;font-weight: bold !important;font-family: var(--font-sans);}
      p.text-sm:nth-child(2) {font-size: 1.3rem !important;}
    #profile-modal-host { 
      position: fixed; inset: 0; z-index: 999999; 
      display: flex; align-items: flex-start; justify-content: center;
      pointer-events: auto; padding-top: 12vh;       
    }
    ${AVATAR_SELECTOR} {
      will-change: background-image, transform;
      transform: translate3d(0, 0, 0);
      backface-visibility: hidden;
    }
    ${AVATAR_SELECTOR}[data-modal-listener] {
      position: relative !important;
    }
    ${AVATAR_SELECTOR}[data-modal-listener]::after {
      content: "Edit";
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: rgba(0,0,0,0.45);
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      font-family: var(--font-sans, system-ui, sans-serif);
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    ${AVATAR_SELECTOR}.ft-avatar-square {
      border-radius: 0 !important;
    }
    ${AVATAR_SELECTOR}.ft-avatar-square[data-modal-listener]::after {
      border-radius: 0;
    }
    ${AVATAR_SELECTOR}[data-modal-listener]:hover::after {
      opacity: 1;
    }
    ${BANNER_SELECTOR},
    ${BACKGROUND_SELECTOR} {
      will-change: background-image, transform;
      transform: translate3d(0, 0, 0);
      backface-visibility: hidden;
    }
    @media (min-width: 1280px) {
      ${BACKGROUND_SELECTOR} {
        height: auto !important;
        min-height: 18rem !important;
      }
    }
    .bg-mode-fill { background-size: cover !important; background-repeat: no-repeat !important; background-position: center !important; }
    .bg-mode-fit { background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important; }
    .bg-mode-stretch { background-size: 100% 100% !important; background-repeat: no-repeat !important; background-position: center !important; }
    .bg-mode-center { background-size: auto !important; background-repeat: no-repeat !important; background-position: center !important; }
    .bg-mode-tile { background-size: auto !important; background-repeat: repeat !important; background-position: top left !important; }

    .banner-mode-fill { background-size: cover !important; background-repeat: no-repeat !important; background-position: center !important; }
    .banner-mode-fit { background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important; }
    .banner-mode-stretch { background-size: 100% 100% !important; background-repeat: no-repeat !important; background-position: center !important; }
    .banner-mode-center { background-size: auto !important; background-repeat: no-repeat !important; background-position: center !important; }
    .banner-mode-tile { background-size: auto !important; background-repeat: repeat !important; background-position: top left !important; }

    .ft-deco-solid {
      box-shadow: 0 0 0 3px var(--user-color, #00babc) !important;
    }

    html.dark .inline-flex.items-center.rounded.border.shadow-base {
      color: #fff !important;
    }

    html:not(.dark) .inline-flex.items-center.rounded.border.shadow-base {
      color: #fff !important;
    }
  `,
  );
};

const setStyleForSelector = (id: string, selector: string, cssText: string) => {
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = selector ? `${selector} { ${cssText} }` : "";
};

const setStylesheet = (id: string, cssText: string) => {
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = cssText;
};

const modeCss: Record<string, string> = {
  fill: "background-size: cover !important; background-repeat: no-repeat !important; background-position: center !important;",
  fit: "background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important;",
  stretch:
    "background-size: 100% 100% !important; background-repeat: no-repeat !important; background-position: center !important;",
  center:
    "background-size: auto !important; background-repeat: no-repeat !important; background-position: center !important;",
  tile: "background-size: auto !important; background-repeat: repeat !important; background-position: top left !important;",
};

export const applyImgs = (rawUrls: VisualUrls | null) => {
  if (!rawUrls) return;
  // Values may come from another user's cloud settings and end up in <style>
  // text and class names: never trust them as-is.
  const urls = sanitizeVisualUrls(rawUrls);

  const avatar = document.querySelector(AVATAR_SELECTOR) as HTMLElement | null;

  if (avatar && !originalAvatarUrl) {
    const inlineStyle = avatar.style.backgroundImage;
    if (
      inlineStyle &&
      inlineStyle !== "none" &&
      !(urls.avatar && inlineStyle.includes(urls.avatar))
    ) {
      const match = inlineStyle.match(/url\((['"]?)(.*?)\1\)/);
      if (match) originalAvatarUrl = match[2];
    }
    if (!originalAvatarUrl) {
      const computedBg = window.getComputedStyle(avatar).backgroundImage;
      if (
        computedBg &&
        computedBg !== "none" &&
        !(urls.avatar && computedBg.includes(urls.avatar))
      ) {
        const match = computedBg.match(/url\((['"]?)(.*?)\1\)/);
        if (match) originalAvatarUrl = match[2];
      }
    }
  }

  if (avatar && urls.avatar && !showingOriginalAvatar) {
    avatar.style.setProperty(
      "background-image",
      `url("${urls.avatar}")`,
      "important",
    );
    avatar.style.setProperty(
      "background-color",
      urls.avatarBg || "transparent",
      "important",
    );
    avatar.style.setProperty(
      "background-size",
      `${urls.avatarScale ?? 100}%`,
      "important",
    );
    avatar.style.setProperty(
      "background-position",
      `${urls.avatarPosX ?? 50}% ${urls.avatarPosY ?? 50}%`,
      "important",
    );
  }
  if (avatar && !showingOriginalAvatar) {
    avatar.style.setProperty("opacity", "1", "important");
  }

  if (avatar) {
    avatar.classList.remove("ft-deco-solid");
    const deco = urls.decoration;
    if (deco && deco !== "none") avatar.classList.add(`ft-deco-${deco}`);
    avatar.classList.toggle(
      "ft-avatar-square",
      urls.avatarShape === "square" &&
        Boolean(urls.avatar) &&
        !showingOriginalAvatar,
    );
  }

  if (urls.banner) {
    const bannerMode = urls.bannerMode || "fill";
    setStyleForSelector(
      "ft-banner-style",
      BANNER_SELECTOR,
      `background-image: url("${urls.banner}") !important; ${modeCss[bannerMode] || modeCss.fill}`,
    );
  } else if (urls.bannerColor) {
    setStyleForSelector(
      "ft-banner-style",
      BANNER_SELECTOR,
      `background-color: ${urls.bannerColor} !important; background-image: none !important;`,
    );
  } else {
    setStyleForSelector("ft-banner-style", BANNER_SELECTOR, "");
  }

  if (urls.background) {
    const bgMode = urls.backgroundMode || "fill";
    setStyleForSelector(
      "ft-bg-style",
      BACKGROUND_SELECTOR,
      `background-image: url("${urls.background}") !important; ${modeCss[bgMode] || modeCss.fill}`,
    );
  } else if (urls.backgroundColor) {
    setStyleForSelector(
      "ft-bg-style",
      BACKGROUND_SELECTOR,
      `background-color: ${urls.backgroundColor} !important; background-image: none !important;`,
    );
  } else {
    setStyleForSelector("ft-bg-style", BACKGROUND_SELECTOR, "");
  }

  if (urls.theme) {
    const theme = urls.theme;
    void import("./profile-card.ts").then((m) =>
      m.applyThemeToProfileCard(theme),
    );
  }

  setStyleForSelector(
    "ft-badge-color-style",
    TITLE_BADGE_SELECTOR,
    badgeColorCss(urls.badgeBg),
  );

  // Name alignment is independent from the username badge's own alignment.
  const nameAlign =
    urls.nameAlign === "center" || urls.nameAlign === "right"
      ? urls.nameAlign
      : "left";
  document.documentElement.style.setProperty("--ft-name-text-align", nameAlign);
  document.documentElement.style.setProperty(
    "--ft-name-pad-right",
    nameAlign === "right" ? "0.5rem" : "0px",
  );

  const usernameBadge = urls.usernameBadge ?? {};
  setStylesheet(
    "ft-name-badge-style",
    usernameBadgeStylesheet(NAME_BADGE_SELECTOR, usernameBadge),
  );
  applyUsernameTitleLine(usernameBadge.titleNewline !== false);
  applyUsernameMarquee(usernameBadge.animation === "marquee");
  applyBadgeEchoText(usernameBadge.animation);

  if (urls.logtime) {
    const logtime = urls.logtime;
    // Respect the user's feature toggle: viewing a profile that publishes
    // logtime settings must not render the widget for someone who disabled it.
    getConfig("ACTIVE_SCRIPTS").then((scripts) => {
      if (!Array.isArray(scripts) || !scripts.includes("logtime")) return;
      void import("../logtime/logtime.ts").then(async (m) => {
        await m.initLogtime();
        m.applyPublicLogtimeSettings(logtime);
      });
    });
  }
};

const attachToggleListener = (avatarEl: HTMLElement) => {
  if (avatarEl.dataset.toggleListener) return;
  avatarEl.dataset.toggleListener = "true";
  avatarEl.style.cursor = "pointer";
  avatarEl.title = "Click to view original avatar";
  avatarEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const currentAvatar = document.querySelector(
      AVATAR_SELECTOR,
    ) as HTMLElement;
    if (!currentAvatar) return;
    if (showingOriginalAvatar) {
      showingOriginalAvatar = false;
      if (visualCache?.avatar) {
        currentAvatar.style.setProperty(
          "background-image",
          `url("${visualCache.avatar}")`,
          "important",
        );
        currentAvatar.style.setProperty(
          "background-color",
          visualCache.avatarBg || "transparent",
          "important",
        );
        currentAvatar.style.setProperty(
          "background-size",
          `${visualCache.avatarScale ?? 100}%`,
          "important",
        );
        currentAvatar.style.setProperty(
          "background-position",
          `${visualCache.avatarPosX ?? 50}% ${visualCache.avatarPosY ?? 50}%`,
          "important",
        );
        currentAvatar.classList.remove("ft-deco-solid");
        const d = visualCache.decoration;
        if (d && d !== "none") currentAvatar.classList.add(`ft-deco-${d}`);
        currentAvatar.classList.toggle(
          "ft-avatar-square",
          visualCache.avatarShape === "square",
        );
      }
    } else {
      showingOriginalAvatar = true;
      currentAvatar.classList.remove("ft-deco-solid");
      currentAvatar.classList.remove("ft-avatar-square");
      if (originalAvatarUrl) {
        currentAvatar.style.setProperty(
          "background-image",
          `url("${originalAvatarUrl}")`,
          "important",
        );
      }
      currentAvatar.style.setProperty("background-size", "cover", "important");
      currentAvatar.style.setProperty(
        "background-position",
        "center",
        "important",
      );
      currentAvatar.style.setProperty(
        "background-color",
        "transparent",
        "important",
      );
    }
  });
};

export const updateVisuals = async () => {
  await runUpdateVisuals();
  if (activeLogin) {
    applyProfileLook(activeLogin, visualCache?.look ?? null);
  } else {
    clearProfileLook();
  }
};

let activeLogin: string | null = null;

const runUpdateVisuals = async () => {
  const pathParts = location.pathname.split("/").filter((p) => p);
  injectCustomStyles();
  installHistoryListener();
  void pruneVisualsCache();

  let avatarEl = document.querySelector(AVATAR_SELECTOR) as HTMLElement;

  let myLogin = await getConfig("CLOUD_LOGIN");
  if (!myLogin) myLogin = "me";

  const targetLogin =
    pathParts[0] === "users" && pathParts[1] ? pathParts[1] : myLogin;

  activeLogin = targetLogin === myLogin ? null : targetLogin;

  if (targetLogin !== lastUser) {
    visualCache = null;
    originalAvatarUrl = null;
    showingOriginalAvatar = false;
    lastUser = targetLogin;
    isFetching = false;
    lastAppliedUser = null;
    lastAppliedKey = null;
    if (avatarEl) avatarEl.style.setProperty("opacity", "1", "important");
  }

  if (!avatarEl) {
    let att = 0;
    while (!avatarEl && att < 30) {
      await new Promise((r) => requestAnimationFrame(r));
      avatarEl = document.querySelector(AVATAR_SELECTOR) as HTMLElement;
      att++;
    }
    if (!avatarEl) return;
  }

  if (targetLogin === myLogin) {
    if (!avatarEl.dataset.modalListener) {
      avatarEl.dataset.modalListener = "true";
      avatarEl.style.cursor = "pointer";
      avatarEl.addEventListener("click", (e) => {
        e.stopPropagation();
        showingOriginalAvatar = false;
        void import("./profile.modal.ts").then((m) =>
          m.createSettingsModal((updatedVisuals) => {
            visualCache = updatedVisuals;
            setCachedVisuals(targetLogin, updatedVisuals);
            applyImgs(visualCache);
            lastAppliedUser = targetLogin;
            lastAppliedKey = getVisualKey(visualCache);
          }),
        );
      });
    }
  }

  if (visualCache) {
    if (document.getElementById("profile-modal-host")) return;
    const key = getVisualKey(visualCache);
    const reapply = needsReapply(visualCache);
    if (lastAppliedUser === targetLogin && lastAppliedKey === key && !reapply)
      return;

    applyImgs(visualCache);
    lastAppliedUser = targetLogin;
    lastAppliedKey = key;
    return;
  }

  if (!isFetching) {
    if (targetLogin === myLogin) {
      // one storage read instead of thirteen serial ones
      const c = await getConfigMany([
        "PROFILE_IMAGE_URL",
        "PROFILE_BANNER_URL",
        "PROFILE_BANNER_MODE",
        "PROFILE_BANNER_COLOR",
        "PROFILE_BACKGROUND_URL",
        "PROFILE_BACKGROUND_MODE",
        "PROFILE_BACKGROUND_COLOR",
        "PROFILE_AVATAR_BG",
        "PROFILE_AVATAR_SHAPE",
        "PROFILE_DECORATION",
        "PROFILE_AVATAR_POSITION_X",
        "PROFILE_AVATAR_POSITION_Y",
        "PROFILE_AVATAR_SCALE",
        "PROFILE_BADGE_BG",
        "PROFILE_NAME_ALIGN",
        "PROFILE_USERNAME_BADGE_ALIGN",
        "PROFILE_USERNAME_BADGE_BG",
        "PROFILE_USERNAME_BADGE_TEXT",
        "PROFILE_USERNAME_BADGE_BORDER",
        "PROFILE_USERNAME_BADGE_BORDER_WIDTH",
        "PROFILE_USERNAME_BADGE_SHAPE",
        "PROFILE_USERNAME_BADGE_TITLE_NEWLINE",
        "PROFILE_USERNAME_BADGE_ANIMATION",
        "PROFILE_USERNAME_BADGE_PADDING",
      ] as const);
      visualCache = {
        avatar: c.PROFILE_IMAGE_URL,
        banner: c.PROFILE_BANNER_URL,
        bannerMode: c.PROFILE_BANNER_MODE || "fill",
        bannerColor: c.PROFILE_BANNER_COLOR,
        background: c.PROFILE_BACKGROUND_URL,
        backgroundMode: c.PROFILE_BACKGROUND_MODE || "fill",
        backgroundColor: c.PROFILE_BACKGROUND_COLOR,
        avatarBg: c.PROFILE_AVATAR_BG,
        avatarShape: c.PROFILE_AVATAR_SHAPE,
        decoration: c.PROFILE_DECORATION,
        avatarPosX: c.PROFILE_AVATAR_POSITION_X,
        avatarPosY: c.PROFILE_AVATAR_POSITION_Y,
        avatarScale: c.PROFILE_AVATAR_SCALE,
        badgeBg: c.PROFILE_BADGE_BG,
        nameAlign: c.PROFILE_NAME_ALIGN,
        usernameBadge: {
          bg: c.PROFILE_USERNAME_BADGE_BG,
          text: c.PROFILE_USERNAME_BADGE_TEXT,
          border: c.PROFILE_USERNAME_BADGE_BORDER,
          borderWidth: c.PROFILE_USERNAME_BADGE_BORDER_WIDTH,
          shape: c.PROFILE_USERNAME_BADGE_SHAPE,
          titleNewline: c.PROFILE_USERNAME_BADGE_TITLE_NEWLINE,
          animation: c.PROFILE_USERNAME_BADGE_ANIMATION,
          padding: c.PROFILE_USERNAME_BADGE_PADDING,
          align: c.PROFILE_USERNAME_BADGE_ALIGN,
        },
      };
      // sanitise at ingestion so that needsReapply()/getVisualKey() compare
      // exactly what applyImgs() writes (otherwise a normalised URL would
      // look "not applied" and trigger a re-apply on every mutation pass)
      visualCache = sanitizeVisualUrls(visualCache);

      if (
        !visualCache.avatar &&
        !visualCache.banner &&
        !visualCache.bannerColor &&
        !visualCache.background &&
        !visualCache.backgroundColor &&
        !visualCache.badgeBg
      ) {
        avatarEl.style.setProperty("opacity", "1", "important");
        if (!document.getElementById("profile-modal-host")) {
          // No other visuals, but the username badge is always on.
          applyImgs(visualCache);
          lastAppliedUser = targetLogin;
          lastAppliedKey = getVisualKey(visualCache);
        }
      } else if (!document.getElementById("profile-modal-host")) {
        applyImgs(visualCache);
        lastAppliedUser = targetLogin;
        lastAppliedKey = getVisualKey(visualCache);
      }
    } else {
      const cached = await getCachedVisuals(targetLogin);
      if (
        cached &&
        (cached.avatar ||
          cached.banner ||
          cached.bannerColor ||
          cached.background ||
          cached.backgroundColor ||
          cached.badgeBg ||
          cached.usernameBadge ||
          cached.theme ||
          cached.logtime)
      ) {
        visualCache = sanitizeVisualUrls(cached);
        applyImgs(visualCache);
        lastAppliedUser = targetLogin;
        lastAppliedKey = getVisualKey(visualCache);
        if (visualCache.avatar) attachToggleListener(avatarEl);
        revalidateVisuals(targetLogin, cached);
      } else {
        // Show the default (neutral) username badge even for profiles with no
        // cloud visuals, so everyone gets one.
        const showDefaultBadge = () => {
          const urls: VisualUrls = {
            avatar: "",
            banner: "",
            bannerMode: "fill",
            background: "",
            backgroundMode: "fill",
          };
          applyImgs(urls);
          lastAppliedUser = targetLogin;
          lastAppliedKey = getVisualKey(urls);
        };
        // Negative cache: a user without cloud visuals used to be re-fetched
        // on every mutation pass of the profile page.
        const knownEmptyAt = noVisualsCache.get(targetLogin);
        if (knownEmptyAt && Date.now() - knownEmptyAt < NO_VISUALS_TTL_MS) {
          showDefaultBadge();
          return;
        }
        isFetching = true;
        const fetchForLogin = targetLogin;
        try {
          const { fetchUserVisuals } = await import("../account/account.ts");
          const cloudUrls = await fetchUserVisuals(targetLogin);

          if (fetchForLogin !== lastUser) return;

          if (
            cloudUrls &&
            (cloudUrls.avatar ||
              cloudUrls.banner ||
              cloudUrls.bannerColor ||
              cloudUrls.background ||
              cloudUrls.backgroundColor ||
              cloudUrls.badgeBg ||
              cloudUrls.usernameBadge ||
              cloudUrls.theme ||
              cloudUrls.logtime)
          ) {
            visualCache = cloudUrls;
            setCachedVisuals(targetLogin, cloudUrls);
            applyImgs(visualCache);
            lastAppliedUser = targetLogin;
            lastAppliedKey = getVisualKey(visualCache);
            if (cloudUrls.avatar) attachToggleListener(avatarEl);
          } else {
            if (cloudUrls) noVisualsCache.set(targetLogin, Date.now());
            showDefaultBadge();
          }
        } finally {
          isFetching = false;
        }
      }
    }
  }
};

const NAV_AVATAR_SELECTOR =
  'img.aspect-square.h-full.w-full[src*="cdn.intra.42.fr"]';
let _navAvatarDone = false;

export async function updateNavAvatar(): Promise<void> {
  if (_navAvatarDone) return;
  const customUrl = await getConfig("PROFILE_IMAGE_URL");

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 20; i++) {
    const img = document.querySelector<HTMLImageElement>(NAV_AVATAR_SELECTOR);
    if (img && !img.dataset.ftNavAvatar) {
      img.style.objectFit = "cover";
      if (customUrl) {
        img.src = customUrl;
      }
      img.dataset.ftNavAvatar = "1";
      _navAvatarDone = true;
      return;
    }
    await wait(250);
  }
}
