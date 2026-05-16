import { gmSetValue, gmDeleteValue } from "../../lib/gm.ts";
import { getConfig } from "../../config.ts";
import { CONFIG_KEYS } from "../../config.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";

export function loginWith42(): void {
  window.open(`${WORKER_URL}/login`, "42Auth", "width=600,height=700");
}

window.addEventListener("message", async (event) => {
  if (event.data?.type === "42_AUTH_SUCCESS") {
    const { token, login } = event.data;
    await gmSetValue("CLOUD_TOKEN", token);
    await gmSetValue("CLOUD_LOGIN", login);
    window.location.reload();
  }
});

export async function getCloudLogin(): Promise<string | null> {
  return (await getConfig("CLOUD_LOGIN")) || null;
}

export async function testCloudConnection(): Promise<number> {
  const token = await getConfig("CLOUD_TOKEN");
  const login = await getCloudLogin();
  if (!token || !login) return 0;

  try {
    const response = await fetch(`${WORKER_URL}?login=${encodeURIComponent(login)}`, {
      method: "GET",
      headers: { 
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json() as any;
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
      if (key === "CLOUD_TOKEN" || key === "CLOUD_LOGIN" || key === "LAST_CLOUD_SYNC") return;
      
      const value = await getConfig(key);
      if (value !== undefined && value !== null) {
        settings[key] = value;
      }
    }),
  );

  try {
    const response = await fetch(`${WORKER_URL}?login=${encodeURIComponent(login)}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ settings }),
    });
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
        "Authorization": `Bearer ${token}`
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
    const response = await fetch(`${WORKER_URL}?login=${encodeURIComponent(login)}`);
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
    const response = await fetch(`${WORKER_URL}?login=${encodeURIComponent(login)}`);
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
      headers: { "Authorization": `Bearer ${token}` },
    });
  } catch (e) {
    console.error("Failed to notify worker of logout", e);
  }

  await gmSetValue("CLOUD_TOKEN", "");
  await gmSetValue("CLOUD_LOGIN", "");
  return true;
}

export async function wipeAllCloudData(): Promise<boolean> {
  const token = await getConfig("CLOUD_TOKEN");
  const login = await getCloudLogin();
  if (!token || !login) return false;

  try {
    const response = await fetch(`${WORKER_URL}?login=${encodeURIComponent(login)}&all=true`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    
    if (response.ok) {
      await gmSetValue("CLOUD_TOKEN", "");
      await gmSetValue("CLOUD_LOGIN", "");
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
}

export async function applyCloudSettings(cloudData: Record<string, any>): Promise<void> {
  await Promise.all(
    CONFIG_KEYS.map(async (key) => {
      if (key in cloudData) {
        await gmSetValue(key, cloudData[key]);
      }
    }),
  );
}