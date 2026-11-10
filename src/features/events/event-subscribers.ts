import { getConfig } from "../../config.ts";
import { hashLogin } from "../../utils/crypto.ts";
import { intrapyFetch } from "../../utils/intrapy.ts";
import { workerFetch } from "../../utils/worker.ts";

export interface EventSubscriber {
  login: string;
  displayName: string;
  avatar: string | null;
  avatarUrl?: string | null;
  location: string | null;
}

export interface EventSubscribersPage {
  users: EventSubscriber[];
  /** True when the worker stopped at its per-request cap. */
  truncated: boolean;
  /** When the worker answered (ms), so the dialog can show its age. */
  fetchedAt: number;
}

/**
 * How long a cached list is reused before opening the dialog triggers a
 * refetch. Subscriber lists move slowly, and every miss costs a 42 API call,
 * so this is deliberately long; the dialog's chip can force a refresh.
 */
export const SUBSCRIBERS_TTL = 24 * 60 * 60 * 1000;

/** Chip thresholds, matching the friends freshness chip. */
export const SUBSCRIBERS_LIVE_MS = 60 * 1000;
export const SUBSCRIBERS_STALE_MS = 5 * 60 * 1000;

const CACHE_KEY = "EVENT_SUBSCRIBERS_CACHE";
const MAX_CACHED_EVENTS = 100;

type CacheEntry = {
  at: number;
  users: EventSubscriber[];
  truncated: boolean;
};
type Cache = Record<string, CacheEntry>;

const inFlight = new Map<number, Promise<EventSubscribersPage>>();

async function readCache(): Promise<Cache> {
  try {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    const raw = stored[CACHE_KEY];
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Cache)
      : {};
  } catch {
    return {};
  }
}

/** Keeps the persisted cache bounded: the least recently fetched events go. */
function prune(cache: Cache): void {
  const ids = Object.keys(cache);
  if (ids.length <= MAX_CACHED_EVENTS) return;
  ids.sort((a, b) => (cache[a]?.at ?? 0) - (cache[b]?.at ?? 0));
  for (const id of ids.slice(0, ids.length - MAX_CACHED_EVENTS)) {
    delete cache[id];
  }
}

async function persist(cache: Cache): Promise<void> {
  try {
    await chrome.storage.local.set({ [CACHE_KEY]: cache });
  } catch {
    /* storage full or disabled */
  }
}

/**
 * Cached subscribers for an event. Stale entries are still returned so the
 * dialog can paint instantly and revalidate behind it.
 */
export async function readCachedSubscribers(
  id: number,
): Promise<{ page: EventSubscribersPage; fresh: boolean } | null> {
  const cache = await readCache();
  const hit = cache[String(id)];
  if (!hit || !Array.isArray(hit.users)) return null;
  return {
    page: {
      users: hit.users,
      truncated: Boolean(hit.truncated),
      fetchedAt: hit.at,
    },
    fresh: Date.now() - hit.at < SUBSCRIBERS_TTL,
  };
}

/** Drops one event's entry (called when the user subscribes/unsubscribes). */
export async function clearCachedSubscribers(id: number): Promise<void> {
  const cache = await readCache();
  if (!(String(id) in cache)) return;
  delete cache[String(id)];
  await persist(cache);
}

export function sanitizeSubscribers(value: unknown): EventSubscriber[] {
  if (!Array.isArray(value)) return [];
  const out: EventSubscriber[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const login = String(raw.login ?? "").trim();
    if (!login) continue;
    out.push({
      login,
      displayName: String(raw.displayName ?? login).trim() || login,
      avatar: typeof raw.avatar === "string" && raw.avatar ? raw.avatar : null,
      avatarUrl:
        typeof raw.avatarUrl === "string" && raw.avatarUrl
          ? raw.avatarUrl
          : null,
      location:
        typeof raw.location === "string" && raw.location ? raw.location : null,
    });
  }
  return out;
}

async function request(id: number): Promise<EventSubscribersPage> {
  const [token, cloudLogin] = await Promise.all([
    getConfig("CLOUD_TOKEN"),
    getConfig("CLOUD_LOGIN"),
  ]);
  if (!token || !cloudLogin) throw new Error("not-connected");

  const hashed = await hashLogin(cloudLogin);
  const res = await workerFetch(
    `/api/v1/private/event-subscribers?event=${id}&login=${encodeURIComponent(hashed)}`,
    { token },
  );
  if (!res.ok) throw new Error(`http-${res.status}`);

  const data = (await res.json()) as { users?: unknown; truncated?: unknown };
  const page: EventSubscribersPage = {
    users: sanitizeSubscribers(data?.users),
    truncated: Boolean(data?.truncated),
    fetchedAt: Date.now(),
  };

  const cache = await readCache();
  cache[String(id)] = {
    at: page.fetchedAt,
    users: page.users,
    truncated: page.truncated,
  };
  prune(cache);
  await persist(cache);
  return page;
}

/** Subscribers of a 42 event, live from the worker (cached for a day). */
export function fetchEventSubscribers(
  id: number,
): Promise<EventSubscribersPage> {
  const pending = inFlight.get(id);
  if (pending) return pending;
  const promise = request(id).finally(() => inFlight.delete(id));
  inFlight.set(id, promise);
  return promise;
}

/** Loose comparison key: "[CLUB] Art&Craft" and "[club] art craft" match. */
export function normalizeEventName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Finds an event id by name from Intra's own event list. The v3 calendar
 * dialog does not expose the id anywhere in its markup, so this is the
 * fallback that makes the button work there.
 */
export async function lookupEventId(name: string): Promise<number | null> {
  const target = normalizeEventName(name);
  if (!target) return null;

  const token = sessionStorage.getItem("ft_intrapy_token");
  if (!token) return null;

  const data = await intrapyFetch<
    Record<string, { id?: number; name?: string }>
  >("/api/v1/users/me/events", token);
  if (!data || typeof data !== "object") return null;

  for (const [key, event] of Object.entries(data)) {
    if (!event || typeof event !== "object") continue;
    if (normalizeEventName(String(event.name ?? "")) !== target) continue;
    const id = Number(event.id ?? key);
    if (Number.isFinite(id)) return id;
  }
  return null;
}
