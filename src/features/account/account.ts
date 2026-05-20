import { getConfig } from "../../config.ts";
import { CONFIG_KEYS } from "../../config.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";

async function hashLogin(login: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(login.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loginWith42(): Promise<void> {
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
    if (event.origin !== WORKER_ORIGIN) return;

    if (event.data && event.data.type === "42_AUTH_SUCCESS") {
      const { token, login } = event.data;

      if (token && login) {
        await chrome.storage.local.set({
          CLOUD_TOKEN: token,
          CLOUD_LOGIN: login,
        });

        window.removeEventListener("message", messageListener);
        popup.close();
        window.location.reload();
      }
    }
  };

  window.addEventListener("message", messageListener);
}

export async function getCloudLogin(): Promise<string | null> {
  return (await getConfig("CLOUD_LOGIN")) || null;
}

export async function testCloudConnection(): Promise<number> {
  const token = await getConfig("CLOUD_TOKEN");
  const login = await getCloudLogin();
  if (!token || !login) return 0;

  try {
    const hashedLogin = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/private/settings?login=${encodeURIComponent(hashedLogin)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        mode: "cors",
      },
    );

    if (response.ok) {
      const data = (await response.json()) as any;
      return typeof data.activeSessions === "number" ? data.activeSessions : 1;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function syncToCloud(): Promise<boolean> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return false;

  const settings: Record<string, any> = {};
  await Promise.all(
    CONFIG_KEYS.map(async (key) => {
      if (
        key === "CLOUD_TOKEN" ||
        key === "CLOUD_LOGIN" ||
        key === "LAST_CLOUD_SYNC"
      )
        return;

      const value = await getConfig(key);
      if (value !== undefined && value !== null) {
        settings[key] = value;
      }
    }),
  );

  try {
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
  } catch {
    return false;
  }
}

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

export async function fetchUserVisuals(login: string) {
  try {
    const hashedTarget = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/public/visuals?login=${encodeURIComponent(hashedTarget)}`,
    );
    if (!response.ok) return null;
    const data = await response.json();

    return {
      avatar: data.avatar || "",
      banner: data.banner || "",
      bannerMode: data.bannerMode || "fill",
      background: data.background || "",
      backgroundMode: data.backgroundMode || "fill",
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function fetchMySettings(): Promise<Record<string, any> | null> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return null;

  try {
    const hashedLogin = await hashLogin(login);
    const response = await fetch(
      `${WORKER_URL}/api/v1/private/settings?login=${encodeURIComponent(hashedLogin)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        mode: "cors",
      },
    );
    if (!response.ok) return null;
    const data = await response.json();

    return data.settings || null;
  } catch (error) {
    console.error("Failed to fetch cloud settings:", error);
    return null;
  }
}

export async function logoutCloud(): Promise<boolean> {
  const token = await getConfig("CLOUD_TOKEN");
  const login = await getCloudLogin();
  if (!token || !login) return false;

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

  await chrome.storage.local.remove(["CLOUD_TOKEN", "CLOUD_LOGIN"]);
  return true;
}

export async function wipeAllCloudData(): Promise<boolean> {
  const token = await getConfig("CLOUD_TOKEN");
  const login = await getCloudLogin();
  if (!token || !login) return false;

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
  } catch (e) {
    console.error(e);
  }
  return false;
}

export async function applyCloudSettings(
  cloudData: Record<string, any>,
): Promise<void> {
  const dataToSave: Record<string, any> = {};

  CONFIG_KEYS.forEach((key) => {
    if (key in cloudData) {
      dataToSave[key] = cloudData[key];
    }
  });

  if (Object.keys(dataToSave).length > 0) {
    await chrome.storage.local.set(dataToSave);
  }
}
