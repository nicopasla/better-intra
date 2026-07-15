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
const POLL_INTERVAL = 30_000;
const SVG_CACHE_PREFIX = "cluster_svg_";

async function getCachedSvg(id: string): Promise<string | null> {
  const result = (await chrome.storage.local.get(
    `${SVG_CACHE_PREFIX}${id}`,
  )) as Record<string, string>;
  return result[`${SVG_CACHE_PREFIX}${id}`] || null;
}

async function setCachedSvg(id: string, text: string) {
  await chrome.storage.local.set({ [`${SVG_CACHE_PREFIX}${id}`]: text });
}

const SVG_URLS_CACHE_KEY = "CLUSTER_SVG_URLS_CACHE";

async function fetchClusterSVGs(): Promise<Record<string, string>> {
  const cached = (await chrome.storage.local.get(SVG_URLS_CACHE_KEY)) as {
    [SVG_URLS_CACHE_KEY]?: Record<string, string>;
  };
  if (cached[SVG_URLS_CACHE_KEY]) return cached[SVG_URLS_CACHE_KEY];
  try {
    const res = await fetch(`${WORKER_URL}/api/v1/cluster/svgs`);
    if (res.ok) {
      const data = (await res.json()) as Record<string, string>;
      chrome.storage.local.set({ [SVG_URLS_CACHE_KEY]: data });
      return data;
    }
  } catch {}
  return {};
}

export async function openClusterDialog() {
  const campusId = await getConfig("CLUSTERS_CAMPUS");
  if (campusId !== "12") {
    window.open("https://meta.intra.42.fr/clusters", "_blank");
    return;
  }

  const svgs = await fetchClusterSVGs();
  const clusters: ClusterInfo[] = [
    ...CLUSTERS.map((c) => ({
      id: c.id,
      name: c.name,
      svg: svgs[c.id],
    })).filter((c) => c.svg),
    { id: "wifi", name: "Wi-Fi" },
  ];

  const themePref = await getConfig("BETTER_INTRA_THEME");
  const isDark =
    themePref === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : themePref !== "light";
  const presetKey = (await getConfig("PROFILE_THEME_PRESET")) || "dark";
  const currentTheme =
    presetKey !== "dark" && presetKey !== "light"
      ? presetKey
      : isDark
        ? "dark"
        : "light";
  const defaultId = await getConfig("CLUSTERS_DEFAULT_ID");
  let activeCluster = clusters.find((c) => c.id === defaultId) || clusters[0];
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let seatPosCache = new Map<string, SeatPos>();
  let svgViewBox = { w: 1200, h: 800 };
  let loadId = 0;
  let lastUpdated = 0;
  let showMarkers = await getConfig("CLUSTERS_SHOW_MARKERS");
  let wifiUsers: OccupancyEntry[] = [];

  const dialog = Object.assign(document.createElement("dialog"), {
    id: "cluster-map-dialog",
    className: "bg-transparent backdrop:bg-black/60",
  });
  Object.assign(dialog.style, {
    margin: "auto",
    width: "min(960px, calc(100dvw - 2rem))",
    maxHeight: "calc(100dvh - 2rem)",
    borderRadius: "1rem",
    overflow: "auto",
    padding: "0",
    border: "none",
    background: "transparent",
  });

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;";
  dialog.appendChild(wrapper);

  const shadow = wrapper.attachShadow({ mode: "closed" });

  const close = () => {
    if (pollTimer) clearInterval(pollTimer);
    dialog.close();
    dialog.remove();
  };

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  function renderTemplate(cluster: ClusterInfo): TemplateResult {
    return html`
      <style>
        :host {
          display: block;
        }
        ${sharedCSS} #map-area {
          position: relative;
          background: var(--color-base-300);
          min-height: 400px;
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
      </style>
      <div data-theme="${currentTheme}" class="flex flex-col bg-base-100">
        <div class="flex items-center justify-between shrink-0 p-3 pb-0">
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
            ${lastUpdated
              ? (() => {
                  const ago = formatTimeAgo(lastUpdated);
                  return html`<span
                    class="btn btn-accent btn-sm border border-base-content/20"
                    >Updated ${ago === "now" ? ago : ago + " ago"}</span
                  >`;
                })()
              : ""}
            <button
              class="btn btn-success btn-sm"
              id="reload-btn"
              title="Reload occupancy & map"
            >
              <span class="size-5 flex items-center justify-center">
                ${unsafeHTML(RELOAD_SVG)}
              </span>
            </button>
            <button
              class="btn btn-circle btn-ghost btn-sm text-xl"
              id="close-btn"
            >
              ✕
            </button>
          </div>
        </div>
        <div id="map-area" class="m-3 mt-2 rounded-lg overflow-auto">
          <div class="flex items-center justify-center p-12">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </div>
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
      (el) => el instanceof HTMLElement && el.id === "reload-btn",
    );
    if (reloadBtn) {
      lastUpdated = 0;
      loadCluster(activeCluster);
      return;
    }
    const markersBtn = path.find(
      (el) => el instanceof HTMLElement && el.id === "markers-btn",
    );
    if (markersBtn) {
      showMarkers = !showMarkers;
      chrome.storage.local.set({ CLUSTERS_SHOW_MARKERS: showMarkers });
      rerender();
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
    if (closeBtn) close();
  });

  shadow.addEventListener("change", (e) => {
    const select = (e.target as HTMLElement).closest(
      "#default-cluster-select",
    ) as HTMLSelectElement | null;
    if (select) {
      chrome.storage.local.set({ CLUSTERS_DEFAULT_ID: select.value });
    }
  });

  const loadOccupancy = async () => {
    const occupancy = await fetchOccupancy();
    wifiUsers = [];
    for (const [host, entry] of occupancy) {
      if (host.startsWith("wifi-")) {
        wifiUsers.push(entry);
        occupancy.delete(host);
      }
    }
    lastUpdated = Date.now();
    renderSeatOverlays(shadow, occupancy, seatPosCache, svgViewBox);
    rerender();
  };

  const loadCluster = async (cluster: ClusterInfo) => {
    activeCluster = cluster;
    const id = ++loadId;
    rerender();
    if (cluster.id === "wifi") {
      renderWifiList(shadow, wifiUsers);
      return;
    }
    if (!cluster.svg) return;

    const mapArea = shadow.getElementById("map-area");
    if (!mapArea) return;

    try {
      let svgText = await getCachedSvg(cluster.id);
      if (!svgText) {
        const proxySvgUrl = `${WORKER_URL}/api/v1/cluster/svg?url=${encodeURIComponent(cluster.svg)}`;
        const svgRes = await fetch(proxySvgUrl);
        if (id !== loadId) return;
        svgText = await svgRes.text();
        setCachedSvg(cluster.id, svgText).catch(() => {});
      } else {
      }

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
      const rootSvg = svgDoc.querySelector("svg");
      const viewBox = (rootSvg?.getAttribute("viewBox") ?? "")
        .split(/\s+/)
        .map(Number);
      svgViewBox = { w: viewBox[2] || 1200, h: viewBox[3] || 800 };
      sanitizeSvg(svgDoc);
      const seats = parseSeats(svgDoc);
      seatPosCache = seats;

      if (id !== loadId) return;

      mapArea.innerHTML = "";
      mapArea.style.position = "relative";
      const imported = document.importNode(svgDoc.documentElement, true);
      mapArea.appendChild(imported);
      applyMarkers(mapArea, showMarkers);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      if (id !== loadId) return;

      await loadOccupancy();
    } catch (e) {}
  };
  rerender();
  document.body.appendChild(dialog);
  dialog.showModal();
  loadCluster(activeCluster);
  pollTimer = setInterval(loadOccupancy, POLL_INTERVAL);
}

function renderWifiList(shadow: ShadowRoot, users: OccupancyEntry[]) {
  const mapArea = shadow.getElementById("map-area");
  if (!mapArea) return;
  mapArea.innerHTML = "";
  mapArea.style.position = "";

  if (users.length === 0) {
    mapArea.innerHTML =
      '<div class="flex items-center justify-center p-12 text-base-content/50">No one on Wi-Fi</div>';
    return;
  }

  const list = document.createElement("div");
  list.style.cssText =
    "display:flex;flex-direction:column;gap:4px;padding:12px;";
  mapArea.appendChild(list);

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

function sanitizeSvg(svgDoc: Document) {
  for (const el of svgDoc.querySelectorAll("script, use")) {
    el.remove();
  }
  const dangerous = /^on/i;
  for (const el of svgDoc.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      if (dangerous.test(attr.name)) el.removeAttribute(attr.name);
      if (
        (attr.name === "href" || attr.name === "xlink:href") &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

function parseSeats(svgDoc: Document): Map<string, SeatPos> {
  const map = new Map<string, SeatPos>();
  for (const el of svgDoc.querySelectorAll("[id]")) {
    const id = el.getAttribute("id") || "";
    if (/-r\d+-p\d+$|-c\d+-p\d+$/.test(id)) {
      map.set(id, {
        x: parseFloat(el.getAttribute("x") || "0"),
        y: parseFloat(el.getAttribute("y") || "0"),
        w: parseFloat(el.getAttribute("width") || "30"),
        h: parseFloat(el.getAttribute("height") || "30"),
      });
    }
  }
  return map;
}

function renderSeatOverlays(
  shadow: ShadowRoot,
  occupancy: Map<string, OccupancyEntry>,
  seatPosCache: Map<string, SeatPos>,
  svgViewBox: { w: number; h: number },
) {
  const mapArea = shadow.getElementById("map-area");
  if (!mapArea) {
    return;
  }

  const svgEl = mapArea.querySelector("svg");
  if (!svgEl) {
    return;
  }

  const oldOverlay = shadow.getElementById("seat-overlay");
  if (oldOverlay) oldOverlay.remove();

  const svgRect = svgEl.getBoundingClientRect();
  if (svgRect.width === 0 || svgRect.height === 0) return;

  const mapRect = mapArea.getBoundingClientRect();
  const scaleX = svgRect.width / svgViewBox.w;
  const scaleY = svgRect.height / svgViewBox.h;

  const overlay = document.createElement("div");
  overlay.id = "seat-overlay";
  overlay.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;";
  mapArea.appendChild(overlay);

  for (const [host, seat] of occupancy) {
    const pos = seatPosCache.get(host);
    if (!pos) continue;

    let left: number, top: number, width: number, height: number;
    let rotationDeg = 0;
    const svgSeat: Element | null = svgEl.querySelector(
      `[id="${CSS.escape(host)}"]`,
    );
    if (svgSeat) {
      const rect = svgSeat.getBoundingClientRect();
      const w = pos.w * scaleX;
      const h = pos.h * scaleY;
      left = rect.left + rect.width / 2 - mapRect.left - w / 2;
      top = rect.top + rect.height / 2 - mapRect.top - h / 2;
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
    overlay.appendChild(a);
  }
}

async function fetchOccupancy(): Promise<Map<string, OccupancyEntry>> {
  try {
    const res = await fetch(CLUSTERS_JSON_URL, { credentials: "include" });
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
