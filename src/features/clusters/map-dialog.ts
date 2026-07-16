import { html, render, TemplateResult } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { sharedCSS } from "../../assets/shared-styles.ts";
import { getConfig } from "../../config.ts";
import { CLUSTERS, SCREENS } from "./clusters.data.ts";
import RELOAD_SVG from "../../assets/svg/reload.svg?raw";

interface ClusterInfo {
  id: string;
  name: string;
  svg?: string;
}

interface OccupancyEntry {
  host: string;
  login: string;
  cdn_uri: string;
  begin_at: string;
  end_at: string | null;
}

interface SeatPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

const WORKER_URL = "https://api.betterintra.com";
const CLUSTERS_JSON_URL = "https://meta.intra.42.fr/clusters.json";
const PROFILE_BASE = "https://profile.intra.42.fr/users";
const POLL_INTERVAL = 60_000;
const SVG_CACHE_PREFIX = "cluster_svg_";

const CACHE_TTL = 7 * 24 * 60 * 60_000;

interface CachedCluster {
  svg: string;
  seats: [string, SeatPos][];
  viewBox: { w: number; h: number };
  cachedAt: number;
}

async function getCachedCluster(id: string): Promise<CachedCluster | null> {
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

async function setCachedCluster(id: string, data: CachedCluster) {
  data.cachedAt = Date.now();
  await chrome.storage.local.set({
    [`${SVG_CACHE_PREFIX}${id}`]: JSON.stringify(data),
  });
}

interface SvgsCacheEntry {
  data: Record<string, string>;
  cachedAt: number;
}

const SVG_URLS_CACHE_KEY = "CLUSTER_SVG_URLS_CACHE";

async function fetchClusterSVGs(): Promise<Record<string, string>> {
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

export async function openClusterDialog() {
  if (document.getElementById("cluster-map-dialog")) return;

  const campusId = await getConfig("CLUSTERS_CAMPUS");
  if (campusId !== "12") {
    window.open("https://meta.intra.42.fr/clusters", "_blank");
    return;
  }

  const [themePref, presetKeyRaw, defaultId, showMarkersVal, svgs] =
    await Promise.all([
      getConfig("BETTER_INTRA_THEME"),
      getConfig("PROFILE_THEME_PRESET"),
      getConfig("CLUSTERS_DEFAULT_ID"),
      getConfig("CLUSTERS_SHOW_MARKERS"),
      fetchClusterSVGs(),
    ]);
  const presetKey = (presetKeyRaw as string) || "dark";

  const clusters: ClusterInfo[] = [
    ...CLUSTERS.map((c) => ({
      id: c.id,
      name: c.name,
      svg: svgs[c.id],
    })).filter((c) => c.svg),
    { id: "wifi", name: "Wi-Fi" },
  ];

  const isDark =
    themePref === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : themePref !== "light";
  const currentTheme =
    presetKey !== "dark" && presetKey !== "light"
      ? presetKey
      : isDark
        ? "dark"
        : "light";
  let activeCluster = clusters.find((c) => c.id === defaultId) || clusters[0];
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const seatPosCache = new Map<string, Map<string, SeatPos>>();
  const svgViewBoxes = new Map<string, { w: number; h: number }>();
  const parsedDocs = new Map<string, Document>();
  let loadId = 0;
  let lastUpdated = 0;
  let showMarkers = showMarkersVal;
  let wifiUsers: OccupancyEntry[] = [];

  const ensureClusterData = async (
    c: ClusterInfo,
    signal?: AbortSignal,
  ): Promise<string | null> => {
    if (!c.svg) return null;
    try {
      if (seatPosCache.has(c.id) && svgViewBoxes.has(c.id)) {
        return "cached";
      }
      let cached = await getCachedCluster(c.id);
      let svgText = cached?.svg;
      if (!svgText) {
        const url = `${WORKER_URL}/api/v1/cluster/svg?url=${encodeURIComponent(c.svg)}`;
        const res = await fetch(url, { signal });
        if (!res.ok) return null;
        svgText = await res.text();
      }
      if (!svgViewBoxes.has(c.id)) {
        const svgDoc = new DOMParser().parseFromString(
          svgText,
          "image/svg+xml",
        );
        const seatMap = sanitizeAndParseSeats(svgDoc);
        parsedDocs.set(c.id, svgDoc);
        const vb = (svgDoc.querySelector("svg")?.getAttribute("viewBox") ?? "")
          .split(/\s+/)
          .map(Number);
        svgViewBoxes.set(c.id, { w: vb[2] || 1200, h: vb[3] || 800 });
        seatPosCache.set(c.id, seatMap);
        setCachedCluster(c.id, {
          svg: svgText,
          seats: [...seatMap],
          viewBox: svgViewBoxes.get(c.id)!,
          cachedAt: 0,
        }).catch(() => {});
      }
      return svgText;
    } catch {
      return null;
    }
  };

  const dialog = Object.assign(document.createElement("dialog"), {
    id: "cluster-map-dialog",
    className: "bg-transparent backdrop:bg-black/60",
  });
  Object.assign(dialog.style, {
    margin: "auto",
    width: "min(960px, calc(100dvw - 2rem))",
    maxHeight: "calc(100dvh - 2rem)",
    borderRadius: "1rem",
    padding: "0",
    border: "none",
    background: "transparent",
  });

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display:flex;flex-direction:column;height:calc(100dvh - 2rem);overflow:hidden;";
  dialog.appendChild(wrapper);

  const shadow = wrapper.attachShadow({ mode: "closed" });

  const abortController = new AbortController();

  const cleanup = () => {
    if (pollTimer) clearInterval(pollTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    abortController.abort();
  };

  dialog.addEventListener("close", () => {
    cleanup();
    if (resizeObserver) resizeObserver.disconnect();
    dialog.remove();
  });

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  function renderTemplate(cluster: ClusterInfo): TemplateResult {
    return html`
      <style>
        :host {
          display: block;
          height: 100%;
          overflow: hidden;
        }
        ${sharedCSS} #map-area {
          position: relative;
          background: var(--color-base-300);
          flex: 1;
          min-height: 0;
          overflow: auto;
        }
        #map-area::-webkit-scrollbar {
          width: 6px;
        }
        #map-area::-webkit-scrollbar-thumb {
          background: var(--color-base-content, #888);
          border-radius: 3px;
        }
        #map-area svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .seat-link {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          overflow: hidden;
          background: #222;
        }
        .seat-link:hover {
          overflow: visible !important;
        }
        .seat-link img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .seat-tip {
          display: none;
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 12px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.88);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          white-space: nowrap;
          z-index: 99999;
          pointer-events: none;
        }
        .seat-link:hover .seat-tip {
          display: block;
        }
        .posts rect:not(.custom-screen),
        .posts polygon:not(.custom-screen),
        rect:not(.custom-screen) {
          fill: var(--color-base-200) !important;
        }
        .spinning {
          animation: btn-spin 0.8s linear infinite;
        }
        @keyframes btn-spin {
          to {
            transform: rotate(360deg);
          }
        }
      </style>
      <div
        data-theme="${currentTheme}"
        class="flex flex-col bg-base-100 h-full overflow-hidden"
      >
        <div
          class="flex items-center justify-between shrink-0 p-3 pb-0 sticky top-0 z-10 bg-base-100 rounded-t-xl"
        >
          <div class="tabs tabs-border border-accent">
            ${clusters.map(
              (c) =>
                html`<button
                  class="tab text-xs px-4 ${c.id === cluster.id
                    ? "tab-active"
                    : ""}"
                  data-cluster-id="${c.id}"
                >
                  ${c.name.toUpperCase()}
                </button>`,
            )}
          </div>
          <div class="flex items-center gap-2">
            <select
              class="select select-accent select-sm"
              id="default-cluster-select"
              title="Default cluster"
            >
              ${clusters.map(
                (c) =>
                  html`<option
                    value="${c.id}"
                    ?selected="${c.id === defaultId}"
                  >
                    ${c.name.toUpperCase()}
                  </option>`,
              )}
            </select>
            <button
              class="btn btn-sm ${showMarkers ? "btn-accent" : "btn-ghost"}"
              style="${showMarkers ? "border-color: var(--color-accent)" : ""}"
              id="markers-btn"
              title="Toggle screen markers"
            >
              Show Markers
            </button>
            <button
              id="updated-badge"
              class="btn btn-accent btn-sm border border-base-content/20"
              style="display:none;width:80px;justify-content:flex-start"
              title="Reload occupancy"
            >
              <span
                id="reload-icon"
                class="size-4 flex items-center justify-center"
                >${unsafeHTML(RELOAD_SVG)}</span
              >
              <span id="badge-text" style="flex:1;text-align:center"></span>
            </button>
            <button
              class="btn btn-circle btn-ghost btn-sm text-xl"
              id="close-btn"
            >
              ✕
            </button>
          </div>
        </div>
        <div id="map-area" class="mx-3 mb-3 mt-2 rounded-lg"></div>
      </div>
    `;
  }

  const rerender = () => {
    render(renderTemplate(activeCluster), shadow);
  };
  shadow.addEventListener("click", (e) => {
    const path = e.composedPath();
    const btn = path.find(
      (el) => el instanceof HTMLElement && el.hasAttribute("data-cluster-id"),
    ) as HTMLElement | undefined;
    if (btn) {
      const id = btn.dataset.clusterId;
      const cluster = clusters.find((c) => c.id === id);
      if (cluster) loadCluster(cluster);
      return;
    }
    const reloadBtn = path.find(
      (el) => el instanceof HTMLElement && el.id === "updated-badge",
    );
    if (reloadBtn) {
      loadOccupancy();
      return;
    }
    const markersBtn = path.find(
      (el) => el instanceof HTMLElement && el.id === "markers-btn",
    );
    if (markersBtn) {
      showMarkers = !showMarkers;
      chrome.storage.local.set({ CLUSTERS_SHOW_MARKERS: showMarkers });
      const mBtn = shadow.getElementById("markers-btn");
      if (mBtn) {
        mBtn.classList.toggle("btn-accent", showMarkers);
        mBtn.classList.toggle("btn-ghost", !showMarkers);
        mBtn.style.borderColor = showMarkers ? "var(--color-accent)" : "";
      }
      const mapArea = shadow.getElementById("map-area");
      if (mapArea) {
        mapArea.querySelectorAll<SVGElement>(".custom-screen").forEach((el) => {
          el.style.display = showMarkers ? "" : "none";
        });
      }
      return;
    }
    const closeBtn = path.find(
      (el) => el instanceof HTMLElement && el.id === "close-btn",
    );
    if (closeBtn) dialog.close();
  });

  shadow.addEventListener("change", (e) => {
    const select = (e.target as HTMLElement).closest(
      "#default-cluster-select",
    ) as HTMLSelectElement | null;
    if (select) {
      chrome.storage.local.set({ CLUSTERS_DEFAULT_ID: select.value });
    }
  });

  let occupancyCache: Map<string, OccupancyEntry> | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  const applyOccupancy = (occupancy: Map<string, OccupancyEntry>) => {
    wifiUsers = [];
    const workCopy = new Map(occupancy);
    for (const [host, entry] of workCopy) {
      if (host.startsWith("wifi-")) {
        wifiUsers.push(entry);
        workCopy.delete(host);
      }
    }
    const positions = seatPosCache.get(activeCluster.id);
    const viewBox = svgViewBoxes.get(activeCluster.id);
    if (positions && viewBox) {
      renderSeatOverlays(shadow, workCopy, positions, viewBox);
    }
    startCountdown();
  };

  const loadOccupancy = async () => {
    const reloadIcon = shadow.getElementById("reload-icon");
    if (reloadIcon) reloadIcon.classList.add("spinning");
    try {
      const occupancy = await fetchOccupancy(abortController.signal);
      occupancyCache = occupancy;
      lastUpdated = Date.now();
      applyOccupancy(occupancy);
    } finally {
      if (reloadIcon) reloadIcon.classList.remove("spinning");
    }
  };

  const updateBadge = () => {
    const secs = Math.max(
      0,
      Math.ceil((POLL_INTERVAL - (Date.now() - lastUpdated)) / 1000),
    );
    const badgeText = shadow.getElementById("badge-text");
    if (badgeText) {
      badgeText.textContent = `${secs}s`;
    }
  };

  const startCountdown = () => {
    if (countdownTimer) clearInterval(countdownTimer);
    const badge = shadow.getElementById("updated-badge");
    if (badge) badge.style.display = "";
    updateBadge();
    countdownTimer = setInterval(updateBadge, 1000);
  };

  const reapplyOccupancy = () => {
    if (!occupancyCache) return;
    applyOccupancy(occupancyCache);
  };

  let retryCount = 0;
  let resizeObserver: ResizeObserver | null = null;

  const loadCluster = async (cluster: ClusterInfo) => {
    activeCluster = cluster;
    const id = ++loadId;
    retryCount = 0;

    shadow.querySelectorAll("[data-cluster-id]").forEach((el) => {
      (el as HTMLElement).classList.toggle(
        "tab-active",
        (el as HTMLElement).dataset.clusterId === cluster.id,
      );
    });

    const mapArea = shadow.getElementById("map-area");
    if (!mapArea) return;

    {
      const spinnerContainer = document.createElement("div");
      spinnerContainer.className = "flex items-center justify-center p-12";
      const spinner = document.createElement("span");
      spinner.className = "loading loading-spinner loading-lg";
      spinnerContainer.appendChild(spinner);
      mapArea.replaceChildren(spinnerContainer);
    }

    if (cluster.id === "wifi") {
      renderWifiList(shadow, wifiUsers);
      return;
    }

    try {
      const svgText = await ensureClusterData(cluster, abortController.signal);
      if (!svgText) {
        if (id !== loadId) return;
        mapArea.replaceChildren();
        return;
      }
      if (id !== loadId) return;

      const svgDoc =
        parsedDocs.get(cluster.id) ||
        new DOMParser().parseFromString(svgText, "image/svg+xml");

      mapArea.style.position = "relative";
      const imported = document.importNode(svgDoc.documentElement, true);
      mapArea.replaceChildren(imported);
      mapArea.scrollTop = 0;
      mapArea.scrollLeft = 0;
      applyMarkers(mapArea, showMarkers);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      if (id !== loadId) return;

      reapplyOccupancy();
    } catch (e) {
      if (id !== loadId) return;
      retryCount++;
      if (retryCount <= 1) {
        loadCluster(activeCluster);
      } else {
        retryCount = 0;
        const errorDiv = document.createElement("div");
        errorDiv.className =
          "flex items-center justify-center p-12 text-base-content/50";
        errorDiv.textContent = "Failed to load map";
        mapArea.replaceChildren(errorDiv);
      }
    }
  };
  rerender();
  {
    const mapArea = shadow.getElementById("map-area");
    if (mapArea) {
      const spinnerContainer = document.createElement("div");
      spinnerContainer.className = "flex items-center justify-center p-12";
      const spinner = document.createElement("span");
      spinner.className = "loading loading-spinner loading-lg";
      spinnerContainer.appendChild(spinner);
      mapArea.replaceChildren(spinnerContainer);
    }
  }
  document.body.appendChild(dialog);
  dialog.showModal();
  await Promise.all([
    ensureClusterData(activeCluster, abortController.signal),
    loadOccupancy(),
  ]);
  loadCluster(activeCluster);
  pollTimer = setInterval(loadOccupancy, POLL_INTERVAL);
  (async () => {
    const rest = clusters.filter((c) => c.id !== activeCluster.id && c.svg);
    for (const c of rest) {
      await ensureClusterData(c, abortController.signal);
    }
  })();
  const mapAreaEl = shadow.getElementById("map-area");
  if (mapAreaEl) {
    let resizeScheduled = false;
    resizeObserver = new ResizeObserver(() => {
      if (resizeScheduled) return;
      resizeScheduled = true;
      requestAnimationFrame(() => {
        resizeScheduled = false;
        reapplyOccupancy();
      });
    });
    resizeObserver.observe(mapAreaEl);
  }
}

function renderWifiList(shadow: ShadowRoot, users: OccupancyEntry[]) {
  const mapArea = shadow.getElementById("map-area");
  if (!mapArea) return;
  mapArea.style.position = "";

  if (users.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className =
      "flex items-center justify-center p-12 text-base-content/50";
    emptyDiv.textContent = "No one on Wi-Fi";
    mapArea.replaceChildren(emptyDiv);
    return;
  }

  const list = document.createElement("div");
  list.style.cssText =
    "display:flex;flex-direction:column;gap:4px;padding:12px;";
  mapArea.replaceChildren(list);

  for (const user of users) {
    const since = new Date(user.begin_at);
    const timeStr = since.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:8px;cursor:pointer;";
    row.addEventListener("click", () => {
      window.open(`${PROFILE_BASE}/${user.login}`, "_blank");
    });
    row.addEventListener("mouseenter", () => {
      row.style.background = "var(--color-base-200)";
    });
    row.addEventListener("mouseleave", () => {
      row.style.background = "";
    });

    const avatar = Object.assign(document.createElement("img"), {
      src: user.cdn_uri,
      alt: user.login,
    });
    avatar.style.cssText =
      "width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;";

    const info = document.createElement("div");
    info.style.cssText = "display:flex;flex-direction:column;min-width:0;";

    const name = document.createElement("span");
    name.textContent = user.login;
    name.style.cssText =
      "font-size:14px;font-weight:600;color:var(--color-base-content);";

    const time = document.createElement("span");
    time.textContent = `since ${timeStr}`;
    time.style.cssText = "font-size:12px;opacity:0.6;";

    info.appendChild(name);
    info.appendChild(time);
    row.appendChild(avatar);
    row.appendChild(info);
    list.appendChild(row);
  }
}

function applyMarkers(container: HTMLElement, visible: boolean) {
  for (const [id, dir] of Object.entries(SCREENS)) {
    const el = container.querySelector(`[id="${CSS.escape(id)}"]`);
    if (!el?.parentNode) continue;
    if (el.parentNode.querySelector(`.custom-screen[data-for="${id}"]`))
      continue;

    const x = Number(el.getAttribute("x"));
    const y = Number(el.getAttribute("y"));
    const w = Number(el.getAttribute("width")) || 30;
    const h = Number(el.getAttribute("height")) || 30;
    const dirStr = String(dir).toUpperCase();
    if (Number.isNaN(x) || Number.isNaN(y) || dirStr === "NONE") continue;

    const chair = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    chair.setAttribute("class", "custom-screen");
    chair.dataset.for = id;

    const cw = 22,
      ch = 4;
    let cx: number, cy: number, fw: number, fh: number;
    if (dirStr === "UP" || dirStr === "DOWN") {
      fw = cw;
      fh = ch;
      cx = x + w / 2 - cw / 2;
      cy = dirStr === "DOWN" ? y - ch : y + h;
    } else {
      fw = ch;
      fh = cw;
      cx = dirStr === "RIGHT" ? x - ch : x + w;
      cy = y + h / 2 - cw / 2;
    }
    chair.setAttribute("width", String(fw));
    chair.setAttribute("height", String(fh));
    chair.setAttribute("x", String(cx));
    chair.setAttribute("y", String(cy));
    chair.setAttribute("rx", "1");
    Object.assign(chair.style, {
      fill: "var(--color-accent)",
      opacity: "0.9",
      pointerEvents: "none",
      display: visible ? "" : "none",
    });
    const t = el.getAttribute("transform");
    if (t) chair.setAttribute("transform", t);
    el.parentNode.appendChild(chair);
  }
}

const SEAT_ID_PATTERN = /-r\d+-p\d+$|-c\d+-p\d+$/;
const DANGEROUS_ATTR = /^on/i;

function sanitizeAndParseSeats(svgDoc: Document): Map<string, SeatPos> {
  const seatMap = new Map<string, SeatPos>();
  for (const el of svgDoc.querySelectorAll("*")) {
    const tagName = el.tagName.toLowerCase();
    if (tagName === "script") {
      el.remove();
      continue;
    }
    if (tagName === "use") {
      const href =
        el.getAttribute("href") || el.getAttribute("xlink:href") || "";
      if (!href.startsWith("#")) {
        el.remove();
        continue;
      }
    }
    for (const attr of [...el.attributes]) {
      if (DANGEROUS_ATTR.test(attr.name)) el.removeAttribute(attr.name);
      if (
        (attr.name === "href" || attr.name === "xlink:href") &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
    const id = el.getAttribute("id");
    if (id && SEAT_ID_PATTERN.test(id)) {
      seatMap.set(id, {
        x: parseFloat(el.getAttribute("x") || "0"),
        y: parseFloat(el.getAttribute("y") || "0"),
        w: parseFloat(el.getAttribute("width") || "30"),
        h: parseFloat(el.getAttribute("height") || "30"),
      });
    }
  }
  return seatMap;
}

function renderSeatOverlays(
  shadow: ShadowRoot,
  occupancy: Map<string, OccupancyEntry>,
  seatPosCache: Map<string, SeatPos>,
  svgViewBox: { w: number; h: number },
) {
  const mapArea = shadow.getElementById("map-area");
  if (!mapArea) return;
  const svgEl = mapArea.querySelector("svg");
  if (!svgEl) return;

  const oldOverlay = shadow.getElementById("seat-overlay");
  if (oldOverlay) oldOverlay.remove();

  const svgRect = svgEl.getBoundingClientRect();
  if (svgRect.width === 0 || svgRect.height === 0) return;
  const mapRect = mapArea.getBoundingClientRect();
  const scrollLeft = mapArea.scrollLeft;
  const scrollTop = mapArea.scrollTop;
  const scaleX = svgRect.width / svgViewBox.w;
  const scaleY = svgRect.height / svgViewBox.h;

  const svgById = new Map<string, Element>();
  for (const el of svgEl.querySelectorAll("[id]")) {
    svgById.set(el.getAttribute("id")!, el);
  }

  interface OverlayEntry {
    seat: OccupancyEntry;
    left: number;
    top: number;
    width: number;
    height: number;
    rotationDeg: number;
  }
  const entries: OverlayEntry[] = [];

  for (const [host, seat] of occupancy) {
    const pos = seatPosCache.get(host);
    if (!pos) continue;

    let left: number, top: number, width: number, height: number;
    let rotationDeg = 0;
    const svgSeat = svgById.get(host);
    if (svgSeat) {
      const rect = svgSeat.getBoundingClientRect();
      const w = pos.w * scaleX;
      const h = pos.h * scaleY;
      left = rect.left + rect.width / 2 - mapRect.left - w / 2 + scrollLeft;
      top = rect.top + rect.height / 2 - mapRect.top - h / 2 + scrollTop;
      width = w;
      height = h;
      let netRotation = 0;
      let el: Element | null = svgSeat;
      while (el && el !== svgEl) {
        const tr = el.getAttribute("transform");
        if (tr) {
          const m = tr.match(/rotate\(\s*([\d.-]+)/);
          if (m) netRotation += parseFloat(m[1]) || 0;
        }
        el = el.parentElement;
      }
      rotationDeg = netRotation;
    } else {
      left = pos.x * scaleX;
      top = pos.y * scaleY;
      width = pos.w * scaleX;
      height = pos.h * scaleY;
    }
    entries.push({ seat, left, top, width, height, rotationDeg });
  }

  const overlay = document.createElement("div");
  overlay.id = "seat-overlay";
  overlay.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;";

  const frag = document.createDocumentFragment();
  for (const { seat, left, top, width, height, rotationDeg } of entries) {
    const since = new Date(seat.begin_at);
    const timeStr = since.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const a = Object.assign(document.createElement("a"), {
      href: `${PROFILE_BASE}/${seat.login}`,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "seat-link",
    });
    a.style.cssText = [
      "pointer-events:auto;",
      `left:${left}px;top:${top}px;`,
      `width:${width}px;height:${height}px;`,
      rotationDeg !== 0 ? `transform:rotate(${rotationDeg}deg);` : "",
    ].join("");

    const tip = document.createElement("span");
    tip.className = "seat-tip";
    tip.textContent = `${seat.login} — since ${timeStr}`;
    a.appendChild(tip);

    const avatar = Object.assign(document.createElement("img"), {
      src: seat.cdn_uri,
      alt: seat.login,
    });
    a.appendChild(avatar);
    frag.appendChild(a);
  }
  overlay.appendChild(frag);
  mapArea.appendChild(overlay);
}

async function fetchOccupancy(
  signal?: AbortSignal,
): Promise<Map<string, OccupancyEntry>> {
  try {
    const res = await fetch(CLUSTERS_JSON_URL, {
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

function formatTimeAgo(ts: number): string {
  const secs = (Date.now() - ts) / 1000;
  if (secs < 3) return "now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}
