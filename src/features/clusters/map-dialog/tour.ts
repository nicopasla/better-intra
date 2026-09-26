import { runTour, type TourStep } from "../../../utils/tour.ts";
import type { DialogState } from "./context.ts";

const TOUR_SEEN_KEY = "CLUSTERS_TOUR_SEEN";

async function hasSeenTour(): Promise<boolean> {
  const store = await chrome.storage.local.get(TOUR_SEEN_KEY);
  return store[TOUR_SEEN_KEY] === true;
}

async function markTourSeen(): Promise<void> {
  await chrome.storage.local.set({ [TOUR_SEEN_KEY]: true });
}

export function startClusterDialogTour(state: DialogState): Promise<void> {
  const { shadow, dialog } = state;

  const menu = () => shadow.getElementById("settings-menu");
  const openMenu = () => {
    const el = menu();
    if (el) el.style.display = "block";
  };
  const closeMenu = () => {
    const el = menu();
    if (el) el.style.display = "none";
  };

  const steps: TourStep[] = [
    {
      target: () => shadow.getElementById("campus-trigger"),
      title: "Switch campus",
      body: "Open the campus picker to view the cluster map of any 42 campus.",
      placement: "bottom",
    },
    {
      target: () =>
        shadow.querySelector<HTMLElement>(".tabs-scroll .tab") ??
        shadow.querySelector<HTMLElement>(".clusters-tabs-host"),
      title: "Cluster rooms",
      body: "Jump between cluster rooms. Each tab shows how many seats are taken.",
      placement: "bottom",
    },
    {
      target: () => shadow.getElementById("map-area"),
      title: "Live cluster map",
      body: "Occupied seats show the student's avatar. Click a seat to open their profile.",
      placement: "top",
    },
    {
      target: () => shadow.getElementById("updated-badge"),
      title: "Live occupancy",
      body: "The map refreshes automatically. Click the badge to reload it now.",
      placement: "left",
    },
    {
      target: () =>
        shadow.getElementById("settings-btn") ??
        shadow.getElementById("settings-inline"),
      title: "Map settings",
      body: "Choose a default cluster and toggle the chair direction markers here.",
      placement: "bottom",
      onEnter: openMenu,
    },
    {
      target: () => shadow.getElementById("default-cluster-select"),
      title: "Default cluster",
      body: "Choose which cluster is selected automatically every time the map opens.",
      placement: "left",
    },
    {
      target: () => shadow.getElementById("markers-btn"),
      title: "Chair markers",
      body: "Show or hide the arrows that indicate which way each chair faces.",
      placement: "left",
      onLeave: closeMenu,
    },
    {
      target: () =>
        shadow.getElementById("zoom-controls") ??
        shadow.getElementById("zoom-in"),
      title: "Zoom",
      body: "Zoom in and out or reset the map to its original size.",
      placement: "left",
    },
    {
      target: () => shadow.getElementById("maximize-btn"),
      title: "Maximize",
      body: "Expand the map to fill the screen. Press Esc or the button again to restore.",
      placement: "bottom",
    },
  ];

  const controller = new AbortController();
  const onCancel = (e: Event) => {
    e.preventDefault();
    controller.abort();
  };
  const onClose = () => controller.abort();

  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("close", onClose, { once: true });

  return runTour({
    steps,
    container: dialog,
    root: shadow,
    hostId: "cluster-tour-host",
    signal: controller.signal,
    scrimOpacity: 0.45,
  }).finally(() => {
    dialog.removeEventListener("cancel", onCancel);
    dialog.removeEventListener("close", onClose);
    closeMenu();
  });
}

export async function maybeStartClusterDialogTour(
  state: DialogState,
  opts: { seatId?: string } = {},
): Promise<void> {
  if (opts.seatId) return;
  if (await hasSeenTour()) return;
  await markTourSeen();
  await startClusterDialogTour(state);
}
