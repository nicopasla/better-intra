import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { sharedCSS } from "../../assets/shared-styles.ts";
import { getEffectiveTheme } from "../profile/theme/theme-manager.ts";
import {
  getTrackerState,
  computeWeekProgress,
  formatHours,
  saveTrackerMode,
  findTrackerBadgeEl,
  thresholdsMet,
  TRACKER_MODES,
  type TrackerState,
  type WeekProgress,
} from "./tracker.ts";
import { lastStats } from "./logtime.ts";
import VALIDATED_SVG from "../../assets/svg/validated.svg?raw";
import INVALIDE_SVG from "../../assets/svg/invalide.svg?raw";

let _state: TrackerState | null = null;
let _badgeEl: HTMLElement | null = null;
let _badgeType: "phoenix" | "pegasus" | null = null;
let _popoverHost: HTMLElement | null = null;
let _popoverTimer: ReturnType<typeof setTimeout> | null = null;

function statusIcon(met: boolean) {
  return html`<span class="size-5 flex items-center justify-center"
    >${unsafeHTML(met ? VALIDATED_SVG : INVALIDE_SVG)}</span
  >`;
}

function renderCard(
  theme: string,
  progress: WeekProgress | null,
  trackerState: TrackerState,
) {
  const { thresholds } = trackerState;

  return html`
    <style>
      ${unsafeHTML(sharedCSS)} :host {
        display: block;
        width: 100%;
      }
      .ft-tracker-table th,
      .ft-tracker-table td {
        padding: 0.25rem 0.5rem 0.25rem 0.25rem;
        font-size: 0.8125rem;
      }
      .ft-tracker-table td:first-child {
        padding-left: 0.5rem;
      }
      .ft-tracker-table td:nth-child(2) {
        white-space: nowrap;
      }
    </style>
    <div data-theme="${theme}">
      <div class="card shadow-sm">
        <div class="card-body p-3 gap-2">
          <div class="flex items-center">
            <select
              class="select select-xs select-ghost font-bold text-sm w-auto max-w-48"
              @change="${(e: Event) => {
                const val = (e.target as HTMLSelectElement).value;
                saveTrackerMode(val).then(() => window.location.reload());
              }}"
            >
              <option value="off" ?selected="${!TRACKER_MODES.includes(trackerState.mode)}">
                Off
              </option>
              <optgroup label="Phoenix">
              ${["phoenix-1", "phoenix-2", "phoenix-3", "phoenix-4"].map(
                (m) => {
                  const s = getTrackerStateSync(m);
                  const selected = m === trackerState.mode;
                  return html`
                    <option value="${m}" ?selected="${selected}">
                      ${s?.label}
                    </option>
                  `;
                },
              )}
              </optgroup>
              <optgroup label="Pegasus">
              ${[
                "pegasus-bronze",
                "pegasus-silver",
                "pegasus-gold",
                "pegasus-diamond",
                "pegasus-vibranium",
              ].map((m) => {
                const s = getTrackerStateSync(m);
                const selected = m === trackerState.mode;
                return html`
                  <option value="${m}" ?selected="${selected}">
                    ${s?.label}
                  </option>
                `;
              })}
              </optgroup>
            </select>
            <div class="flex-1"></div>
          </div>
          </div>

          <div class="overflow-x-auto">
            <table class="ft-tracker-table w-full">
              <thead></thead>
              <tbody>
                ${
                  progress
                    ? html`
                        <tr>
                          <td class="font-medium">Days</td>
                          <td class="tabular-nums">
                            ${progress.daysDone} / ${thresholds.days}
                          </td>
                          <td class="text-center">
                            ${statusIcon(progress.daysDone >= thresholds.days)}
                          </td>
                        </tr>
                        <tr>
                          <td class="font-medium">Hours</td>
                          <td class="tabular-nums">
                            ${formatHours(progress.hoursDone)} /
                            ${formatHours(thresholds.hours)}
                          </td>
                          <td class="text-center">
                            ${statusIcon(
                              progress.hoursDone >= thresholds.hours,
                            )}
                          </td>
                        </tr>
                      `
                    : html`
                        <tr>
                          <td
                            colspan="3"
                            class="text-center text-xs opacity-50 py-4"
                          >
                            No logtime data yet.
                          </td>
                        </tr>
                      `
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getTrackerStateSync(mode: string): TrackerState | null {
  const map: Record<string, TrackerState> = {
    "phoenix-1": {
      mode: "phoenix-1",
      label: "Phoenix - Phase 1",
      thresholds: { days: 2, hours: 20, slots: null },
    },
    "phoenix-2": {
      mode: "phoenix-2",
      label: "Phoenix - Phase 2",
      thresholds: { days: 3, hours: 25, slots: null },
    },
    "phoenix-3": {
      mode: "phoenix-3",
      label: "Phoenix - Phase 3",
      thresholds: { days: 4, hours: 30, slots: null },
    },
    "phoenix-4": {
      mode: "phoenix-4",
      label: "Phoenix - Phase 4",
      thresholds: { days: 5, hours: 35, slots: null },
    },
    "pegasus-bronze": {
      mode: "pegasus-bronze",
      label: "Pegasus - Bronze",
      thresholds: { days: 4, hours: 30, slots: null },
    },
    "pegasus-silver": {
      mode: "pegasus-silver",
      label: "Pegasus - Silver",
      thresholds: { days: 4, hours: 35, slots: null },
    },
    "pegasus-gold": {
      mode: "pegasus-gold",
      label: "Pegasus - Gold",
      thresholds: { days: 5, hours: 40, slots: null },
    },
    "pegasus-diamond": {
      mode: "pegasus-diamond",
      label: "Pegasus - Diamond",
      thresholds: { days: 5, hours: 45, slots: null },
    },
    "pegasus-vibranium": {
      mode: "pegasus-vibranium",
      label: "Pegasus - Vibranium",
      thresholds: { days: 6, hours: 50, slots: null },
    },
  };
  return map[mode] ?? null;
}

function updateBadgeIndicator() {
  if (!_state || !_badgeEl) return;
  const progress = lastStats ? computeWeekProgress(lastStats, _state) : null;
  const met = progress ? thresholdsMet(progress, _state) : false;
  const color = met ? "#10b981" : "#ef4444";
  const glow = met
    ? "0 0 16px rgba(16,185,129,0.5), 0 0 4px rgba(16,185,129,0.3)"
    : "0 0 16px rgba(239,68,68,0.5), 0 0 4px rgba(239,68,68,0.3)";

  _badgeEl.style.setProperty("border", "2px solid", "important");
  _badgeEl.style.setProperty("border-color", color, "important");
  _badgeEl.style.setProperty("box-shadow", glow, "important");

  const existing = _badgeEl.querySelector(".ft-tracker-icon");
  if (existing) existing.remove();

  const icon = document.createElement("span");
  icon.className = "ft-tracker-icon";
  icon.style.cssText =
    "margin-left:0.25rem;display:inline-flex;align-items:center;";
  icon.insertAdjacentHTML("beforeend", met ? VALIDATED_SVG : INVALIDE_SVG);
  _badgeEl.appendChild(icon);
}

function renderPopover() {
  if (!_state || !_badgeEl) return;
  if (_popoverHost) closePopover();

  const progress = lastStats ? computeWeekProgress(lastStats, _state) : null;

  _popoverHost = document.createElement("div");
  _popoverHost.style.cssText = "position:absolute;z-index:99999;width:200px;";

  const shadow = _popoverHost.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `${sharedCSS}
    .ft-popover { box-shadow: 0 4px 24px rgba(0,0,0,0.3); }
    .ft-popover td { padding: 0.2rem 0.4rem; font-size: 0.8125rem; }
  `;
  shadow.appendChild(style);

  (async () => {
    const theme = await getEffectiveTheme();
    const daisyTheme = theme === "light" ? "light" : "dark";
    const t = _state!.thresholds;
    render(
      html`
        <div data-theme="${daisyTheme}">
          <div class="card card-compact ft-popover bg-base-100">
            <div class="card-body p-3">
              <div class="mb-1">
                <select
                  class="select select-xs select-ghost w-full"
                  @change="${(e: Event) => {
                    const val = (e.target as HTMLSelectElement).value;
                    saveTrackerMode(val).then(() => window.location.reload());
                  }}"
                >
                  ${TRACKER_MODES.filter((m) => m.startsWith(_badgeType!)).map(
                    (m) => {
                      const s = getTrackerStateSync(m);
                      const selected = m === _state!.mode;
                      return html`
                        <option value="${m}" ?selected="${selected}">
                          ${s?.label.replace(/^(Phoenix|Pegasus) - /, "")}
                        </option>
                      `;
                    },
                  )}
                </select>
              </div>
              <div class="grid grid-cols-2 gap-2">
                ${progress
                  ? html`
                      <div
                        class="card card-compact"
                        style="background:${progress.daysDone >= t.days
                          ? "rgba(16,185,129,0.15)"
                          : "rgba(239,68,68,0.15)"}"
                      >
                        <div class="card-body p-2 items-center text-center">
                          <span class="text-xs opacity-60">Days</span>
                          <span class="font-bold tabular-nums"
                            >${progress.daysDone}/${t.days}</span
                          >
                        </div>
                      </div>
                      <div
                        class="card card-compact"
                        style="background:${progress.hoursDone >= t.hours
                          ? "rgba(16,185,129,0.15)"
                          : "rgba(239,68,68,0.15)"}"
                      >
                        <div class="card-body p-2 items-center text-center">
                          <span class="text-xs opacity-60">Hours</span>
                          <span class="font-bold tabular-nums"
                            >${formatHours(progress.hoursDone)}/${formatHours(
                              t.hours,
                            )}</span
                          >
                        </div>
                      </div>
                    `
                  : html`
                      <div
                        class="col-span-2 text-center text-xs opacity-50 py-2"
                      >
                        No logtime data yet.
                      </div>
                    `}
              </div>
            </div>
          </div>
        </div>
      `,
      shadow,
    );

    const rect = _badgeEl!.getBoundingClientRect();
    _popoverHost!.style.top = `${rect.bottom + 6 + window.scrollY}px`;
    _popoverHost!.style.left = `${Math.min(rect.left + window.scrollX, document.documentElement.scrollWidth - 276)}px`;
  })();

  document.body.appendChild(_popoverHost);

  _popoverHost.addEventListener("mouseenter", () => {
    if (_popoverTimer) clearTimeout(_popoverTimer);
  });
  _popoverHost.addEventListener("mouseleave", () => {
    _popoverTimer = setTimeout(closePopover, 100);
  });
}

function closePopover() {
  if (!_popoverHost) return;
  _popoverHost.remove();
  _popoverHost = null;
}

export async function colorTrackerBadge(): Promise<void> {
  if (_badgeEl) return;

  const found = findTrackerBadgeEl();
  if (!found) return;

  _badgeEl = found.element;
  _badgeType = found.type;
  _badgeEl.style.cursor = "pointer";
  _badgeEl.title = "";

  _badgeEl.addEventListener("mouseenter", () => {
    if (_popoverTimer) clearTimeout(_popoverTimer);
    renderPopover();
  });
  _badgeEl.addEventListener("mouseleave", () => {
    _popoverTimer = setTimeout(closePopover, 100);
  });

  let state = await getTrackerState();
  if (!state) {
    const defaultMode =
      found.type === "phoenix" ? "phoenix-1" : "pegasus-bronze";
    await saveTrackerMode(defaultMode);
    state = await getTrackerState();
  }
  if (!state) return;
  _state = state;

  updateBadgeIndicator();

  document.addEventListener("42_LOGTIME_DATA", updateBadgeIndicator);
}
