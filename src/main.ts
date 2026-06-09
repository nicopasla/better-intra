import { initLogtime } from "./features/logtime/logtime.ts";
import { initClusters } from "./features/clusters/clusters.ts";
import { initProfile } from "./features/profile/profile.ts";
import { initHubSettings } from "./features/hub/hubSettings.ts";
import { initShortcuts } from "./features/shortcuts/shortcuts.ts";
import { getConfig } from "./config.ts";
import { initThemeManager } from "./features/profile/theme/theme-manager.ts";

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
        if (node.matches?.("div.rounded-full.w-52.h-52")) target = node;
        else target = node.querySelector?.("div.rounded-full.w-52.h-52");
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
  const el = document.querySelector<HTMLElement>("div.rounded-full.w-52.h-52");
  if (el) el.style.setProperty("opacity", "1", "important");
}, 5000);

/**
 * A map that links feature ID strings to their initialization functions.
 * This prevents the need for a long list of if-statements and makes adding
 * new features cleaner.
 */
const featureInitializers: { [key: string]: () => Promise<void> } = {
  logtime: initLogtime,
  clusters: initClusters,
  profile: initProfile,
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
    window.close();
    return;
  }

  const waitForIntra = async () => {
    const target =
      document.getElementById("root") ||
      document.querySelector("div.rounded-full.w-52.h-52") ||
      document.querySelector("body");

    if (target) {
      try {
        // Hub settings are always initialized for the settings page.
        await initHubSettings();

        // Get the list of scripts the user has enabled.
        const activeScripts = await getConfig("ACTIVE_SCRIPTS");

        // Loop through the user's active scripts and initialize them if they exist in our map.
        for (const scriptId of activeScripts) {
          if (featureInitializers[scriptId]) {
            await featureInitializers[scriptId]();
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
