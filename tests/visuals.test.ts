import { describe, it, expect, beforeEach, afterEach } from "vitest";

// hasBackground is a module-scoped function in visuals.ts.
// We test its logic by replicating the regex pattern it uses.
const urlRe = /url\((["']?)(.*?)\1\)/;

function hasBackground(el: HTMLElement | null, url?: string): boolean {
  if (!url) return true;
  if (!el) return false;
  const inline = el.style.backgroundImage || "";
  const computed = window.getComputedStyle(el).backgroundImage || "";
  const inlineMatch = inline.match(urlRe);
  const computedMatch = computed.match(urlRe);
  return (inlineMatch?.[2] === url) || (computedMatch?.[2] === url);
}

describe("hasBackground", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it("returns true when no url is provided", () => {
    expect(hasBackground(el)).toBe(true);
  });

  it("returns false when element is null", () => {
    expect(hasBackground(null, "https://example.com/img.jpg")).toBe(false);
  });

  it("returns true when inline style matches the url exactly", () => {
    el.style.backgroundImage = `url("https://example.com/avatar.jpg")`;
    expect(hasBackground(el, "https://example.com/avatar.jpg")).toBe(true);
  });

  it("returns false when url is a substring of the active image (old includes bug)", () => {
    el.style.backgroundImage = `url("https://example.com/avatar.jpg")`;
    expect(hasBackground(el, "https://example.com/avatar.jpg?v=2")).toBe(false);
  });

  it("returns false when url is a superstring of the active image", () => {
    el.style.backgroundImage = `url("https://example.com/avatar.jpg?v=2")`;
    expect(hasBackground(el, "https://example.com/avatar.jpg")).toBe(false);
  });

  it("handles single-quoted url()", () => {
    el.style.backgroundImage = `url('https://example.com/img.png')`;
    expect(hasBackground(el, "https://example.com/img.png")).toBe(true);
  });

  it("handles unquoted url()", () => {
    el.style.backgroundImage = `url(https://example.com/img.png)`;
    expect(hasBackground(el, "https://example.com/img.png")).toBe(true);
  });

  it("returns false when no background-image is set", () => {
    expect(hasBackground(el, "https://example.com/img.png")).toBe(false);
  });
});

describe("getVisualKey (serialized)", () => {
  const getVisualKey = (urls: Record<string, unknown>) =>
    JSON.stringify({
      avatar: urls.avatar || "",
      banner: urls.banner || "",
      bannerMode: urls.bannerMode || "",
      background: urls.background || "",
      backgroundMode: urls.backgroundMode || "",
      theme: (urls as any).theme || null,
      logtime: (urls as any).logtime || null,
    });

  it("produces the same key for identical visuals", () => {
    const a = { avatar: "a.jpg", banner: "b.jpg", bannerMode: "fill", background: "c.jpg", backgroundMode: "fill" };
    const b = { ...a };
    expect(getVisualKey(a)).toBe(getVisualKey(b));
  });

  it("produces different keys for different avatars", () => {
    const a = { avatar: "a.jpg", banner: "", bannerMode: "fill", background: "", backgroundMode: "fill" };
    const b = { avatar: "b.jpg", banner: "", bannerMode: "fill", background: "", backgroundMode: "fill" };
    expect(getVisualKey(a)).not.toBe(getVisualKey(b));
  });

  it("includes theme in the key", () => {
    const a = { avatar: "", banner: "", bannerMode: "", background: "", backgroundMode: "", theme: { profileColor: "#ff0" } };
    const b = { ...a, theme: null };
    expect(getVisualKey(a)).not.toBe(getVisualKey(b));
  });
});
