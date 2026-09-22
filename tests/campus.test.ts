/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://profile-v3.intra.42.fr/" }
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const CAMPUS_ID = "12";
const CACHE_KEY = `CAMPUS_DATA_${CAMPUS_ID}`;
const TTL_MS = 60 * 60 * 1000;

const manifest = { campuses: [{ id: CAMPUS_ID, name: "Mulhouse" }] };
const campusFile = {
  clusters: [{ id: "c1", name: "c1" }],
  definitions: {},
};

function cacheEntry(data: unknown, ageMs: number) {
  return { data, timestamp: Date.now() - ageMs };
}

async function loadCampus() {
  vi.resetModules();
  return import("../src/features/campus/campus.ts");
}

describe("campus cache", () => {
  beforeEach(async () => {
    (chrome.storage.local.clear as any)();
    vi.mocked(chrome.storage.local.get).mockClear();
    vi.mocked(chrome.storage.local.set).mockClear();
    vi.restoreAllMocks();
  });

  it("serves an expired copy without waiting for the refresh", async () => {
    await chrome.storage.local.set({
      CLUSTERS_CAMPUS: CAMPUS_ID,
      CAMPUS_MANIFEST_V2: {
        manifest,
        timestamp: Date.now() - TTL_MS - 1,
      },
      [CACHE_KEY]: cacheEntry(campusFile, TTL_MS + 1),
    });
    // The network never answers: the call must still resolve.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    const { loadCampusData } = await loadCampus();
    const data = await loadCampusData(CAMPUS_ID);
    expect(data).toBe(campusFile);
  });

  it("does not touch the network while the cache is fresh", async () => {
    await chrome.storage.local.set({
      [CACHE_KEY]: cacheEntry(campusFile, 1000),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { loadCampusData } = await loadCampus();
    expect(await loadCampusData(CAMPUS_ID)).toBe(campusFile);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits for the network on a cold cache and stores the result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes("campuses.json") ? manifest : campusFile,
      })),
    );

    const { loadCampusData } = await loadCampus();
    await loadCampusData(CAMPUS_ID);

    const stored = await chrome.storage.local.get(CACHE_KEY);
    expect(stored[CACHE_KEY].data).toBe(campusFile);
  });

  it("falls back to the expired copy when the refresh fails", async () => {
    await chrome.storage.local.set({
      CLUSTERS_CAMPUS: CAMPUS_ID,
      CAMPUS_MANIFEST_V2: { manifest, timestamp: Date.now() - TTL_MS - 1 },
      [CACHE_KEY]: cacheEntry(campusFile, TTL_MS + 1),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 })),
    );

    const { loadCampusData } = await loadCampus();
    expect(await loadCampusData(CAMPUS_ID)).toBe(campusFile);
  });

  it("fails loudly on a forced reload", async () => {
    await chrome.storage.local.set({
      CLUSTERS_CAMPUS: CAMPUS_ID,
      CAMPUS_MANIFEST_V2: { manifest, timestamp: Date.now() - TTL_MS - 1 },
      [CACHE_KEY]: cacheEntry(campusFile, TTL_MS + 1),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 })),
    );

    const { loadCampusData } = await loadCampus();
    await expect(loadCampusData(CAMPUS_ID, true)).rejects.toThrow();
  });

  it("serves an expired manifest when the list fetch fails", async () => {
    await chrome.storage.local.set({
      CAMPUS_MANIFEST_V2: { manifest, timestamp: Date.now() - TTL_MS - 1 },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 })),
    );

    const { fetchCampusList } = await loadCampus();
    expect(await fetchCampusList()).toEqual(manifest);
  });

  it("loads campus data once for concurrent ensureCampusData calls", async () => {
    await chrome.storage.local.set({ CLUSTERS_CAMPUS: CAMPUS_ID });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes("campuses.json") ? manifest : campusFile,
      })),
    );

    const { ensureCampusData, CLUSTERS } = await loadCampus();
    CLUSTERS.length = 0;
    vi.mocked(chrome.storage.local.get).mockClear();

    await Promise.all([ensureCampusData(), ensureCampusData()]);
    await ensureCampusData();

    const campusIdReads = vi
      .mocked(chrome.storage.local.get)
      .mock.calls.filter(([keys]) => keys === "CLUSTERS_CAMPUS").length;
    expect(campusIdReads).toBe(1);
  });
});
