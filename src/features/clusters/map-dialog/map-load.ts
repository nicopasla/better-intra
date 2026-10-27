import type { ClusterInfo, DialogState } from "./context";
import { WORKER_URL, SEAT_TARGET_PX, keyOf, clusterLabel } from "./context";
import { getClusterData, getCampusExits } from "../clusters.data.ts";
import {
  CACHE_REVALIDATE_MS,
  getCachedCluster,
  isClusterCacheFresh,
  setCachedCluster,
  scrapeCampusSVGUrls,
} from "./cache";
import { sanitizeAndParseSeats, getSvgTitle, applyMarkers } from "./seats";
import { applyExitSigns } from "./exit-markers";
import { renderActiveList } from "./render";
import { loadOccupancy, reapplyOccupancy } from "./occupancy";
import { whenIdle } from "./helpers";
import { updateActiveSortControls } from "./active-sort";
import { clearSeatGlow } from "./glow";
import { rebuildHeader, updateCampusTime, updateDefaultSelect } from "./header";
import { getCampusFlag } from "../../profile/campus-flags.ts";

function syncMarkersButton(state: DialogState) {
  state.shadow
    .querySelectorAll<HTMLElement>('[id="markers-btn"]')
    .forEach((el) => {
      el.style.display = state.markersAvailable ? "" : "none";
    });
}

export async function buildClusters(
  campusId: string,
): Promise<{ clusters: ClusterInfo[]; hasMarkers: boolean }> {
  let repoClusters: { id: string; name: string; svg?: string }[] = [];
  let hasMarkers = false;
  try {
    const data = await getClusterData(campusId);
    repoClusters = data.clusters;
    hasMarkers = Object.values(data.screens).some((d) => d !== "NONE");
  } catch {
    repoClusters = [];
  }
  // Maps listed in the campus file are shared assets (campuses/maps/…); only
  // scrape meta.intra.42.fr for clusters that don't point at one.
  const svgs =
    repoClusters.length > 0 && repoClusters.every((c) => c.svg)
      ? {}
      : await scrapeCampusSVGUrls(campusId);
  const list: ClusterInfo[] = [];
  for (const c of repoClusters) {
    const svg = c.svg || svgs[c.id];
    if (svg) list.push({ id: c.id, name: c.name || "", svg });
  }
  for (const [id, svg] of Object.entries(svgs)) {
    if (!list.some((c) => c.id === id)) list.push({ id, name: "", svg });
  }
  return { clusters: list, hasMarkers };
}

function mapSvgUrl(svgUrl: string): string {
  // Maps listed in the campus file are served by our own worker (already
  // CORS-enabled), so only 42's URLs go through the proxy.
  return svgUrl.startsWith(WORKER_URL)
    ? svgUrl
    : `${WORKER_URL}/api/v1/cluster/svg?url=${encodeURIComponent(svgUrl)}`;
}

/** Parses and stores the seat/viewBox data for a map (once per version). */
function applyMapSvg(
  state: DialogState,
  c: ClusterInfo,
  campusId: string,
  svgText: string,
): void {
  const key = keyOf(campusId, c.id);
  if (state.svgViewBoxes.has(key)) return;
  const svgDoc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const seatMap = sanitizeAndParseSeats(svgDoc);
  state.parsedDocs.set(key, svgDoc);
  const title = getSvgTitle(svgDoc);
  if (title && !c.name.trim()) c.name = title;
  const vb = (svgDoc.querySelector("svg")?.getAttribute("viewBox") ?? "")
    .split(/\s+/)
    .map(Number);
  state.svgViewBoxes.set(key, { w: vb[2] || 1200, h: vb[3] || 800 });
  state.seatPosCache.set(key, seatMap);
}

/** Drops everything derived from a map whose SVG body changed. */
function invalidateMapSvg(
  state: DialogState,
  c: ClusterInfo,
  campusId: string,
): void {
  const key = keyOf(campusId, c.id);
  state.parsedDocs.delete(key);
  state.seatPosCache.delete(key);
  state.svgViewBoxes.delete(key);
  state.seatGeomCache.delete(key);
  state.trimmedViewBoxes.delete(key);
  if (state.overlay && state.activeCluster.id === c.id) state.overlay = null;
  state.mapVersions.set(key, (state.mapVersions.get(key) ?? 0) + 1);
}

/**
 * Loads a map's SVG, revalidating the stored copy at most every
 * `CACHE_REVALIDATE_MS`. The worker answers 304 (ETag) when the map is
 * unchanged, so the 7-day stored copy is never blindly trusted, and still
 * works offline.
 */
export async function ensureClusterData(
  state: DialogState,
  c: ClusterInfo,
  campusId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!c.svg) {
    return null;
  }
  const key = keyOf(campusId, c.id);
  try {
    // Hot path (every poll): the map is already parsed and was checked recently.
    if (
      state.svgViewBoxes.has(key) &&
      isClusterCacheFresh(state.mapFetchedAt.get(key) ?? 0)
    ) {
      return "cached";
    }

    const cached = await getCachedCluster(campusId, c.id, c.svg);
    const stored = cached?.svg ?? null;
    const lastFetch = Math.max(
      state.mapFetchedAt.get(key) ?? 0,
      cached?.cachedAt ?? 0,
    );
    if (state.svgViewBoxes.has(key) && isClusterCacheFresh(lastFetch)) {
      state.mapFetchedAt.set(key, lastFetch);
      return stored ?? "cached";
    }

    // Fresh stored copy (first load in this dialog): skip the network entirely.
    if (stored && cached && isClusterCacheFresh(cached.cachedAt)) {
      state.mapFetchedAt.set(key, cached.cachedAt);
      applyMapSvg(state, c, campusId, stored);
      return stored;
    }

    let svgText: string | null = null;
    try {
      const res = await fetch(mapSvgUrl(c.svg), {
        cache: "no-cache",
        signal,
      });
      if (res.ok) svgText = await res.text();
    } catch {
      if (signal?.aborted) return null;
    }

    const next = svgText ?? stored;
    if (!next) return null;

    const changed = svgText !== null && svgText !== stored;
    if (changed) invalidateMapSvg(state, c, campusId);
    applyMapSvg(state, c, campusId, next);

    if (changed) {
      const seats = state.seatPosCache.get(key);
      const viewBox = state.svgViewBoxes.get(key);
      if (seats && viewBox) {
        setCachedCluster(campusId, c.id, {
          svg: next,
          seats: [...seats],
          viewBox,
          source: c.svg,
          cachedAt: 0,
        }).catch(() => {});
      }
    }

    // A 304 (or an offline fallback) only updates the check timestamp; a
    // failure retries in a minute instead of after the full revalidation delay.
    state.mapFetchedAt.set(
      key,
      svgText === null ? Date.now() - CACHE_REVALIDATE_MS + 60_000 : Date.now(),
    );

    return next;
  } catch {
    return null;
  }
}

export function trimSvgToContent(state: DialogState) {
  const mapArea = state.shadow.getElementById("map-area");
  const svg = mapArea?.querySelector("svg") as SVGSVGElement | null;
  if (!svg) return;
  const key = keyOf(state.activeCampusId, state.activeCluster.id);
  // Measuring a big SVG forces a full layout: do it once per cluster.
  const cached = state.trimmedViewBoxes.get(key);
  if (cached) {
    svg.setAttribute("viewBox", cached);
    return;
  }
  try {
    const bbox = svg.getBBox();
    if (bbox.width > 0 && bbox.height > 0) {
      const pad = 10;
      const minX = bbox.x - pad;
      const minY = bbox.y - pad;
      const maxX = bbox.x + bbox.width + pad;
      const maxY = bbox.y + bbox.height + pad;
      const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
      svg.setAttribute("viewBox", viewBox);
      state.trimmedViewBoxes.set(key, viewBox);
    }
  } catch {}
}

export function updateZoom(state: DialogState) {
  const mapArea = state.shadow.getElementById("map-area");
  const svg = mapArea?.querySelector("svg") as SVGSVGElement | null;
  if (mapArea && svg) {
    svg.style.width = `${Math.max(
      1,
      Math.round(mapArea.clientWidth * state.zoomLevel),
    )}px`;
    svg.style.height = "auto";
  }
  const pct = state.shadow.querySelector(".zoom-pct") as HTMLElement | null;
  if (pct) pct.textContent = `${Math.round(state.zoomLevel * 100)}%`;
  requestAnimationFrame(() => reapplyOccupancy(state));
}

export async function loadCluster(
  state: DialogState,
  cluster: ClusterInfo,
  signal?: AbortSignal,
) {
  state.activeCluster = cluster;
  state.zoomLevel = 1.0;
  clearSeatGlow(state);
  const isOverview = cluster.id === "active";
  const badge = state.shadow.getElementById("seat-count-badge");
  if (badge) badge.style.display = isOverview ? "none" : "";
  const zoomCtrls = state.shadow.getElementById("zoom-controls");
  if (zoomCtrls) zoomCtrls.style.display = isOverview ? "none" : "";
  const sortCtrls = state.shadow.getElementById("active-sort");
  if (sortCtrls)
    sortCtrls.style.display = cluster.id === "active" ? "" : "none";
  const topBadges = state.shadow.getElementById("top-left-badges");
  topBadges?.classList.toggle("active-tab", cluster.id === "active");
  const id = ++state.loadId;
  state.retryCount = 0;

  state.shadow.querySelectorAll("[data-cluster-id]").forEach((el) => {
    const active = (el as HTMLElement).dataset.clusterId === cluster.id;
    (el as HTMLElement).classList.toggle("tab-active", active);
    (el as HTMLElement).classList.toggle("menu-active", active);
  });

  const summaryLabel = state.shadow.querySelector<HTMLElement>(
    ".clusters-nav-summary-label",
  );
  if (summaryLabel) summaryLabel.textContent = clusterLabel(cluster);

  const tabsRow = state.shadow.querySelector<HTMLElement>(".tabs-scroll");
  const activeTab = tabsRow?.querySelector<HTMLElement>(
    `[data-cluster-id="${CSS.escape(cluster.id)}"]`,
  );
  activeTab?.scrollIntoView({ block: "nearest", inline: "nearest" });

  const mapArea = state.shadow.getElementById("map-area");
  if (!mapArea) return;

  {
    const spinnerContainer = document.createElement("div");
    spinnerContainer.className = "flex items-center justify-center p-12";
    const spinner = document.createElement("span");
    spinner.className = "loading loading-spinner loading-lg";
    spinnerContainer.appendChild(spinner);
    mapArea.replaceChildren(spinnerContainer);
  }

  if (cluster.id === "active") {
    updateActiveSortControls(state);
    renderActiveList(state.shadow, state.activeUsers);
    return;
  }

  try {
    const svgText = await ensureClusterData(
      state,
      cluster,
      state.activeCampusId,
      signal,
    );
    if (!svgText) {
      if (id !== state.loadId) return;
      mapArea.replaceChildren();
      return;
    }
    if (id !== state.loadId) return;

    const svgDoc =
      state.parsedDocs.get(keyOf(state.activeCampusId, cluster.id)) ||
      new DOMParser().parseFromString(svgText, "image/svg+xml");

    mapArea.style.position = "relative";
    const imported = document.importNode(svgDoc.documentElement, true);
    const centeringWrap = document.createElement("div");
    centeringWrap.style.cssText =
      "display:flex;align-items:flex-start;min-height:100%;padding-top:2rem;";
    centeringWrap.appendChild(imported);
    mapArea.replaceChildren(centeringWrap);
    const svgEl = mapArea.querySelector("svg") as SVGSVGElement | null;
    const zp = state.shadow.querySelector(".zoom-pct") as HTMLElement | null;
    if (zp) zp.textContent = "100%";
    mapArea.scrollTop = 0;
    mapArea.scrollLeft = 0;
    // Shared maps carry their own chairs and signs, so the overlays (and the
    // Markers button) are only useful for maps that don't.
    const ownChairs = Boolean(svgDoc.querySelector('[class~="chair"]'));
    const ownSigns = Boolean(
      svgDoc.querySelector('[class~="sign"], [class~="exit"]'),
    );
    state.markersAvailable = state.hasMarkers && !ownChairs;
    if (state.markersAvailable) applyMarkers(mapArea, state.showMarkers);
    if (!ownSigns) applyExitSigns(state);
    syncMarkersButton(state);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    trimSvgToContent(state);
    mapArea.scrollTop = 0;
    mapArea.scrollLeft = 0;

    const seats = state.seatPosCache.get(
      keyOf(state.activeCampusId, cluster.id),
    );
    if (seats && seats.size > 0 && svgEl) {
      const vb = (svgEl.getAttribute("viewBox") || "").split(/\s+/).map(Number);
      const rect = svgEl.getBoundingClientRect();
      if (rect.width > 0) {
        const scaleX = rect.width / (vb[2] || 1200);
        const ws = [...seats.values()].map((s) => s.w).sort((a, b) => a - b);
        const hs = [...seats.values()].map((s) => s.h).sort((a, b) => a - b);
        const unit = Math.max(
          ws[Math.floor(ws.length / 2)],
          hs[Math.floor(hs.length / 2)],
        );
        state.zoomLevel = Math.min(
          3,
          Math.max(0.4, SEAT_TARGET_PX / (unit * scaleX)),
        );
        state.defaultZoomLevel = state.zoomLevel;
      }
    }
    updateZoom(state);

    if (id !== state.loadId) return;

    reapplyOccupancy(state);
  } catch {
    if (id !== state.loadId) return;
    state.retryCount++;
    if (state.retryCount <= 1) {
      loadCluster(state, state.activeCluster, signal);
    } else {
      state.retryCount = 0;
      const errorDiv = document.createElement("div");
      errorDiv.className =
        "flex items-center justify-center p-12 text-base-content/50";
      errorDiv.textContent = "Failed to load map";
      mapArea.replaceChildren(errorDiv);
    }
  }
}

export async function loadCampus(
  state: DialogState,
  campusId: string,
  signal?: AbortSignal,
) {
  const { shadow } = state;
  state.activeCampusId = campusId;
  state.zoomLevel = 1.0;
  state.loadId++;
  // If another campus is selected (or the dialog closed) while this one is
  // loading, the stale result must not overwrite state nor be cached under the
  // newer campus id. Keyed on the campus id: loadCluster() bumps loadId itself,
  // so a generation token on that counter would always look stale here.
  const stale = () =>
    state.activeCampusId !== campusId || signal?.aborted === true;
  const exits = await getCampusExits(campusId);
  if (stale()) return;
  state.campusExits = exits ?? null;
  const { clusters, hasMarkers } = await buildClusters(campusId);
  if (stale()) return;
  state.clusters = clusters;
  state.hasMarkers = hasMarkers;
  // Refined per map in loadCluster(): maps with their own chairs need no overlay.
  state.markersAvailable = hasMarkers;
  syncMarkersButton(state);
  if (!state.clusters.some((c) => c.svg)) {
    const mapArea = shadow.getElementById("map-area");
    if (mapArea) {
      const div = document.createElement("div");
      div.className =
        "flex items-center justify-center p-12 text-base-content/50";
      div.textContent = "No cluster data for this campus";
      mapArea.replaceChildren(div);
    }
    return;
  }
  state.activeCluster =
    state.defaultId === "active"
      ? { id: "active", name: "Active" }
      : state.clusters.find((c) => c.id === state.defaultId) ||
        state.clusters[0] || { id: "active", name: "Active" };
  const trigger = shadow.getElementById("campus-trigger");
  if (trigger) {
    const name =
      state.campusOptions.find((o) => o.id === campusId)?.name || campusId;
    const flagEl = shadow.getElementById("campus-trigger-flag");
    if (flagEl) flagEl.textContent = getCampusFlag(name);
    const nameEl = shadow.getElementById("campus-trigger-name");
    if (nameEl) nameEl.textContent = name.toUpperCase();
  }
  rebuildHeader(state);
  updateDefaultSelect(state);
  updateCampusTime(state);
  await loadCluster(state, state.activeCluster, signal);
  if (stale()) return;
  await loadOccupancy(state, signal);
  if (stale()) return;
  whenIdle(() => {
    void (async () => {
      const rest = state.clusters.filter(
        (c) => c.id !== state.activeCluster.id && c.svg,
      );
      for (const c of rest) {
        if (stale()) return;
        await ensureClusterData(state, c, campusId, signal);
      }
      if (!stale()) reapplyOccupancy(state);
    })();
  });
}
