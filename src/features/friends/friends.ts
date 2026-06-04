import { getConfig } from "../../config.ts";
import { hashLogin } from "../account/account.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";

export interface FriendData {
  login: string;
  displayName: string;
  avatar: string | null;
  level: number;
  grade: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  poolLabel: string | null;
  wallet: number;
  correctionPoints: number;
}

export async function getFriendsList(): Promise<string[]> {
  const raw = await getConfig("FRIENDS_LIST");
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveFriendsList(logins: string[]): Promise<void> {
  await chrome.storage.local.set({
    FRIENDS_LIST: JSON.stringify(logins),
  });
}

export async function addFriend(login: string): Promise<void> {
  const list = await getFriendsList();
  const normalized = login.trim().toLowerCase();
  if (list.includes(normalized)) return;
  await saveFriendsList([...list, normalized]);
}

export async function removeFriend(login: string): Promise<void> {
  const list = await getFriendsList();
  await saveFriendsList(list.filter((l) => l !== login.toLowerCase()));
}

export async function isFriend(login: string): Promise<boolean> {
  const list = await getFriendsList();
  return list.includes(login.trim().toLowerCase());
}

export async function fetchFriendsData(
  logins: string[],
): Promise<FriendData[]> {
  if (logins.length === 0) return [];

  const token = await getConfig("CLOUD_TOKEN");
  const cloudLogin = await getConfig("CLOUD_LOGIN");
  if (!token || !cloudLogin) return [];

  try {
    const hashedLogin = await hashLogin(cloudLogin);
    const res = await fetch(
      `${WORKER_URL}/api/v1/private/friends/data?login=${encodeURIComponent(hashedLogin)}&logins=${encodeURIComponent(logins.join(","))}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) {
      const data = (await res.json()) as { friends?: FriendData[] };
      return data.friends ?? [];
    }
  } catch (e) {
    console.error("Failed to fetch friends data:", e);
  }

  return [];
}
