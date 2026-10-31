import type {
  DialogState,
  SeatGeom,
  SeatOverlay,
} from "./context";
import { keyOf } from "./context";
import { normalizeSeatId } from "./seats";

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

  const overlay: SeatOverlay = {
    mapArea,
    svg,
    container,
    links: new Map(),
    geoms,
    newerSeats,
    viewBox,
    baseScale,
  };
  state.overlay = overlay;
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

  const seen = new Set<string>();
  for (const [host, seat] of occupancy) {
    const hostKey = normalizeSeatId(host);
    const geom = overlay.geoms.get(hostKey);
    if (!geom) continue;
    seen.add(hostKey);
    let link = overlay.links.get(hostKey);
    if (!link) {
      link = createSeatLink(geom, overlay.baseScale, hostKey);
      overlay.links.set(hostKey, link);
      overlay.container.appendChild(link);
    }
    link.classList.toggle("seat-newer", overlay.newerSeats.has(hostKey));
    if (link.dataset.login === seat.login) continue;
    updateSeatLink(link, seat);
  }

  for (const [hostKey, link] of [...overlay.links]) {
    if (seen.has(hostKey)) continue;
    link.remove();
    overlay.links.delete(hostKey);
  }
}

export function renderActiveList(shadow: ShadowRoot, users: OccupancyEntry[]) {
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
