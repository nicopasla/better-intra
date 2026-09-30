import { describe, it, expect } from "vitest";
import {
  CUSTOM_THEME_ROLES,
  buildDaisyThemeCss,
  buildIntraVars,
  hexToTriplet,
  resolvePalette,
  seedPaletteFromPreset,
} from "../src/features/profile/theme/custom-theme";

describe("hexToTriplet", () => {
  it("converts hex to a space-separated HSL triplet", () => {
    expect(hexToTriplet("#ff0000")).toBe("0 100% 50%");
    expect(hexToTriplet("#00ff00")).toBe("120 100% 50%");
    expect(hexToTriplet("#ffffff")).toBe("0 0% 100%");
  });
});

describe("resolvePalette", () => {
  it("returns a hex color for every role", () => {
    const palette = resolvePalette(undefined, true);
    for (const role of CUSTOM_THEME_ROLES) {
      expect(palette[role.id]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps a valid stored color and ignores an invalid one", () => {
    const palette = resolvePalette(
      { page: "#123456", card: "not-a-color" },
      true,
    );
    expect(palette.page).toBe("#123456");
    expect(palette.card).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("uses the requested preset as the base", () => {
    const neon = resolvePalette(undefined, true, "neon");
    const dark = resolvePalette(undefined, true, "dark");
    expect(neon.accent).not.toBe(dark.accent);
  });
});

describe("buildIntraVars", () => {
  it("emits the dedicated component variables", () => {
    const declarations = buildIntraVars({}, true).join("\n");
    for (const variable of [
      "--background",
      "--bi-header",
      "--bi-sidebar",
      "--bi-card",
      "--bi-input",
      "--primary",
      "--border",
    ]) {
      expect(declarations).toContain(`${variable}:`);
    }
  });

  it("applies an input override to --bi-input and --input", () => {
    const declarations = buildIntraVars({ input: "#ff0000" }, true, "dracula");
    expect(declarations).toContain("--bi-input: 0 100% 50% !important");
    expect(declarations).toContain("--input: 0 100% 50% !important");
  });
});

describe("buildDaisyThemeCss", () => {
  it("produces a custom daisyUI theme block", () => {
    const css = buildDaisyThemeCss({}, false);
    expect(css).toContain('[data-theme="custom"]');
    expect(css).toContain("--color-primary:");
    expect(css).toContain("color-scheme: light");
  });

  it("targets a named preset key", () => {
    const css = buildDaisyThemeCss(
      { card: "#123456" },
      true,
      "dracula",
      "dracula",
    );
    expect(css).toContain('[data-theme="dracula"]');
    expect(css).toContain("#123456");
  });
});

describe("seedPaletteFromPreset", () => {
  it("returns hex values for all roles", () => {
    const seeded = seedPaletteFromPreset("dark", true);
    for (const role of CUSTOM_THEME_ROLES) {
      expect(seeded[role.id]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
