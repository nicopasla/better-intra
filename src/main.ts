import { initHubSettings } from "./features/hub/hubSettings.ts";
import {
  initThemeManager,
  getIsLight,
} from "./features/profile/theme/theme-manager.ts";
import { maybeShowWelcome } from "./features/welcome/welcome.ts";
import { initGlobalTooltips } from "./utils/tooltip.ts";
import { ensureCampusData } from "./features/campus/campus.ts";
import {
  holdAvatar,
  injectAvatarPendingRule,
  releaseAvatar,
  updateNavAvatar,
} from "./features/profile/visuals.ts";
import { AVATAR_SELECTOR } from "./features/profile/selectors.ts";
import { initAnnouncementBanner } from "./features/announcement/announcement.ts";
import {
  clearAuthFlow,
  peekAuthFlow,
} from "./features/account/auth-callback.ts";
import { initFontManager } from "./utils/font-manager.ts";
import { html, render } from "lit-html";

void (async () => {
  try {
    const { maybeMergeCloud } = await import("./features/account/account.ts");
    await maybeMergeCloud();
  } catch {
    // merging is best-effort
  }

  const { CLOUD_SYNC_DEFAULT_MIGRATED } = await chrome.storage.local.get(
    "CLOUD_SYNC_DEFAULT_MIGRATED",
  );
  if (!CLOUD_SYNC_DEFAULT_MIGRATED) {
    await chrome.storage.local.set({
      CLOUD_SYNC_DEFAULT_MIGRATED: true,
      CLOUD_SYNC_ENABLED: true,
    });
  }

  initThemeManager();
  void initAnnouncementBanner();
  initGlobalTooltips(getIsLight);
  void initFontManager();
})();

// Hold the avatar before React paints, so the Intra picture cannot flash
// before the visuals are applied. Released below when profile is off.
injectAvatarPendingRule();
holdAvatar();

const HOSTNAME = window.location.hostname;
const IS_PROFILE_V3 = HOSTNAME === "profile-v3.intra.42.fr";
const IS_PROFILE_HOST =
  HOSTNAME === "profile-v3.intra.42.fr" || HOSTNAME === "profile.intra.42.fr";
const IS_PROJECTS = HOSTNAME === "projects.intra.42.fr";

// Feature code is loaded on demand and only on the hosts that use it, so the
// heavy profile/logtime/clusters bundles are never fetched elsewhere.
const featureInitializers: { [key: string]: () => Promise<void> } = {
  profile: () =>
    IS_PROFILE_V3 || IS_PROJECTS
      ? import("./features/profile/profile.ts").then((m) => m.initProfile())
      : Promise.resolve(),
  logtime: () =>
    IS_PROFILE_V3
      ? import("./features/logtime/logtime.ts").then((m) => m.initLogtime())
      : Promise.resolve(),
  shortcuts: () =>
    IS_PROFILE_HOST
      ? import("./features/shortcuts/shortcuts.ts").then((m) =>
          m.initShortcuts(),
        )
      : Promise.resolve(),
};

(function v2Warning() {
  if (window.location.hostname !== "profile.intra.42.fr") return;
  if (window.location.pathname !== "/") return;
  if (sessionStorage.getItem("ft-v2-dismissed") === "1") return;

  const dismiss = () => {
    const el = document.getElementById("ft-v2-warning");
    if (el) el.remove();
    sessionStorage.setItem("ft-v2-dismissed", "1");
  };

  const banner = document.createElement("div");
  banner.id = "ft-v2-warning";

  render(
    html`
      <style>
        #ft-v2-warning {
          position: relative;
          z-index: 999999;
        }
        .ft-v2-bnr {
          background: #ff9800;
          color: #fff;
          padding: 10px 20px;
          text-align: center;
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
          position: relative;
        }
        .ft-v2-bnr a {
          color: #fff;
          font-weight: 700;
        }
        .ft-v2-dismiss {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 20px;
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: inherit;
          opacity: 0.6;
          line-height: 1;
          padding: 4px 8px;
        }
        .ft-v2-dismiss:hover {
          opacity: 1;
        }
      </style>
      <div class="ft-v2-bnr">
        Better Intra is designed for the
        <strong>v3</strong> profile. You are on the old v2.
        <a href="https://profile.intra.42.fr/v3_early_access">Switch to v3</a>
        <button class="ft-v2-dismiss" @click="${dismiss}" data-tip="Dismiss">
          &times;
        </button>
      </div>
    `,
    banner,
  );

  const tryInject = () => {
    if (document.body) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      requestAnimationFrame(tryInject);
    }
  };
  tryInject();
})();

(async function runBetterIntra() {
  // The worker currently returns the result in the query string. Also accept
  // it in the URL fragment (#token=...&login=...): fragments never reach the
  // intra servers or their logs, so the worker can switch to them at any time.
  const oauthParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  );
  const oauthToken = oauthParams.get("token") ?? hashParams.get("token");
  const oauthLogin = oauthParams.get("login") ?? hashParams.get("login");
  if (oauthToken && oauthLogin) {
    // Only trust the callback if this extension started a login recently.
    // Otherwise any intra link with ?token=&login= could hijack the account.
    if (!(await peekAuthFlow("cloud"))) {
      console.warn(
        "Better Intra: ignoring unexpected auth callback (no login in progress).",
      );
      history.replaceState(null, "", window.location.pathname);
      return;
    }
    await chrome.storage.local.set({
      CLOUD_TOKEN: oauthToken,
      CLOUD_LOGIN: oauthLogin,
      PENDING_SETTINGS_RESTORE: true,
    });
    await chrome.storage.local.remove("CLOUD_AUTH_FAILED");
    await clearAuthFlow("cloud");
    history.replaceState(null, "", window.location.pathname);
    window.opener?.postMessage(
      { type: "42_AUTH_SUCCESS", token: oauthToken, login: oauthLogin },
      window.location.origin,
    );
    window.close();
    return;
  }

  const discordId =
    oauthParams.get("discord_id") ?? hashParams.get("discord_id");
  const discordUsername =
    oauthParams.get("discord_username") ?? hashParams.get("discord_username");
  if (discordId) {
    if (!(await peekAuthFlow("discord"))) {
      console.warn(
        "Better Intra: ignoring unexpected Discord callback (no link in progress).",
      );
      history.replaceState(null, "", window.location.pathname);
      return;
    }
    await chrome.storage.local.set({
      DISCORD_ID: discordId,
      DISCORD_ENABLED: true,
      DISCORD_USERNAME: discordUsername || "",
    });
    await clearAuthFlow("discord");
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
        if (IS_PROJECTS) {
          void import("./features/subjects/tracker.ts").then((m) =>
            m.initSubjectTracker(),
          );
        }

        // Hub settings are always initialized for the settings page.
        // initHubSettings returns the active feature list.
        const activeScripts = await initHubSettings();

        // Only the profile feature reveals the avatar; otherwise show the Intra one.
        if (!activeScripts.includes("profile")) releaseAvatar();

        await ensureCampusData();
        updateNavAvatar();

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

        const pendingRestore = await chrome.storage.local.get(
          "PENDING_SETTINGS_RESTORE",
        );
        if (pendingRestore.PENDING_SETTINGS_RESTORE) {
          const { maybePromptRestore } =
            await import("./features/account/account.ts");
          await maybePromptRestore();
        }

        const { maybePromptConflict } =
          await import("./features/account/account.ts");
        await maybePromptConflict();

        await maybeShowWelcome();
      } catch (error) {
        releaseAvatar();
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
