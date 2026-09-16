import { describe, it, expect, beforeEach, vi } from "vitest";
import { getConfig, getConfigMany, CONFIG_DEFAULT } from "../src/config";

beforeEach(() => {
  (chrome.storage.local.clear as any)();
  vi.mocked(chrome.storage.local.get).mockClear();
});

describe("getConfigMany", () => {
  it("reads several keys with a single storage call", async () => {
    await chrome.storage.local.set({
      LOGTIME_GOAL_HOURS: 120,
      LOGTIME_EMOJI: "🍕",
    });
    vi.mocked(chrome.storage.local.get).mockClear();

    const c = await getConfigMany([
      "LOGTIME_GOAL_HOURS",
      "LOGTIME_EMOJI",
      "LOGTIME_SHOW_GOAL",
    ] as const);

    expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
    expect(c.LOGTIME_GOAL_HOURS).toBe(120);
    expect(c.LOGTIME_EMOJI).toBe("🍕");
    expect(c.LOGTIME_SHOW_GOAL).toBe(CONFIG_DEFAULT.LOGTIME_SHOW_GOAL);
  });

  it("matches getConfig() for legacy JSON-string values", async () => {
    await chrome.storage.local.set({ FRIENDS_LIST: '["a","b"]' });
    const one = await getConfig("FRIENDS_LIST");
    const many = await getConfigMany(["FRIENDS_LIST"] as const);
    expect(many.FRIENDS_LIST).toEqual(one);
    expect(many.FRIENDS_LIST).toEqual(["a", "b"]);
  });

  it("applies the PROFILE_CARD_ORDER completion like getConfig()", async () => {
    await chrome.storage.local.set({ PROFILE_CARD_ORDER: ["LOGTIME"] });
    const many = await getConfigMany(["PROFILE_CARD_ORDER"] as const);
    expect(many.PROFILE_CARD_ORDER[0]).toBe("LOGTIME");
    expect(many.PROFILE_CARD_ORDER.length).toBe(
      CONFIG_DEFAULT.PROFILE_CARD_ORDER.length,
    );
  });
});