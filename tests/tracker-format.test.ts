import { describe, it, expect } from "vitest";
import { formatHours } from "../src/features/logtime/tracker";
import { sanitizeHttpUrl } from "../src/utils/safe-url";
import { getActiveFeatures } from "../src/features/hub/hubSettings.storage";

describe("formatHours", () => {
  it("never renders 60 minutes", () => {
    expect(formatHours(4 + 59.75 / 60)).toBe("5h");
    expect(formatHours(4.5)).toBe("4h30");
    expect(formatHours(0)).toBe("0h");
    expect(formatHours(2 + 5 / 60)).toBe("2h05");
  });
});

describe("sanitizeHttpUrl", () => {
  it("keeps absolute http(s) URLs and rejects the rest", () => {
    expect(sanitizeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeHttpUrl("example.com")).toBe("");
    expect(sanitizeHttpUrl(null)).toBe("");
  });
});

describe("getActiveFeatures", () => {
  it("keeps an explicitly empty list instead of re-enabling everything", async () => {
    await chrome.storage.local.set({ ACTIVE_SCRIPTS: [] });
    expect(await getActiveFeatures()).toEqual([]);
  });

  it("falls back to every feature when the stored value is garbage", async () => {
    await chrome.storage.local.set({ ACTIVE_SCRIPTS: "not json" });
    expect((await getActiveFeatures()).length).toBeGreaterThan(0);
  });
});