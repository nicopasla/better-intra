import { getConfig } from "../../config.ts";

interface ClusterDataFile {
  clusters: { id: string; name: string }[];
  definitions: Record<string, unknown>;
}

interface CampusManifest {
  campuses: { id: string; name: string }[];
}

export let CLUSTERS: { id: string; name: string }[] = [];

const CAMPUS_BASE =
  "https://raw.githubusercontent.com/nicopasla/better-intra/main/campuses";
const CACHE_PREFIX = "CAMPUS_DATA_";
const MANIFEST_CACHE_KEY = "CAMPUS_MANIFEST";
const CACHE_TTL = 60 * 60 * 1000;

export async function fetchCampusList(): Promise<CampusManifest> {
  const cached = await chrome.storage.local.get(MANIFEST_CACHE_KEY);
  const cachedData = cached[MANIFEST_CACHE_KEY] as
    | { manifest: CampusManifest; timestamp: number }
    | undefined;
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return cachedData.manifest;
  }
  const res = await fetch(`${CAMPUS_BASE}/campuses.json`);
  if (!res.ok) throw new Error("Failed to fetch campus list");
  const manifest = (await res.json()) as CampusManifest;
  await chrome.storage.local.set({
    [MANIFEST_CACHE_KEY]: { manifest, timestamp: Date.now() },
  });
  return manifest;
}

export async function loadCampusData(
  campusId: string,
): Promise<ClusterDataFile> {
  const cacheKey = `${CACHE_PREFIX}${campusId}`;
  const cached = await chrome.storage.local.get(cacheKey);
  const cachedData = cached[cacheKey] as
    | { data: ClusterDataFile; timestamp: number }
    | undefined;
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return cachedData.data;
  }
  const res = await fetch(`${CAMPUS_BASE}/${campusId}/clusters.json`);
  if (!res.ok) throw new Error(`Failed to fetch campus data for ${campusId}`);
  const data = (await res.json()) as ClusterDataFile;
  await chrome.storage.local.set({
    [cacheKey]: { data, timestamp: Date.now() },
  });
  return data;
}

export async function detectCampus(): Promise<string | null> {
  try {
    const token = sessionStorage.getItem("ft_intrapy_token");
    if (!token) return null;
    const res = await fetch(
      "https://intrapy.intra.42.fr/api/v1/users/me/campus",
      { headers: { Authorization: token } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id: number;
      is_primary: boolean;
    }[];
    const primary = data.find((c) => c.is_primary) || data[0];
    return primary ? String(primary.id) : null;
  } catch {
    return null;
  }
}

const CAMPUS_LOADED_KEY = "ft_campus_data_loaded";

export async function ensureCampusData(): Promise<void> {
  if (sessionStorage.getItem(CAMPUS_LOADED_KEY)) return;
  sessionStorage.setItem(CAMPUS_LOADED_KEY, "1");

  let campus = await getConfig("CLUSTERS_CAMPUS");
  if (!campus || campus === "") {
    const detected = await detectCampus();
    if (detected) {
      await chrome.storage.local.set({
        CLUSTERS_CAMPUS: detected,
        CLUSTERS_CAMPUS_AUTO: true,
      });
      campus = detected;
    }
  }

  if (campus && campus !== "" && CLUSTERS.length === 0) {
    const data = await loadCampusData(campus);
    CLUSTERS = data.clusters;
  }
}

export async function fetchEventTypes(
  campusId: string,
): Promise<{ label: string; value: string }[]> {
  try {
    const res = await fetch(`${CAMPUS_BASE}/${campusId}/event_types.json`);
    if (!res.ok) return [];
    const data = await res.json();
    const types = data.event_types as Record<
      string,
      { display: string; keywords: string[] }
    >;
    return Object.entries(types).map(([key, val]) => ({
      label: val.display || key,
      value: key,
    }));
  } catch {
    return [];
  }
}

export async function loadEventTypeKeywords(
  campusId: string,
): Promise<Record<string, string[]>> {
  try {
    const res = await fetch(`${CAMPUS_BASE}/${campusId}/event_types.json`);
    if (!res.ok) return {};
    const data = await res.json();
    const types = data.event_types as Record<
      string,
      { display: string; keywords: string[] }
    >;
    const map: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(types)) {
      map[key] = val.keywords;
    }
    return map;
  } catch {
    return {};
  }
}
