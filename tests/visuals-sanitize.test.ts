import { describe, it, expect } from "vitest";
import {
  sanitizeCssColor,
  sanitizeCssUrl,
  sanitizeHexColor,
  sanitizeVisualUrls,
} from "../src/features/profile/visuals-sanitize";
import type { VisualUrls } from "../src/features/profile/visuals";

const base: VisualUrls = {
  avatar: "",
  banner: "",
  bannerMode: "fill",
  background: "",
  backgroundMode: "fill",
};

describe("sanitizeCssUrl", () => {
  it("keeps plain http(s) URLs", () => {
    expect(sanitizeCssUrl("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
    expect(sanitizeCssUrl("http://example.com/b.jpg?x=1")).toBe(
      "http://example.com/b.jpg?x=1",
    );
  });

  it("rejects CSS breakout attempts and other schemes", () => {
    expect(
      sanitizeCssUrl('x") } * { display:none !important } .z { background:url("'),
    ).toBe("");
    expect(sanitizeCssUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeCssUrl("data:image/png;base64,AAAA")).toBe("");
    expect(sanitizeCssUrl("not a url")).toBe("");
    expect(sanitizeCssUrl(42)).toBe("");
  });

  it("normalises rather than rejects unusual but legitimate URLs", () => {
    expect(sanitizeCssUrl("https://a.com/x y.png")).toBe("https://a.com/x%20y.png");
    expect(sanitizeCssUrl('https://a.com/x"y.png')).toBe("https://a.com/x%22y.png");
    expect(sanitizeCssUrl("https://upload.wikimedia.org/a_(b).png")).toBe(
      "https://upload.wikimedia.org/a_(b).png",
    );
    const once = sanitizeCssUrl("https://a.com/x y.png");
    expect(sanitizeCssUrl(once)).toBe(once);
  });
});

describe("sanitizeCssColor", () => {
  it("keeps hex and functional colours", () => {
    expect(sanitizeCssColor("#fff")).toBe("#fff");
    expect(sanitizeCssColor("#00BCBA")).toBe("#00BCBA");
    expect(sanitizeCssColor("#00bcba80")).toBe("#00bcba80");
    expect(sanitizeCssColor("rgba(0, 188, 186, 0.5)")).toBe(
      "rgba(0, 188, 186, 0.5)",
    );
    expect(sanitizeCssColor("hsl(199 89% 48%)")).toBe("hsl(199 89% 48%)");
  });

  it("rejects declarations smuggled into a colour", () => {
    expect(sanitizeCssColor("red; } body { display:none } .a { color: red")).toBe("");
    expect(sanitizeCssColor("url(https://evil/x)")).toBe("");
    expect(sanitizeCssColor("red")).toBe("");
    expect(sanitizeCssColor("transparent", new Set(["transparent"]))).toBe(
      "transparent",
    );
  });
});

describe("sanitizeHexColor", () => {
  it("only accepts 6-digit hex", () => {
    expect(sanitizeHexColor("#26a641")).toBe("#26a641");
    expect(sanitizeHexColor("#fff")).toBe("");
    expect(sanitizeHexColor("#26a641; }")).toBe("");
  });
});

describe("sanitizeVisualUrls", () => {
  it("neutralises a malicious remote profile", () => {
    const out = sanitizeVisualUrls({
      ...base,
      banner: 'x") } * { display:none } .z { background:url("',
      bannerColor: "red; } body { display:none } .a { color: red",
      decoration: "a b",
      bannerMode: "evil",
      avatarPosX: 9999,
      avatarScale: NaN,
      badgeBg: "url(https://evil/x)",
      theme: { profileColor: "#fff; } * { color: red" },
      logtime: {
        calendarColor: "red;} .lt-box-container{display:none}",
        labelsColor: "#26a641",
        emojiDivisor: -1,
        emojiRate: "abc",
      },
    });
    expect(out.banner).toBe("");
    expect(out.bannerColor).toBe("");
    expect(out.decoration).toBe("none");
    expect(out.bannerMode).toBe("fill");
    expect(out.avatarPosX).toBe(100);
    expect(out.avatarScale).toBe(100);
    expect(out.badgeBg).toBe("");
    expect(out.theme?.profileColor).toBeUndefined();
    expect(out.logtime?.calendarColor).toBeUndefined();
    expect(out.logtime?.labelsColor).toBe("#26a641");
    expect(out.logtime?.emojiDivisor).toBe(0.01);
    expect(out.logtime?.emojiRate).toBe(2);
  });

  it("passes a legitimate profile through unchanged", () => {
    const legit: VisualUrls = {
      avatar: "https://cdn.example.com/avatar.png",
      banner: "https://cdn.example.com/banner.png",
      bannerMode: "fit",
      bannerColor: "#112233",
      background: "https://cdn.example.com/bg.png",
      backgroundMode: "tile",
      backgroundColor: "rgb(1, 2, 3)",
      avatarBg: "transparent",
      decoration: "solid",
      avatarPosX: 40,
      avatarPosY: 60,
      avatarScale: 120,
      badgeBg: "#abcdef",
      theme: { profileColor: "#00bcba" },
      logtime: {
        calendarColor: "#00bcba",
        labelsColor: "#26a641",
        emoji: "🌮",
        rainbowPalette: "rainbow",
      },
    };
    expect(sanitizeVisualUrls(legit)).toEqual({
      ...legit,
      logtime: {
        calendarColor: "#00bcba",
        labelsColor: "#26a641",
        emoji: "🌮",
        emojiDivisor: undefined,
        emojiRate: undefined,
        rainbowPalette: "rainbow",
      },
    });
  });

  it("is idempotent", () => {
    const once = sanitizeVisualUrls({
      ...base,
      avatar: "https://a.com/x y.png",
      bannerColor: "#112233",
      decoration: "solid",
    });
    expect(sanitizeVisualUrls(once)).toEqual(once);
  });
});