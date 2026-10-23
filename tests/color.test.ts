import { describe, it, expect } from "vitest";
import {
  contrastText,
  mixToward,
  perceptualLuminance,
  toHex,
  toRgba,
  ensureContrast,
  contrastRatio,
  MIN_BADGE_CONTRAST,
} from "../src/utils/color";

describe("toRgba", () => {
  it("converts hex to an rgba string", () => {
    expect(toRgba("#00babc", 0.5)).toBe("rgba(0, 186, 188, 0.5)");
  });
});

describe("toHex", () => {
  it("converts an rgb() string to hex", () => {
    expect(toHex("rgb(1, 2, 3)")).toBe("#010203");
  });

  it("normalises hex input", () => {
    expect(toHex("#ABCDEF")).toBe("#abcdef");
  });

  it("returns the input untouched when unparsable", () => {
    expect(toHex("not-a-color")).toBe("not-a-color");
  });
});

describe("contrastText", () => {
  it("uses white text on dark backgrounds", () => {
    expect(contrastText("#000000")).toBe("#ffffff");
  });

  it("uses black text on light backgrounds", () => {
    expect(contrastText("#ffffff")).toBe("#000000");
  });

  it("keeps the 128 luminance threshold", () => {
    expect(perceptualLuminance("#00babc")).toBeGreaterThanOrEqual(128);
    expect(contrastText("#00babc")).toBe("#000000");
    expect(contrastText("#123456")).toBe("#ffffff");
  });
});

describe("mixToward", () => {
  it("blends halfway toward white", () => {
    expect(mixToward("#000000", "#ffffff")).toBe("#808080");
    expect(mixToward("#000010", "#ffffff")).toBe("#808088");
    expect(mixToward("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  it("blends halfway toward black", () => {
    expect(mixToward("#ffffff", "#000000")).toBe("#808080");
    expect(mixToward("#ffffff", "#000000", 1)).toBe("#000000");
  });

  it("leaves the colour in place at amount 0", () => {
    expect(mixToward("#123456", "#ffffff", 0)).toBe("#123456");
  });
});

describe("ensureContrast", () => {
  it("returns an already-readable colour unchanged", () => {
    expect(ensureContrast("#ffffff", "#000000")).toBe("#ffffff");
    expect(ensureContrast("#000000", "#ffffff")).toBe("#000000");
  });

  it("lifts black text off a black background", () => {
    const out = ensureContrast("#000000", "#000000");
    expect(contrastRatio(out, "#000000")).toBeGreaterThanOrEqual(
      MIN_BADGE_CONTRAST,
    );
  });

  it("keeps the hue when only a nudge is needed", () => {
    const out = ensureContrast("#222222", "#000000");
    expect(out).not.toBe("#222222");
    expect(contrastRatio(out, "#000000")).toBeGreaterThanOrEqual(
      MIN_BADGE_CONTRAST,
    );
  });

  it("handles non-hex colours and mid-tone backgrounds", () => {
    const out = ensureContrast("rgb(0, 0, 0)", "#00babc");
    expect(contrastRatio(out, "#00babc")).toBeGreaterThanOrEqual(
      MIN_BADGE_CONTRAST,
    );
  });

  it("leaves unparsable colours untouched", () => {
    expect(ensureContrast("not-a-colour", "#000000")).toBe("not-a-colour");
  });
});
