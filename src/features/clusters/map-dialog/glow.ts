import type { DialogState } from "./context";
import { normalizeSeatId } from "./seats";

/** How long a seat stays highlighted after a deep link. */
const GLOW_MS = 6000;

function dropGlow(state: DialogState) {
  state.flashingSeat = null;
  state.shadow
    .querySelectorAll(".ft-dialog-seat-glow")
    .forEach((n) => n.classList.remove("ft-dialog-seat-glow"));
}

function stopGlowTimer(state: DialogState) {
  if (!state.timers.glow) return;
  clearTimeout(state.timers.glow);
  state.timers.glow = null;
}

export function getSeatGlowTarget(
  state: DialogState,
  seatId: string,
): Element | null {
  const { shadow } = state;
  const key = normalizeSeatId(seatId);
  // Overlay hosts are already normalised ids (letters/digits only), so the
  // selector needs no escaping and resolves without walking every seat.
  const overlayLink = shadow.querySelector<HTMLElement>(
    `#seat-overlay .seat-link[data-host="${key}"]`,
  );
  if (overlayLink) return overlayLink;
  const mapArea = shadow.getElementById("map-area");
  const svg = mapArea?.querySelector("svg");
  if (!svg) return null;
  for (const el of svg.querySelectorAll<Element>("[id]")) {
    if (normalizeSeatId(el.getAttribute("id") || "") === key) return el;
  }
  return null;
}

export function clearSeatGlow(state: DialogState) {
  stopGlowTimer(state);
  dropGlow(state);
}

export function applySeatGlow(state: DialogState, seatId: string): boolean {
  const target = getSeatGlowTarget(state, seatId);
  if (!target) return false;
  target.classList.add("ft-dialog-seat-glow");
  return true;
}

export function flashSeat(state: DialogState, seatId: string) {
  const mapArea = state.shadow.getElementById("map-area");
  if (!mapArea) return;
  const svg = mapArea.querySelector("svg");
  if (!svg) return;
  clearSeatGlow(state);
  const target = getSeatGlowTarget(state, seatId);
  if (!target) return;
  state.flashingSeat = seatId;
  target.classList.add("ft-dialog-seat-glow");
  target.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });
  // Bounded highlight: an endless pulse repaints the map forever.
  state.timers.glow = setTimeout(() => {
    state.timers.glow = null;
    dropGlow(state);
  }, GLOW_MS);
}
