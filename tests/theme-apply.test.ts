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

describe("applyThemePreset", () => {
  it("writes the built-in preset colors", async () => {
    document.documentElement.classList.add("dark");
    await chrome.storage.local.set({ PROFILE_THEME_PRESET: "dracula" });
    await applyThemePreset();
    expect(presetCss()).toContain("--background:");
  });

  it("applies a saved (mine) theme's stored palette", async () => {
    document.documentElement.classList.add("dark");
    await chrome.storage.local.set({
      PROFILE_THEME_PRESET: "mine-x",
      PROFILE_THEME_CUSTOMS: [
        {
          id: "mine-x",
          name: "X",
          colors: { dark: { page: "#ff0000" }, light: {} },
        },
      ],
    });

    await applyThemePreset();

    expect(presetCss()).toContain("--background: 0 100% 50% !important");
  });

  it("clears styles for an unknown theme id", async () => {
    await chrome.storage.local.set({ PROFILE_THEME_PRESET: "nope" });
    await applyThemePreset();
    expect(presetCss()).toBe("");
  });
});
