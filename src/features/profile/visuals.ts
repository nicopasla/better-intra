import { getConfig } from "../../config.ts";
import { getCloudLogin, fetchUserVisuals } from "../account/account.ts";
import { createSettingsModal } from "./profile.modal.ts";
import { applyThemeToProfileCard } from "./profile-card.ts";
import { applyPublicLogtimeSettings, initLogtime } from "../logtime/logtime.ts";

let isFetching = false;
let visualCache: any = null;
let lastUser: string | null = null;
let showingOriginalAvatar = false;
let originalAvatarUrl: string | null = null;

let lastAppliedUser: string | null = null;
let lastAppliedKey: string | null = null;

const getVisualKey = (urls: any) =>
  JSON.stringify({
    avatar: urls?.avatar || "",
    banner: urls?.banner || "",
    bannerMode: urls?.bannerMode || "",
    background: urls?.background || "",
    backgroundMode: urls?.backgroundMode || "",
    theme: urls?.theme || null,
    logtime: urls?.logtime || null,
  });

const hasBackground = (el: HTMLElement | null, url?: string) => {
  if (!url) return true;
  if (!el) return false;
  const inline = el.style.backgroundImage || "";
  const computed = window.getComputedStyle(el).backgroundImage || "";
  return inline.includes(url) || computed.includes(url);
};

const needsReapply = (urls: any) => {
  const avatar = document.querySelector(
    "div.rounded-full.w-52.h-52",
  ) as HTMLElement | null;
  const banner = document.querySelector(
    "div.border-neutral-600.bg-ft-gray\\/50",
  ) as HTMLElement | null;
  const background = document.querySelector(
    ".w-full.xl\\:h-72.bg-center.bg-cover.bg-ft-black",
  ) as HTMLElement | null;

  if (
    urls?.avatar &&
    !showingOriginalAvatar &&
    !hasBackground(avatar, urls.avatar)
  )
    return true;
  if (urls?.banner && !hasBackground(banner, urls.banner)) return true;
  if (urls?.background && !hasBackground(background, urls.background))
    return true;
  return false;
};

export const injectCustomStyles = () => {
  if (document.getElementById("ft-profile-host-styles")) return;
  const style = document.createElement("style");
  style.id = "ft-profile-host-styles";
  style.textContent = `
    .bg-ft-gray b,
      .bg-ft-gray span {font-size: 1.2rem !important;font-weight: bold !important;font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;}
      p.text-sm:nth-child(2) {font-size: 1.3rem !important;}
    #profile-modal-host { 
      position: fixed; inset: 0; z-index: 999999; 
      display: flex; align-items: flex-start; justify-content: center;
      pointer-events: auto; padding-top: 12vh;       
    }
    div.rounded-full.w-52.h-52,
    div.border-neutral-600.bg-ft-gray\\/50,
    .w-full.xl\\:h-72.bg-center.bg-cover.bg-ft-black {
      will-change: background-image, transform;
      transform: translate3d(0, 0, 0);
      backface-visibility: hidden;
    }
    .bg-mode-fill { background-size: cover !important; background-repeat: no-repeat !important; background-position: center !important; }
    .bg-mode-fit { background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important; }
    .bg-mode-stretch { background-size: 100% 100% !important; background-repeat: no-repeat !important; background-position: center !important; }
    .bg-mode-center { background-size: auto !important; background-repeat: no-repeat !important; background-position: center !important; }
    .bg-mode-tile { background-size: auto !important; background-repeat: repeat !important; background-position: top left !important; }

    .banner-mode-fill { background-size: cover !important; background-repeat: no-repeat !important; background-position: center !important; }
    .banner-mode-fit { background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important; }
    .banner-mode-stretch { background-size: 100% 100% !important; background-repeat: no-repeat !important; background-position: center !important; }
    .banner-mode-center { background-size: auto !important; background-repeat: no-repeat !important; background-position: center !important; }
    .banner-mode-tile { background-size: auto !important; background-repeat: repeat !important; background-position: top left !important; }
  `;
  document.head.appendChild(style);
};

export const applyImgs = async (urls: any) => {
  if (!urls) return;

  const avatar = document.querySelector(
    "div.rounded-full.w-52.h-52",
  ) as HTMLElement;
  const banner = document.querySelector(
    "div.border-neutral-600.bg-ft-gray\\/50",
  ) as HTMLElement;
  const background = document.querySelector(
    ".w-full.xl\\:h-72.bg-center.bg-cover.bg-ft-black",
  ) as HTMLElement;

  if (avatar && !originalAvatarUrl) {
    const inlineStyle = avatar.style.backgroundImage;
    if (
      inlineStyle &&
      inlineStyle !== "none" &&
      !inlineStyle.includes(urls.avatar)
    ) {
      const match = inlineStyle.match(/url\((['"]?)(.*?)\1\)/);
      if (match) originalAvatarUrl = match[2];
    }
    if (!originalAvatarUrl) {
      const computedBg = window.getComputedStyle(avatar).backgroundImage;
      if (
        computedBg &&
        computedBg !== "none" &&
        !computedBg.includes(urls.avatar)
      ) {
        const match = computedBg.match(/url\((['"]?)(.*?)\1\)/);
        if (match) originalAvatarUrl = match[2];
      }
    }
  }

  if (avatar && urls.avatar && !showingOriginalAvatar) {
    avatar.style.setProperty(
      "background-image",
      `url("${urls.avatar}")`,
      "important",
    );
    avatar.style.opacity = "1";
  }

  if (banner && urls.banner) {
    banner.style.setProperty(
      "background-image",
      `url("${urls.banner}")`,
      "important",
    );
    banner.classList.remove(
      "banner-mode-fill",
      "banner-mode-fit",
      "banner-mode-stretch",
      "banner-mode-center",
      "banner-mode-tile",
    );
    const bannerMode = urls.bannerMode || "fill";
    banner.classList.add(`banner-mode-${bannerMode}`);
  }

  if (background && urls.background) {
    background.style.setProperty(
      "background-image",
      `url("${urls.background}")`,
      "important",
    );
    background.classList.remove(
      "bg-mode-fill",
      "bg-mode-fit",
      "bg-mode-stretch",
      "bg-mode-center",
      "bg-mode-tile",
    );
    const bgMode = urls.backgroundMode || "fill";
    background.classList.add(`bg-mode-${bgMode}`);
  }

  if (urls.theme) {
    applyThemeToProfileCard(urls.theme);
  }

  if (urls.logtime) {
    await initLogtime();
    applyPublicLogtimeSettings(urls.logtime);
  }
};

export const updateVisuals = async () => {
  const pathParts = location.pathname.split("/").filter((p) => p);
  injectCustomStyles();

  const avatarEl = document.querySelector(
    "div.rounded-full.w-52.h-52",
  ) as HTMLElement;

  if (avatarEl && !showingOriginalAvatar && !visualCache) {
    avatarEl.style.opacity = "1";
  }

  let myLogin = await getCloudLogin();
  if (!myLogin) myLogin = "me";

  const targetLogin =
    pathParts[0] === "users" && pathParts[1] ? pathParts[1] : myLogin;

  if (targetLogin !== lastUser) {
    visualCache = null;
    originalAvatarUrl = null;
    showingOriginalAvatar = false;
    lastUser = targetLogin;
    isFetching = false;
    lastAppliedUser = null;
    lastAppliedKey = null;
    if (avatarEl) avatarEl.style.opacity = "1";
  }

  if (!avatarEl) return;

  if (targetLogin === myLogin) {
    if (!avatarEl.dataset.modalListener) {
      avatarEl.dataset.modalListener = "true";
      avatarEl.style.cursor = "pointer";
      avatarEl.addEventListener("click", (e) => {
        e.stopPropagation();
        createSettingsModal((updatedVisuals) => {
          visualCache = updatedVisuals;
          applyImgs(visualCache);
          lastAppliedUser = targetLogin;
          lastAppliedKey = getVisualKey(visualCache);
        });
      });
    }
  }

  if (visualCache) {
    const key = getVisualKey(visualCache);
    const reapply = needsReapply(visualCache);
    if (lastAppliedUser === targetLogin && lastAppliedKey === key && !reapply)
      return;

    await applyImgs(visualCache);
    lastAppliedUser = targetLogin;
    lastAppliedKey = key;
    return;
  }

  if (!isFetching) {
    if (targetLogin === myLogin) {
      visualCache = {
        avatar: await getConfig("PROFILE_IMAGE_URL"),
        banner: await getConfig("PROFILE_BANNER_URL"),
        bannerMode: await getConfig("PROFILE_BANNER_MODE"),
        background: await getConfig("PROFILE_BACKGROUND_URL"),
        backgroundMode: await getConfig("PROFILE_BACKGROUND_MODE"),
      };

      if (!visualCache.avatar) {
        avatarEl.style.opacity = "1";
      } else {
        await applyImgs(visualCache);
        lastAppliedUser = targetLogin;
        lastAppliedKey = getVisualKey(visualCache);
      }
    } else {
      isFetching = true;
      const cloudUrls = await fetchUserVisuals(targetLogin);

      if (
        cloudUrls &&
        (cloudUrls.avatar || cloudUrls.banner || cloudUrls.background)
      ) {
        visualCache = cloudUrls;
        await applyImgs(visualCache);
        lastAppliedUser = targetLogin;
        lastAppliedKey = getVisualKey(visualCache);

        if (!avatarEl.dataset.toggleListener) {
          avatarEl.dataset.toggleListener = "true";
          avatarEl.style.cursor = "pointer";
          avatarEl.title = "Click to view original avatar";

          avatarEl.addEventListener("click", (e) => {
            e.stopPropagation();
            const currentAvatar = document.querySelector(
              "div.rounded-full.w-52.h-52",
            ) as HTMLElement;
            if (!currentAvatar) return;

            if (showingOriginalAvatar) {
              showingOriginalAvatar = false;
              if (visualCache?.avatar) {
                currentAvatar.style.setProperty(
                  "background-image",
                  `url("${visualCache.avatar}")`,
                  "important",
                );
              }
            } else {
              showingOriginalAvatar = true;
              if (originalAvatarUrl) {
                currentAvatar.style.setProperty(
                  "background-image",
                  `url("${originalAvatarUrl}")`,
                  "important",
                );
              }
            }
          });
        }
      } else {
        avatarEl.style.opacity = "1";
      }
    }
  }
};
