import {
  CLUSTERS_JSON_URL,
  POLL_INTERVAL,
  keyOf,
  clusterLabel,
  type DialogState,
} from "./context";
import {
  renderActiveList,
  renderSeatOverlays,
  sortActiveUsers,
  type OccupancyEntry,
} from "./render";
import { normalizeSeatId } from "./seats";
import { applyActivePresence } from "./helpers";
import { applySeatGlow } from "./glow";
import { rebuildHeader } from "./header";
import { updateTabsOverflow } from "./tabs";
import { loadCluster } from "./map-load";

async function fetchOccupancy(
  campusId: string,
  signal?: AbortSignal,
): Promise<Map<string, OccupancyEntry>> {
  const url = campusId
    ? `https://meta.intra.42.fr/campus/${campusId}/clusters.json`
    : CLUSTERS_JSON_URL;
  try {
    const res = await fetch(url, {
      credentials: "include",
      signal,
    });
    if (!res.ok) return new Map();
    const data = (await res.json()) as Record<string, OccupancyEntry>;
    const map = new Map<string, OccupancyEntry>();
    for (const [, entry] of Object.entries(data)) {
      if (entry.host && entry.login) {
        map.set(entry.host, entry);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export function applyOccupancy(
  state: DialogState,
  occupancy: Map<string, OccupancyEntry>,
) {
  const { shadow, activeCluster, activeCampusId } = state;
  state.wifiUsers = [];
  const workCopy = new Map(occupancy);
  for (const [host, entry] of workCopy) {
    if (host.startsWith("wifi-")) {
      state.wifiUsers.push(entry);
      workCopy.delete(host);
    }
  }
  state.activeUsers = sortActiveUsers(
    state.activeWifiOnly
      ? state.wifiUsers
      : [...workCopy.values(), ...state.wifiUsers],
    state.activeSortMode,
    state.activeNameDir,
    state.activeSinceDir,
  );
  state.seatedUsers = [...workCopy.values()];
  const activeVisible = state.activeUsers.length > 0;
  let clustersChanged = false;
  const activeChange = applyActivePresence(state.clusters, activeVisible);
  if (activeChange.added || activeChange.removed) {
    state.clusters = activeChange.clusters;
    clustersChanged = true;
  }
  if (clustersChanged) {
    rebuildHeader(state);
    if (activeChange.removed && activeCluster.id === "active") {
      state.activeCluster = state.clusters[0];
      if (state.activeCluster) loadCluster(state, state.activeCluster);
    }
  }
  const positions = state.seatPosCache.get(
    keyOf(activeCampusId, activeCluster.id),
  );
  if (positions && activeCluster.id !== "active") {
    renderSeatOverlays(state, workCopy);
  }
  if (activeCluster.id === "active") {
    renderActiveList(shadow, state.activeUsers);
  }
  if (state.flashingSeat) {
    applySeatGlow(state, state.flashingSeat);
  }
  const badge = shadow.getElementById("seat-count-badge");
  if (badge) {
    const total = positions?.size ?? 0;
    let taken = 0;
    for (const host of workCopy.keys()) {
      if (positions?.has(normalizeSeatId(host))) taken++;
    }
    if (total > 0) {
      const free = total - taken;
      badge.textContent = `${taken} / ${total}`;
      badge.title = `${taken} taken, ${free} free · ${total} total`;
    } else {
      badge.textContent = `- / -`;
    }
  }
  const clusterCounts = new Map<string, { taken: number; total: number }>();
  const campusPrefix = `${activeCampusId}:`;
  const occupiedSeats = new Set<string>();
  for (const host of workCopy.keys()) occupiedSeats.add(normalizeSeatId(host));
  for (const [key, seats] of state.seatPosCache) {
    if (!key.startsWith(campusPrefix)) continue;
    const clusterId = key.slice(campusPrefix.length);
    let taken = 0;
    for (const host of occupiedSeats) {
      if (seats.has(host)) taken++;
    }
    clusterCounts.set(clusterId, { taken, total: seats.size });
  }
  for (const tab of shadow.querySelectorAll<HTMLElement>("[data-cluster-id]")) {
    const id = tab.dataset.clusterId;
    if (!id) continue;
    const cluster = state.clusters.find((c) => c.id === id);
    const name = cluster
      ? clusterLabel(cluster)
      : tab.dataset.clusterName || id.toUpperCase();
    const count =
      id === "active"
        ? state.activeUsers.length > 0
          ? String(state.activeUsers.length)
          : ""
        : (() => {
            const c = clusterCounts.get(id);
            return c && c.total > 0 ? `${c.taken}/${c.total}` : "";
          })();
    // Repeated calls (poll, resize frames) must not rebuild the tab labels:
    // that would relayout the tab bar for nothing.
    const signature = `${name}|${count}`;
    if (tab.dataset.state === signature) continue;
    tab.dataset.state = signature;
    tab.textContent = name;
    if (!count) continue;
    const num = document.createElement("span");
    num.textContent = count;
    num.style.cssText =
      "font-weight:400;opacity:0.55;font-size:11px;margin-left:6px;font-family:var(--font-sans);";
    tab.appendChild(num);
  }
  const clusterSelect = shadow.getElementById(
    "default-cluster-select",
  ) as HTMLSelectElement | null;
  if (clusterSelect) {
    const signature = state.clusters
      .map((c) => `${c.id}:${clusterLabel(c)}`)
      .join("|");
    if (clusterSelect.dataset.state !== signature) {
      clusterSelect.dataset.state = signature;
      for (const opt of clusterSelect.querySelectorAll("option")) {
        const cluster = state.clusters.find((c) => c.id === opt.value);
        if (cluster) opt.textContent = clusterLabel(cluster);
      }
    }
  }
  const allCounts = [...clusterCounts.values()];
  const sumTaken = allCounts.reduce((s, c) => s + c.taken, 0);
  const sumTotal = allCounts.reduce((s, c) => s + c.total, 0);
  const totalsBadge = shadow.getElementById("totals-badge");
  if (totalsBadge) {
    if (activeCluster.id === "active") {
      const text = `${state.activeUsers.length} active`;
      if (totalsBadge.textContent !== text) totalsBadge.textContent = text;
      totalsBadge.title = "Users currently connected";
      totalsBadge.style.display = state.activeUsers.length > 0 ? "" : "none";
    } else {
      const text = `${sumTaken} / ${sumTotal}`;
      if (totalsBadge.textContent !== text) totalsBadge.textContent = text;
      totalsBadge.title = "Total taken / Total seats";
      if (sumTotal > 0 || sumTaken > 0) {
        totalsBadge.style.display = "";
      } else {
        totalsBadge.style.display = "none";
      }
    }
  }
  startCountdown(state);
  updateTabsOverflow(state);
}

export async function loadOccupancy(state: DialogState, signal?: AbortSignal) {
  const reloadIcon = state.shadow.getElementById("reload-icon");
  if (reloadIcon) reloadIcon.classList.add("spinning");
  try {
    const occupancy = await fetchOccupancy(state.activeCampusId, signal);
    state.occupancyCache = occupancy;
    state.lastUpdated = Date.now();
    applyOccupancy(state, occupancy);
  } finally {
    if (reloadIcon) reloadIcon.classList.remove("spinning");
  }
}

function updateBadge(state: DialogState) {
  const secs = Math.max(
    0,
    Math.ceil((POLL_INTERVAL - (Date.now() - state.lastUpdated)) / 1000),
  );
  const badgeText = state.shadow.getElementById("badge-text");
  if (badgeText) {
    badgeText.textContent = `${secs}s`;
  }
}

function startCountdown(state: DialogState) {
  const badge = state.shadow.getElementById("updated-badge");
  if (badge) badge.style.display = "";
  updateBadge(state);
  if (state.timers.countdown) return;
  state.timers.countdown = setInterval(() => {
    if (document.hidden) return;
    updateBadge(state);
  }, 1000);
}

export function reapplyOccupancy(state: DialogState) {
  if (!state.occupancyCache) return;
  applyOccupancy(state, state.occupancyCache);
}
