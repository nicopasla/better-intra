import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { until } from "lit-html/directives/until.js";
import { ref } from "lit-html/directives/ref.js";
import { getConfig, setConfig } from "../../config.ts";
import {
  DEFAULT_GENERAL_FONT,
  IMPORTED_FONT_MAX_BYTES,
  addFontToHistory,
  type ImportedFontEntry,
} from "../../utils/fonts.ts";
import {
  type HubSettingDef,
  type FeatureCardOption,
} from "./hubSettings.data.ts";
import {
  getStoredLinks,
  extractLinksFromForm,
  renderShortcutsSettings,
  type ShortcutLink,
} from "../shortcuts/shortcuts.ui.ts";
import {
  createSortable,
  moveItem,
  mergeVisibleOrder,
} from "../../utils/sortable.ts";
import EYE_SVG from "../../assets/svg/eye.svg?raw";
import EYE_SLASH_SVG from "../../assets/svg/eye-slash.svg?raw";
import RESET_SVG from "../../assets/svg/reset.svg?raw";
import GRIP_VERTICAL_SVG from "../../assets/svg/grip-vertical.svg?raw";
import LINK_SVG from "../../assets/svg/link.svg?raw";
import CHEVRON_DOWN_SVG from "../../assets/svg/chevron-down.svg?raw";
import SUNSET_SVG from "../../assets/svg/sunset.svg?raw";
import SUNRISE_SVG from "../../assets/svg/sunrise.svg?raw";
import { exportableSettings, sanitizeBackup } from "./backup.ts";
import { renderDiscordPanel } from "../discord/discord.ui.ts";
import { renderCalendarPanel } from "../calendar/calendar.ui.ts";
import { THEMES } from "../profile/theme/theme-manager.ts";
import {
  openThemeEditor,
  openCommunityThemesDialog,
} from "../profile/theme/theme-editor.ts";
import { showConfirmDialog } from "../../utils/confirm-dialog.ts";
import { fetchCampusList } from "../clusters/clusters.data.ts";
import { clearCampusConfigCache, loadCampusData } from "../campus/campus.ts";
import {
  dynamicCampusOptions,
  dynamicEventTypeOptions,
} from "./hubSettings.state.ts";
import {
  getCampusSunTimes,
  type CampusSunTimes,
} from "../profile/theme/campus-coords.ts";

// Changes only persist locally here; they are uploaded when the user clicks
// "Save & Reload" (or the account "Push Settings" button).
async function saveSetting(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

const FEATURE_CARD_COLORS: Record<string, string> = {
  warning: "var(--color-warning)",
  info: "var(--color-info)",
  success: "var(--color-success)",
  error: "var(--color-error)",
  primary: "var(--color-primary)",
};

function renderFeatureCard(params: {
  opt: FeatureCardOption;
  value: boolean;
  subValue: boolean;
  disabled: boolean;
  subDisabled: boolean;
  enabled: boolean;
}): ReturnType<typeof html> {
  const { opt, value, subValue, disabled, subDisabled, enabled } = params;
  return html`
    <div
      class="card bg-base-200 shadow-sm p-4 flex flex-col gap-3 border border-t-4 ${disabled
        ? "opacity-40 grayscale"
        : ""}"
      style="border-top-color: ${FEATURE_CARD_COLORS[opt.color ?? ""] ??
      "var(--color-primary)"}"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-col gap-1">
          <h3 class="font-bold text-base">${opt.label}</h3>
          ${opt.desc ? html`<p class="text-xs opacity-70">${opt.desc}</p>` : ""}
        </div>
        <input
          type="checkbox"
          class="toggle ${opt.big
            ? "toggle-xl toggle-primary"
            : "toggle-lg toggle-accent"}"
          data-setting-key="${opt.value}"
          ?checked="${Boolean(value)}"
          ?disabled="${!enabled || disabled}"
          @change="${(e: Event) =>
            saveSetting(opt.value!, (e.target as HTMLInputElement).checked)}"
        />
      </div>
      ${opt.subToggle
        ? html`<div class="divider gap-0" style="margin-top:auto"></div>
            <div
              class="flex items-center justify-between gap-2 ${subDisabled
                ? "opacity-40 grayscale"
                : ""}"
            >
              <div
                class="flex flex-col justify-center gap-1"
                style="min-height: 3.5rem"
              >
                <span class="text-sm font-semibold leading-5"
                  >${opt.subToggle.label}</span
                >
                ${opt.subToggle.desc
                  ? html`<p class="text-xs opacity-70 leading-4 line-clamp-2">
                      ${opt.subToggle.desc}
                    </p>`
                  : ""}
              </div>
              <input
                type="checkbox"
                class="toggle toggle-accent"
                data-setting-key="${opt.subToggle.value}"
                ?checked="${Boolean(subValue)}"
                ?disabled="${!enabled || disabled || subDisabled}"
                @change="${(e: Event) =>
                  saveSetting(
                    opt.subToggle!.value,
                    (e.target as HTMLInputElement).checked,
                  )}"
              />
            </div>`
        : ""}
    </div>
  `;
}

function truncateLabel(name: string, max = 28): string {
  return name.length > max ? name.slice(0, max - 3) + "..." : name;
}

async function applyThemePresetSideEffects(
  value: string,
  root: ShadowRoot,
): Promise<void> {
  const container = root.querySelector("[data-theme]") as HTMLElement | null;
  if (container) container.setAttribute("data-theme", value);
  const currentMode = await getConfig("BETTER_INTRA_THEME");
  // System / Schedule are explicit overrides; picking a theme shouldn't disable them.
  if (currentMode === "system" || currentMode === "schedule") return;
  const preset = THEMES[value];
  const mode: "dark" | "light" | null =
    value === "light"
      ? "light"
      : value === "dark"
        ? "dark"
        : preset?.light && !preset?.dark
          ? "light"
          : preset?.dark && !preset?.light
            ? "dark"
            : null;
  if (mode) {
    await chrome.storage.local.set({ BETTER_INTRA_THEME: mode });
  }
}

function renderPresetSwatches(
  options: readonly FeatureCardOption[] | undefined,
  selected: string,
  enabled: boolean,
  groupName: string,
  onSelect: (value: string, root: ShadowRoot) => void,
): unknown {
  return (options ?? []).map((raw) => {
    const o = raw as {
      label?: string;
      value?: string;
      color?: string;
      divider?: boolean;
    };
    if (o.divider) {
      return html`<div class="w-full h-px bg-base-300 my-1"></div>`;
    }
    if (o.label && !o.value) {
      return html`<div
        class="w-full text-xs font-bold uppercase opacity-50 pt-1"
      >
        ${o.label}
      </div>`;
    }
    const hsl = o.color ?? "199 89% 48%";
    const isSelected = String(o.value) === selected;
    const lightness = parseInt(hsl.split(" ")[2] ?? "50");
    const textColor = lightness > 50 ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)";
    return html`<input
      type="radio"
      name="${groupName}"
      class="btn btn-sm flex-none"
      aria-label="${o.label}"
      value="${o.value}"
      style="background-color: hsl(${hsl}); color: ${textColor}; border: 2px solid ${isSelected
        ? "#fff"
        : "transparent"}; outline: ${isSelected
        ? "2px solid hsl(" + hsl + ")"
        : "none"}; outline-offset: 2px;"
      ?checked="${isSelected}"
      ?disabled="${!enabled}"
      @change="${(e: Event) => {
        const input = e.target as HTMLInputElement;
        if (!input.checked) return;
        onSelect(input.value, input.getRootNode() as ShadowRoot);
      }}"
    />`;
  });
}

function renderThemeAccentControl(
  host: HTMLElement,
  def: HubSettingDef,
  enabled: boolean,
): void {
  let isSchedule = false;
  let selected = "";
  let darkPreset = "";
  let lightPreset = "";
  let sunTimes: CampusSunTimes | null = null;

  const presetMode = (value: string): "dark" | "light" | null => {
    const preset = THEMES[value];
    if (value === "light") return "light";
    if (value === "dark") return "dark";
    if (preset?.light && !preset?.dark) return "light";
    if (preset?.dark && !preset?.light) return "dark";
    return null;
  };

  const setSchedule = (on: boolean) => {
    const next = on ? "schedule" : (presetMode(selected) ?? "dark");
    void chrome.storage.local
      .set({ BETTER_INTRA_THEME: next })
      .then(() => init());
  };

  const init = async () => {
    const themeMode = await getConfig("BETTER_INTRA_THEME");
    isSchedule = themeMode === "schedule";
    selected = await getConfig("PROFILE_THEME_PRESET");
    darkPreset = await getConfig("THEME_SCHEDULE_DARK_PRESET");
    lightPreset = await getConfig("THEME_SCHEDULE_LIGHT_PRESET");
    const campusId = await getConfig("CLUSTERS_CAMPUS");
    sunTimes = await getCampusSunTimes(campusId);
    draw();
  };

  const draw = () => {
    render(
      html`<div class="flex flex-col gap-3 w-full">
        ${isSchedule
          ? html`<div class="flex flex-col gap-1">
              <span class="text-[11px] opacity-60"
                >Pick one dark theme and one light theme.</span
              >
              <div class="flex flex-wrap gap-1 w-full">
                ${(() => {
                  let inLight = false;
                  return (def.options ?? []).map((raw) => {
                    const o = raw as {
                      label?: string;
                      value?: string;
                      color?: string;
                      divider?: boolean;
                    };
                    if (o.divider) {
                      return html`<div
                        class="w-full h-px bg-base-300 my-1"
                      ></div>`;
                    }
                    if (o.label && !o.value) {
                      if (o.label === "Light") inLight = true;
                      return html`<div
                        class="w-full text-xs font-bold uppercase opacity-50 pt-1"
                      >
                        ${o.label}
                      </div>`;
                    }
                    const hsl = o.color ?? "199 89% 48%";
                    const isDarkSel = String(o.value) === darkPreset;
                    const isLightSel = String(o.value) === lightPreset;
                    const slotIsLight = inLight;
                    const lightness = parseInt(hsl.split(" ")[2] ?? "50");
                    const textColor =
                      lightness > 50 ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)";
                    return html`<button
                      type="button"
                      class="btn btn-sm flex-none relative"
                      aria-label="${o.label}"
                      style="background-color: hsl(${hsl}); color: ${textColor}; border: 2px solid ${isDarkSel
                        ? "#3b82f6"
                        : isLightSel
                          ? "#f59e0b"
                          : "transparent"}; outline: ${isDarkSel || isLightSel
                        ? "2px solid " + (isDarkSel ? "#3b82f6" : "#f59e0b")
                        : "none"}; outline-offset: 2px;"
                      @click="${() => {
                        if (slotIsLight) {
                          lightPreset = o.value ?? "";
                          void chrome.storage.local.set({
                            THEME_SCHEDULE_LIGHT_PRESET: o.value,
                          });
                          if (
                            !document.documentElement.classList.contains("dark")
                          ) {
                            void chrome.storage.local.set({
                              PROFILE_THEME_PRESET: o.value,
                            });
                          }
                        } else {
                          darkPreset = o.value ?? "";
                          void chrome.storage.local.set({
                            THEME_SCHEDULE_DARK_PRESET: o.value,
                          });
                          if (
                            document.documentElement.classList.contains("dark")
                          ) {
                            void chrome.storage.local.set({
                              PROFILE_THEME_PRESET: o.value,
                            });
                          }
                        }
                        draw();
                      }}"
                    >
                      ${o.label}
                      ${isDarkSel
                        ? html`<span
                            class="absolute -top-1.5 -right-1.5 text-[8px] font-bold uppercase px-1 rounded-full"
                            style="background:#3b82f6;color:#fff;"
                            >dark</span
                          >`
                        : ""}
                      ${isLightSel
                        ? html`<span
                            class="absolute -top-1.5 -right-1.5 text-[8px] font-bold uppercase px-1 rounded-full"
                            style="background:#f59e0b;color:#fff;"
                            >light</span
                          >`
                        : ""}
                    </button>`;
                  });
                })()}
              </div>
            </div>`
          : html`<div class="flex flex-wrap gap-1 w-full">
              ${renderPresetSwatches(
                def.options,
                selected,
                enabled,
                def.key ?? "accent",
                (value) => {
                  selected = value;
                  saveSetting(def.key!, value);
                  void applyThemePresetSideEffects(
                    value,
                    host.getRootNode() as ShadowRoot,
                  );
                  draw();
                },
              )}
            </div>`}
        <div class="flex flex-wrap gap-2 w-full">
          <button
            type="button"
            class="text-left"
            style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 0.9rem; border-radius:0.75rem; border:1px solid var(--color-base-300); background:var(--color-base-100); cursor:pointer;"
            @click="${openCommunityThemesDialog}"
          >
            <span style="font-size:0.875rem; font-weight:600;"
              >Community themes</span
            >
          </button>
<label
              class="cursor-pointer"
              style="display:flex; flex-direction:row; align-items:center; gap:0.5rem; padding:0.6rem 0.9rem; border-radius:0.75rem; border:1px solid var(--color-base-300); background:var(--color-base-100);"
            >
              <input
                type="checkbox"
                class="toggle toggle-primary"
                ?checked="${isSchedule}"
                ?disabled="${!enabled}"
                @change="${(e: Event) =>
                  setSchedule((e.target as HTMLInputElement).checked)}"
              />
              <span
                style="display:flex; flex-direction:column; align-items:flex-start;"
              >
                <span style="font-size:0.875rem; font-weight:600;">Auto</span>
                ${sunTimes
                  ? html`<span
                      style="display:flex; align-items:center; gap:0.25rem; font-size:0.75rem; opacity:0.7;"
                    >
                      <span
                        style="display:inline-flex; width:0.85rem; height:0.85rem;"
                        >${unsafeHTML(SUNSET_SVG)}</span
                      >${sunTimes.sunset}
                      <span
                        style="display:inline-flex; width:0.85rem; height:0.85rem; margin-left:0.25rem;"
                        >${unsafeHTML(SUNRISE_SVG)}</span
                      >${sunTimes.sunrise}
                    </span>`
                  : ""}
              </span>
            </label>
          <button
            type="button"
            class="text-left"
            style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 0.9rem; border-radius:0.75rem; border:1px solid var(--color-base-300); background:var(--color-base-100); cursor:pointer;"
            ?disabled="${!enabled}"
            @click="${() => openThemeEditor(def.options ?? [])}"
          >
            <span style="font-size:0.875rem; font-weight:600;"
              >Customize colors</span
            >
          </button>
        </div>
      </div>`,
      host,
    );
  };

  const onStorage = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (
      area === "local" &&
      (changes.BETTER_INTRA_THEME ||
        changes.PROFILE_THEME_PRESET ||
        changes.THEME_SCHEDULE_DARK_PRESET ||
        changes.THEME_SCHEDULE_LIGHT_PRESET)
    ) {
      void init();
    }
  };

  chrome.storage.onChanged.addListener(onStorage);

  void init();
}

function renderFontImportControl(
  container: HTMLElement,
  fileName: string,
  enabled: boolean,
): void {
  const refresh = (name: string) =>
    renderFontImportControl(container, name, enabled);

  const highlightPicker = (id: string) => {
    const root = container.getRootNode() as ShadowRoot;
    root
      .querySelectorAll<HTMLButtonElement>("[data-font-option]")
      .forEach((b) => {
        b.style.border =
          b.dataset.fontOption === id
            ? "2px solid var(--color-primary)"
            : "2px solid transparent";
      });
  };

  const saveFontHistory = async (
    history: readonly ImportedFontEntry[],
  ): Promise<void> => {
    try {
      await chrome.storage.local.set({ GENERAL_FONT_FILE_HISTORY: history });
    } catch {
      if (history.length <= 1) return;
      await saveFontHistory(history.slice(0, -1));
    }
  };

  const importFile = (el: EventTarget | null) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".woff2,.woff,.ttf,.otf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > IMPORTED_FONT_MAX_BYTES) {
        alert(
          `Font file too large. Maximum size is ${Math.round(
            IMPORTED_FONT_MAX_BYTES / (1024 * 1024),
          )} MB.`,
        );
        return;
      }
      if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) {
        alert("Only .woff2, .woff, .ttf or .otf font files are allowed.");
        return;
      }
      const dataUri = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });
      if (!dataUri) return;
      await chrome.storage.local.set({
        GENERAL_FONT_FILE: dataUri,
        GENERAL_FONT_FILE_NAME: file.name,
        GENERAL_FONT: "file",
      });
      const history = await getConfig("GENERAL_FONT_FILE_HISTORY");
      await saveFontHistory(
        addFontToHistory(history, { name: file.name, dataUri }),
      );
      highlightPicker("file");
      refresh(file.name);
    };
    input.click();
  };

  const removeFile = async () => {
    await chrome.storage.local.remove([
      "GENERAL_FONT_FILE",
      "GENERAL_FONT_FILE_NAME",
    ]);
    if ((await getConfig("GENERAL_FONT")) === "file") {
      await chrome.storage.local.set({ GENERAL_FONT: DEFAULT_GENERAL_FONT });
      highlightPicker(DEFAULT_GENERAL_FONT);
    }
    refresh("");
  };

  const applyHistoryEntry = async (entry: ImportedFontEntry) => {
    await chrome.storage.local.set({
      GENERAL_FONT_FILE: entry.dataUri,
      GENERAL_FONT_FILE_NAME: entry.name,
      GENERAL_FONT: "file",
    });
    highlightPicker("file");
    refresh(entry.name);
  };

  const clearHistory = async () => {
    await chrome.storage.local.remove(["GENERAL_FONT_FILE_HISTORY"]);
    refresh(fileName);
  };

  getConfig("GENERAL_FONT_FILE_HISTORY").then((history) => {
    render(
      html`<div class="flex flex-col gap-2 w-full">
        <div class="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            class="btn btn-sm btn-primary font-bold"
            ?disabled="${!enabled}"
            @mousedown="${(e: Event) => e.stopPropagation()}"
            @click="${(e: Event) => {
              e.stopPropagation();
              importFile(e.currentTarget);
            }}"
          >
            Import font file
          </button>
          ${fileName
            ? html`<span class="text-sm opacity-70">${fileName}</span>
                <button
                  type="button"
                  class="btn btn-sm btn-outline"
                  ?disabled="${!enabled}"
                  @mousedown="${(e: Event) => e.stopPropagation()}"
                  @click="${(e: Event) => {
                    e.stopPropagation();
                    void removeFile();
                  }}"
                >
                  Remove
                </button>`
            : html`<span class="text-sm opacity-50">No file imported</span>`}
        </div>
        ${history.length > 0
          ? html`<div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs opacity-50">Previously imported:</span>
              ${history.map(
                (entry) => html`
                  <button
                    type="button"
                    class="btn btn-xs btn-outline gap-1"
                    ?disabled="${!enabled}"
                    data-tip="${entry.name}"
                    @mousedown="${(e: Event) => e.stopPropagation()}"
                    @click="${(e: Event) => {
                      e.stopPropagation();
                      void applyHistoryEntry(entry);
                    }}"
                  >
                    ${truncateLabel(entry.name)}
                  </button>
                `,
              )}
              <button
                type="button"
                class="btn btn-xs btn-ghost opacity-50 hover:opacity-100 hover:text-error"
                ?disabled="${!enabled}"
                data-tip="Clear history"
                @mousedown="${(e: Event) => e.stopPropagation()}"
                @click="${(e: Event) => {
                  e.stopPropagation();
                  void clearHistory();
                }}"
              >
                ✕
              </button>
            </div>`
          : ""}
      </div>`,
      container,
    );
  });
}

function renderSettingControl(def: HubSettingDef, enabled: boolean) {
  if (def.kind === "shortcuts" && def.key === "SHORTCUTS_LINKS") {
    const container = document.createElement("div");
    container.setAttribute("data-shortcuts-panel", "true");
    let links: ShortcutLink[] = [];

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const stripIds = (list: ShortcutLink[]): ShortcutLink[] =>
      list.map(({ name, url, color, emoji }) => ({ name, url, color, emoji }));
    const save = async () => {
      links = extractLinksFromForm(container);
      await setConfig("SHORTCUTS_LINKS", stripIds(links));
    };
    const debouncedSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => save(), 300);
    };

    const update = () => {
      render(
        renderShortcutsSettings(
          links,
          () => {
            if (links.length < 8) {
              links = [
                ...links,
                { name: "", url: "", color: "#7dd3fc", emoji: "" },
              ];
              update();
            }
          },
          async (idx) => {
            links = links.filter((_, i) => i !== idx);
            await setConfig("SHORTCUTS_LINKS", stripIds(links));
            update();
          },
          () => debouncedSave(),
          () => update(),
          async (from, to) => {
            links = moveItem(links, from, to);
            await setConfig("SHORTCUTS_LINKS", stripIds(links));
            update();
          },
        ),
        container,
      );
    };

    getStoredLinks().then((storedLinks) => {
      links = storedLinks;
      update();
    });

    return container;
  }

  if (def.kind === "about") {
    return html`<div
      class="flex items-center justify-center w-full h-full min-h-40"
      data-about-placeholder
    >
      <span class="loading loading-spinner loading-sm"></span>
    </div>`;
  }
  if (def.kind === "card-order") {
    const container = document.createElement("div");
    container.className = "w-full flex flex-col gap-2 relative mt-2";
    container.setAttribute("data-card-order-panel", "true");

    let cardSortable: { destroy: () => void } | null = null;

    const cardColors: Record<string, string> = {
      EVALUATIONS: "bg-error text-error-content hover:bg-error/80 border-error",
      AGENDA: "bg-info text-info-content hover:bg-info/80 border-info",
      LOGTIME:
        "bg-success text-success-content hover:bg-success/80 border-success",
      PROJECTS:
        "bg-warning text-warning-content hover:bg-warning/80 border-warning",
      ACHIEVEMENTS:
        "bg-primary text-primary-content hover:bg-primary/80 border-primary",
      "THURSDAY ROULETTE":
        "bg-accent text-accent-content hover:bg-accent/80 border-accent",
    };

    const getCardColor = (name: string) => {
      const cleanName = name.startsWith("-") ? name.substring(1) : name;
      return cardColors[cleanName.toUpperCase().trim()] || "btn-neutral";
    };

    const renderCardOrder = (currentOrder: string[]) => {
      cardSortable?.destroy();
      cardSortable = null;
      render(
        html`
          <button
            type="button"
            class="btn btn-xs btn-outline btn-error gap-1 absolute -top-11 right-0 md:right-2 z-30"
            ?disabled="${!enabled}"
            @click="${() => {
              if (enabled) resetToDefault();
            }}"
          >
            <span class="size-3 flex items-center justify-center"
              >${unsafeHTML(RESET_SVG)}</span
            >
            Reset
          </button>

          <div
            class="flex flex-wrap gap-3 items-center p-4 bg-base-300/30 rounded-xl border border-base-300 w-full"
            data-card-order-list="true"
          >
            <span class="text-xs opacity-50 w-full pb-1">Drag to reorder</span>
            ${currentOrder.map((rawName, idx) => {
              const isDisabled = rawName.startsWith("-");
              const displayName = isDisabled ? rawName.substring(1) : rawName;

              const toggleVisibility = (e: Event) => {
                e.stopPropagation();
                if (!enabled) return;

                const newOrder = [...currentOrder];
                newOrder[idx] = isDisabled ? displayName : `-${displayName}`;

                renderCardOrder(newOrder);

                const input = container.querySelector<HTMLInputElement>(
                  "input[type='hidden']",
                );
                if (input) {
                  input.value = JSON.stringify(newOrder);
                  input.dispatchEvent(new Event("input", { bubbles: true }));
                }
                saveSetting(def.key!, newOrder);
              };

              return html`
                <div
                  class="btn btn-md border shadow-sm transition-all select-none gap-2 font-bold normal-case px-4 
      ${getCardColor(rawName)} 
      ${enabled && !isDisabled
                    ? "cursor-grab active:cursor-grabbing"
                    : "cursor-not-allowed"}
      ${isDisabled ? "opacity-30 line-through saturate-50 scale-95" : ""}"
                  data-ft-draggable
                >
                  ${enabled && !isDisabled
                    ? html`<span
                        class="size-4 shrink-0 opacity-40 pointer-events-none flex items-center justify-center"
                        >${unsafeHTML(GRIP_VERTICAL_SVG)}</span
                      >`
                    : ""}
                  ${displayName.toUpperCase().trim() !== "EVALUATIONS" &&
                  displayName.toUpperCase().trim() !== "PENDING EVALUATIONS" &&
                  displayName.toUpperCase().trim() !== "PROJECTS"
                    ? html`
                        <button
                          type="button"
                          class="p-1 -ml-1 rounded hover:bg-black/10 transition-colors pointer-events-auto cursor-pointer flex items-center justify-center text-white"
                          @click="${toggleVisibility}"
                          data-tip="${isDisabled ? "Show card" : "Hide card"}"
                        >
                          ${isDisabled
                            ? html`<span
                                class="size-4 opacity-80 flex items-center justify-center"
                                >${unsafeHTML(EYE_SLASH_SVG)}</span
                              >`
                            : html`<span
                                class="size-4 opacity-60 flex items-center justify-center"
                                >${unsafeHTML(EYE_SVG)}</span
                              >`}
                        </button>
                      `
                    : ""}

                  <span class="pointer-events-none">${displayName}</span>
                </div>
              `;
            })}
          </div>

          <input
            type="hidden"
            data-setting-key="${def.key}"
            .value="${JSON.stringify(currentOrder)}"
          />
        `,
        container,
      );

      if (!enabled) return;
      const list = container.querySelector<HTMLElement>(
        "[data-card-order-list]",
      );
      if (!list) return;
      cardSortable = createSortable(list, {
        draggable: "[data-ft-draggable]",
        filter: ".line-through",
        onReorder: (from, to) => {
          const visible = currentOrder.filter((n) => !n.startsWith("-"));
          const reordered = moveItem(visible, from, to);
          saveSetting(def.key!, mergeVisibleOrder(currentOrder, reordered));
        },
      });
    };

    const resetToDefault = () => {
      renderCardOrder((def.defaultValue as string[]) || []);
      saveSetting(def.key!, def.defaultValue as string[]);
    };

    if (!def.key) return container;
    getConfig(def.key).then((savedOrder) => {
      let order: string[] = def.defaultValue as string[];
      if (savedOrder) {
        try {
          order =
            typeof savedOrder === "string"
              ? JSON.parse(savedOrder)
              : savedOrder;
        } catch {
          order = def.defaultValue as string[];
        }
      }
      renderCardOrder(order);
    });

    return container;
  }

  if (def.kind === "discord-panel") return renderDiscordPanel();
  if (def.kind === "calendar-panel") return renderCalendarPanel();

  return until(
    (async () => {
      const value = def.key
        ? ((await getConfig(def.key)) ?? def.defaultValue ?? "")
        : (def.defaultValue ?? "");

      switch (def.kind) {
        case "feature-cards": {
          const cloudToken = await getConfig("CLOUD_TOKEN");
          const cards = [];
          for (const opt of def.options ?? []) {
            const key = opt.value ?? "";
            cards.push({
              opt,
              value: key ? ((await getConfig(key as never)) ?? false) : false,
              subValue: opt.subToggle
                ? ((await getConfig(opt.subToggle.value as never)) ?? false)
                : false,
              disabled: !!(
                (opt.dependsOn && !(await getConfig(opt.dependsOn as never))) ||
                (opt.requiresCloud && !cloudToken)
              ),
              subDisabled: !!(
                (opt.subToggle?.requiresCloud && !cloudToken) ||
                (opt.subToggle?.dependsOn &&
                  !(await getConfig(opt.subToggle.dependsOn as never)))
              ),
            });
          }
          return html`<div
            class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full col-span-full"
          >
            ${cards.map((c) => renderFeatureCard({ ...c, enabled }))}
          </div>`;
        }

        case "toggle":
          return html`<input
            type="checkbox"
            class="toggle toggle-lg toggle-accent"
            data-setting-key="${def.key}"
            ?checked="${Boolean(value)}"
            ?disabled="${!enabled}"
            @change="${(e: Event) =>
              saveSetting(def.key!, (e.target as HTMLInputElement).checked)}"
          />`;

        case "number": {
          const showEuroSuffix =
            def.key === "LOGTIME_EMOJI_RATE" ||
            def.key === "LOGTIME_EMOJI_DIVISOR" ||
            def.key === "LOGTIME_MAX_EARNINGS";

          return showEuroSuffix
            ? html`<label
                class="input input-accent w-24 flex items-center gap-1"
              >
                <input
                  type="number"
                  class="w-full"
                  .value="${String(value)}"
                  data-setting-key="${def.key}"
                  ?disabled="${!enabled}"
                  @change="${(e: Event) =>
                    saveSetting(
                      def.key!,
                      (e.target as HTMLInputElement).value,
                    )}"
                />
                <span class="opacity-70">€</span>
              </label>`
            : html`<input
                type="number"
                class="input input-accent w-24"
                .value="${String(value)}"
                data-setting-key="${def.key}"
                ?disabled="${!enabled}"
                @change="${(e: Event) =>
                  saveSetting(def.key!, (e.target as HTMLInputElement).value)}"
              />`;
        }

        case "select": {
          const options =
            def.key === "CLUSTERS_CAMPUS" && dynamicCampusOptions.length > 0
              ? dynamicCampusOptions
              : def.key === "PROFILE_EVENT_TYPE_FILTER" &&
                  dynamicEventTypeOptions.length > 0
                ? [
                    { label: "Show All", value: "all" },
                    ...dynamicEventTypeOptions,
                  ]
                : (def.options ?? []);
          return html`<select
            class="select select-accent w-44"
            data-setting-key="${def.key}"
            ?disabled="${!enabled}"
            @change="${(e: Event) =>
              saveSetting(def.key!, (e.target as HTMLSelectElement).value)}"
            @mousedown="${(e: Event) => e.stopPropagation()}"
            @click="${(e: Event) => e.stopPropagation()}"
          >
            ${options.map(
              (o) =>
                html`<option
                  value="${o.value}"
                  ?selected="${String(o.value) === String(value)}"
                >
                  ${o.label}
                </option>`,
            )}
          </select>`;
        }

        case "color":
          return html`<input
            type="color"
            class="input input-accent p-1 w-20 h-10"
            .value="${String(value)}"
            data-setting-key="${def.key}"
            ?disabled="${!enabled}"
            @change="${(e: Event) =>
              saveSetting(def.key!, (e.target as HTMLInputElement).value)}"
          />`;

        case "rainbow-palette": {
          const options = def.options ?? [];
          const current =
            options.find((o) => o.value === value) ??
            (options[0] as (typeof options)[number]);
          return html`<div class="w-full">
            <details
              class="dropdown"
              style="position: relative; position-area: auto !important;"
              @mousedown="${(e: Event) => e.stopPropagation()}"
              @click="${(e: Event) => e.stopPropagation()}"
            >
              <summary
                class="btn btn-sm btn-outline flex items-center gap-2 justify-between w-full border-base-content/30"
                data-tip="${current.label}"
              >
                <span
                  class="h-3 flex-1 rounded-full border border-base-300"
                  style="background: linear-gradient(90deg, ${current.color});"
                ></span>
                <span class="opacity-80 text-xs">${current.label}</span>
                <span
                  class="size-3 shrink-0 opacity-60 flex items-center justify-center"
                  >${unsafeHTML(
                    CHEVRON_DOWN_SVG.replace(
                      "<svg",
                      '<svg width="12" height="12"',
                    ),
                  )}</span
                >
              </summary>
              <ul
                class="menu menu-sm dropdown-content z-20 mb-2 rounded-box bg-base-100 p-1 shadow-xl"
                style="bottom: 100% !important; right: 0 !important; left: auto !important; transform-origin: bottom; width:max-content; min-width:14rem;"
              >
                ${options.map(
                  (o) =>
                    html`<li>
                      <button
                        type="button"
                        class="flex items-center gap-2 whitespace-nowrap ${o.value ===
                        value
                          ? "menu-active"
                          : ""}"
                        @click="${(e: Event) => {
                          saveSetting(def.key!, o.value ?? "");
                          (e.currentTarget as HTMLElement)
                            .closest("details")
                            ?.removeAttribute("open");
                        }}"
                      >
                        <span
                          class="h-3 w-10 rounded-full border border-base-300"
                          style="background: linear-gradient(90deg, ${o.color});"
                        ></span>
                        <span>${o.label}</span>
                      </button>
                    </li>`,
                )}
              </ul>
            </details>
          </div>`;
        }

        case "radio-group": {
          const options =
            def.key === "PROFILE_EVENT_TYPE_FILTER" &&
            dynamicEventTypeOptions.length > 0
              ? [
                  { label: "Show All", value: "all" },
                  ...dynamicEventTypeOptions,
                ]
              : (def.options ?? []);
          return html`<div class="join">
            ${options.map(
              (o) =>
                html`<input
                  type="radio"
                  name="${def.key}"
                  class="join-item btn btn-outline border-base-content/20"
                  aria-label="${o.label}"
                  value="${o.value}"
                  ?checked="${o.value === value}"
                  data-setting-key="${def.key}"
                  ?disabled="${!enabled}"
                  @change="${(e: Event) =>
                    saveSetting(
                      def.key!,
                      (e.target as HTMLInputElement).value,
                    )}"
                />`,
            )}
          </div>`;
        }

        case "theme-accent":
          return html`<div
            class="w-full"
            ${ref((el) => {
              if (el)
                queueMicrotask(() =>
                  renderThemeAccentControl(el as HTMLElement, def, enabled),
                );
            })}
          ></div>`;

        case "font-preset":
          return html`<div class="flex flex-wrap gap-1 w-full">
            ${(def.options ?? []).map((o) => {
              const selected = String(o.value) === String(value);
              const fontFamily = o.font
                ? `"${o.font}", system-ui, sans-serif`
                : "system-ui, sans-serif";
              return html`<button
                type="button"
                class="btn btn-sm flex-none"
                data-font-option="${o.value}"
                ?disabled="${!enabled}"
                style="font-family: ${fontFamily}; font-size: 0.95rem; border: 2px solid ${selected
                  ? "var(--color-primary)"
                  : "transparent"};"
                @mousedown="${(e: Event) => e.stopPropagation()}"
                @click="${(e: Event) => {
                  e.stopPropagation();
                  const btn = e.currentTarget as HTMLButtonElement;
                  saveSetting(def.key!, o.value!);
                  btn
                    .closest(".flex")!
                    .querySelectorAll("[data-font-option]")
                    .forEach((b) => {
                      const el = b as HTMLButtonElement;
                      el.style.border =
                        el.dataset.fontOption === o.value
                          ? "2px solid var(--color-primary)"
                          : "2px solid transparent";
                    });
                }}"
              >
                ${o.label}
              </button>`;
            })}
          </div>`;

        case "font-scale":
          return html`<div class="flex flex-wrap gap-1 w-full items-end">
            ${(def.options ?? []).map((o) => {
              const selected = String(o.value) === String(value);
              const previewSize = Number(o.value) * 0.15;
              return html`<button
                type="button"
                class="btn btn-sm flex-1 leading-none"
                data-font-scale="${o.value}"
                data-tip="${o.value}%"
                ?disabled="${!enabled}"
                style="font-size: ${previewSize}px; border: 2px solid ${selected
                  ? "var(--color-primary)"
                  : "transparent"};"
                @mousedown="${(e: Event) => e.stopPropagation()}"
                @click="${(e: Event) => {
                  e.stopPropagation();
                  const btn = e.currentTarget as HTMLButtonElement;
                  saveSetting(def.key!, Number(o.value));
                  btn
                    .closest(".flex")!
                    .querySelectorAll("[data-font-scale]")
                    .forEach((b) => {
                      const el = b as HTMLButtonElement;
                      el.style.border =
                        el.dataset.fontScale === o.value
                          ? "2px solid var(--color-primary)"
                          : "2px solid transparent";
                    });
                }}"
              >
                ${o.label}
              </button>`;
            })}
          </div>`;

        case "font-import":
          return html`<div
            ${ref((el) => {
              if (el)
                queueMicrotask(() =>
                  renderFontImportControl(
                    el as HTMLElement,
                    String(value || ""),
                    enabled,
                  ),
                );
            })}
          ></div>`;

        case "url":
          return html`<div class="w-full">
            <label
              class="input input-accent validator flex items-center gap-2 w-full"
            >
              <span class="h-[1em] opacity-50 flex items-center justify-center"
                >${unsafeHTML(LINK_SVG)}</span
              >
              <input
                type="url"
                required
                placeholder="https://beemovie.com/beemovie.gif"
                .value="${String(value)}"
                data-setting-key="${def.key}"
                ?disabled="${!enabled}"
                pattern="^(https?://)?.*"
                class="grow"
                @change="${(e: Event) =>
                  saveSetting(def.key!, (e.target as HTMLInputElement).value)}"
              />
            </label>
          </div>`;

        case "text":
          return html`<input
            type="text"
            class="input input-accent w-60"
            placeholder="${def.placeholder || ""}"
            .value="${String(value || "")}"
            data-setting-key="${def.key}"
            ?disabled="${!enabled}"
            @change="${(e: Event) =>
              saveSetting(def.key!, (e.target as HTMLInputElement).value)}"
          />`;

        case "action": {
          const { actionType, actionLabel } = def as {
            actionType?: string;
            actionLabel?: string;
          };

          if (actionType === "backup") {
            return html`<div class="flex gap-2">
              <button
                type="button"
                class="btn btn-sm btn-primary font-bold"
                @click="${() => {
                  chrome.storage.local.get(null, (items) => {
                    // never write credentials (cloud token, calendar secret...) to disk
                    const filtered = exportableSettings(items);
                    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const n = new Date();
                    a.download = `better-intra-settings-${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}_${String(n.getHours()).padStart(2, "0")}-${String(n.getMinutes()).padStart(2, "0")}-${String(n.getSeconds()).padStart(2, "0")}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  });
                }}"
              >
                Export
              </button>
              <button
                type="button"
                class="btn btn-sm btn-primary font-bold"
                @click="${() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      // only known, non-sensitive, correctly typed keys are restored
                      const data = sanitizeBackup(JSON.parse(text));
                      await chrome.storage.local.set(data);
                      location.reload();
                    } catch {
                      alert("Invalid backup file.");
                    }
                  };
                  input.click();
                }}"
              >
                Import
              </button>
            </div>`;
          }

          if (actionType === "reload-campus") {
            return html`<button
              type="button"
              class="btn btn-sm btn-primary font-bold"
              @click="${() => {
                void (async () => {
                  const campusId = (await getConfig("CLUSTERS_CAMPUS")) || "";
                  await clearCampusConfigCache(campusId);
                  await fetchCampusList(true);
                  if (campusId) await loadCampusData(campusId, true);
                  location.reload();
                })();
              }}"
            >
              ${actionLabel || "Reload"}
            </button>`;
          }

          if (actionType === "welcome" || actionType === "tour") {
            return html`<button
              type="button"
              class="btn btn-sm btn-primary font-bold"
              @click="${() => {
                void (async () => {
                  (
                    document.getElementById("hub-dialog") as HTMLDialogElement
                  )?.close();
                  if (actionType === "welcome") {
                    const { openWelcome } =
                      await import("../welcome/welcome.ui.ts");
                    await openWelcome();
                  } else {
                    const { startTour } = await import("../welcome/tour.ts");
                    await startTour();
                  }
                })();
              }}"
            >
              ${actionLabel || "Show"}
            </button>`;
          }

          return html`<button
            type="button"
            class="btn btn-sm btn-error font-bold"
            @click="${() => {
              void (async () => {
                const ok = await showConfirmDialog({
                  title: "Reset all data",
                  message:
                    "This will clear ALL Better Intra settings and reload. Continue?",
                  confirmLabel: "Reset",
                });
                if (ok) {
                  await chrome.storage.local.clear();
                  location.reload();
                }
              })();
            }}"
          >
            ${actionLabel || "Reset"}
          </button>`;
        }

        case "campus-info": {
          const campusId = await getConfig("CLUSTERS_CAMPUS");
          const campusName = campusId
            ? dynamicCampusOptions.find((c) => c.value === campusId)?.label ||
              campusId
            : "Not detected";
          return html`<span class="badge badge-info badge-lg text-base"
            >${campusName}</span
          >`;
        }

        case "emoji":
        default:
          return html`<input
            type="text"
            class="input input-accent w-30 text-center text-xl"
            placeholder="${def.placeholder || "🐝"}"
            maxlength="6"
            .value="${String(value || "")}"
            data-setting-key="${def.key}"
            ?disabled="${!enabled}"
            @change="${(e: Event) =>
              saveSetting(def.key!, (e.target as HTMLInputElement).value)}"
          />`;
      }
    })(),
    html`<div class="loading loading-spinner loading-sm"></div>`,
  );
}

function searchHaystack(def: HubSettingDef): string {
  return `${def.label ?? ""} ${def.desc ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function renderSetting(def: HubSettingDef, enabled: boolean, hidden?: boolean) {
  if (def.kind === "divider") {
    return html`<div class="divider font-bold my-2 col-span-full opacity-70">
      ${def.label}
    </div>`;
  }

  if (
    def.kind === "discord-panel" ||
    def.kind === "about" ||
    def.kind === "calendar-panel" ||
    def.kind === "feature-cards"
  ) {
    return renderSettingControl(def, enabled);
  }

  const COLSPAN_CLASSES = ["col-span-1", "col-span-2", "col-span-3"] as const;
  const isFullWidth =
    def.fullWidth ?? (def.kind === "url" || def.kind === "shortcuts");
  const gridClass =
    def.colSpan != null
      ? (COLSPAN_CLASSES[def.colSpan - 1] ?? "col-span-full")
      : "col-span-full";

  return html`<div
    class="card bg-base-200 shadow-sm p-3 sm:p-4 ${gridClass} ${hidden
      ? "hidden"
      : enabled
        ? ""
        : "opacity-40 grayscale"}"
    data-search="${searchHaystack(def)}"
  >
    <div
      class="flex ${isFullWidth
        ? "flex-col"
        : "flex-col sm:flex-row sm:items-center"} justify-between gap-3 sm:gap-4"
    >
      <div class="flex flex-col">
        <span class="text-sm">${def.label}</span>
        ${def.desc
          ? html`<span class="text-xs opacity-50">${def.desc}</span>`
          : ""}
      </div>
      <div
        class="${isFullWidth ? "w-full" : "flex-none self-end sm:self-auto"}"
      >
        ${renderSettingControl(def, enabled)}
      </div>
    </div>
  </div>`;
}

export function renderSettingList(
  defs: readonly HubSettingDef[],
  isAlwaysEnabled: boolean,
  enabled: boolean,
  disabledDeps: Set<string>,
  hiddenDeps: Set<string>,
) {
  return defs.map((def) => {
    const hidden = !!(def.key && hiddenDeps.has(def.key));
    return renderSetting(
      def,
      isAlwaysEnabled ||
        (enabled &&
          !(def.key && disabledDeps.has(def.key)) &&
          !(def.requiresCloud && disabledDeps.has("__CLOUD__"))),
      hidden,
    );
  });
}
