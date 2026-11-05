import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import USBC_SVG from "../../../assets/svg/usbc.svg?raw";
import FRIENDS_SVG from "../../../assets/svg/friends.svg?raw";
import type { DialogState, SeatGeom, SeatOverlay } from "./context";
import { keyOf } from "./context";
import { normalizeSeatId } from "./seats";
import { seatIssueTooltipHtml } from "./seat-icons";
import {
  blockingSeatReasons,
  getComponentStatus,
  getMinorSeatIssues,
} from "./reports";
import { attachSeatActions } from "./seat-actions";

const PROFILE_BASE = "https://profile.intra.42.fr/users";

export interface OccupancyEntry {
  host: string;
  login: string;
  cdn_uri: string;
  begin_at: string;
  end_at: string | null;
}

export type ActiveSortMode = "name" | "since";

export const ACTIVE_SORT_DEFAULT = {
  mode: "name",
  nameDir: "asc",
  sinceDir: "desc",
} as const;

export function sortActiveUsers(
  list: OccupancyEntry[],
  mode: ActiveSortMode,
  nameDir: "asc" | "desc",
  sinceDir: "asc" | "desc",
): OccupancyEntry[] {
  return [...list].sort((a, b) => {
    if (mode === "since") {
      const at = new Date(a.begin_at).getTime();
      const bt = new Date(b.begin_at).getTime();
      const diff = at - bt;
      const result = sinceDir === "asc" ? diff : -diff;
      return result || a.login.localeCompare(b.login);
    }
    const cmp = a.login.localeCompare(b.login);
    return nameDir === "asc" ? cmp : -cmp;
  });
}

function parseViewBox(svg: SVGSVGElement): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const vb = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
  return {
    x: vb[0] || 0,
    y: vb[1] || 0,
    w: vb[2] || 1200,
    h: vb[3] || 800,
  };
}

/** Net rotation applied by the element itself and its SVG ancestors. */
function netRotation(el: Element, svg: SVGSVGElement): number {
  let deg = 0;
  let current: Element | null = el;
  while (current && current !== svg) {
    const tr = current.getAttribute("transform");
    if (tr) {
      const match = tr.match(/rotate\(\s*([\d.-]+)/);
      if (match) deg += parseFloat(match[1]) || 0;
    }
    current = current.parentElement;
  }
  return deg;
}

function seatElementIndex(svg: SVGSVGElement): Map<string, Element> {
  const byId = new Map<string, Element>();
  // Avatars are painted into the `image[id]` placeholder (the PWA fills it),
  // so measure the placeholder first: its transform can differ from the desk
  // rect, e.g. the angled seats in the Belgium `mi` map.
  for (const el of svg.querySelectorAll("image[id]")) {
    const key = normalizeSeatId(el.getAttribute("id")!);
    if (!byId.has(key)) byId.set(key, el);
  }
  for (const el of svg.querySelectorAll("[id]")) {
    const key = normalizeSeatId(el.getAttribute("id")!);
    if (!byId.has(key)) byId.set(key, el);
  }
  return byId;
}

/**
 * Seat geometry in SVG user units: it never changes for a given map, so it is
 * computed once (with one rect per seat) and cached in `state.seatGeomCache`.
 */
function computeSeatGeoms(
  svg: SVGSVGElement,
  seatPositions: Map<string, { x: number; y: number; w: number; h: number }>,
): Map<string, SeatGeom> | null {
  const rect = svg.getBoundingClientRect();
  const viewBox = parseViewBox(svg);
  const scale = rect.width > 0 ? rect.width / viewBox.w : 0;
  if (scale <= 0) return null;
  const byId = seatElementIndex(svg);
  const geoms = new Map<string, SeatGeom>();

  for (const [key, pos] of seatPositions) {
    const el = byId.get(key);
    if (el) {
      const box = el.getBoundingClientRect();
      geoms.set(key, {
        cx: (box.left + box.width / 2 - rect.left) / scale,
        cy: (box.top + box.height / 2 - rect.top) / scale,
        w: pos.w,
        h: pos.h,
        rotationDeg: netRotation(el, svg),
        round:
          el.tagName.toLowerCase() === "circle" ||
          (el.getAttribute("clip-path") || "").includes("circle"),
      });
    } else {
      geoms.set(key, {
        cx: pos.x + pos.w / 2,
        cy: pos.y + pos.h / 2,
        w: pos.w,
        h: pos.h,
        rotationDeg: 0,
        round: false,
      });
    }
  }
  return geoms;
}

/** (Re)builds the overlay container for the map currently on screen. */
function ensureSeatOverlay(state: DialogState): SeatOverlay | null {
  const mapArea = state.shadow.getElementById("map-area") as HTMLElement | null;
  const svg = mapArea?.querySelector("svg") as SVGSVGElement | null;
  if (!mapArea || !svg) {
    state.overlay = null;
    return null;
  }
  const existing = state.overlay;
  if (existing && existing.svg === svg && existing.container.isConnected) {
    return existing;
  }

  const key = keyOf(state.activeCampusId, state.activeCluster.id);
  const viewBox = parseViewBox(svg);
  const rect = svg.getBoundingClientRect();
  const baseScale = rect.width > 0 ? rect.width / viewBox.w : 0;
  if (baseScale <= 0) return null;

  let geoms = state.seatGeomCache.get(key);
  if (!geoms) {
    const positions = state.seatPosCache.get(key);
    if (!positions || positions.size === 0) return null;
    const computed = computeSeatGeoms(svg, positions);
    if (!computed) return null;
    geoms = computed;
    state.seatGeomCache.set(key, geoms);
  }

  const container = document.createElement("div");
  container.id = "seat-overlay";
  container.style.cssText =
    "position:absolute;top:0;left:0;transform-origin:0 0;pointer-events:none;";
  mapArea.appendChild(container);

  // Seats the map builder marked as having a newer computer.
  const newerSeats = new Set<string>();
  for (const rect of svg.querySelectorAll("rect.seat-newer[id]")) {
    const id = (rect.getAttribute("id") || "").trim();
    if (id) newerSeats.add(normalizeSeatId(id));
  }

  // Geometry keys are normalized (hyphens stripped); reports and links use the
  // raw id (e.g. `fu-r1-p1`), so keep a mapping.
  const rawIds = new Map<string, string>();
  for (const el of svg.querySelectorAll("[id]")) {
    const raw = (el.getAttribute("id") || "").trim().toLowerCase();
    if (!raw) continue;
    const key = normalizeSeatId(raw);
    if (!rawIds.has(key)) rawIds.set(key, raw);
  }

  const overlay: SeatOverlay = {
    mapArea,
    svg,
    container,
    links: new Map(),
    geoms,
    rawIds,
    decorations: new Map(),
    hotspots: new Map(),
    newerSeats,
    viewBox,
    baseScale,
  };
  state.overlay = overlay;
  attachSeatActions(state, overlay);
  return overlay;
}

function createSeatLink(
  geom: SeatGeom,
  scale: number,
  hostKey: string,
): HTMLAnchorElement {
  const width = geom.w * scale;
  const height = geom.h * scale;
  const link = document.createElement("a");
  link.className = "seat-link";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.cssText = [
    "pointer-events:auto;",
    `left:${geom.cx * scale - width / 2}px;`,
    `top:${geom.cy * scale - height / 2}px;`,
    `width:${width}px;height:${height}px;`,
    geom.rotationDeg !== 0 ? `transform:rotate(${geom.rotationDeg}deg);` : "",
    geom.round ? "border-radius:50%;" : "",
  ].join("");
  if (geom.round) link.dataset.round = "true";
  link.dataset.host = hostKey;

  const avatar = document.createElement("img");
  avatar.loading = "lazy";
  avatar.decoding = "async";
  link.appendChild(avatar);

  // Friend ring as its own layer above the avatar. An inset box-shadow would be
  // painted under the <img>, which is why it looked invisible.
  const ring = document.createElement("span");
  ring.className = "seat-friend-ring";
  ring.setAttribute("aria-hidden", "true");
  link.appendChild(ring);

  return link;
}

function updateSeatLink(link: HTMLAnchorElement, seat: OccupancyEntry): void {
  const since = new Date(seat.begin_at);
  const timeStr = since.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  link.href = `${PROFILE_BASE}/${seat.login}`;
  link.dataset.login = seat.login;
  link.setAttribute("data-tip", `${seat.login} - since ${timeStr}`);
  link.setAttribute("data-tip-size", "15px");

  const avatar = link.firstElementChild as HTMLImageElement | null;
  if (!avatar) return;
  avatar.alt = seat.login;
  if (avatar.getAttribute("src") !== seat.cdn_uri) avatar.src = seat.cdn_uri;
}

function placeSeatLink(
  link: HTMLAnchorElement,
  geom: SeatGeom,
  scale: number,
): void {
  const width = geom.w * scale;
  const height = geom.h * scale;
  link.style.left = `${geom.cx * scale - width / 2}px`;
  link.style.top = `${geom.cy * scale - height / 2}px`;
  link.style.width = `${width}px`;
  link.style.height = `${height}px`;
}

/** Re-lays the avatars at the current zoom (keeps them crisp when zooming). */
function relayoutSeatLinks(overlay: SeatOverlay, scale: number): void {
  overlay.baseScale = scale;
  for (const [hostKey, link] of overlay.links) {
    const geom = overlay.geoms.get(hostKey);
    if (!geom) continue;
    placeSeatLink(link, geom, scale);
  }
}

/**
 * Updates the avatar overlay for the map on screen: the container transform
 * follows zoom/resize for free, and only seats whose occupant changed are
 * touched. Safe to call on every poll and resize frame.
 */
export function renderSeatOverlays(
  state: DialogState,
  occupancy: Map<string, OccupancyEntry>,
): void {
  const overlay = ensureSeatOverlay(state);
  if (!overlay) return;

  const svgRect = overlay.svg.getBoundingClientRect();
  if (svgRect.width === 0 || svgRect.height === 0) return;
  const mapRect = overlay.mapArea.getBoundingClientRect();
  const scale = svgRect.width / overlay.viewBox.w;
  // A big zoom change re-lays the avatars once, so they stay sharp; small
  // changes (window resize, a zoom step) are handled by the container transform.
  if (Math.abs(scale / overlay.baseScale - 1) > 0.5) {
    relayoutSeatLinks(overlay, scale);
  }
  const zoom = scale / overlay.baseScale;
  const originX = svgRect.left - mapRect.left + overlay.mapArea.scrollLeft;
  const originY = svgRect.top - mapRect.top + overlay.mapArea.scrollTop;
  overlay.container.style.transform = `translate(${originX}px, ${originY}px) scale(${zoom})`;

  const occupied = new Set<string>();
  const reportHosts = new Map<string, string>();
  for (const [host, seat] of occupancy) {
    const hostKey = normalizeSeatId(host);
    occupied.add(hostKey);
    reportHosts.set(hostKey, host.trim().toLowerCase());
    const geom = overlay.geoms.get(hostKey);
    if (!geom) continue;
    let link = overlay.links.get(hostKey);
    if (!link) {
      link = createSeatLink(geom, overlay.baseScale, hostKey);
      overlay.links.set(hostKey, link);
      overlay.container.appendChild(link);
    }
    // Reports and friend matching need the real host id, not the normalized
    // geometry key.
    const rawHost = host.trim().toLowerCase();
    link.dataset.reportHost = rawHost;
    link.classList.toggle("seat-newer", overlay.newerSeats.has(hostKey));

    const login = seat.login.trim().toLowerCase();
    const isFriend =
      Boolean(login) && login !== state.me && state.friends.has(login);
    link.classList.toggle("seat-friend", isFriend);

    if (link.dataset.login === seat.login) continue;
    updateSeatLink(link, seat);
  }

  for (const [hostKey, link] of [...overlay.links]) {
    if (occupied.has(hostKey)) continue;
    link.remove();
    overlay.links.delete(hostKey);
  }

  renderSeatDecorations(state, overlay, occupied, reportHosts);
  syncSeatHotspots(state, overlay, occupied);
}

/** Draws the report cross and the USB-C glyph for the current map. */
function renderSeatDecorations(
  state: DialogState,
  overlay: SeatOverlay,
  occupied: Set<string>,
  reportHosts: Map<string, string>,
): void {
  if (!state.canReport) {
    for (const decoration of overlay.decorations.values()) decoration.remove();
    overlay.decorations.clear();
    return;
  }
  const scale = overlay.baseScale;
  for (const [key, geom] of overlay.geoms) {
    // Match reports on the exact host id (not the normalized geometry key), so
    // two seats can never share a report through separator normalization. For
    // occupied seats prefer the API's host, which is what the report sheet
    // reads and writes; it can differ in formatting from the SVG id.
    const host = reportHosts.get(key) ?? overlay.rawIds.get(key) ?? key;
    // A cross is strictly a Power/Network report. Using the explicit reasons
    // also makes the rule independent of the severity catalog.
    const reasons = blockingSeatReasons(host);
    const blocking = reasons.length > 0;
    const usbc =
      !occupied.has(key) &&
      getComponentStatus(host, "usbc")?.status === "works";
    // A crossed seat only shows the cross; the triangle is reserved for seats
    // whose only issues are non-blocking (keyboard, mouse scroll, audio).
    const issues = blocking ? [] : getMinorSeatIssues(host);
    const issueKey = issues.join("+");
    const existing = overlay.decorations.get(key);

    if (!blocking && !usbc && !issueKey) {
      if (existing) {
        existing.remove();
        overlay.decorations.delete(key);
      }
      continue;
    }

    let decoration = existing;
    if (!decoration) {
      decoration = document.createElement("div");
      decoration.className = "seat-decoration";
      decoration.dataset.seat = key;
      overlay.container.appendChild(decoration);
      overlay.decorations.set(key, decoration);
    }

    // The cross node only exists while there is a Power/Network reason. This is
    // structural, so a USB-C-only seat can never render a cross.
    const content = `${blocking ? "cross" : ""}${usbc ? "usbc" : ""}${
      issueKey ? `warn:${issueKey}` : ""
    }`;
    if (decoration.dataset.content !== content) {
      decoration.dataset.content = content;
      render(
        html`${blocking
          ? html`<svg
              class="seat-cross"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M18 18 L82 82 M82 18 L18 82"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>`
          : ""}
        ${usbc
          ? html`<span class="seat-usbc">${unsafeHTML(USBC_SVG)}</span>`
          : ""}
        ${issueKey
          ? html`<svg
              class="seat-warning"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              data-tip-html="${seatIssueTooltipHtml(issues)}"
              data-tip-size="12px"
              aria-hidden="true"
            >
              <path
                d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
              />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>`
          : ""}`,
        decoration,
      );
    }

    decoration.dataset.host = host;
    placeSeatBox(decoration, geom, scale);
  }
}

/** Transparent buttons over every seat, used by report mode and long-press. */
function syncSeatHotspots(
  state: DialogState,
  overlay: SeatOverlay,
  occupied: Set<string>,
): void {
  overlay.container.classList.toggle("report-mode", state.reportMode);
  const scale = overlay.baseScale;
  for (const [key, geom] of overlay.geoms) {
    const host = overlay.rawIds.get(key) ?? key;
    let hotspot = overlay.hotspots.get(key);
    if (!hotspot) {
      hotspot = document.createElement("button");
      hotspot.type = "button";
      hotspot.className = "seat-hotspot";
      hotspot.dataset.reportHost = host;
      hotspot.setAttribute("aria-label", `Report an issue for ${host}`);
      overlay.container.appendChild(hotspot);
      overlay.hotspots.set(key, hotspot);
    } else if (hotspot.dataset.reportHost !== host) {
      hotspot.dataset.reportHost = host;
      hotspot.setAttribute("aria-label", `Report an issue for ${host}`);
    }
    hotspot.classList.toggle("seat-hotspot-empty", !occupied.has(key));
    hotspot.classList.toggle("report-mode", state.reportMode);
    // Without a cloud session the report targets must not swallow clicks.
    hotspot.style.pointerEvents = state.canReport ? "" : "none";
    placeSeatBox(hotspot, geom, scale);
  }
}

function placeSeatBox(el: HTMLElement, geom: SeatGeom, scale: number): void {
  const width = geom.w * scale;
  const height = geom.h * scale;
  el.style.left = `${geom.cx * scale - width / 2}px`;
  el.style.top = `${geom.cy * scale - height / 2}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.transform = geom.rotationDeg ? `rotate(${geom.rotationDeg}deg)` : "";
  if (geom.round) el.style.borderRadius = "50%";
}

export function renderActiveList(
  state: DialogState,
  users: OccupancyEntry[],
): void {
  const { shadow } = state;
  const mapArea = shadow.getElementById("map-area");
  if (!mapArea) return;
  mapArea.style.position = "";

  if (users.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className =
      "flex items-center justify-center p-12 text-base-content/50";
    emptyDiv.textContent = "No one connected";
    mapArea.replaceChildren(emptyDiv);
    return;
  }

  const grid = document.createElement("div");
  grid.style.cssText = [
    "display:grid;",
    "grid-template-columns:repeat(auto-fill,minmax(120px,1fr));",
    "gap:8px;",
    "padding:72px 16px 16px;",
    "align-content:start;",
  ].join("");

  for (const user of users) {
    const card = Object.assign(document.createElement("a"), {
      href: `${PROFILE_BASE}/${user.login}`,
      target: "_blank",
      rel: "noopener noreferrer",
    });
    card.style.cssText = [
      "display:flex;",
      "flex-direction:column;",
      "align-items:center;",
      "gap:4px;",
      "padding:10px 8px;",
      "border-radius:10px;",
      "background:var(--color-base-200);",
      "text-align:center;",
      "text-decoration:none;",
      "min-width:0;",
      "position:relative;",
    ].join("");
    card.addEventListener("mouseenter", () => {
      card.style.background = "var(--color-base-300)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.background = "var(--color-base-200)";
    });

    const avatar = Object.assign(document.createElement("img"), {
      src: user.cdn_uri,
      alt: user.login,
    });
    avatar.style.cssText =
      "width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;";

    const login = document.createElement("span");
    login.textContent = user.login;
    login.style.cssText =
      "font-size:13px;font-weight:600;color:var(--color-base-content);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

    const since = document.createElement("span");
    since.className = "badge badge-sm";
    since.textContent = formatTimeAgo(new Date(user.begin_at).getTime());
    since.style.cssText = [
      "max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
      "background:#fff;color:#000;border-color:#fff;font-family:var(--font-sans);",
    ].join("");
    since.setAttribute(
      "data-tip",
      `since ${new Date(user.begin_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
    );

    card.appendChild(avatar);
    card.appendChild(login);
    card.appendChild(since);

    const isFriend = (() => {
      const loginKey = user.login.trim().toLowerCase();
      return Boolean(
        loginKey && loginKey !== state.me && state.friends.has(loginKey),
      );
    })();
    if (isFriend) {
      avatar.style.boxShadow = "0 0 0 2.5px var(--color-info)";
      const friend = document.createElement("span");
      friend.className = "active-friend-icon";
      friend.title = "Friend";
      friend.setAttribute("aria-label", "Friend");
      render(
        unsafeHTML(
          FRIENDS_SVG.replace(
            "<svg",
            '<svg fill="currentColor" width="13" height="13"',
          ),
        ),
        friend,
      );
      card.appendChild(friend);
    }

    grid.appendChild(card);
  }
  mapArea.replaceChildren(grid);
}

export function formatTimeAgo(ts: number): string {
  const secs = (Date.now() - ts) / 1000;
  if (secs < 3) return "now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}
