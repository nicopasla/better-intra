// ==UserScript==
// @name         42 Intra Profile
// @namespace    https://github.com/nicopasla/42-userscripts
// @version      0.0.1
// @updateURL	   https://raw.githubusercontent.com/nicopasla/42-userscripts/main/profile.user.js
// @license      MIT
// @author       nicopasla
// @description  Replace your profile and background pics
// @match        https://profile-v3.intra.42.fr/
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const getSettings = () => ({
    img: localStorage.getItem("custom-42-img-url"),
    bg: localStorage.getItem("custom-42-bg-url"),
  });
  const INTRA_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  const isValidUrl = (url) => {
    if (!url) return false;

    try {
      const u = new URL(url.trim());

      if (!["http:", "https:"].includes(u.protocol)) return false;
      if (!u.hostname) return false;

      return /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(u.pathname);
    } catch {
      return false;
    }
  };

  const injectStyles = () => {
    if (document.getElementById("custom-42-styles")) return;
    const style = document.createElement("style");
    style.id = "custom-42-styles";
    style.textContent = `
            .bg-ft-gray b { font-size: 1rem !important; margin-right: 5px; font-family: ${INTRA_FONT};}
            .bg-ft-gray span { font-size: 1.2rem !important; font-weight: bold !important; font-family: ${INTRA_FONT};}
            .user-primary h1, .user-name { font-size: 2.5rem !important; font-family: ${INTRA_FONT};}
            .custom-clickable-avatar { cursor: pointer !important; transition: filter 0.2s; }
            .custom-clickable-avatar:hover { filter: brightness(0.8); }
        `;
    document.head.appendChild(style);
  };

  const createSettingsModal = () => {
    if (document.getElementById("profile-settings-modal")) return;
    const modal = document.createElement("div");
    modal.id = "profile-settings-modal";
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: none; align-items: center; justify-content: center; z-index: 10000; font-family: ${INTRA_FONT};`;

    const initial = getSettings();

    modal.innerHTML = `
            <div style="background: white; border-radius: 12px; max-width: 350px; width: 90%; overflow: visible; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); position: relative;">
                <div style="padding: 15px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b; display: flex; justify-content: space-between; align-items: center;">
                    Profile Settings
                    <button id="reset-urls" style="background: transparent; border: 1px solid #cbd5e1; color: #64748b; font-size: 10px; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-weight: 600;">RESTORE DEFAULTS</button>
                    <button id="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;">&times;</button>
                </div>
                <div style="padding: 15px; display: flex; flex-direction: column; gap: 12px;">
                    <label style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Profile Image URL</label>
                    <input type="text" id="set-img-url" value="${initial.img || ""}" placeholder="GIF/PNG/JPG" style="padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; width: 100%; box-sizing: border-box;">
                    <label style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Background Image URL</label>
                    <input type="text" id="set-bg-url" value="${initial.bg || ""}" placeholder="GIF/PNG/JPG" style="padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; width: 100%; box-sizing: border-box;">
                </div>
                <div style="padding: 15px; border-top: 1px solid #e2e8f0;">
                    <button id="save-42-cfg" style="width: 100%; padding: 10px; background: #00BCBA; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">SAVE & RELOAD</button>
                </div>
            </div>`;

    document.body.appendChild(modal);

    const inputImg = modal.querySelector("#set-img-url");
    const inputBg = modal.querySelector("#set-bg-url");

    const liveUpdate = () => {
      const avatar = document.querySelector(
        'div.rounded-full[style*="background-image"]',
      );
      const banner = document.querySelector(
        "div.border-neutral-600.bg-ft-gray\\/50",
      );

      if (avatar) {
        const url = inputImg.value.trim();
        avatar.style.backgroundImage = isValidUrl(url)
          ? `url("${url}")`
          : avatar.dataset.orig || "";
      }
      if (banner) {
        const url = inputBg.value.trim();
        banner.style.backgroundImage = isValidUrl(url)
          ? `url("${url}")`
          : banner.dataset.orig || "";
      }
    };

    inputImg.oninput = liveUpdate;
    inputBg.oninput = liveUpdate;

    modal.querySelector("#save-42-cfg").onclick = () => {
      localStorage.setItem("custom-42-img-url", inputImg.value.trim());
      localStorage.setItem("custom-42-bg-url", inputBg.value.trim());
      location.reload();
    };

    modal.querySelector("#reset-urls").onclick = () => {
      if (confirm("Reset profile and background?")) {
        localStorage.removeItem("custom-42-img-url");
        localStorage.removeItem("custom-42-bg-url");
        location.reload();
      }
    };

    modal.querySelector("#close-modal").onclick = () => {
      modal.style.display = "none";
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.style.display = "none";
    };
  };

  const updateUI = () => {
    const avatar = document.querySelector(
      'div.rounded-full[style*="background-image"]',
    );
    const bannerContainer = document.querySelector(
      "div.border-neutral-600.bg-ft-gray\\/50",
    );
    const settings = getSettings();

    if (avatar && !avatar.dataset.customized) {
      avatar.dataset.orig = avatar.style.backgroundImage;
      if (isValidUrl(settings.img)) {
        avatar.style.backgroundImage = `url("${settings.img}")`;
        avatar.style.backgroundSize = "cover";
      }
      avatar.classList.add("custom-clickable-avatar");
      avatar.onclick = (e) => {
        e.stopPropagation();
        const m = document.getElementById("profile-settings-modal");
        if (m) m.style.display = "flex";
      };
      avatar.dataset.customized = "true";
    }

    if (bannerContainer && !bannerContainer.dataset.customized) {
      bannerContainer.dataset.orig = bannerContainer.style.backgroundImage;
      if (isValidUrl(settings.bg)) {
        bannerContainer.style.backgroundImage = `url("${settings.bg}")`;
        bannerContainer.style.backgroundSize = "cover";
        bannerContainer.style.backgroundPosition = "center";
      }
      bannerContainer.dataset.customized = "true";
    }

    return !!(
      avatar?.dataset.customized && bannerContainer?.dataset.customized
    );
  };

  injectStyles();
  createSettingsModal();

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const done = updateUI();
      if (done) observer.disconnect();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
