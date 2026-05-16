import { gmSetValue, gmDeleteValue } from "../../lib/gm.ts";
import { getConfig } from "../../config.ts";
import { CONFIG_KEYS } from "../../config.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";

export function getIntraLogin(): string | null {
  const loginElement = document.querySelector("span[data-login]");
  return loginElement?.getAttribute("data-login")?.trim() || null;
}

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

export async function testCloudConnection(): Promise<boolean> {
  const token = await getConfig("CLOUD_TOKEN");
  const login = getIntraLogin();
  if (!token || !login) return false;

  try {
    const response = await fetch(`${WORKER_URL}?login=${encodeURIComponent(login)}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ settings: {} }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function syncToCloud(): Promise<boolean> {
  const login = getIntraLogin();
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
  const login = getIntraLogin();
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
  const login = getIntraLogin();
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

export async function logoutCloud(): Promise<void> {
  await gmDeleteValue("CLOUD_TOKEN");
  await gmDeleteValue("CLOUD_LOGIN");
  await gmDeleteValue("LAST_CLOUD_SYNC");
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