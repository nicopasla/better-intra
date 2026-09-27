/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  initProfileCardStyling,
  seedBadgeHostColor,
} from "../src/features/profile/profile-card";

const SHADOW_HOST_ID = "profile-badges-shadow";
const INFO_CARD_ID = "ft-info-card";

function mountProfileCard() {
  document.body.innerHTML = `
    <div id="ft-profile-card-test">
      <div class="flex flex-col lg:flex-row">
        <p class="text-sm">me</p>
        <h1 class="text-4xl" style="color: rgb(1, 2, 3)">07</h1>
        <div class="border-t-neutral-600">
          <div><b>Wallet</b><span>&#8381; 100</span></div>
          <div><b>Ev.P</b><span>5</span></div>
          <div><b>Level</b><span>7.0</span></div>
        </div>
      </div>
    </div>`;
}

beforeEach(async () => {
  document.body.innerHTML = "";
  document.head.querySelectorAll("style").forEach((s) => s.remove());
  await chrome.storage.local.clear();
  await chrome.storage.local.set({
    PROFILE_THEME_PRESET: "dark",
    PROFILE_USE_MODERN_INFO_CARD: true,
    PROFILE_USE_CUSTOM_COLOR: true,
    LOGTIME_CALENDAR_COLOR: "#123456",
    PROFILE_LEVEL_NO_PADDING: false,
  });
});

describe("seedBadgeHostColor", () => {
  it("copies the accent variables onto the badge host", () => {
    const card = document.createElement("div");
    card.style.setProperty("--user-color", "#abcdef");
    card.style.setProperty("--user-color-translucent", "#abcdef33");
    const host = document.createElement("div");

    seedBadgeHostColor(host, card);

    expect(host.style.getPropertyValue("--user-color")).toBe("#abcdef");
    expect(host.style.getPropertyValue("--user-color-translucent")).toBe(
      "#abcdef33",
    );
  });

  it("leaves the host untouched when no accent is set", () => {
    const host = document.createElement("div");
    seedBadgeHostColor(host, document.createElement("div"));
    expect(host.style.getPropertyValue("--user-color")).toBe("");
  });
});

describe("initProfileCardStyling accent", () => {
  it("seeds the info card with the custom color from the first render", async () => {
    mountProfileCard();
    await initProfileCardStyling();

    const host = document.getElementById(SHADOW_HOST_ID) as HTMLElement | null;
    expect(host).not.toBeNull();
    expect(host!.style.getPropertyValue("--user-color")).toBe("#123456");
    expect(host!.style.getPropertyValue("--user-color-translucent")).toBe(
      "#12345633",
    );
    expect(host!.shadowRoot?.getElementById(INFO_CARD_ID)).not.toBeNull();
  });

  it("falls back to the level color when custom color is disabled", async () => {
    await chrome.storage.local.set({ PROFILE_USE_CUSTOM_COLOR: false });
    mountProfileCard();
    await initProfileCardStyling();

    const host = document.getElementById(SHADOW_HOST_ID) as HTMLElement | null;
    expect(host).not.toBeNull();
    expect(host!.style.getPropertyValue("--user-color")).toBe("#010203");
  });
});
