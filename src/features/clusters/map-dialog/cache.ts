import { SeatPos } from "./crop";

const SVG_CACHE_PREFIX = "cluster_svg_v2_";
/** Old prefix: maps were cached from meta.intra.42.fr before the shared ones. */
const LEGACY_SVG_CACHE_PREFIX = "cluster_svg_";
const SVG_URLS_CACHE_PREFIX = "CLUSTER_SVG_URLS_V1_";
const META_BASE = "https://meta.intra.42.fr/";
/** The stored copy is a 7-day offline fallback; it is revalidated long before. */
const CACHE_TTL = 7 * 24 * 60 * 60_000;
/** Maps are revalidated at most this often (the worker answers 304 via ETag). */
export const CACHE_REVALIDATE_MS = 10 * 60_000;

export function isClusterCacheFresh(cachedAt: number): boolean {
  return Date.now() - cachedAt < CACHE_REVALIDATE_MS;
}

export interface CachedCluster {
  svg: string;
  seats: [string, SeatPos][];
  viewBox: { w: number; h: number };
  cachedAt: number;
  /** Map URL the entry came from: a different source invalidates it. */
  source?: string;
}

interface SvgsCacheEntry {
  data: Record<string, string>;
  cachedAt: number;
}

export async function getCachedCluster(
  campusId: string,
  clusterId: string,
  source?: string,
): Promise<CachedCluster | null> {
  const key = `${SVG_CACHE_PREFIX}${campusId}_${clusterId}`;
  const result = (await chrome.storage.local.get(key)) as Record<
    string,
    string
  >;
  const raw = result[key];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedCluster;
    if (Date.now() - parsed.cachedAt > CACHE_TTL) return null;
    // A map that now comes from another URL (shared assets instead of 42's
    // map) must not be served from an older cache entry.
    if (source && parsed.source !== source) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedCluster(
  campusId: string,
  clusterId: string,
  data: CachedCluster,
) {
  data.cachedAt = Date.now();
  await chrome.storage.local.set({
    [`${SVG_CACHE_PREFIX}${campusId}_${clusterId}`]: JSON.stringify(data),
  });
  // Drop the old map cached from meta.intra.42.fr (now a different map).
  try {
    await chrome.storage.local.remove(
      `${LEGACY_SVG_CACHE_PREFIX}${campusId}_${clusterId}`,
    );
  } catch {}
}

/** Drops the cached map SVGs (and the scraped map URLs) for a campus. */
export async function clearClusterMapCaches(campusId: string): Promise<void> {
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter(
      (k) =>
        k.startsWith(`${SVG_CACHE_PREFIX}${campusId}_`) ||
        k.startsWith(`${LEGACY_SVG_CACHE_PREFIX}${campusId}_`) ||
        k === `${SVG_URLS_CACHE_PREFIX}${campusId}`,
    );
    if (keys.length) await chrome.storage.local.remove(keys);
  } catch {}
}

export function getSvgSlug(svgUrl: string): string {
  try {
    const path = new URL(svgUrl).pathname;
    const file = path.split("/").pop() || "";
    return file.replace(/\.svg$/i, "");
  } catch {
    return "";
  }
}

export function parseClusterPanes(html: string): Record<string, string> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const map: Record<string, string> = {};
  for (const pane of doc.querySelectorAll(".tab-pane")) {
    const id = pane.getAttribute("id") || "";
    const match = id.match(/^cluster-(.+)$/);
    if (!match) continue;
    const svgUrl = pane
      .querySelector(".map-container[data-image]")
      ?.getAttribute("data-image");
    if (!svgUrl) continue;
    try {
      map[match[1]] = new URL(svgUrl, META_BASE).href;
    } catch {}
  }
  return map;
}

export async function scrapeCampusSVGUrls(
  campusId: string,
): Promise<Record<string, string>> {
  const cacheKey = `${SVG_URLS_CACHE_PREFIX}${campusId}`;
  const cached = (await chrome.storage.local.get(cacheKey)) as {
    [cacheKey]?: SvgsCacheEntry;
  };
  const entry = cached[cacheKey];
  if (entry && Date.now() - entry.cachedAt <= CACHE_TTL) {
    return entry.data;
  }
  try {
    const url = campusId
      ? `https://meta.intra.42.fr/campus/${campusId}/clusters`
      : "https://meta.intra.42.fr/clusters";
    const res = await fetch(url, {
      headers: { Accept: "text/html" },
      credentials: "include",
    });
    if (res.ok) {
      const html = await res.text();
      const data = parseClusterPanes(html);
      if (Object.keys(data).length > 0) {
        chrome.storage.local.set({
          [cacheKey]: { data, cachedAt: Date.now() },
        });
      }
      return data;
    }
  } catch {}
  return {};
}
