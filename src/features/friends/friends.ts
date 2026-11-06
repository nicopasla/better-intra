import { getConfig, setConfig } from "../../config.ts";
import { workerFetch } from "../../utils/worker.ts";
import { hashLogin } from "../account/account.ts";


export interface FriendData {
  login: string;
  displayName: string;
  avatar: string | null;
  customAvatar: string | null;
  avatarBg?: string;
  avatarShape?: "round" | "square";
  avatarPosX?: number;
  avatarPosY?: number;
  avatarScale?: number;
  level: number;
  grade: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  poolLabel: string | null;
  wallet: number;
  correctionPoints: number;
  lastOnlineTimestamp: number | null;
}

export async function getFriendsList(): Promise<string[]> {
  const raw = await getConfig("FRIENDS_LIST");
  return Array.isArray(raw) ? raw : [];
}

export async function saveFriendsList(logins: string[]): Promise<void> {
  await setConfig("FRIENDS_LIST", logins);
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

const CACHE_KEY = "FRIENDS_DATA_CACHE";
/**
 * Cached friends are rendered immediately; this is how long they are trusted
 * before an automatic revalidation. A manual refresh always bypasses it.
 */
export const AUTO_REFRESH_MS = 15 * 60_000;
/** Snapshot age after which online dots are presented as stale. */
export const STALE_ONLINE_MS = 5 * 60_000;

export interface FriendsCacheEntry {
  data: FriendData[];
  timestamp: number;
}

async function getCachedData(): Promise<FriendsCacheEntry | null> {
  try {
    const raw = (await chrome.storage.local.get(CACHE_KEY)) as Record<
      string,
      unknown
    >;
    const val = raw[CACHE_KEY] as FriendsCacheEntry | undefined;
    if (val && Array.isArray(val.data) && typeof val.timestamp === "number")
      return val;
    return null;
  } catch {
    return null;
  }
}

/** Reads the stored list at any age, without touching the network. */
export function readFriendsCache(): Promise<FriendsCacheEntry | null> {
  return getCachedData();
}

async function setCachedData(data: FriendData[]): Promise<void> {
  await chrome.storage.local.set({
    [CACHE_KEY]: { data, timestamp: Date.now() },
  });
}

export async function clearFriendsCache(): Promise<void> {
  await chrome.storage.local.remove(CACHE_KEY);
}

export async function fetchFriendsData(
  logins: string[],
  opts: { force?: boolean } = {},
): Promise<FriendData[]> {
  if (logins.length === 0) return [];

  const token = await getConfig("CLOUD_TOKEN");
  const cloudLogin = await getConfig("CLOUD_LOGIN");
  if (!token || !cloudLogin) return [];

  const hashedLogin = await hashLogin(cloudLogin);
  // The list travels in the body so it never lands in URLs/logs; the hashed
  // login stays in the query because the worker routes on it.
  const request = (list: string[]): Promise<Response> =>
    workerFetch(
      `/api/v1/private/friends/data?login=${encodeURIComponent(hashedLogin)}`,
      { token, method: "POST", body: { logins: list } },
    );

  // Single-login fetches (add friend validation) always go to API
  if (logins.length === 1) {
    try {
      const res = await request(logins);
      if (res.status === 401) {
        await chrome.storage.local.set({ CLOUD_AUTH_FAILED: true });
      }
      return res.ok
        ? (((await res.json()) as { friends?: FriendData[] }).friends ?? [])
        : [];
    } catch {
      return [];
    }
  }

  // Show what we already have unless the caller asked to refresh.
  const cached = await getCachedData();
  if (
    !opts.force &&
    cached &&
    cached.data.length > 0 &&
    Date.now() - cached.timestamp < AUTO_REFRESH_MS
  ) {
    return cached.data;
  }

  try {
    const res = await request(logins);
    if (res.ok) {
      const data = (await res.json()) as { friends?: FriendData[] };
      const friends = data.friends ?? [];
      if (friends.length > 0) {
        setCachedData(friends);
        return friends;
      }
      // Fresh fetch returned empty — fall back to last known non-empty data
      if (cached && cached.data.length > 0) return cached.data;
      return [];
    } else if (res.status === 401) {
      await chrome.storage.local.set({ CLOUD_AUTH_FAILED: true });
    }
  } catch (e) {
    console.error("Failed to fetch friends data:", e);
  }

  // On failure, fall back to last known non-empty data if present
  if (cached && cached.data.length > 0) return cached.data;
  return [];
}
