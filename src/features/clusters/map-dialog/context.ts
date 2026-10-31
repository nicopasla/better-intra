import type { OccupancyEntry, ActiveSortMode } from "./render";
import type { SeatPos } from "./crop";
import { getSvgSlug } from "./cache";
import type { ExitConfig } from "../../campus/campus.ts";
import { WORKER_URL } from "../../../utils/worker.ts";

export { WORKER_URL };

export type {
  ExitConfig,
  ExitSign,
  ExitArrowDir,
} from "../../campus/campus.ts";

export interface ClusterInfo {
  id: string;
  name: string;
  svg?: string;
}

export const CLUSTERS_JSON_URL = "https://meta.intra.42.fr/clusters.json";
export const POLL_INTERVAL = 60_000;
export const SEAT_TARGET_PX = 60;

export interface DialogTabsState {
  wired: WeakSet<Element>;
  overflowing: boolean;
  resizeObserver: ResizeObserver | null;
  /** Last width the tabs were measured at, to skip needless relayouts. */
  measuredWidth: number;
  measuredAt: number;
  /** Label/count signature at the last measurement. */
  signature: string;
}

export interface DialogTimers {
  poll: ReturnType<typeof setInterval> | null;
  clock: ReturnType<typeof setInterval> | null;
  countdown: ReturnType<typeof setInterval> | null;
  glow: ReturnType<typeof setTimeout> | null;
}

/** Where a seat sits, in SVG user units (layout-independent, so it is cached). */
export interface SeatGeom {
  /** Seat centre. */
  cx: number;
  cy: number;
  /** Seat box size, taken from the seat element's own attributes. */
  w: number;
  h: number;
  rotationDeg: number;
  round: boolean;
}

/**
 * The live avatar overlay for the map on screen. Children are positioned once
 * in "base" pixels; resizes/zoom only rescale the container's transform, so a
 * resize or a poll costs no per-seat layout at all.
 */
export interface SeatOverlay {
  mapArea: HTMLElement;
  svg: SVGSVGElement;
  container: HTMLElement;
  /** `<a>` per normalised host name. */
  links: Map<string, HTMLAnchorElement>;
  geoms: Map<string, SeatGeom>;
  /** Normalised ids of seats the map exports with the `seat-newer` class. */
  newerSeats: Set<string>;
  viewBox: { x: number; y: number; w: number; h: number };
  /** Pixels per SVG user unit when the children were laid out. */
  baseScale: number;
}

export interface DialogState {
  shadow: ShadowRoot;
  dialog: HTMLDialogElement;
  tabsState: DialogTabsState;
  timers: DialogTimers;

  campusOptions: { id: string; name: string; timezone?: string }[];
  activeCampusId: string;
  detectedCampus: string;
  currentTheme: string;

  clusters: ClusterInfo[];
  activeCluster: ClusterInfo;
  defaultId: string;
  campusExits: ExitConfig | null;

  zoomLevel: number;
  defaultZoomLevel: number;
  showMarkers: boolean;
  hasMarkers: boolean;
  /** Markers are useful for the map on screen (it has no chairs of its own). */
  markersAvailable: boolean;

  seatPosCache: Map<string, Map<string, SeatPos>>;
  svgViewBoxes: Map<string, { w: number; h: number }>;
  /** Seat geometry in user units, per campus:cluster (computed once). */
  seatGeomCache: Map<string, Map<string, SeatGeom>>;
  /** Trimmed viewBox per campus:cluster, so the SVG is only measured once. */
  trimmedViewBoxes: Map<string, string>;
  /** When each map's SVG was last checked against the worker (304-friendly). */
  mapFetchedAt: Map<string, number>;
  /** Bumped when a map's SVG body changes so the open dialog can redraw it. */
  mapVersions: Map<string, number>;
  /** The avatar overlay currently mounted in `#map-area`. */
  overlay: SeatOverlay | null;
  parsedDocs: Map<string, Document>;
  loadId: number;
  retryCount: number;
  lastUpdated: number;

  occupancyCache: Map<string, OccupancyEntry> | null;
  wifiUsers: OccupancyEntry[];
  seatedUsers: OccupancyEntry[];
  activeUsers: OccupancyEntry[];
  flashingSeat: string | null;

  activeSortMode: ActiveSortMode;
  activeNameDir: "asc" | "desc";
  activeSinceDir: "asc" | "desc";
  activeWifiOnly: boolean;

  settingsInline: boolean;
}

export const keyOf = (campusId: string, clusterId: string) =>
  `${campusId}:${clusterId}`;

export function clusterLabel(c: ClusterInfo): string {
  return (
    c.name.trim() ||
    (c.svg ? getSvgSlug(c.svg) : "") ||
    `Cluster ${c.id}`
  ).toUpperCase();
}
