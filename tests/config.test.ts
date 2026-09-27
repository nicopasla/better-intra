import { describe, it, expect, beforeEach } from "vitest";
import {
  getConfig,
  setConfig,
  setConfigMany,
  CONFIG_DEFAULT,
  CLOUD_SYNC_KEYS,
} from "../src/config";

beforeEach(() => {
  (chrome.storage.local.clear as any)();
});

describe("getConfig", () => {
  it("defaults auto push to off", () => {
    expect(CONFIG_DEFAULT.CLOUD_SYNC_ENABLED).toBe(false);
  });

  it("returns the default when storage is empty", async () => {
    const value = await getConfig("LOGTIME_GOAL_HOURS");
    expect(value).toBe(CONFIG_DEFAULT.LOGTIME_GOAL_HOURS);
  });

  it("returns the default for a string key", async () => {
    const value = await getConfig("PROFILE_IMAGE_URL");
    expect(value).toBe(CONFIG_DEFAULT.PROFILE_IMAGE_URL);
  });

  it("returns the default for an array key", async () => {
    const value = await getConfig("ACTIVE_SCRIPTS");
    expect(value).toEqual(CONFIG_DEFAULT.ACTIVE_SCRIPTS);
  });

  it("returns a stored string value", async () => {
    await chrome.storage.local.set({ LOGTIME_EMOJI: "🍕" });
    const value = await getConfig("LOGTIME_EMOJI");
    expect(value).toBe("🍕");
  });

  it("returns a stored number value", async () => {
    await chrome.storage.local.set({ LOGTIME_GOAL_HOURS: 200 });
    const value = await getConfig("LOGTIME_GOAL_HOURS");
    expect(value).toBe(200);
  });

  it("returns a stored boolean value", async () => {
    await chrome.storage.local.set({ CLOUD_SYNC_ENABLED: true });
    const value = await getConfig("CLOUD_SYNC_ENABLED");
    expect(value).toBe(true);
  });

  it("parses a JSON-stringified array from storage (legacy compat)", async () => {
    await chrome.storage.local.set({
      ACTIVE_SCRIPTS: JSON.stringify(["logtime", "profile"]),
    });
    const value = await getConfig("ACTIVE_SCRIPTS");
    expect(value).toEqual(["logtime", "profile"]);
  });

  it("returns the default when stored value is undefined", async () => {
    await chrome.storage.local.set({ LOGTIME_GOAL_HOURS: undefined });
    const value = await getConfig("LOGTIME_GOAL_HOURS");
    expect(value).toBe(CONFIG_DEFAULT.LOGTIME_GOAL_HOURS);
  });
});

describe("setConfig", () => {
  it("round-trips a string key", async () => {
    await setConfig("LOGTIME_EMOJI", "🍕");
    expect(await getConfig("LOGTIME_EMOJI")).toBe("🍕");
  });

  it("stores legacy array keys as JSON strings", async () => {
    await setConfig("ACTIVE_SCRIPTS", ["logtime", "profile"]);
    const raw = await chrome.storage.local.get("ACTIVE_SCRIPTS");
    expect(raw.ACTIVE_SCRIPTS).toBe(JSON.stringify(["logtime", "profile"]));
    expect(await getConfig("ACTIVE_SCRIPTS")).toEqual(["logtime", "profile"]);
  });

  it("stores non-legacy array keys raw", async () => {
    await setConfig("PROFILE_BADGE_ORDER", ["A", "-B"]);
    const raw = await chrome.storage.local.get("PROFILE_BADGE_ORDER");
    expect(raw.PROFILE_BADGE_ORDER).toEqual(["A", "-B"]);
  });
});

describe("CLOUD_SYNC_KEYS", () => {
  it("includes the reorderable lists that must reach the cloud", () => {
    expect(CLOUD_SYNC_KEYS).toContain("SHORTCUTS_LINKS");
    expect(CLOUD_SYNC_KEYS).toContain("PROFILE_CARD_ORDER");
    expect(CLOUD_SYNC_KEYS).toContain("PROFILE_BADGE_ORDER");
    expect(CLOUD_SYNC_KEYS).toContain("PROFILE_BADGE_WRAP");
  });
});

describe("setConfigMany", () => {
  it("writes several keys in one call", async () => {
    await setConfigMany({ LOGTIME_EMOJI: "🌮", FRIENDS_LIST: ["alice"] });
    expect(await getConfig("LOGTIME_EMOJI")).toBe("🌮");
    expect(await getConfig("FRIENDS_LIST")).toEqual(["alice"]);
    const raw = await chrome.storage.local.get("FRIENDS_LIST");
    expect(raw.FRIENDS_LIST).toBe(JSON.stringify(["alice"]));
  });
});
