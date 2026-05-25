import { BetterIntraConfig, ConfigKey, getConfig } from "../../config.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";

/**
 * Hashes a login string using SHA-256 for secure, anonymized identification.
 * @param login The user's 42 login.
 * @returns A promise that resolves to the hex-encoded SHA-256 hash.
 */
async function hashLogin(login: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(login.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Initiates the 42 OAuth login flow by opening a popup window.
 * It listens for a message from the popup to receive the session token upon success.
 * @param onSuccess Optional callback to run after a successful login.
 */
export async function loginWith42(onSuccess?: () => void): Promise<void> {
  const extensionFakeCallback = window.location.href;
  const authUrl = `${WORKER_URL}/login?redirect_uri=${encodeURIComponent(extensionFakeCallback)}`;

  const popup = window.open(
    authUrl,
    "42 Authentication",
    "width=600,height=700",
  );

  if (!popup) {
    alert("Popup blocked! Please allow popups for this site.");
    return;
  }

  const WORKER_ORIGIN = new URL(WORKER_URL).origin;

  const messageListener = async (event: MessageEvent) => {
    // Ensure the message is from the trusted worker origin
    if (event.origin !== WORKER_ORIGIN) return;

    if (event.data && event.data.type === "42_AUTH_SUCCESS") {
      const { token, login } = event.data;

      if (token && login) {
        // Save the new token and login to local storage
        await chrome.storage.local.set({
          CLOUD_TOKEN: token,
          CLOUD_LOGIN: login,
        });

        window.removeEventListener("message", messageListener);
        popup.close();
        if (onSuccess) {
          onSuccess(); // Execute callback if provided
        } else {
          window.location.reload(); // Default to reloading the page
        }
      }
    }
  };

  window.addEventListener("message", messageListener);
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
    if (!response.ok) return 0;
    const data = (await response.json()) as any;
    return data.activeSessions ?? 0;
  } catch (error) {
    console.error("Cloud connection test failed:", error);
    return 0;
  }
}

/**
 * Gathers all local settings (except cloud credentials) and pushes them to the cloud.
 * @returns A promise that resolves to true on success, false on failure.
 */
export async function syncToCloud(): Promise<boolean> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return false;

  try {
    const settings: Partial<BetterIntraConfig> = {};
    const allKeys = Object.keys(
      await chrome.storage.local.get(null),
    ) as ConfigKey[];

    // Collect all settings except for the cloud-specific ones
    for (const key of allKeys) {
      if (
        key !== "CLOUD_TOKEN" &&
        key !== "CLOUD_LOGIN" &&
        key !== "LAST_CLOUD_SYNC"
      ) {
        (settings as any)[key] = await getConfig(key);
      }
    }

    const hashedLogin = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/private/settings?login=${encodeURIComponent(hashedLogin)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      },
    );
    return response.ok;
  } catch (error) {
    console.error("Cloud sync failed:", error);
    return false;
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
  background: string;
  backgroundMode?: string;
}): Promise<void> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return;

  try {
    const hashedLogin = await hashLogin(login);
    await fetch(
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
            PROFILE_BACKGROUND_URL: visuals.background,
            PROFILE_BACKGROUND_MODE: visuals.backgroundMode || "fill",
          },
        }),
      },
    );
  } catch (e) {
    console.error("Cloud Quick Sync Error:", e);
  }
}

/**
 * Fetches the public visual settings for a given user login.
 * @param login The target user's 42 login.
 * @returns A promise that resolves to the user's visual settings, or null on failure.
 */
export async function fetchUserVisuals(login: string) {
  try {
    const hashedTarget = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/public/visuals?login=${encodeURIComponent(hashedTarget)}`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as any;

    return {
      avatar: data.avatar || "",
      banner: data.banner || "",
      bannerMode: data.bannerMode || "fill",
      background: data.background || "",
      backgroundMode: data.backgroundMode || "fill",
      theme: data.theme || null,
      logtime: data.logtime || null,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Fetches the current user's settings from the cloud.
 * @returns A promise that resolves to a partial config object, or null on failure.
 */
export async function fetchMySettings(): Promise<Partial<BetterIntraConfig> | null> {
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
    if (!response.ok) return null;
    const data = (await response.json()) as any;
    return data.settings || null;
  } catch (error) {
    console.error("Fetch settings failed:", error);
    return null;
  }
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

  await chrome.storage.local.remove(["CLOUD_TOKEN", "CLOUD_LOGIN"]);
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
      await chrome.storage.local.remove(["CLOUD_TOKEN", "CLOUD_LOGIN"]);
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
  const validKeys = Object.keys(cloudData) as ConfigKey[];

  for (const key of validKeys) {
    (dataToSave as any)[key] = cloudData[key];
  }

  if (Object.keys(dataToSave).length > 0) {
    await chrome.storage.local.set(dataToSave);
  }
}
