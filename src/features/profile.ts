import { gmGetValue } from "../lib/gm.ts";
import { updateEventFilters } from "./events.ts";

export async function initProfile() {
  "use strict";

  if (
    location.origin !== "https://profile-v3.intra.42.fr" ||
    location.pathname !== "/"
  )
    return;

  const getSettings = async () => ({
    avatar_url: await gmGetValue<string | null>("PROFILE_IMAGE_URL", null),
    banner_url: await gmGetValue<string | null>("PROFILE_BANNER_URL", null),
    background_url: await gmGetValue<string | null>("PROFILE_BACKGROUND_URL", null),
    slots_redirection: await gmGetValue<boolean>("PROFILE_SLOTS_REDIRECTION", true),
    campus_mode: await gmGetValue<string>("PROFILE_CAMPUS_FILTER", "all"),
    event_filter_mode: await gmGetValue<string>("PROFILE_EVENT_TYPE_FILTER", "all"),
  });

  const findAvatar = () =>
    document.querySelector('div.rounded-full[style*="background-image"]') as HTMLElement | null;

  const findBanner = () =>
    document.querySelector("div.border-neutral-600.bg-ft-gray\\/50") as HTMLElement | null;

  const findBackground = () =>
    document.querySelector(".w-full.xl\\:h-72.bg-center.bg-cover.bg-ft-black.flex.xl\\:flex-row.text-white") as HTMLElement | null;

  const findSlotsButton = () =>
    document.querySelector('a[href="https://profile.intra.42.fr/slots"]') as HTMLAnchorElement | null;

  const updateUI = async () => {
    const settings = await getSettings();
    const avatar = findAvatar();
    const banner = findBanner();
    const background = findBackground();
    const slotsBtn = findSlotsButton();
    await updateEventFilters();

    if (slotsBtn && settings.slots_redirection && !slotsBtn.dataset.customized) {
      slotsBtn.href = "https://slots.42belgium.be/slots";
      slotsBtn.target = "_blank";
      slotsBtn.rel = "noopener noreferrer";
      slotsBtn.dataset.customized = "true";
    }

    if (avatar && !avatar.dataset.customized) {
      if (settings.avatar_url) {
        avatar.style.setProperty("background-image", `url("${settings.avatar_url}")`, "important");
        avatar.style.backgroundSize = "cover";
      }
      avatar.dataset.customized = "true";
    }

    if (banner && !banner.dataset.customized) {
      if (settings.banner_url) {
        banner.style.setProperty("background-image", `url("${settings.banner_url}")`, "important");
        banner.style.backgroundSize = "cover";
        banner.style.backgroundPosition = "center";
      }
      banner.dataset.customized = "true";
    }

    if (background) {
      if (settings.background_url) {
        background.style.setProperty("background-image", `url("${settings.background_url}")`, "important");
        background.style.backgroundSize = "cover";
        background.style.backgroundPosition = "center";
      }
      background.dataset.customized = "true";
    }
  };

  const observer = new MutationObserver(() =>
    requestAnimationFrame(() => updateUI()),
  );

  observer.observe(document.body, { childList: true, subtree: true });
  updateUI();
}