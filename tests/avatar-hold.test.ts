/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://profile-v3.intra.42.fr/" }
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

async function loadVisuals() {
  vi.resetModules();
  return import("../src/features/profile/visuals.ts");
}

describe("avatar hold", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    document.head.innerHTML = "";
  });

  it("installs a class-scoped rule, not an unconditional one", async () => {
    const { injectAvatarPendingRule, AVATAR_PENDING_CLASS } = await loadVisuals();
    injectAvatarPendingRule();

    const rule = document.getElementById("ft-avatar-pending-style")?.textContent;
    expect(rule).toContain(`html.${AVATAR_PENDING_CLASS}`);
    expect(rule).toContain("opacity: 0 !important");
  });

  it("toggles the class on <html>", async () => {
    const { holdAvatar, releaseAvatar, AVATAR_PENDING_CLASS } = await loadVisuals();

    holdAvatar();
    expect(document.documentElement.classList.contains(AVATAR_PENDING_CLASS)).toBe(
      true,
    );

    releaseAvatar();
    expect(document.documentElement.classList.contains(AVATAR_PENDING_CLASS)).toBe(
      false,
    );
  });

  it("needs a re-apply while a mounted avatar has no inline opacity", async () => {
    const { needsReapply } = await loadVisuals();
    document.body.innerHTML = `<div class="rounded-full w-52 h-52"></div>`;

    const urls = {
      avatar: "",
      banner: "",
      bannerMode: "",
      background: "",
      backgroundMode: "",
    };
    expect(needsReapply(urls)).toBe(true);

    const avatar = document.querySelector<HTMLElement>(".rounded-full.w-52");
    avatar!.style.setProperty("opacity", "1", "important");
    expect(needsReapply(urls)).toBe(false);
  });
});
