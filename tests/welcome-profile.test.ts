/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://profile-v3.intra.42.fr/" }
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../src/features/welcome/welcome.ui", () => ({
  openWelcome: vi.fn(async () => {}),
}));

import { maybeShowWelcome } from "../src/features/welcome/welcome";
import { openWelcome } from "../src/features/welcome/welcome.ui";

function mountProfileShell() {
  const avatar = document.createElement("div");
  avatar.className = "rounded-full w-52 h-52";
  document.body.appendChild(avatar);
}

beforeEach(async () => {
  document.body.innerHTML = "";
  await chrome.storage.local.clear();
  vi.clearAllMocks();
});

describe("maybeShowWelcome on the v3 profile", () => {
  it("opens and clears PENDING_WELCOME once the profile shell exists", async () => {
    mountProfileShell();
    await chrome.storage.local.set({ PENDING_WELCOME: true });

    await maybeShowWelcome();

    expect(openWelcome).toHaveBeenCalledTimes(1);
    const store = await chrome.storage.local.get("PENDING_WELCOME");
    expect(store.PENDING_WELCOME).toBeUndefined();
  });

  it("does nothing when no welcome is pending", async () => {
    mountProfileShell();

    await maybeShowWelcome();

    expect(openWelcome).not.toHaveBeenCalled();
  });
});
