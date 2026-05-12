import { initLogtime } from "./features/logtime/logtime.ts";
import { initClusters } from "./features/clusters/clusters.ts";
import { initProfile } from "./features/profile/profile.ts";
import { initHubSettings } from "./features/hub/hubSettings.ts";
import { initShortcuts } from "./features/shortcuts/shortcuts.ts";

const bootstrap = async () => {
  console.log("Better Intra started...");

  const active = initHubSettings();

  const enabled = (id: "logtime" | "clusters" | "profile" | "shortcuts") =>
    active.includes(id);

  try {
    if (enabled("logtime")) await initLogtime();
  } catch (e) {
    console.error("[initLogtime] failed:", e);
  }

  try {
    if (enabled("clusters")) await initClusters();
  } catch (e) {
    console.error("[initClusters] failed:", e);
  }

  try {
    if (enabled("profile")) await initProfile();
  } catch (e) {
    console.error("[initProfile] failed:", e);
  }

  try {
    if (enabled("shortcuts")) {
      await initShortcuts();
    }
  } catch (e) {
    console.error("[initShortcuts] failed:", e);
  }
};

bootstrap().catch((e) => console.error("[bootstrap] failed:", e));
