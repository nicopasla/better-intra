import { getConfig } from "../../config.ts";
import { CONFIG_KEYS } from "../../config.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";

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

  const authInterval = setInterval(async () => {
    try {
      if (popup.closed) {
        clearInterval(authInterval);
        return;
      }

      const popupUrl = popup.location.href;
      if (popupUrl.includes("token=") && popupUrl.includes("login=")) {
        const urlObj = new URL(popupUrl);
        const token = urlObj.searchParams.get("token");
        const login = urlObj.searchParams.get("login");

        if (token && login) {
          await browser.storage.local.set({
            CLOUD_TOKEN: token,
            CLOUD_LOGIN: login,
          });

          clearInterval(authInterval);
          popup.close();
          window.location.reload();
        }
      }
    } catch (e) {}
  }, 500);
}

export async function getCloudLogin(): Promise<string | null> {
  return (await getConfig("CLOUD_LOGIN")) || null;
}

export async function testCloudConnection(): Promise<number> {
  const token = await getConfig("CLOUD_TOKEN");
  const login = await getCloudLogin();
  if (!token || !login) return 0;

  try {
    const response = await fetch(
      `${WORKER_URL}?login=${encodeURIComponent(login)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    const response = await fetch(
      `${WORKER_URL}?login=${encodeURIComponent(login)}`,
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
  background: string;
}): Promise<void> {
  const login = await getCloudLogin();
  const token = await getConfig("CLOUD_TOKEN");
  if (!login || !token) return;

  try {
    await fetch(`${WORKER_URL}?login=${encodeURIComponent(login)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        settings: {
          PROFILE_IMAGE_URL: visuals.avatar,
          PROFILE_BANNER_URL: visuals.banner,
          PROFILE_BACKGROUND_URL: visuals.background,
        },
      }),
    });
  } catch (e) {
    console.error("Cloud Quick Sync Error:", e);
  }
}

export async function fetchUserVisuals(login: string) {
  try {
    const response = await fetch(
      `${WORKER_URL}?login=${encodeURIComponent(login)}`,
    );
    if (!response.ok) return null;
    const data = await response.json();

    return {
      avatar: data.settings?.PROFILE_IMAGE_URL || "",
      banner: data.settings?.PROFILE_BANNER_URL || "",
      background: data.settings?.PROFILE_BACKGROUND_URL || "",
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function fetchMySettings(): Promise<Record<string, any> | null> {
  const login = await getCloudLogin();
  if (!login) return null;

  try {
    const response = await fetch(
      `${WORKER_URL}?login=${encodeURIComponent(login)}`,
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
    await fetch(`${WORKER_URL}?login=${encodeURIComponent(login)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.error("Failed to notify worker of logout", e);
  }

  await browser.storage.local.remove(["CLOUD_TOKEN", "CLOUD_LOGIN"]);
  return true;
}

export async function wipeAllCloudData(): Promise<boolean> {
  const token = await getConfig("CLOUD_TOKEN");
  const login = await getCloudLogin();
  if (!token || !login) return false;

  try {
    const response = await fetch(
      `${WORKER_URL}?login=${encodeURIComponent(login)}&all=true`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.ok) {
      await browser.storage.local.remove(["CLOUD_TOKEN", "CLOUD_LOGIN"]);
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
    await browser.storage.local.set(dataToSave);
  }
}
