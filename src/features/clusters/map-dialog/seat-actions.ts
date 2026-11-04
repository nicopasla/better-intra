import type { DialogState, SeatOverlay } from "./context";
import { openSeatReportSheet } from "./report-sheet";
import { setReportMode } from "./report-ui";

const LONG_PRESS_MS = 500;
const MOVE_SLOP = 6;
const wired = new WeakSet<HTMLElement>();

function occupantLogin(state: DialogState, host: string): string | null {
  const cache = state.occupancyCache;
  if (!cache) return null;
  const target = host.trim().toLowerCase();
  for (const [key, entry] of cache) {
    if (key.trim().toLowerCase() === target) return entry.login ?? null;
  }
  return null;
}

function openSheet(state: DialogState, host: string): void {
  openSeatReportSheet({
    state,
    seat: host,
    cluster: state.activeCluster.id,
    occupant: occupantLogin(state, host),
    onChanged: () => state.onSeatReportSaved?.(),
  });
}

/**
 * Wires long-press and report-mode taps on the avatar overlay. Occupied seats
 * use their `<a>` link; empty seats use the transparent hotspot buttons.
 */
export function attachSeatActions(
  state: DialogState,
  overlay: SeatOverlay,
): void {
  const container = overlay.container;
  if (wired.has(container)) return;
  wired.add(container);

  let timer: number | null = null;
  let start: { x: number; y: number } | null = null;
  let suppressClick = false;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    start = null;
  };

  container.addEventListener(
    "pointerdown",
    (event) => {
      if (!state.canReport) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const target = (event.target as Element).closest(
        ".seat-link, .seat-hotspot",
      ) as HTMLElement | null;
      if (!target) return;
      const host = target.dataset.reportHost;
      if (!host) return;

      // Outside report mode only occupied links and empty hotspots can start a
      // long-press. Occupied hotspots ignore pointer events anyway.
      const isHotspot = target.classList.contains("seat-hotspot");
      if (
        !state.reportMode &&
        isHotspot &&
        !target.classList.contains("seat-hotspot-empty")
      ) {
        return;
      }

      start = { x: event.clientX, y: event.clientY };
      if (timer !== null) clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        suppressClick = true;
        window.setTimeout(() => {
          suppressClick = false;
        }, 700);
        setReportMode(state, false);
        openSheet(state, host);
      }, LONG_PRESS_MS);
    },
    true,
  );

  container.addEventListener(
    "pointermove",
    (event) => {
      if (!start) return;
      if (
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_SLOP
      ) {
        cancel();
      }
    },
    true,
  );
  container.addEventListener("pointerup", cancel, true);
  container.addEventListener("pointercancel", cancel, true);
  container.addEventListener("pointerleave", cancel, true);
  container.addEventListener("wheel", cancel, { capture: true, passive: true });
  overlay.mapArea.addEventListener("scroll", cancel, {
    capture: true,
    passive: true,
  });

  container.addEventListener(
    "click",
    (event) => {
      if (!state.canReport) return;
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const hotspot = (event.target as Element).closest(
        ".seat-hotspot",
      ) as HTMLElement | null;
      if (!hotspot) return;
      // Long-press opens empty seats; a plain tap only reports while armed.
      if (!state.reportMode) return;
      const host = hotspot.dataset.reportHost;
      if (!host) return;
      event.preventDefault();
      event.stopPropagation();
      setReportMode(state, false);
      openSheet(state, host);
    },
    true,
  );

  // A long-press on touch must not open the OS callout/context menu.
  container.addEventListener("contextmenu", (event) => {
    if ((event.target as Element).closest(".seat-link, .seat-hotspot")) {
      event.preventDefault();
    }
  });
}
