import { describe, it, expect, beforeEach } from "vitest";
import { getConfig, CONFIG_DEFAULT } from "../src/config";

beforeEach(() => {
  (chrome.storage.local.clear as any)();
});

describe("getConfig", () => {
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
    await chrome.storage.local.set({ ACTIVE_SCRIPTS: JSON.stringify(["logtime", "profile"]) });
    const value = await getConfig("ACTIVE_SCRIPTS");
    expect(value).toEqual(["logtime", "profile"]);
  });

  it("returns the default when stored value is undefined", async () => {
    await chrome.storage.local.set({ LOGTIME_GOAL_HOURS: undefined });
    const value = await getConfig("LOGTIME_GOAL_HOURS");
    expect(value).toBe(CONFIG_DEFAULT.LOGTIME_GOAL_HOURS);
  });
});
