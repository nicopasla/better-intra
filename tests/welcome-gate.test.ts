/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://signin.intra.42.fr/" }
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../src/features/welcome/welcome.ui", () => ({
  openWelcome: vi.fn(async () => {}),
}));

import { maybeShowWelcome } from "../src/features/welcome/welcome";
import { openWelcome } from "../src/features/welcome/welcome.ui";

beforeEach(async () => {
  await chrome.storage.local.clear();
  vi.clearAllMocks();
});

describe("maybeShowWelcome on a non-profile host", () => {
  it("keeps PENDING_WELCOME and never opens the welcome", async () => {
    await chrome.storage.local.set({ PENDING_WELCOME: true });

    await maybeShowWelcome();

    const store = await chrome.storage.local.get("PENDING_WELCOME");
    expect(store.PENDING_WELCOME).toBe(true);
    expect(openWelcome).not.toHaveBeenCalled();
  });
});
