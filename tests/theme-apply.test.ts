import { describe, it, expect, beforeEach } from "vitest";
import { applyThemePreset } from "../src/features/profile/theme/theme-manager";

beforeEach(async () => {
  await (chrome.storage.local.clear as any)();
  document.head.innerHTML = "";
  document.documentElement.className = "";
});

function presetCss(): string {
  return (
    document.getElementById("better-intra-theme-preset")?.textContent ?? ""
  );
}

describe("applyThemePreset overrides", () => {
  it("writes the chosen input color for a builtin dark theme", async () => {
    document.documentElement.classList.add("dark");
    await chrome.storage.local.set({
      PROFILE_THEME_PRESET: "dark",
      PROFILE_THEME_OVERRIDES: {
        dark: { dark: { input: "#ff0000", sidebar: "#00ff00" } },
      },
    });

    await applyThemePreset();

    const css = presetCss();
    expect(css).toContain("--bi-input: 0 100% 50% !important");
    expect(css).toContain("--bi-sidebar: 120 100% 50% !important");
    expect(css).toContain("--input: 0 100% 50% !important");
  });

  it("writes the chosen input color for a named theme", async () => {
    document.documentElement.classList.add("dark");
    await chrome.storage.local.set({
      PROFILE_THEME_PRESET: "dracula",
      PROFILE_THEME_OVERRIDES: {
        dracula: { dark: { input: "#ff0000" } },
      },
    });

    await applyThemePreset();

    expect(presetCss()).toContain("--bi-input: 0 100% 50% !important");
  });

  it("writes the chosen input color for seishin (dark-only)", async () => {
    document.documentElement.classList.add("dark");
    await chrome.storage.local.set({
      PROFILE_THEME_PRESET: "seishin",
      PROFILE_THEME_OVERRIDES: {
        seishin: { dark: { input: "#ff0000" } },
      },
    });

    await applyThemePreset();

    expect(presetCss()).toContain("--bi-input: 0 100% 50% !important");
    expect(presetCss()).toContain("--input: 0 100% 50% !important");
  });

  it("does not apply dark overrides while in light mode", async () => {
    await chrome.storage.local.set({
      PROFILE_THEME_PRESET: "light",
      PROFILE_THEME_OVERRIDES: {
        light: { dark: { input: "#ff0000" } },
      },
    });

    await applyThemePreset();

    expect(presetCss()).not.toContain("--bi-input: 0 100% 50% !important");
  });
});
