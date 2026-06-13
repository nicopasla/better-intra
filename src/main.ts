import { initLogtime } from "./features/logtime/logtime.ts";
import { initClusters } from "./features/clusters/clusters.ts";
import { initProfile } from "./features/profile/profile.ts";
import { initHubSettings } from "./features/hub/hubSettings.ts";
import { initShortcuts } from "./features/shortcuts/shortcuts.ts";
import { getConfig } from "./config.ts";
import { initThemeManager } from "./features/profile/theme/theme-manager.ts";
import { AVATAR_SELECTOR } from "./features/profile/selectors.ts";

initThemeManager();

{
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("hook.js");
  (document.head || document.documentElement).appendChild(s);
  s.remove();
}

{
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        let target: HTMLElement | null = null;
        if (node.matches?.(AVATAR_SELECTOR)) target = node;
        else target = node.querySelector?.(AVATAR_SELECTOR);
        if (target) {
          target.style.setProperty("opacity", "0", "important");
          obs.disconnect();
          return;
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

setTimeout(() => {
  const el = document.querySelector<HTMLElement>(AVATAR_SELECTOR);
  if (el) el.style.setProperty("opacity", "1", "important");
}, 5000);

/**
 * A map that links feature ID strings to their initialization functions.
 * This prevents the need for a long list of if-statements and makes adding
 * new features cleaner.
 */
const featureInitializers: { [key: string]: () => Promise<void> } = {
  profile: initProfile,
  logtime: initLogtime,
  clusters: initClusters,
  shortcuts: initShortcuts,
};

(async function runBetterIntra() {
  const oauthParams = new URLSearchParams(window.location.search);
  const oauthToken = oauthParams.get("token");
  const oauthLogin = oauthParams.get("login");
  if (oauthToken && oauthLogin) {
    await chrome.storage.local.set({
      CLOUD_TOKEN: oauthToken,
      CLOUD_LOGIN: oauthLogin,
    });
    history.replaceState(null, "", window.location.pathname);
    window.close();
    return;
  }

  const waitForIntra = async () => {
    const target =
      document.getElementById("root") ||
      document.querySelector(AVATAR_SELECTOR) ||
      document.querySelector("body");

    if (target) {
      try {
        // Hub settings are always initialized for the settings page.
        // initHubSettings returns the active feature list.
        const activeScripts = await initHubSettings();

        // Loop through the user's active scripts and initialize them if they exist in our map.
        for (const scriptId of activeScripts) {
          const init = featureInitializers[scriptId];
          if (init) {
            try {
              await init();
            } catch (e) {
              console.error(`Feature "${scriptId}" failed to initialize:`, e);
            }
          }
        }
      } catch (error) {
        console.error("Error during init of Better Intra :", error);
      }
    } else {
      setTimeout(() => {
        void waitForIntra();
      }, 100);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => waitForIntra());
  } else {
    waitForIntra();
  }
})();
