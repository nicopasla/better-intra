import type { DialogState } from "./context";

/** Shows/hides the report controls for the current tab and session. */
export function syncReportControls(state: DialogState): void {
  const show = state.canReport && state.activeCluster.id !== "active";
  const btn = state.shadow.getElementById(
    "report-btn",
  ) as HTMLButtonElement | null;
  if (btn) {
    btn.style.display = show ? "" : "none";
    btn.classList.toggle("btn-primary", state.reportMode);
    btn.classList.toggle("btn-warning", !state.reportMode);
    btn.setAttribute("aria-pressed", state.reportMode ? "true" : "false");
    btn.dataset.tip = state.reportMode
      ? "Tap a seat to report"
      : "Report a computer issue";
  }
  const label = state.shadow.getElementById(
    "report-btn-label",
  ) as HTMLElement | null;
  if (label) label.textContent = state.reportMode ? "Cancel" : "Report";
  const hint = state.shadow.getElementById("report-hint") as HTMLElement | null;
  if (hint) hint.style.display = show && state.reportMode ? "" : "none";
  applyReportModeToHotspots(state);
}

/** Arms/disarms the map so the next seat tap opens the report sheet. */
export function setReportMode(state: DialogState, on: boolean): void {
  state.reportMode = on;
  syncReportControls(state);
}

export function applyReportModeToHotspots(state: DialogState): void {
  const container = state.overlay?.container;
  if (!container) return;
  container.classList.toggle("report-mode", state.reportMode);
  for (const el of container.querySelectorAll<HTMLElement>(".seat-hotspot")) {
    el.classList.toggle("report-mode", state.reportMode);
  }
}
