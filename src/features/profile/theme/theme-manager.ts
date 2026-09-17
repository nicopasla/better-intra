import { getConfig } from "../../../config.ts";
import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import SUN_MOON_SVG from "../../../assets/svg/sun-moon.svg?raw";
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

export const THEMES: Record<string, ThemePreset> = themesJson;

function toKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

async function applyThemePreset() {
  const presetKey = await getConfig("PROFILE_THEME_PRESET");
  const isDark = document.documentElement.classList.contains("dark");

  let styleEl = document.getElementById(
    "better-intra-theme-preset",
  ) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "better-intra-theme-preset";
    (document.head || document.documentElement).appendChild(styleEl);
  }

  if (!presetKey || presetKey === "dark" || presetKey === "light") {
    styleEl.textContent = "";
    return;
  }

  const preset = THEMES[presetKey];
  if (!preset) {
    styleEl.textContent = "";
    return;
  }

  const { primary, primaryForeground, ring } = preset;
  let content = "";

  if (isDark && preset.dark) {
    const vars = [
      `--primary: ${primary}`,
      `--primary-foreground: ${primaryForeground}`,
      `--ring: ${ring}`,
    ];
    for (const [key, val] of Object.entries(preset.dark)) {
      vars.push(`--${toKebab(key)}: ${val}`);
    }
    content = `html.dark {\n    ${vars.join(";\n    ")};\n  }`;
  } else if (!isDark && preset.light) {
    const vars = [
      `--primary: ${primary}`,
      `--primary-foreground: ${primaryForeground}`,
      `--ring: ${ring}`,
      `--legacy-main: var(--primary)`,
    ];
    for (const [key, val] of Object.entries(preset.light)) {
      vars.push(`--${toKebab(key)}: ${val}`);
    }
    content = `html:not(.dark) {\n    ${vars.join(";\n    ")};\n  }\n${themeLightV3Overrides}`;
  }

  styleEl.textContent = content;
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

const LOOK_BTN_ID = "ft-look-btn";
const SUPPRESSED = new Set<string>();
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

function hideLookButton(): void {
  document.getElementById(LOOK_BTN_ID)?.remove();
  stopLookRouteWatcher();
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

function showLookButton(login: string): void {
  let btn = document.getElementById(LOOK_BTN_ID) as HTMLButtonElement | null;
  if (!btn) {
    btn = document.createElement("button");
    btn.id = LOOK_BTN_ID;
    btn.type = "button";
    btn.style.cssText =
      "position:fixed;bottom:24px;left:24px;z-index:9999;width:44px;height:44px;" +
      "border-radius:9999px;display:flex;align-items:center;justify-content:center;" +
      "padding:0;cursor:pointer;background:hsl(var(--card,220 20% 10%));" +
      "color:hsl(var(--foreground,213 31% 91%));" +
      "border:1px solid color-mix(in oklab, currentColor 20%, transparent);" +
      "box-shadow:0 4px 14px rgba(0,0,0,.3);";
    render(unsafeHTML(SUN_MOON_SVG), btn);
    const svg = btn.querySelector("svg");
    if (svg) {
      svg.setAttribute("width", "24");
      svg.setAttribute("height", "24");
    }
    (document.body || document.documentElement).appendChild(btn);
  }
  btn.setAttribute("data-tip", `Viewing ${login}'s theme — use yours`);
  btn.onclick = () => {
    SUPPRESSED.add(login);
    clearProfileLook();
  };
  startLookRouteWatcher();
}

/** Applies a profile owner's published theme to the page for this visit. */
export function applyProfileLook(
  login: string,
  look: ProfileLook | null | undefined,
): void {
  pendingLook = look?.preset ? { login, look } : null;

  if (!look?.preset || SUPPRESSED.has(login) || !modeMatches(look.theme)) {
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
  showLookButton(login);
}

export function clearProfileLook(): void {
  clearLookVars();
  appliedLookLogin = null;
  hideLookButton();
}

export function isViewingProfileLook(): boolean {
  return appliedLookLogin !== null;
}

function reapplyProfileLook(): void {
  if (pendingLook) applyProfileLook(pendingLook.login, pendingLook.look);
}
