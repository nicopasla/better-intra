import { getConfig } from "../../config.ts";
import { getCloudLogin, fetchUserVisuals } from "../account/account.ts";
import { createSettingsModal } from "./profile.modal.ts";

let isFetching = false;
let visualCache: any = null;
let lastUser: string | null = null;
let showingOriginalAvatar = false;
let originalAvatarUrl: string | null = null;

export const injectCustomStyles = () => {
  if (document.getElementById("ft-profile-host-styles")) return;
  const style = document.createElement("style");
  style.id = "ft-profile-host-styles";
  style.textContent = `
    .bg-ft-gray b, .bg-ft-gray span { font-size: 1.2rem !important; font-weight: bold !important; }
    #profile-modal-host { 
      position: fixed; inset: 0; z-index: 999999; 
      display: flex; align-items: flex-start; justify-content: center;
      pointer-events: auto; padding-top: 12vh;       
    }
  `;
  document.head.appendChild(style);
};

const getInlineUrl = (el: HTMLElement | null): string => {
  if (!el) return "";
  const bg = window.getComputedStyle(el).backgroundImage;
  if (!bg || bg === "none") return "";
  const match = bg.match(/url\((['"]?)(.*?)\1\)/);
  return match ? match[2] : "";
};

export const applyImgs = (urls: any) => {
  if (!urls) return;

  const avatar = document.querySelector(
    "div.rounded-full.w-52.h-52",
  ) as HTMLElement;
  const banner = document.querySelector(
    "div.border-neutral-600.bg-ft-gray\\/50",
  );
  const background = document.querySelector(
    ".w-full.xl\\:h-72.bg-center.bg-cover.bg-ft-black",
  );

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

  if (banner && urls.banner)
    (banner as HTMLElement).style.setProperty(
      "background-image",
      `url("${urls.banner}")`,
      "important",
    );
  if (background && urls.background)
    (background as HTMLElement).style.setProperty(
      "background-image",
      `url("${urls.background}")`,
      "important",
    );
};

export const updateVisuals = async () => {
  const pathParts = location.pathname.split("/").filter((p) => p);
  injectCustomStyles();

  const avatarEl = document.querySelector(
    "div.rounded-full.w-52.h-52",
  ) as HTMLElement;

  if (avatarEl && !showingOriginalAvatar && !visualCache) {
    avatarEl.style.opacity = "0";
  }

  if (visualCache && !showingOriginalAvatar) {
    applyImgs(visualCache);
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
        });
      });
    }
  }

  if (visualCache) {
    applyImgs(visualCache);
    return;
  }

  if (!isFetching) {
    if (targetLogin === myLogin) {
      visualCache = {
        avatar: await getConfig("PROFILE_IMAGE_URL"),
        banner: await getConfig("PROFILE_BANNER_URL"),
        background: await getConfig("PROFILE_BACKGROUND_URL"),
      };

      if (!visualCache.avatar) {
        avatarEl.style.opacity = "1";
      } else {
        applyImgs(visualCache);
      }
    } else {
      isFetching = true;
      const cloudUrls = await fetchUserVisuals(targetLogin);

      if (
        cloudUrls &&
        (cloudUrls.avatar || cloudUrls.banner || cloudUrls.background)
      ) {
        visualCache = cloudUrls;
        applyImgs(visualCache);

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
