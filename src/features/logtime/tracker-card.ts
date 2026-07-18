import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { sharedCSS } from "../../assets/shared-styles.ts";
import { getEffectiveTheme } from "../profile/theme/theme-manager.ts";
import {
  getTrackerState,
  computeWeekProgress,
  formatHours,
  saveTrackerMode,
  detectTrackerBadges,
  TRACKER_MODES,
  type TrackerState,
  type WeekProgress,
} from "./tracker.ts";
import { lastStats } from "./logtime.ts";
import VALIDATED_SVG from "../../assets/svg/validated.svg?raw";
import INVALIDE_SVG from "../../assets/svg/invalide.svg?raw";

const HOST_ID = "ft-tracker-card";
let _host: HTMLElement | null = null;
let _shadow: ShadowRoot | null = null;
let _state: TrackerState | null = null;

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

async function renderUI() {
  if (!_shadow || !_state) return;

  const theme = await getEffectiveTheme();
  const daisyTheme = theme === "light" ? "light" : "dark";
  const progress = lastStats ? computeWeekProgress(lastStats, _state) : null;

  render(renderCard(daisyTheme, progress, _state), _shadow);
}

export async function injectTrackerCard(): Promise<void> {
  if (_host) return;

  let state = await getTrackerState();

  if (!state) {
    const badge = detectTrackerBadges();
    if (badge) {
      const defaultMode = badge === "phoenix" ? "phoenix-1" : "pegasus-bronze";
      await saveTrackerMode(defaultMode);
      state = await getTrackerState();
    }
  }

  if (!state) return;

  _state = state;

  const yAxis = document.querySelector<HTMLElement>(
    ".flex.flex-col.w-10.justify-evenly",
  );
  if (!yAxis) return;

  const chartRow = yAxis.parentElement as HTMLElement;
  if (!chartRow) return;

  _host = document.createElement("div");
  _host.id = HOST_ID;
  _host.style.cssText = "width:100%;margin-top:auto";
  chartRow.replaceWith(_host);
  _shadow = _host.attachShadow({ mode: "open" });

  await renderUI();
}
