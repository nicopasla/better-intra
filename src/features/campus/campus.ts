import { getConfig } from "../../config.ts";

export interface TranscriptEntry {
  cursusLabel: string;
  records: { label: string; sr_id: number }[];
}

export type ExitArrowDir = "up" | "right" | "down" | "left";

export interface ExitSign {
  x: number | string;
  y: number | string;
  w?: number | string;
  h?: number | string;
  dir?: ExitArrowDir;
  label?: string;
}

export type ExitConfig = Record<string, ExitSign[]>;

interface ClusterDataFile {
  clusters: { id: string; name: string; svg?: string }[];
  transcripts?: TranscriptEntry[];
  definitions: Record<string, unknown>;
  exits?: ExitConfig;
  badgeBaseUrl?: string;
  badges?: Record<string, string>;
}

interface CampusManifest {
  campuses: { id: string; name: string; timezone?: string }[];
}

export const CLUSTERS: { id: string; name: string; svg?: string }[] = [];

function setClusters(clusters: { id: string; name: string; svg?: string }[]) {
  CLUSTERS.length = 0;
  CLUSTERS.push(...clusters);
}

const CAMPUS_BASE = "https://api.betterintra.com/gh/campuses";
const CACHE_PREFIX = "CAMPUS_DATA_";
const MANIFEST_CACHE_KEY = "CAMPUS_MANIFEST_V2";
const CACHE_TTL = 60 * 60 * 1000;
const inFlightLoads = new Map<string, Promise<ClusterDataFile>>();

async function resolveCampusFolder(
  campusId: string,
  force?: boolean,
): Promise<string> {
  const manifest = await fetchCampusList(force);
  const campus = manifest.campuses.find((c) => c.id === campusId);
  if (!campus) return campusId;
  return campus.name.toLowerCase().replace(/\s+/g, "-");
}

async function resolveCampusId(
  campusId: string,
  force?: boolean,
): Promise<string> {
  if (campusId) return campusId;
  const manifest = await fetchCampusList(force);
  for (const campus of manifest.campuses) {
    const prefix = campus.name.toLowerCase().replace(/\s+/g, "-");
    const res = await fetch(`${CAMPUS_BASE}/${prefix}.json`, {
      cache: force ? "no-store" : undefined,
    });
    if (res.ok) return campus.id;
  }
  return "";
}

let campusListenerInstalled = false;
let knownCampusId: string | null = null;

function installCampusDetectedListener(): void {
  if (campusListenerInstalled) return;
  campusListenerInstalled = true;

  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== "local" || !("CLUSTERS_CAMPUS" in changes)) return;
    knownCampusId = String(changes.CLUSTERS_CAMPUS.newValue ?? "");
  });

  document.addEventListener("42_CAMPUS_DETECTED", async (e) => {
    if (location.pathname.includes("/users/")) return;
    const campusId = (e as CustomEvent).detail as string;
    // Skip writing the id the page announces on every load.
    if (knownCampusId === null) {
      knownCampusId = await getConfig("CLUSTERS_CAMPUS");
    }
    if (knownCampusId !== campusId) {
      knownCampusId = campusId;
      await chrome.storage.local.set({
        CLUSTERS_CAMPUS: campusId,
      });
    }
    if (CLUSTERS.length === 0) {
      try {
        const data = await loadCampusData(campusId);
        setClusters(data.clusters);
      } catch {}
    }
  });
}

export async function fetchCampusList(
  force?: boolean,
): Promise<CampusManifest> {
  const cached = await chrome.storage.local.get(MANIFEST_CACHE_KEY);
  const cachedData = cached[MANIFEST_CACHE_KEY] as
    | { manifest: CampusManifest; timestamp: number }
    | undefined;
  if (!force && cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return cachedData.manifest;
  }
  let manifest: CampusManifest;
  try {
    const res = await fetch(`${CAMPUS_BASE}/campuses.json`, {
      cache: force ? "no-store" : undefined,
    });
    if (!res.ok) throw new Error("Failed to fetch campus list");
    manifest = (await res.json()) as CampusManifest;
  } catch (e) {
    // Stale-if-error; a forced load still reports the failure.
    if (!force && cachedData) return cachedData.manifest;
    throw e;
  }
  await chrome.storage.local.set({
    [MANIFEST_CACHE_KEY]: { manifest, timestamp: Date.now() },
  });
  return manifest;
}

export async function loadCampusData(
  campusId: string,
  force?: boolean,
): Promise<ClusterDataFile> {
  const resolvedId = await resolveCampusId(campusId, force);
  if (!resolvedId) throw new Error("No campus data available");
  const cacheKey = `${CACHE_PREFIX}${resolvedId}`;
  // Also the stale-if-error fallback below. A forced load never reads it.
  let cachedData: { data: ClusterDataFile; timestamp: number } | undefined;
  if (!force) {
    const cached = await chrome.storage.local.get(cacheKey);
    cachedData = cached[cacheKey] as typeof cachedData;
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return cachedData.data;
    }
  }
  const existing = force ? undefined : inFlightLoads.get(cacheKey);
  if (existing) return cachedData ? cachedData.data : existing;
  const load = (async () => {
    let data: ClusterDataFile;
    try {
      const prefix = await resolveCampusFolder(resolvedId, force);
      const res = await fetch(`${CAMPUS_BASE}/${prefix}.json`, {
        cache: force ? "no-store" : undefined,
      });
      if (!res.ok)
        throw new Error(`Failed to fetch campus data for ${resolvedId}`);
      data = (await res.json()) as ClusterDataFile;
    } catch (e) {
      if (cachedData) return cachedData.data;
      throw e;
    }
    await chrome.storage.local.set({
      [cacheKey]: { data, timestamp: Date.now() },
    });
    return data;
  })().finally(() => {
    if (!force) inFlightLoads.delete(cacheKey);
  });
  if (!force) inFlightLoads.set(cacheKey, load);
  if (force) return await load;
  // Stale-while-revalidate: an expired file is served at once and refreshed
  // behind the caller. Only a cold install waits for the network.
  if (cachedData) {
    load.catch(() => {});
    return cachedData.data;
  }
  return load;
}

/** The refresh started by a stale loadCampusData(), if one is running. */
function pendingRefresh(
  campusId: string,
): Promise<ClusterDataFile> | undefined {
  return inFlightLoads.get(`${CACHE_PREFIX}${campusId}`);
}

export async function clearCampusConfigCache(campusId: string): Promise<void> {
  await chrome.storage.local.remove([
    `${CACHE_PREFIX}${campusId}`,
    MANIFEST_CACHE_KEY,
  ]);
}

let ensurePromise: Promise<void> | null = null;

/** Load the campus cluster list once per page (main.ts, profile.ts, clusters.ts). */
export async function ensureCampusData(): Promise<void> {
  installCampusDetectedListener();
  if (CLUSTERS.length > 0) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    if (knownCampusId === null) {
      knownCampusId = await getConfig("CLUSTERS_CAMPUS");
    }
    const campus = knownCampusId;
    if (campus && campus !== "") {
      if (CLUSTERS.length === 0) {
        try {
          const data = await loadCampusData(campus);
          setClusters(data.clusters);
          pendingRefresh(campus)?.then(
            (fresh) => setClusters(fresh.clusters),
            () => {},
          );
        } catch {}
      }
    }
  })().finally(() => {
    // Cleared so a failed load can be retried by the next caller.
    ensurePromise = null;
  });
  return ensurePromise;
}
