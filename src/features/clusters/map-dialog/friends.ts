import { getConfig } from "../../../config.ts";
import { hashLogin } from "../../../utils/crypto.ts";
import { workerFetch } from "../../../utils/worker.ts";

export interface ClusterFriends {
  /** Lower-case friend logins. */
  list: Set<string>;
  /** Lower-case login of the current cloud user, when known. */
  me: string | null;
}

function normalize(raw: unknown): Set<string> {
  const list = new Set<string>();
  if (Array.isArray(raw)) {
    for (const login of raw) {
      const normalized = String(login).trim().toLowerCase();
      if (normalized) list.add(normalized);
    }
  }
  return list;
}

/**
 * Reads the friends list used by the cluster map. Prefers the local extension
 * copy; when that is empty, falls back to the shared cloud settings so friends
 * added in the PWA still get their blue ring.
 */
export async function loadClusterFriends(): Promise<ClusterFriends> {
  const [raw, cloudLogin, token] = await Promise.all([
    getConfig("FRIENDS_LIST"),
    getConfig("CLOUD_LOGIN"),
    getConfig("CLOUD_TOKEN"),
  ]);
  const me = cloudLogin ? cloudLogin.trim().toLowerCase() : null;
  let list = normalize(raw);

  if (list.size === 0 && me && token) {
    try {
      const hashed = await hashLogin(me);
      const res = await workerFetch(
        `/api/v1/private/settings?login=${encodeURIComponent(hashed)}`,
        { token, cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          settings?: { FRIENDS_LIST?: unknown };
        };
        list = normalize(data.settings?.FRIENDS_LIST);
      }
    } catch {
      /* offline / not signed in: the map still works without friend rings */
    }
  }

  return { list, me };
}
