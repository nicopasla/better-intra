import { gmSetValue, gmDeleteValue } from "../../lib/gm.ts";
import { getConfig } from "../../config.ts";
import { CONFIG_KEYS } from "../../config.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev/";

export function getIntraLogin(): string | null {
  const loginElement = document.querySelector("span[data-login]");
  return loginElement?.getAttribute("data-login")?.trim() || null;
}

async function hashString(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function testCloudConnection(): Promise<boolean> {
  const login = getIntraLogin();
  const rawPassword = await getConfig("CLOUD_PASSWORD");

  if (!login || !rawPassword) return false;

  const hashedLogin = await hashString(login);
  const hashedPassword = await hashString(rawPassword);

  try {
    const response = await fetch(
      `${WORKER_URL}?login=${encodeURIComponent(login)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: hashedPassword,
          settings: {},
        }),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function syncToCloud(): Promise<boolean> {
  const login = getIntraLogin();
  const rawPassword = await getConfig("CLOUD_PASSWORD");

  if (!login || !rawPassword) return false;

  const hashedLogin = await hashString(login);
  const hashedPassword = await hashString(rawPassword);

 const settings: Record<string, any> = {};

  await Promise.all(
    CONFIG_KEYS.map(async (key) => {
      if (key === "CLOUD_PASSWORD" || key === "LAST_CLOUD_SYNC") return;
      const value = await getConfig(key);
      if (value !== undefined && value !== null) {
        settings[key] = value;
      }
    }),
  );

  try {
    const response = await fetch(
      `${WORKER_URL}?login=${encodeURIComponent(hashedLogin)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: hashedPassword,
          settings,
        }),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function logoutCloud(): Promise<void> {
  gmDeleteValue("ACCOUNT");
  gmDeleteValue("CLOUD_PASSWORD");
  gmDeleteValue("LAST_CLOUD_SYNC");
  gmSetValue("CLOUD_SYNC_ENABLED", false);
}

export function applyCloudSettings(cloudData: Record<string, any>) {
  CONFIG_KEYS.forEach((key) => {
    if (key in cloudData) {
      gmSetValue(key, cloudData[key]);
    }
  });
}