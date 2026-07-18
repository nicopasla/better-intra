import { SeatPos } from "./crop";

const WORKER_URL = "https://api.betterintra.com";
const SVG_CACHE_PREFIX = "cluster_svg_";
const SVG_URLS_CACHE_KEY = "CLUSTER_SVG_URLS_CACHE";
const CACHE_TTL = 7 * 24 * 60 * 60_000;

export interface CachedCluster {
  svg: string;
  seats: [string, SeatPos][];
  viewBox: { w: number; h: number };
  cachedAt: number;
}

interface SvgsCacheEntry {
  data: Record<string, string>;
  cachedAt: number;
}

export async function getCachedCluster(
  id: string,
): Promise<CachedCluster | null> {
  const result = (await chrome.storage.local.get(
    `${SVG_CACHE_PREFIX}${id}`,
  )) as Record<string, string>;
  const raw = result[`${SVG_CACHE_PREFIX}${id}`];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedCluster;
    if (Date.now() - parsed.cachedAt > CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedCluster(id: string, data: CachedCluster) {
  data.cachedAt = Date.now();
  await chrome.storage.local.set({
    [`${SVG_CACHE_PREFIX}${id}`]: JSON.stringify(data),
  });
}

export async function fetchClusterSVGs(): Promise<Record<string, string>> {
  const cached = (await chrome.storage.local.get(SVG_URLS_CACHE_KEY)) as {
    [SVG_URLS_CACHE_KEY]?: SvgsCacheEntry;
  };
  const entry = cached[SVG_URLS_CACHE_KEY];
  if (entry && Date.now() - entry.cachedAt <= CACHE_TTL) return entry.data;
  try {
    const res = await fetch(`${WORKER_URL}/api/v1/cluster/svgs`);
    if (res.ok) {
      const data = (await res.json()) as Record<string, string>;
      chrome.storage.local.set({
        [SVG_URLS_CACHE_KEY]: { data, cachedAt: Date.now() },
      });
      return data;
    }
  } catch {}
  return {};
}
