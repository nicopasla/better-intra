export type ScreenDirection = "UP" | "DOWN" | "LEFT" | "RIGHT" | "NONE";
import { getConfig } from "../../config.ts";

interface RowConfig {
  range: string;
  pos: number[];
  dir: ScreenDirection;
}

interface ManualConfig {
  row: string;
  pos: number[];
  dir: ScreenDirection;
}

export interface ClusterDefinition {
  rows?: RowConfig[];
  manual?: ManualConfig[];
  overrides?: Record<string, ScreenDirection>;
}

interface ClusterDataFile {
  clusters: { id: string; name: string }[];
  definitions: Record<string, ClusterDefinition>;
}

interface CampusManifest {
  campuses: { id: string; name: string }[];
}

function rowScreens(
  row: string,
  positions: number[],
  dir: ScreenDirection,
): Record<string, ScreenDirection> {
  return Object.fromEntries(positions.map((n) => [`${row}-p${n}`, dir]));
}

function rowsScreens(
  rows: string[],
  positions: number[],
  dir: ScreenDirection,
): Record<string, ScreenDirection> {
  return Object.fromEntries(
    rows.flatMap((row) => positions.map((n) => [`${row}-p${n}`, dir])),
  );
}

function prefixScreens(
  prefix: string,
  screens: Record<string, ScreenDirection>,
): Record<string, ScreenDirection> {
  return Object.fromEntries(
    Object.entries(screens).map(([id, dir]) => [`${prefix}-${id}`, dir]),
  );
}

const expandRange = (range: string) => {
  const [start, end] = range.split("-");
  const prefix = start[0];
  const startN = parseInt(start.slice(1));
  const endN = parseInt(end.slice(1));
  return Array.from(
    { length: endN - startN + 1 },
    (_, i) => `${prefix}${startN + i}`,
  );
};

const buildScreens = (
  definitions: Record<string, ClusterDefinition>,
): Record<string, ScreenDirection> => {
  const final: Record<string, ScreenDirection> = {};
  Object.entries(definitions).forEach(([clusterName, config]) => {
    config.rows?.forEach((r) => {
      const rows = expandRange(r.range);
      Object.assign(
        final,
        prefixScreens(clusterName, rowsScreens(rows, r.pos, r.dir)),
      );
    });
    config.manual?.forEach((m) => {
      Object.assign(
        final,
        prefixScreens(clusterName, rowScreens(m.row, m.pos, m.dir)),
      );
    });
    if (config.overrides) {
      Object.entries(config.overrides).forEach(([k, v]) => {
        final[`${clusterName}-${k}`] = v;
      });
    }
  });
  return final;
};

// Populated dynamically by getClusterData()
export let CLUSTERS: { id: string; name: string }[] = [];
export let SCREENS: Record<string, ScreenDirection> = {};

const CAMPUS_BASE =
  "https://raw.githubusercontent.com/nicopasla/better-intra/main/campuses";
const CACHE_PREFIX = "CAMPUS_DATA_";
const MANIFEST_CACHE_KEY = "CAMPUS_MANIFEST";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

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

export async function getClusterData(campusId: string): Promise<{
  clusters: { id: string; name: string }[];
  screens: Record<string, ScreenDirection>;
}> {
  const data = await loadCampusData(campusId);
  CLUSTERS = data.clusters;
  SCREENS = buildScreens(data.definitions);
  return {
    clusters: data.clusters,
    screens: SCREENS,
  };
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
    try {
      await getClusterData(campus);
    } catch {
      // silently fail, will retry next page load
    }
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
