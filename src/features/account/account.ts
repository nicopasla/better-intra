import generateRandomUsername from "generate-random-username";
import { BetterIntraConfig, getConfig, CLOUD_SYNC_KEYS } from "../../config.ts";
import type { VisualUrls } from "../profile/visuals.ts";
import { hashLogin } from "../../utils/crypto.ts";
import {
  showAlertDialog,
  showConfirmDialog,
} from "../../utils/confirm-dialog.ts";
import { markAuthFlowPending } from "./auth-callback.ts";
import { sanitizeVisualUrls } from "../profile/visuals-sanitize.ts";
import { mergeSettings } from "./merge.ts";

export { hashLogin };

const WORKER_URL = "https://api.betterintra.com";

async function handleAuthResponse(response: Response): Promise<boolean> {
  if (response.status === 401) {
    await chrome.storage.local.set({ CLOUD_AUTH_FAILED: true });
    return false;
  }
  return response.ok;
}

export async function clearAuthFailed(): Promise<void> {
  await chrome.storage.local.remove("CLOUD_AUTH_FAILED");
}

export async function getCloudDeviceName(): Promise<string> {
  const store = await chrome.storage.local.get("CLOUD_DEVICE_NAME");
  const existing = store.CLOUD_DEVICE_NAME;
  if (typeof existing === "string" && existing) return existing;
  const name = generateRandomUsername({ capitalize: true, separator: " " });
  await chrome.storage.local.set({ CLOUD_DEVICE_NAME: name });
  return name;
}

/**
 * Initiates the 42 OAuth login flow by opening a popup window.
 * It listens for a message from the popup to receive the session token upon success.
 * @param onSuccess Optional callback to run after a successful login.
 */
export async function loginWith42(
  onSuccess?: () => void | Promise<void>,
): Promise<void> {
  const deviceName = await getCloudDeviceName();
  const callbackUrl = new URL(window.location.href);
  callbackUrl.searchParams.set("ft_device", deviceName);
  const authUrl = `${WORKER_URL}/login?redirect_uri=${encodeURIComponent(callbackUrl.toString())}`;

  // Record that a login is in progress so that main.ts accepts the callback.
  // This must complete before window.open(): on Firefox the toolbar popup is
  // torn down as soon as the auth window takes focus, which cancels an
  // in-flight storage write. A marker failure must never abort the
  // postMessage flow below, so it is swallowed.
  try {
    await markAuthFlowPending("cloud");
  } catch (e) {
    console.warn("Better Intra: could not record login flow", e);
  }

  const popup = window.open(
    authUrl,
    "42 Authentication",
    "width=600,height=700",
  );

  if (!popup) {
    void showAlertDialog({
      message: "Popup blocked! Please allow popups for this site.",
    });
    return;
  }

  const WORKER_ORIGIN = new URL(WORKER_URL).origin;
  const isExtension =
    window.location.protocol === "chrome-extension:" ||
    window.location.protocol === "moz-extension:";

  const messageListener = async (event: MessageEvent) => {
    if (
      event.origin !== WORKER_ORIGIN &&
      event.origin !== "https://profile.intra.42.fr" &&
      event.origin !== "https://profile-v3.intra.42.fr"
    )
      return;

    if (event.data && event.data.type === "42_AUTH_SUCCESS") {
      const { token, login } = event.data;

      if (token && login) {
        await chrome.storage.local.set({
          CLOUD_TOKEN: token,
          CLOUD_LOGIN: login,
          PENDING_SETTINGS_RESTORE: true,
        });

        window.removeEventListener("message", messageListener);
        if (pollInterval) clearInterval(pollInterval);
        popup.close();
        if (onSuccess) {
          await onSuccess();
        } else {
          window.location.reload();
        }
      }
    }
  };

  window.addEventListener("message", messageListener);

  let pollInterval: ReturnType<typeof setInterval> | undefined;
  if (isExtension) {
    pollInterval = setInterval(async () => {
      if (!popup.closed) return;
      clearInterval(pollInterval);
      window.removeEventListener("message", messageListener);
      await new Promise((r) => setTimeout(r, 300));
      const savedLogin = await getCloudLogin();
      const savedToken = await getConfig("CLOUD_TOKEN");
      if (savedLogin && savedToken) {
        await chrome.storage.local.set({ PENDING_SETTINGS_RESTORE: true });
        if (onSuccess) await onSuccess();
        else window.location.reload();
      }
    }, 500);
  }
}

/**
 * Retrieves the stored 42 login from local storage.
 * @returns A promise that resolves to the login string or null if not found.
 */
export async function getCloudLogin(): Promise<string | null> {
  return (await getConfig("CLOUD_LOGIN")) || null;
}

/**
 * Tests the connection to the worker by fetching the number of active sessions.
 * @returns A promise that resolves to the number of active sessions, or 0 on failure.
 */
export async function testCloudConnection(): Promise<number> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return 0;

  try {
    const hashedLogin = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/private/settings?login=${encodeURIComponent(hashedLogin)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!(await handleAuthResponse(response))) return 0;
    const data = (await response.json()) as any;
    return data.activeSessions ?? 0;
  } catch (error) {
    console.error("Cloud connection test failed:", error);
    return 0;
  }
}

export interface SessionSummary {
  id: string;
  label: string;
  name?: string;
  country?: string;
  createdAt: number;
  current: boolean;
}

export interface SessionsResponse {
  sessions: SessionSummary[];
  max: number;
}

export async function fetchSessions(): Promise<SessionsResponse> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return { sessions: [], max: 0 };

  try {
    const hashedLogin = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/private/sessions?login=${encodeURIComponent(hashedLogin)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!(await handleAuthResponse(response))) return { sessions: [], max: 0 };
    const data = (await response.json()) as SessionsResponse;
    return { sessions: data.sessions || [], max: data.max || 0 };
  } catch (error) {
    console.error("Fetch sessions failed:", error);
    return { sessions: [], max: 0 };
  }
}

export async function revokeSession(id: string): Promise<boolean> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return false;

  try {
    const hashedLogin = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/private/sessions?login=${encodeURIComponent(hashedLogin)}&id=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return await handleAuthResponse(response);
  } catch (error) {
    console.error("Revoke session failed:", error);
    return false;
  }
}

/**
 * Gathers all local settings (except cloud credentials) and pushes them to the cloud.
 * @returns A promise that resolves to true on success, false on failure.
 */
export type SyncStatus = "ok" | "conflict" | "error";

export interface SyncResult {
  status: SyncStatus;
  revision?: string;
  cloud?: Record<string, unknown>;
}

export async function collectLocalSettings(): Promise<Record<string, unknown>> {
  const settings: Record<string, unknown> = {};
  for (const key of CLOUD_SYNC_KEYS) {
    settings[key] = await getConfig(key);
  }
  return settings;
}

export async function syncToCloud(opts?: {
  force?: boolean;
}): Promise<SyncResult> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return { status: "error" };

  try {
    const settings = await collectLocalSettings();
    const hashedLogin = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/private/settings?login=${encodeURIComponent(hashedLogin)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings,
          baseRevision: (await getConfig("CLOUD_REVISION")) ?? null,
          force: opts?.force === true,
        }),
      },
    );

    if (response.status === 409) {
      const data = (await response.json().catch(() => ({}))) as {
        settings?: Record<string, unknown>;
      };
      await chrome.storage.local.set({ CLOUD_SYNC_CONFLICT: true });
      return { status: "conflict", cloud: data.settings || {} };
    }

    if (!(await handleAuthResponse(response))) return { status: "error" };

    const data = (await response.json().catch(() => ({}))) as {
      revision?: string;
    };
    await chrome.storage.local.set({
      LAST_CLOUD_SYNC: Date.now(),
      CLOUD_SYNC_CONFLICT: false,
      ...(data.revision ? { CLOUD_REVISION: data.revision } : {}),
    });
    return { status: "ok", revision: data.revision };
  } catch (error) {
    console.error("Cloud sync failed:", error);
    return { status: "error" };
  }
}

/**
 * A specialized sync function to quickly update only the user's visual settings.
 * @param visuals An object containing URLs and modes for profile visuals.
 */
export async function syncMyVisuals(visuals: {
  avatar: string;
  banner: string;
  bannerMode?: string;
  bannerColor?: string;
  background: string;
  backgroundMode?: string;
  backgroundColor?: string;
  avatarBg?: string;
  decoration?: string;
  avatarPosX?: number;
  avatarPosY?: number;
  avatarScale?: number;
  badgeBg?: string;
}): Promise<void> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return;

  try {
    const hashedLogin = await hashLogin(login);
    const res = await fetch(
      `${WORKER_URL}/api/v1/private/settings?login=${encodeURIComponent(hashedLogin)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings: {
            PROFILE_IMAGE_URL: visuals.avatar,
            PROFILE_BANNER_URL: visuals.banner,
            PROFILE_BANNER_MODE: visuals.bannerMode || "fill",
            PROFILE_BANNER_COLOR: visuals.bannerColor || "",
            PROFILE_BACKGROUND_URL: visuals.background,
            PROFILE_BACKGROUND_MODE: visuals.backgroundMode || "fill",
            PROFILE_BACKGROUND_COLOR: visuals.backgroundColor || "",
            PROFILE_AVATAR_BG: visuals.avatarBg || "transparent",
            PROFILE_DECORATION: visuals.decoration || "none",
            PROFILE_AVATAR_POSITION_X: visuals.avatarPosX ?? 50,
            PROFILE_AVATAR_POSITION_Y: visuals.avatarPosY ?? 50,
            PROFILE_AVATAR_SCALE: visuals.avatarScale ?? 100,
            PROFILE_BADGE_BG: visuals.badgeBg || "",
            PROFILE_IMAGE_HISTORY: await getConfig("PROFILE_IMAGE_HISTORY"),
            PROFILE_BANNER_HISTORY: await getConfig("PROFILE_BANNER_HISTORY"),
            PROFILE_BACKGROUND_HISTORY: await getConfig(
              "PROFILE_BACKGROUND_HISTORY",
            ),
          },
          baseRevision: (await getConfig("CLOUD_REVISION")) ?? null,
        }),
      },
    );

    if (res.status === 409) {
      await chrome.storage.local.set({ CLOUD_SYNC_CONFLICT: true });
      return;
    }
    if (!(await handleAuthResponse(res))) return;
    const data = (await res.json().catch(() => ({}))) as { revision?: string };
    await chrome.storage.local.set({
      CLOUD_SYNC_CONFLICT: false,
      ...(data.revision ? { CLOUD_REVISION: data.revision } : {}),
    });
  } catch (e) {
    console.error("Cloud Quick Sync Error:", e);
  }
}

/**
 * Fetches the public visual settings for a given user login.
 * @param login The target user's 42 login.
 * @returns A promise that resolves to the user's visual settings, or null on failure.
 */
export async function fetchUserVisuals(
  login: string,
): Promise<VisualUrls | null> {
  try {
    const hashedTarget = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/public/visuals?login=${encodeURIComponent(hashedTarget)}`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;

    return sanitizeVisualUrls({
      avatar: String(data.avatar || ""),
      banner: String(data.banner || ""),
      bannerMode: String(data.bannerMode || "fill"),
      bannerColor: String(data.bannerColor || ""),
      background: String(data.background || ""),
      backgroundMode: String(data.backgroundMode || "fill"),
      backgroundColor: String(data.backgroundColor || ""),
      avatarBg: String(data.avatarBg || "transparent"),
      decoration: String(data.decoration || "none"),
      avatarPosX: Number(data.avatarPosX ?? 50),
      avatarPosY: Number(data.avatarPosY ?? 50),
      avatarScale: Number(data.avatarScale ?? 100),
      badgeBg: String(data.badgeBg || ""),
      theme: (data.theme as { profileColor?: string }) || null,
      look: (data.look as { preset?: string; theme?: string }) || null,
      logtime: (data.logtime as Record<string, unknown>) || null,
    });
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Fetches the current user's settings from the cloud.
 * @returns A promise that resolves to a partial config object, or null on failure.
 */
export interface CloudSettingsSnapshot {
  settings: Record<string, unknown>;
  revision: string | null;
  discordId?: string;
  discordUsername?: string;
}

export async function fetchCloudSettings(): Promise<CloudSettingsSnapshot | null> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return null;

  try {
    const hashedLogin = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/private/settings?login=${encodeURIComponent(hashedLogin)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!(await handleAuthResponse(response))) return null;
    const data = (await response.json()) as {
      settings?: Record<string, unknown>;
      revision?: string | null;
      discordId?: string;
      discordUsername?: string;
    };
    return {
      settings: data.settings || {},
      revision: data.revision ?? null,
      discordId: data.discordId,
      discordUsername: data.discordUsername,
    };
  } catch (error) {
    console.error("[fetchCloudSettings] error:", error);
    return null;
  }
}

export async function fetchMySettings(): Promise<Partial<BetterIntraConfig> | null> {
  const data = await fetchCloudSettings();
  if (!data) return null;

  try {
    const settings = { ...data.settings };
    if (data.discordId) settings.DISCORD_ID = data.discordId;
    if (data.discordUsername) settings.DISCORD_USERNAME = data.discordUsername;
    await chrome.storage.local.set({
      CLOUD_REVISION: data.revision,
      CLOUD_SYNC_CONFLICT: false,
    });
    return settings as Partial<BetterIntraConfig>;
  } catch (error) {
    console.error("[fetchMySettings] error:", error);
    return null;
  }
}

export interface SettingsHistoryEntryView {
  index: number;
  revision: string | null;
  createdAt: number;
}

const LOCAL_BACKUP_LIMIT = 5;

export async function fetchSettingsHistory(): Promise<
  SettingsHistoryEntryView[]
> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return [];

  try {
    const hashedLogin = await hashLogin(login);
    const res = await fetch(
      `${WORKER_URL}/api/v1/private/settings/history?login=${encodeURIComponent(hashedLogin)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!(await handleAuthResponse(res))) return [];
    const data = (await res.json()) as { entries?: SettingsHistoryEntryView[] };
    return data.entries || [];
  } catch (error) {
    console.error("Fetch settings history failed:", error);
    return [];
  }
}

export async function restoreSettingsSnapshot(index: number): Promise<boolean> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return false;

  try {
    const hashedLogin = await hashLogin(login);
    const res = await fetch(
      `${WORKER_URL}/api/v1/private/settings/restore?login=${encodeURIComponent(hashedLogin)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ index }),
      },
    );
    if (!(await handleAuthResponse(res))) return false;
    const data = (await res.json()) as {
      revision?: string;
      settings?: Record<string, unknown>;
    };
    if (data.settings) {
      await applyCloudSettings(data.settings as Partial<BetterIntraConfig>);
    }
    await chrome.storage.local.set({
      CLOUD_REVISION: data.revision ?? null,
      CLOUD_SYNC_CONFLICT: false,
      CLOUD_BASELINE: data.settings ?? null,
      LAST_CLOUD_SYNC: Date.now(),
    });
    return true;
  } catch (error) {
    console.error("Restore settings snapshot failed:", error);
    return false;
  }
}

export async function pushLocalBackup(): Promise<void> {
  const settings = await collectLocalSettings();
  if (Object.keys(settings).length === 0) return;
  const existing = (await getConfig("SETTINGS_BACKUP_LOCAL")) || [];
  const next = [{ at: Date.now(), settings }, ...existing].slice(
    0,
    LOCAL_BACKUP_LIMIT,
  );
  await chrome.storage.local.set({ SETTINGS_BACKUP_LOCAL: next });
}

export async function restoreLocalBackup(index: number): Promise<boolean> {
  const existing = (await getConfig("SETTINGS_BACKUP_LOCAL")) || [];
  const entry = existing[index];
  if (!entry) return false;
  await applyCloudSettings(entry.settings as Partial<BetterIntraConfig>);
  return true;
}

/**
 * Logs the user out by deleting the current session from the worker and clearing local credentials.
 * @returns A promise that resolves to true on success.
 */
export async function logoutCloud(): Promise<boolean> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");

  if (login && token) {
    try {
      const hashedLogin = await hashLogin(login);
      await fetch(
        `${WORKER_URL}/api/v1/private/settings?login=${encodeURIComponent(hashedLogin)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch (e) {
      console.error("Failed to notify worker of logout", e);
    }
  }

  await chrome.storage.local.remove([
    "CLOUD_TOKEN",
    "CLOUD_LOGIN",
    "CLOUD_AUTH_FAILED",
  ]);
  return true;
}

/**
 * Sends a request to the worker to wipe all cloud data associated with the user's account.
 * @returns A promise that resolves to true on success, false on failure.
 */
export async function wipeAllCloudData(): Promise<boolean> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return false;

  try {
    const hashedLogin = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/private/settings?login=${encodeURIComponent(hashedLogin)}&all=true`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      await chrome.storage.local.remove([
        "CLOUD_TOKEN",
        "CLOUD_LOGIN",
        "CLOUD_AUTH_FAILED",
      ]);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Wipe cloud data failed:", error);
    return false;
  }
}

/**
 * Applies a set of settings from the cloud to the local storage.
 * @param cloudData A partial configuration object from the cloud.
 */
export async function applyCloudSettings(
  cloudData: Partial<BetterIntraConfig>,
): Promise<void> {
  const dataToSave: Partial<BetterIntraConfig> = {};

  for (const key of CLOUD_SYNC_KEYS) {
    if (key in cloudData) {
      (dataToSave as Record<string, unknown>)[key] = (
        cloudData as Record<string, unknown>
      )[key];
    }
  }

  if (Object.keys(dataToSave).length > 0) {
    await chrome.storage.local.set(dataToSave as Record<string, unknown>);
  }
}

/**
 * Prompts the user to restore their cloud settings after a fresh 42 connect.
 * Triggered once per connect via the PENDING_SETTINGS_RESTORE flag.
 */
export async function maybePromptRestore(): Promise<void> {
  const pending = (await chrome.storage.local.get(
    "PENDING_SETTINGS_RESTORE",
  )) as Record<string, unknown>;
  if (!pending.PENDING_SETTINGS_RESTORE) return;
  await chrome.storage.local.remove("PENDING_SETTINGS_RESTORE");

  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return;

  const settings = await fetchMySettings();
  if (!settings) return;

  const hasData = Object.entries(settings).some(
    ([k, v]) =>
      k !== "CLOUD_TOKEN" && k !== "CLOUD_LOGIN" && v != null && v !== "",
  );
  if (
    hasData &&
    (await showConfirmDialog({
      title: "Restore cloud settings",
      message: "Cloud backup found. Restore your settings?",
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
    }))
  ) {
    await applyCloudSettings(settings);
    window.location.reload();
  }
}

export async function maybeMergeCloud(): Promise<void> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return;

  const cloud = await fetchCloudSettings();
  if (!cloud) return;

  const local = await collectLocalSettings();
  const base = await getConfig("CLOUD_BASELINE");
  const { apply, conflicts } = mergeSettings(base, local, cloud.settings);

  if (Object.keys(apply).length > 0) {
    await pushLocalBackup();
    await chrome.storage.local.set(apply);
  }
  await chrome.storage.local.set({
    CLOUD_BASELINE: cloud.settings,
    CLOUD_REVISION: cloud.revision,
    CLOUD_SYNC_CONFLICT: conflicts.length > 0,
  });
}

export async function maybePromptConflict(): Promise<void> {
  if (!(await getConfig("CLOUD_SYNC_CONFLICT"))) return;

  const cloud = await fetchCloudSettings();
  if (!cloud) return;

  const local = await collectLocalSettings();
  const { diffSettings, showSettingsConflictDialog } =
    await import("./conflict-dialog.ts");
  const choice = await showSettingsConflictDialog(
    diffSettings(local, cloud.settings),
  );

  if (choice === "pull") {
    await applyCloudSettings(cloud.settings as Partial<BetterIntraConfig>);
    await chrome.storage.local.set({
      CLOUD_REVISION: cloud.revision,
      CLOUD_SYNC_CONFLICT: false,
      LAST_CLOUD_SYNC: Date.now(),
    });
    window.location.reload();
  } else if (choice === "keep") {
    await syncToCloud({ force: true });
  }
}
