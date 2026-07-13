import { html, render, TemplateResult } from "lit-html";
import { sharedCSS } from "../../assets/shared-styles.ts";
import { getConfig } from "../../config.ts";
import { CLUSTERS } from "./clusters.data.ts";

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

  console.log("[BI] openClusterDialog called");
  try {
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
          .posts rect,
          .posts polygon,
          rect:not(.custom-screen) {
            fill: var(--color-base-200) !important;
          }
        </style>
        <div data-theme="${currentTheme}" class="flex flex-col bg-base-100">
          <div class="flex items-center justify-between shrink-0 p-3 pb-0">
            <div class="flex items-center gap-1">
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
              <div class="flex items-center gap-1">
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
                  ↻
                </button>
              </div>
            </div>
            <button
              class="btn btn-circle btn-ghost btn-sm text-xl"
              id="close-btn"
            >
              ✕
            </button>
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
      const closeBtn = path.find(
        (el) => el instanceof HTMLElement && el.id === "close-btn",
      );
      if (closeBtn) close();
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
      console.log("[BI] loadCluster:", cluster.name, cluster.svg);
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
          console.log("[BI] SVG fetch status:", svgRes.status);
          if (id !== loadId) return;
          svgText = await svgRes.text();
          setCachedSvg(cluster.id, svgText).catch(() => {});
        } else {
          console.log("[BI] SVG from cache");
        }
        console.log("[BI] SVG text length:", svgText.length);

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
        console.log("[BI] Found seats:", seats.size);

        if (id !== loadId) return;

        mapArea.innerHTML = "";
        mapArea.style.position = "relative";
        const imported = document.importNode(svgDoc.documentElement, true);
        mapArea.appendChild(imported);

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        if (id !== loadId) return;

        console.log("[BI] Loading occupancy...");
        await loadOccupancy();
        console.log("[BI] Occupancy loaded");
      } catch (e) {
        if (id === loadId) console.error("Failed to load cluster map:", e);
      }
    };

    rerender();
    console.log("[BI] Appending dialog to body...");
    document.body.appendChild(dialog);
    console.log("[BI] Showing modal...");
    dialog.showModal();
    console.log("[BI] Dialog shown, loading cluster...");
    loadCluster(activeCluster);

    pollTimer = setInterval(loadOccupancy, POLL_INTERVAL);
  } catch (err) {
    console.error("[BI] Error in openClusterDialog:", err);
  }
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
  console.log(
    "[BI] renderSeatOverlays — occupancy:",
    occupancy.size,
    "seats:",
    seatPosCache.size,
  );
  const mapArea = shadow.getElementById("map-area");
  if (!mapArea) {
    console.log("[BI] no map-area");
    return;
  }

  const svgEl = mapArea.querySelector("svg");
  if (!svgEl) {
    console.log("[BI] no svg in map-area");
    return;
  }

  const oldOverlay = shadow.getElementById("seat-overlay");
  if (oldOverlay) oldOverlay.remove();

  const svgRect = svgEl.getBoundingClientRect();
  if (svgRect.width === 0 || svgRect.height === 0) return;

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
      `left:${pos.x * scaleX}px;top:${pos.y * scaleY}px;`,
      `width:${pos.w * scaleX}px;height:${pos.h * scaleY}px;`,
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
