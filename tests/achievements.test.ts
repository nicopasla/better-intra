import { describe, it, expect } from "vitest";
import {
  normalizeAchievementSvg,
  resolveAchievementIconSource,
} from "../src/features/profile/achievements.ts";

function parse(markup: string): Element {
  return new DOMParser().parseFromString(markup, "image/svg+xml")
    .documentElement;
}

describe("resolveAchievementIconSource", () => {
  it("keeps inline SVG markup as-is", () => {
    const markup = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    expect(resolveAchievementIconSource(markup)).toEqual({
      kind: "inline",
      markup,
    });
  });

  it("keeps absolute URLs untouched", () => {
    expect(
      resolveAchievementIconSource(
        "https://cdn.intra.42.fr/achievements/1.svg",
      ),
    ).toEqual({
      kind: "url",
      url: "https://cdn.intra.42.fr/achievements/1.svg",
    });
  });

  it("resolves relative paths against the intrapy host", () => {
    expect(resolveAchievementIconSource("/static/a.svg")).toEqual({
      kind: "url",
      url: "https://intrapy.intra.42.fr/static/a.svg",
    });
    expect(resolveAchievementIconSource("static/a.svg")).toEqual({
      kind: "url",
      url: "https://intrapy.intra.42.fr/static/a.svg",
    });
  });

  it("keeps data URIs", () => {
    expect(
      resolveAchievementIconSource("data:image/svg+xml;base64,PHN2Zy8+"),
    ).toEqual({
      kind: "url",
      url: "data:image/svg+xml;base64,PHN2Zy8+",
    });
  });

  it("returns null for empty values", () => {
    expect(resolveAchievementIconSource("")).toBeNull();
    expect(resolveAchievementIconSource("   ")).toBeNull();
    expect(resolveAchievementIconSource(null)).toBeNull();
    expect(resolveAchievementIconSource(undefined)).toBeNull();
  });
});

describe("normalizeAchievementSvg", () => {
  it("sizes only the root and keeps child geometry", () => {
    const out = normalizeAchievementSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="256" fill="#f00"/></svg>',
    );
    const root = parse(out);
    expect(root.getAttribute("width")).toBe("100%");
    expect(root.getAttribute("height")).toBe("100%");
    expect(root.getAttribute("viewBox")).toBe("0 0 512 512");

    const rect = root.querySelector("rect")!;
    expect(rect.getAttribute("width")).toBe("512");
    expect(rect.getAttribute("height")).toBe("256");
  });

  it("keeps an existing viewBox", () => {
    const out = normalizeAchievementSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>',
    );
    const root = parse(out);
    expect(root.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(root.getAttribute("width")).toBe("100%");
  });

  it("does not derive a viewBox from percentage sizes", () => {
    const out = normalizeAchievementSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"></svg>',
    );
    expect(parse(out).getAttribute("viewBox")).toBeNull();
  });

  it("returns non-markup input unchanged", () => {
    expect(normalizeAchievementSvg("https://example.com/a.svg")).toBe(
      "https://example.com/a.svg",
    );
  });
});
