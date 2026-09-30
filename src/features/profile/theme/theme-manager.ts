import { getConfig } from "../../../config.ts";
import {
  setCustomDaisyTheme,
  setCustomThemesEnabled,
} from "../../../utils/theme-styles.ts";
import {
  buildDaisyThemeCss,
  buildIntraVars,
  hexToTriplet,
  modeVarsFromResolved,
  resolvePalette,
} from "./custom-theme.ts";
import themev3 from "./theme-dark-v3.css?inline";
import themev2 from "./theme-dark-v2.css?inline";
import themeLightV3 from "./theme-light-default-v3.css?inline";
import themeLightV3Overrides from "./theme-light-v3.css?inline";
import themesJson from "./themes.json";

type ThemeModeVars = {
  background: string;
  card: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  popover: string;
  popoverForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
};

type ThemePreset = {
  primary: string;
  primaryForeground: string;
  ring: string;
  dark?: ThemeModeVars;
  light?: ThemeModeVars;
};

export const THEMES: Record<string, ThemePreset> = { ...themesJson };

function toKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export async function applyThemePreset() {
  const [presetKey, overrides] = await Promise.all([
    getConfig("PROFILE_THEME_PRESET"),
    getConfig("PROFILE_THEME_OVERRIDES"),
  ]);
  const isDark = document.documentElement.classList.contains("dark");

  let styleEl = document.getElementById(
    "better-intra-theme-preset",
  ) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "better-intra-theme-preset";
    (document.head || document.documentElement).appendChild(styleEl);
  }

  const isCustom = presetKey === "custom";
  const isBuiltin = presetKey === "dark" || presetKey === "light";
  const namedPreset = !isCustom && !isBuiltin ? THEMES[presetKey] : undefined;
  const palette = overrides?.[presetKey]?.[isDark ? "dark" : "light"] ?? {};
  const hasOverrides = Object.keys(palette).length > 0;

  if (!isCustom && !namedPreset && !(isBuiltin && hasOverrides)) {
    styleEl.textContent = "";
    setCustomThemesEnabled(false);
    setCustomDaisyTheme(null);
    const original = themesJson[presetKey as keyof typeof themesJson] as
      | ThemePreset
      | undefined;
    if (original) THEMES[presetKey] = original;
    return;
  }

  setCustomThemesEnabled(true);

  const baseKey = isCustom || isBuiltin ? undefined : presetKey;
  const vars = buildIntraVars(palette, isDark, baseKey);
  const resolved = resolvePalette(palette, isDark, baseKey);
  const composed: ThemePreset = {
    primary: hexToTriplet(resolved.accent),
    primaryForeground: hexToTriplet(resolved.accentText),
    ring: hexToTriplet(resolved.accent),
    dark: modeVarsFromResolved(resolved),
    light: modeVarsFromResolved(resolved),
  };

  // Expose the composed colors to the ~7 places that read `THEMES[presetKey]`.
  // Replace the entry (never mutate the shared themes.json objects).
  const original = themesJson[
    presetKey as keyof typeof themesJson
  ] as ThemePreset;
  if (isCustom) {
    THEMES.custom = composed;
  } else if (original) {
    THEMES[presetKey] = hasOverrides
      ? {
          ...THEMES[presetKey],
          primary: composed.primary,
          primaryForeground: composed.primaryForeground,
          ring: composed.ring,
        }
      : original;
  }

  if (isCustom) {
    setCustomDaisyTheme(
      buildDaisyThemeCss(palette, isDark, undefined, "custom"),
    );
  } else if (hasOverrides) {
    setCustomDaisyTheme(
      buildDaisyThemeCss(palette, isDark, baseKey, presetKey),
    );
  } else {
    setCustomDaisyTheme(null);
  }

  const selector = isDark
    ? "html.dark, html.dark body, html.dark #root"
    : "html:not(.dark), html:not(.dark) body, html:not(.dark) #root";
  let content = `${selector} {\n    ${vars.join(";\n    ")};\n  }`;
  if (!isDark) content += `\n${themeLightV3Overrides}`;

  styleEl.textContent = content;
  (document.head || document.documentElement).appendChild(styleEl);
}

function applyTheme(theme: "dark" | "light") {
  const isDark = theme === "dark";
  const isV3 = window.location.hostname === "profile-v3.intra.42.fr";

  if (!isV3) {
    let styleEl = document.getElementById("better-intra-theme-stylesheet");
    let presetEl = document.getElementById("better-intra-theme-preset");
    if (presetEl) presetEl.remove();
    if (isDark) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "better-intra-theme-stylesheet";
        (document.head || document.documentElement).appendChild(styleEl);
      }
      styleEl.textContent = themev2;
      document.documentElement.classList.add("dark");
    } else {
      if (styleEl) styleEl.remove();
      document.documentElement.classList.remove("dark");
    }
    document.documentElement.removeAttribute("data-theme");
    if (document.body) document.body.classList.toggle("dark", isDark);
    sessionStorage.setItem("intra-theme", theme);
    return;
  }

  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.setAttribute("data-theme", theme);
  if (document.body) {
    document.body.classList.toggle("dark", isDark);
  }

  let styleEl = document.getElementById("better-intra-theme-stylesheet");

  if (isDark) {
    const css = isV3 ? themev3 : themev2;
    if (styleEl) {
      styleEl.textContent = css;
    } else {
      styleEl = document.createElement("style");
      styleEl.id = "better-intra-theme-stylesheet";
      styleEl.textContent = css;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  } else if (isV3) {
    const css = themeLightV3;
    if (styleEl) {
      styleEl.textContent = css;
    } else {
      styleEl = document.createElement("style");
      styleEl.id = "better-intra-theme-stylesheet";
      styleEl.textContent = css;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  } else if (styleEl) {
    styleEl.remove();
  }

  void applyThemePreset();

  reapplyProfileLook();

  sessionStorage.setItem("intra-theme", theme);
}

export async function getEffectiveTheme(): Promise<"dark" | "light"> {
  const savedTheme = await getConfig("BETTER_INTRA_THEME");

  if (savedTheme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return (savedTheme as "dark" | "light") || "light";
}

export async function getIsLight(): Promise<boolean> {
  return (await getEffectiveTheme()) === "light";
}

let themeManagerInitialized = false;

export async function initThemeManager() {
  const cachedTheme = sessionStorage.getItem("intra-theme") as
    | "dark"
    | "light"
    | null;
  if (cachedTheme) {
    applyTheme(cachedTheme);
  }
  const initialTheme = await getEffectiveTheme();
  if (initialTheme !== cachedTheme) {
    applyTheme(initialTheme);
  }

  if (themeManagerInitialized) return;
  themeManagerInitialized = true;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.BETTER_INTRA_THEME) {
      sessionStorage.removeItem("intra-theme");
      initThemeManager();
    }
    if (area === "local" && changes.PROFILE_THEME_PRESET) {
      void applyThemePreset();
    }
    if (area === "local" && changes.PROFILE_THEME_OVERRIDES) {
      void applyThemePreset();
    }
  });
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", async (e) => {
      const savedTheme = await getConfig("BETTER_INTRA_THEME");
      if (savedTheme === "system") {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
}

export interface ProfileLook {
  preset?: string;
  theme?: string;
}

let appliedLookLogin: string | null = null;
let appliedLookVars: string[] = [];
let pendingLook: { login: string; look: ProfileLook } | null = null;

function currentMode(): "dark" | "light" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** The owner's explicit mode must match the viewer's, otherwise their look is not applied. */
function modeMatches(ownerTheme: string | undefined): boolean {
  if (ownerTheme !== "dark" && ownerTheme !== "light") return true;
  return ownerTheme === currentMode();
}

function applyLookVars(vars: Record<string, string>): void {
  const root = document.documentElement;
  for (const key of appliedLookVars) root.style.removeProperty(key);
  appliedLookVars = [];
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
    appliedLookVars.push(key);
  }
}

function clearLookVars(): void {
  const root = document.documentElement;
  for (const key of appliedLookVars) root.style.removeProperty(key);
  appliedLookVars = [];
}

function isProfilePath(): boolean {
  if (location.hostname !== "profile-v3.intra.42.fr") return false;
  return (
    location.pathname === "/" || /^\/users\/[^/]+\/?$/.test(location.pathname)
  );
}

let lookRouteWatcher: number | null = null;
let lookRouteListenersBound = false;

function handleLookRouteChange(): void {
  if (document.hidden) return;
  if (isViewingProfileLook() && !isProfilePath()) clearProfileLook();
}

function stopLookRouteWatcher(): void {
  if (lookRouteWatcher !== null) {
    clearInterval(lookRouteWatcher);
    lookRouteWatcher = null;
  }
}

function startLookRouteWatcher(): void {
  if (!lookRouteListenersBound) {
    lookRouteListenersBound = true;
    window.addEventListener("popstate", handleLookRouteChange);
    window.addEventListener("hashchange", handleLookRouteChange);
  }
  if (lookRouteWatcher !== null) return;
  lookRouteWatcher = window.setInterval(handleLookRouteChange, 700);
}

export function applyProfileLook(
  login: string,
  look: ProfileLook | null | undefined,
): void {
  pendingLook = look?.preset ? { login, look } : null;

  if (!look?.preset || !modeMatches(look.theme)) {
    clearProfileLook();
    return;
  }

  const preset = THEMES[look.preset];
  if (!preset) {
    clearProfileLook();
    return;
  }

  const isDark = currentMode() === "dark";
  const vars: Record<string, string> = {
    "--primary": preset.primary,
    "--primary-foreground": preset.primaryForeground,
    "--ring": preset.ring,
  };
  const modeVars = isDark ? preset.dark : preset.light;
  if (modeVars) {
    for (const [key, value] of Object.entries(modeVars)) {
      if (typeof value === "string") vars[`--${toKebab(key)}`] = value;
    }
  }

  applyLookVars(vars);
  appliedLookLogin = login;
  startLookRouteWatcher();
}

export function clearProfileLook(): void {
  clearLookVars();
  appliedLookLogin = null;
  stopLookRouteWatcher();
}

export function isViewingProfileLook(): boolean {
  return appliedLookLogin !== null;
}

function reapplyProfileLook(): void {
  if (pendingLook) applyProfileLook(pendingLook.login, pendingLook.look);
}
