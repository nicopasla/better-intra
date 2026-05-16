import { initLogtime } from "./features/logtime/logtime.ts";
import { initClusters } from "./features/clusters/clusters.ts";
import { initProfile } from "./features/profile/profile.ts";
import { initHubSettings } from "./features/hub/hubSettings.ts";
import { initShortcuts } from "./features/shortcuts/shortcuts.ts";
import { getConfig } from "./config.ts";

(async function runBetterIntra() {
  const waitForIntra = async () => {
    const target =
      document.getElementById("root") ||
      document.querySelector("div.rounded-full.w-52.h-52") ||
      document.querySelector("body");

    if (target) {
      try {
        await initHubSettings();

        const activeRaw = await getConfig("ACTIVE_SCRIPTS");
        const active: string[] =
          typeof activeRaw === "string" ? JSON.parse(activeRaw) : activeRaw;
        const enabled = (id: string) =>
          Array.isArray(active) && active.includes(id);

        if (enabled("logtime")) await initLogtime();
        if (enabled("clusters")) await initClusters();
        if (enabled("profile")) await initProfile();
        if (enabled("shortcuts")) await initShortcuts();
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
