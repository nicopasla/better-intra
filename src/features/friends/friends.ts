import { getConfig } from "../../config.ts";
import { hashLogin } from "../account/account.ts";

const WORKER_URL = "https://better-intra-worker.nicopasla.workers.dev";
const CACHE_KEY = "FRIENDS_CACHE";
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface FriendData {
  login: string;
  displayName: string;
  avatar: string | null;
  level: number;
  grade: string | null;
  cursus: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  poolYear: string | null;
  wallet: number;
  correctionPoints: number;
  cachedAt: number;
}

export type FriendsCache = Record<string, FriendData>;

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
  // Also remove from cache
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cache = (result[CACHE_KEY] as FriendsCache) ?? {};
  delete cache[login.toLowerCase()];
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

export async function isFriend(login: string): Promise<boolean> {
  const list = await getFriendsList();
  return list.includes(login.trim().toLowerCase());
}

async function getFriendsCache(): Promise<FriendsCache> {
  const result = await chrome.storage.local.get(CACHE_KEY);
  return (result[CACHE_KEY] as FriendsCache) ?? {};
}

async function setFriendsCache(cache: FriendsCache): Promise<void> {
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

export async function fetchFriendsData(
  logins: string[],
  forceRefresh = false,
): Promise<FriendData[]> {
  if (logins.length === 0) return [];

  const token = await getConfig("CLOUD_TOKEN");
  const cloudLogin = await getConfig("CLOUD_LOGIN");
  if (!token || !cloudLogin) return [];

  const cache = await getFriendsCache();
  const now = Date.now();

  const stale = logins.filter(
    (l) => forceRefresh || !cache[l] || now - cache[l].cachedAt > CACHE_TTL_MS,
  );

  if (stale.length > 0) {
  try {
    const hashedLogin = await hashLogin(cloudLogin);
    const res = await fetch(
      `${WORKER_URL}/api/v1/private/friends/data?login=${encodeURIComponent(hashedLogin)}&logins=${encodeURIComponent(stale.join(","))}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) {
      const data = (await res.json()) as { friends?: FriendData[] };
      const friends = data.friends;
      if (friends) {
        for (const friend of friends) {
          if (friend) {
            cache[friend.login] = { ...friend, cachedAt: now };
          }
        }
        await setFriendsCache(cache);
      }
    }
  } catch (e) {
    console.error("Failed to fetch friends data:", e);
  }
}

  return logins.map((l) => cache[l]).filter(Boolean) as FriendData[];
}