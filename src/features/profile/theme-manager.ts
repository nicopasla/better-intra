import { getConfig } from "../../config";
import themev3 from "./theme-v3.css?inline";
import themev2 from "./theme-v2.css?inline";

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

  if (isDark) {
    // If dark mode is ON, inject the right CSS if it's missing
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "better-intra-theme-stylesheet";
      if (window.location.hostname === "profile-v3.intra.42.fr") {
        styleEl.textContent = themev3;
      } else {
        styleEl.textContent = themev2;
      }
      
      // Target head, fallback to documentElement if head isn't parsed yet
      const target = document.head || document.documentElement;
      target.appendChild(styleEl);
    }
  } else {
    // If dark mode is OFF, completely remove the CSS
    if (styleEl) {
      styleEl.remove();
    }
  }

  // 3. Store in sessionStorage for quick sync access on next navigation
  sessionStorage.setItem("intra-theme", theme);
}

/**
 * Determines the effective theme ('dark' or 'light') based on the stored preference.
 * Falls back to system preference if set to 'system'.
 * @returns A promise that resolves to the effective theme.
 */
async function getEffectiveTheme(): Promise<"dark" | "light"> {
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
export async function initThemeManager() {
  const cachedTheme = sessionStorage.getItem("intra-theme") as "dark" | "light" | null;
  if (cachedTheme) {
    applyTheme(cachedTheme);
  }
  const initialTheme = await getEffectiveTheme();
  if (initialTheme !== cachedTheme) {
    applyTheme(initialTheme);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.BETTER_INTRA_THEME) {
      sessionStorage.removeItem("intra-theme");
      initThemeManager(); 
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

  console.log("BetterIntra: Theme manager initialized successfully.");
}

/**
 * Helper function to manually toggle dark mode (useful for testing)
 */
export function toggleTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
}

/**
 * Get the current theme
 */
export function getCurrentTheme(): "dark" | "light" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
