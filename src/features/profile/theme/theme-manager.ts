import { getConfig } from "../../../config.ts";
import themev3 from "./theme-v3.css?inline";
import themev2 from "./theme-v2.css?inline";
import themeLightV3 from "./theme-light-v3.css?inline";

type ThemeVars = {
  primary: string;
  primaryForeground: string;
  ring: string;
  background: string;
  card: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
};

const synthwave: ThemeVars = {
  primary:          "327 92% 68%",
  primaryForeground: "335 94% 16%",
  ring:             "327 92% 68%",
  background:       "252 100% 9%",
  card:             "249 70% 14%",
  foreground:       "230 100% 82%",
  muted:            "248 67% 50%",
  mutedForeground:  "228 100% 89%",
  border:           "245 51% 19%",
  input:            "249 70% 14%",
};

const forest: ThemeVars = {
  primary:          "141 71% 42%",
  primaryForeground: "0 0% 0%",
  ring:             "141 71% 42%",
  background:       "0 10% 10%",
  card:             "0 11% 8%",
  foreground:       "1 1% 79%",
  muted:            "161 37% 15%",
  mutedForeground:  "157 6% 82%",
  border:           "0 14% 6%",
  input:            "0 11% 8%",
};

const halloween: ThemeVars = {
  primary:          "34 100% 50%",
  primaryForeground: "180 6% 8%",
  ring:             "34 100% 50%",
  background:       "24 10% 9%",
  card:             "19 15% 4%",
  foreground:       "150 0% 81%",
  muted:            "31 79% 10%",
  mutedForeground:  "29 10% 80%",
  border:           "0 0% 0%",
  input:            "19 15% 4%",
};

const dracula: ThemeVars = {
  primary:          "326 100% 74%",
  primaryForeground: "327 62% 5%",
  ring:             "326 100% 74%",
  background:       "231 15% 18%",
  card:             "231 15% 16%",
  foreground:       "60 27% 96%",
  muted:            "230 15% 30%",
  mutedForeground:  "229 7% 85%",
  border:           "231 16% 14%",
  input:            "231 15% 16%",
};

const night: ThemeVars = {
  primary:          "199 93% 60%",
  primaryForeground: "204 88% 4%",
  ring:             "199 93% 60%",
  background:       "222 47% 11%",
  card:             "222 50% 10%",
  foreground:       "221 7% 80%",
  muted:            "217 32% 17%",
  mutedForeground:  "217 8% 82%",
  border:           "222 52% 8%",
  input:            "222 50% 10%",
};

const sunset: ThemeVars = {
  primary:          "16 100% 68%",
  primaryForeground: "11 77% 5%",
  ring:             "16 100% 68%",
  background:       "204 31% 10%",
  card:             "204 37% 9%",
  foreground:       "208 15% 85%",
  muted:            "204 23% 14%",
  mutedForeground:  "204 10% 75%",
  border:           "204 45% 7%",
  input:            "204 37% 9%",
};

const luxury: ThemeVars = {
  primary:          "0 0% 100%",
  primaryForeground: "180 0% 9%",
  ring:             "0 0% 100%",
  background:       "240 9% 4%",
  card:             "270 4% 9%",
  foreground:       "37 67% 58%",
  muted:            "28 100% 10%",
  mutedForeground:  "44 100% 82%",
  border:           "270 3% 12%",
  input:            "270 4% 9%",
};

const cyberpunk: ThemeVars = {
  primary:          "341 100% 70%",
  primaryForeground: "347 74% 5%",
  ring:             "341 100% 70%",
  background:       "227 56% 15%",
  card:             "227 56% 15%",
  foreground:       "56 100% 64%",
  muted:            "227 56% 15%",
  mutedForeground:  "56 100% 64%",
  border:           "56 88% 47%",
  input:            "227 56% 15%",
};

const dim: ThemeVars = {
  primary:          "108 66% 73%",
  primaryForeground: "109 45% 5%",
  ring:             "108 66% 73%",
  background:       "220 17% 20%",
  card:             "220 17% 17%",
  foreground:       "197 30% 77%",
  muted:            "220 21% 14%",
  mutedForeground:  "197 30% 77%",
  border:           "219 18% 15%",
  input:            "220 17% 17%",
};

const black: ThemeVars = {
  primary:          "0 0% 23%",
  primaryForeground: "0 0% 100%",
  ring:             "0 0% 23%",
  background:       "0 0% 0%",
  card:             "0 0% 8%",
  foreground:       "300 0% 84%",
  muted:            "0 0% 23%",
  mutedForeground:  "0 0% 100%",
  border:           "0 0% 10%",
  input:            "0 0% 8%",
};

const coffee: ThemeVars = {
  primary:          "30 66% 58%",
  primaryForeground: "23 78% 4%",
  ring:             "30 66% 58%",
  background:       "306 16% 13%",
  card:             "306 18% 10%",
  foreground:       "37 46% 58%",
  muted:            "300 19% 6%",
  mutedForeground:  "301 2% 79%",
  border:           "306 27% 6%",
  input:            "306 18% 10%",
};

const aqua: ThemeVars = {
  primary:          "182 90% 51%",
  primaryForeground: "181 98% 17%",
  ring:             "182 90% 51%",
  background:       "225 69% 32%",
  card:             "227 59% 21%",
  foreground:       "201 97% 86%",
  muted:            "230 91% 22%",
  mutedForeground:  "217 100% 78%",
  border:           "229 76% 15%",
  input:            "227 59% 21%",
};

export const THEME_PRESETS: Record<string, ThemeVars> = {
  dark:      synthwave, // reused, never injected — dark uses theme-v3 defaults
  synthwave,
  forest,
  halloween,
  dracula,
  night,
  sunset,
  luxury,
  cyberpunk,
  dim,
  black,
  coffee,
  aqua,
};

async function applyThemePreset() {
  const presetKey = await getConfig("PROFILE_THEME_PRESET");
  const preset = THEME_PRESETS[presetKey];
  let styleEl = document.getElementById("better-intra-theme-preset") as HTMLStyleElement | null;
  if (!preset || presetKey === "dark") {
    if (styleEl) styleEl.remove();
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "better-intra-theme-preset";
    (document.head || document.documentElement).appendChild(styleEl);
  }
  styleEl.textContent = `html.dark {
    --primary: ${preset.primary};
    --primary-foreground: ${preset.primaryForeground};
    --ring: ${preset.ring};
    --background: ${preset.background};
    --card: ${preset.card};
    --foreground: ${preset.foreground};
    --muted: ${preset.muted};
    --muted-foreground: ${preset.mutedForeground};
    --popover: ${preset.card};
    --popover-foreground: ${preset.foreground};
    --accent: ${preset.muted};
    --accent-foreground: ${preset.foreground};
    --input: ${preset.input};
    --border: ${preset.border};
  }`;
}

/**
 * Applies the selected theme by adding/removing the 'dark' class
 * AND injecting/removing the custom CSS string.
 * @param theme The theme to apply, either 'dark' or 'light'.
 */
function applyTheme(theme: "dark" | "light") {
  const isDark = theme === "dark";

  // 1. Apply classes to html safely (and body if it exists yet)
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.setAttribute("data-theme", theme);
  if (document.body) {
    document.body.classList.toggle("dark", isDark);
  }

  // 2. Manage the injected stylesheet based on the setting
  let styleEl = document.getElementById("better-intra-theme-stylesheet");
  const isV3 = window.location.hostname === "profile-v3.intra.42.fr";

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

  // 3. Apply theme preset override (primary/ring accent color)
  void applyThemePreset();

  // 4. Store in sessionStorage for quick sync access on next navigation
  sessionStorage.setItem("intra-theme", theme);
}

/**
 * Determines the effective theme ('dark' or 'light') based on the stored preference.
 * Falls back to system preference if set to 'system'.
 * @returns A promise that resolves to the effective theme.
 */
export async function getEffectiveTheme(): Promise<"dark" | "light"> {
  const savedTheme = await getConfig("BETTER_INTRA_THEME");

  if (savedTheme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return (savedTheme as "dark" | "light") || "light";
}

/**
 * Initializes the theme manager on page load.
 * Sets up listeners for theme changes and system preference changes.
 */
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
