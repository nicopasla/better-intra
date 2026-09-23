import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { until } from "lit-html/directives/until.js";
import { ref } from "lit-html/directives/ref.js";
import { getConfig, CONFIG_DEFAULT, type ConfigKey } from "../../config.ts";
import {
  DEFAULT_GENERAL_FONT,
  IMPORTED_FONT_MAX_BYTES,
} from "../../utils/fonts.ts";
import {
  FEATURE_DEFS,
  HUB_INFO,
  FeatureId,
  INTRA_FONT,
  HUB_SETTING_DEFS,
  type HubSettingDef,
  type FeatureCardOption,
} from "./hubSettings.data.ts";
import {
  getStoredLinks,
  extractLinksFromForm,
  renderShortcutsSettings,
  type ShortcutLink,
} from "../shortcuts/shortcuts.ui.ts";
import { clearAuthFailed } from "../account/account.ts";
import { loginWith42, syncToCloud } from "../account/account.ts";
import { sharedCSS } from "../../assets/shared-styles.ts";
import EYE_SVG from "../../assets/svg/eye.svg?raw";
import EYE_SLASH_SVG from "../../assets/svg/eye-slash.svg?raw";
import X_SVG from "../../assets/svg/x.svg?raw";
import FORTY_TWO_SVG from "../../assets/svg/42_Logo.svg?raw";
import RELOAD_SVG from "../../assets/svg/reload.svg?raw";
import RESET_SVG from "../../assets/svg/reset.svg?raw";
import SUN_SVG from "../../assets/svg/sun.svg?raw";
import MOON_SVG from "../../assets/svg/moon.svg?raw";
import CLOUD_SVG from "../../assets/svg/cloud.svg?raw";
import ICON_SVG from "../../assets/svg/icon.svg?raw";
import GRIP_VERTICAL_SVG from "../../assets/svg/grip-vertical.svg?raw";
import LINK_SVG from "../../assets/svg/link.svg?raw";
import CHEVRON_DOWN_SVG from "../../assets/svg/chevron-down.svg?raw";
import SEARCH_SVG from "../../assets/svg/search.svg?raw";
import { renderAboutPanel } from "./hub.about.ts";
import { exportableSettings, sanitizeBackup } from "./backup.ts";
import { renderDiscordPanel } from "../discord/discord.ui.ts";
import { renderCalendarPanel } from "../calendar/calendar.ui.ts";
import {
  THEMES,
  getEffectiveTheme,
  getIsLight,
} from "../profile/theme/theme-manager.ts";
import { bindTooltips } from "../../utils/tooltip.ts";

async function saveSetting(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

import { fetchCampusList, fetchEventTypes } from "../clusters/clusters.data.ts";
import {
  CLUSTERS,
  ensureCampusData,
  clearCampusConfigCache,
  loadCampusData,
} from "../campus/campus.ts";

let dynamicCampusOptions: { label: string; value: string }[] = [];
let dynamicEventTypeOptions: { label: string; value: string }[] = [];

export async function openHubModal(active: FeatureId[]) {
  let dialog = document.getElementById("hub-dialog") as HTMLDialogElement;
  if (!dialog) {
    createModal(active);
    dialog = document.getElementById("hub-dialog") as HTMLDialogElement;
  }

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  dialog.showModal();

  dialog.addEventListener(
    "close",
    () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    },
    { once: true },
  );
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

  render(
    html`<div class="flex items-center gap-3 flex-wrap">
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
    </div>`,
    container,
  );
}

function renderSettingControl(def: HubSettingDef, enabled: boolean) {
  if (def.kind === "shortcuts" && def.key === "SHORTCUTS_LINKS") {
    const container = document.createElement("div");
    container.setAttribute("data-shortcuts-panel", "true");
    let links: ShortcutLink[] = [];

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const save = async () => {
      links = extractLinksFromForm(container);
      await chrome.storage.local.set({
        SHORTCUTS_LINKS: JSON.stringify(links),
      });
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
            await chrome.storage.local.set({
              SHORTCUTS_LINKS: JSON.stringify(links),
            });
            update();
          },
          () => debouncedSave(),
          () => update(),
          (from, to) => {
            const newLinks = [...links];
            const [moved] = newLinks.splice(from, 1);
            newLinks.splice(to, 0, moved);
            links = newLinks;
            setTimeout(() => update(), 0);
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

    let draggedIdx: number | null = null;

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
                  draggable="${enabled && !isDisabled}"
                  @dragstart="${(e: DragEvent) =>
                    enabled && !isDisabled && handleDragStart(e, idx)}"
                  @dragover="${(e: DragEvent) =>
                    enabled && handleDragOver(e, idx)}"
                  @dragend="${() => enabled && handleDragEnd()}"
                  @drop="${(e: DragEvent) =>
                    enabled && handleDrop(e, currentOrder, idx)}"
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
    };

    const handleDragStart = (e: DragEvent, idx: number) => {
      draggedIdx = idx;
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      (e.currentTarget as HTMLElement).style.opacity = "0.3";
    };

    const handleDragOver = (e: DragEvent, idx: number) => {
      e.preventDefault();
    };

    const handleDragEnd = () => {
      draggedIdx = null;
      container
        .querySelectorAll<HTMLElement>(".btn")
        .forEach((p) => (p.style.opacity = ""));
    };

    const handleDrop = (
      e: DragEvent,
      currentOrder: string[],
      targetIdx: number,
    ) => {
      e.preventDefault();
      if (draggedIdx === null || draggedIdx === targetIdx) return;

      const newOrder = [...currentOrder];
      const [removed] = newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, removed);

      draggedIdx = null;
      renderCardOrder(newOrder);
      saveSetting(def.key!, newOrder);
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
          return html`<div class="grid grid-cols-2 gap-4 w-full col-span-full">
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
                : def.key === "CLUSTERS_DEFAULT_ID" && CLUSTERS.length > 0
                  ? CLUSTERS.map((c) => ({
                      label: c.name.toUpperCase(),
                      value: c.id,
                    }))
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

        case "theme-preset":
          return html`<div class="flex flex-wrap gap-1 w-full">
            ${(def.options ?? []).map((o) => {
              if ((o as { divider?: boolean }).divider) {
                return html`<div class="w-full h-px bg-base-300 my-1"></div>`;
              }
              if (
                (o as { label?: string }).label &&
                !(o as { value?: string }).value
              ) {
                return html`<div
                  class="w-full text-xs font-bold uppercase opacity-50 pt-1"
                >
                  ${o.label}
                </div>`;
              }
              const hsl = (o as { color?: string }).color ?? "199 89% 48%";
              const selected = String(o.value) === String(value);
              const parts = hsl.split(" ");
              const lightness = parseInt(parts[2] ?? "50");
              const textColor =
                lightness > 50 ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)";
              return html`<input
                type="radio"
                name="${def.key}"
                class="btn btn-sm flex-none"
                aria-label="${o.label}"
                value="${o.value}"
                data-hsl="${hsl}"
                style="background-color: hsl(${hsl}); color: ${textColor}; border: 2px solid ${selected
                  ? "#fff"
                  : "transparent"}; outline: ${selected
                  ? "2px solid hsl(" + hsl + ")"
                  : "none"}; outline-offset: 2px;"
                ?checked="${selected}"
                @change="${(e: Event) => {
                  const input = e.target as HTMLInputElement;
                  if (!input.checked) return;
                  saveSetting(def.key!, input.value);
                  const group = input.closest(".flex")!;
                  group
                    .querySelectorAll(`input[name="${def.key}"]`)
                    .forEach((r) => {
                      const el = r as HTMLInputElement;
                      const h = el.dataset.hsl ?? "199 89% 48%";
                      el.style.border = el.checked
                        ? "2px solid #fff"
                        : "2px solid transparent";
                      el.style.outline = el.checked
                        ? `2px solid hsl(${h})`
                        : "none";
                      el.style.outlineOffset = el.checked ? "2px" : "";
                    });
                  const root = input.getRootNode() as ShadowRoot;
                  const container = root.querySelector(
                    "[data-theme]",
                  ) as HTMLElement;
                  if (container)
                    container.setAttribute("data-theme", input.value);
                  const toggle = root.querySelector(
                    "#hub-theme-toggle",
                  ) as HTMLInputElement;
                  if (toggle) {
                    const isLight =
                      input.value === "light" || !!THEMES[input.value]?.light;
                    if (toggle.checked === isLight) {
                      toggle.checked = !isLight;
                      chrome.storage.local.set({
                        BETTER_INTRA_THEME: isLight ? "light" : "dark",
                      });
                    }
                  }
                }}"
              />`;
            })}
          </div>`;

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

          return html`<button
            type="button"
            class="btn btn-sm btn-error font-bold"
            @click="${() => {
              if (
                confirm(
                  "This will clear ALL Better Intra settings and reload. Continue?",
                )
              ) {
                void (async () => {
                  await chrome.storage.local.clear();
                  location.reload();
                })();
              }
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

async function getInitialTheme() {
  return getEffectiveTheme();
}

const GRID_COLS_CLASSES = ["", "", "md:grid-cols-2", "md:grid-cols-3"] as const;

function isAlwaysEnabledFeature(f: (typeof FEATURE_DEFS)[number]): boolean {
  return (
    f.id === "about" ||
    f.id === "appearance" ||
    f.id === "discord" ||
    f.id === "calendar" ||
    f.id === "advanced" ||
    f.id === "extras"
  );
}

function renderSettingList(
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

function renderTabsContent(
  active: FeatureId[],
  disabledDeps: Set<string>,
  hiddenDeps: Set<string>,
) {
  const visibleDefs = FEATURE_DEFS.filter(
    (f) => !("hideFromTopLevel" in f && f.hideFromTopLevel),
  );

  return visibleDefs.map((f, idx) => {
    const isAlwaysEnabled = isAlwaysEnabledFeature(f);
    const enabled = active.includes(f.id) || isAlwaysEnabled;
    const cloudDisabled =
      "requiresCloud" in f &&
      (f as { requiresCloud?: boolean }).requiresCloud &&
      disabledDeps.has("__CLOUD__");
    const settings = renderSettingList(
      HUB_SETTING_DEFS[f.id] || [],
      isAlwaysEnabled,
      enabled,
      disabledDeps,
      hiddenDeps,
    );
    const gridColsClass =
      "cols" in f && f.cols != null
        ? (GRID_COLS_CLASSES[f.cols] ?? "md:grid-cols-3")
        : "md:grid-cols-3";

    return html`<label class="tab flex items-center gap-2">
        <input
          type="radio"
          name="hub_tabs"
          ?checked="${idx === 0}"
          data-hub-tab="${f.id}"
        />
        <span class="size-4 flex items-center justify-center">
          ${unsafeHTML(f.icon)}
        </span>
        ${f.name}
      </label>
      <div
        role="tabpanel"
        class="tab-content bg-base-100 border-base-300 p-0 overflow-y-auto"
      >
        <div
          class="flex flex-col ${enabled || isAlwaysEnabled
            ? cloudDisabled
              ? "opacity-40 grayscale"
              : ""
            : "opacity-40 grayscale"}"
          data-feature-panel="${f.id}"
        >
          ${!isAlwaysEnabled
            ? html`
                <div
                  class="sticky top-0 z-20 flex items-center justify-between bg-base-200 px-6 py-4 border-b border-base-300 shadow-sm"
                >
                  <div class="flex flex-col">
                    <h2 class="text-lg font-bold leading-tight">${f.name}</h2>
                    <p class="text-xs opacity-70">${f.desc}</p>
                  </div>
                  <div class="flex items-center gap-3">
                    <button
                      class="btn btn-sm btn-outline btn-error flex items-center gap-2"
                      data-reset-feature="${f.id}"
                    >
                      <span class="size-3.5 flex items-center justify-center"
                        >${unsafeHTML(RESET_SVG)}</span
                      >
                      Reset
                    </button>
                    <input
                      type="checkbox"
                      class="toggle toggle-xl toggle-primary hub-feature-toggle"
                      data-id="${f.id}"
                      ?checked="${enabled && !cloudDisabled}"
                      ?disabled="${cloudDisabled}"
                    />
                  </div>
                </div>
              `
            : ""}
          ${cloudDisabled
            ? html`<div
                class="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center"
              >
                <span
                  class="size-14 opacity-40 flex items-center justify-center [&_path]:fill-current"
                  >${unsafeHTML(FORTY_TWO_SVG)}</span
                >
                <p class="opacity-50 max-w-72 text-sm">
                  Connect your 42 account to unlock this feature.
                </p>
                <button
                  type="button"
                  class="btn bg-[#00babc] text-white border-none hover:bg-[#1fd2d4] h-12 text-base flex items-center justify-center gap-3 transition-colors duration-200"
                  @click="${async () => {
                    loginWith42(async () => {
                      await clearAuthFailed();
                      window.location.reload();
                    });
                  }}"
                >
                  <span class="font-bold tracking-wide">Connect with</span>
                  <span
                    class="size-8 flex items-center justify-center [&_path]:fill-current"
                  >
                    ${unsafeHTML(FORTY_TWO_SVG)}
                  </span>
                </button>
              </div>`
            : "subTabs" in f && f.subTabs
              ? renderSubTabs(
                  f,
                  enabled,
                  !!cloudDisabled,
                  disabledDeps,
                  hiddenDeps,
                  gridColsClass,
                )
              : html`<div
                  class="${f.id === "about"
                    ? "p-6 w-full"
                    : `grid grid-cols-1 ${gridColsClass} gap-4 p-6`}"
                >
                  ${settings}
                </div>`}
        </div>
      </div>`;
  });
}

function renderSubTabs(
  f: (typeof FEATURE_DEFS)[number] & {
    subTabs?: readonly { id: string; name: string; icon?: string }[];
  },
  enabled: boolean,
  cloudDisabled: boolean,
  disabledDeps: Set<string>,
  hiddenDeps: Set<string>,
  gridColsClass: string,
) {
  const subTabs = f.subTabs ?? [];
  const content = (subTabId: string) => {
    const parentDefs = (HUB_SETTING_DEFS[f.id] || []).filter(
      (d) => d.subTab === subTabId,
    );
    if (parentDefs.length > 0) {
      return html`<div class="grid grid-cols-1 ${gridColsClass} gap-4 p-6">
        ${renderSettingList(
          parentDefs,
          true,
          enabled,
          disabledDeps,
          hiddenDeps,
        )}
      </div>`;
    }
    const childDefs = HUB_SETTING_DEFS[subTabId as FeatureId] || [];
    const childFeature = FEATURE_DEFS.find((fd) => fd.id === subTabId);
    const childName = childFeature?.name ?? subTabId;
    const childDesc = childFeature?.desc ?? "";
    const childEnabled = enabled && !cloudDisabled;
    return html`<div class="flex flex-col h-full">
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-200 shadow-sm"
      >
        <div class="flex flex-col">
          <h2 class="text-lg font-bold leading-tight">${childName}</h2>
          <p class="text-xs opacity-70">${childDesc}</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            class="btn btn-sm btn-outline btn-error flex items-center gap-2"
            data-reset-feature="${subTabId}"
          >
            <span class="size-3.5 flex items-center justify-center"
              >${unsafeHTML(RESET_SVG)}</span
            >
            Reset
          </button>
          <input
            type="checkbox"
            class="toggle toggle-xl toggle-primary hub-feature-toggle"
            data-id="${subTabId}"
            ?checked="${childEnabled}"
            ?disabled="${cloudDisabled}"
          />
        </div>
      </div>
      <div class="grid grid-cols-1 ${gridColsClass} gap-4 p-6">
        ${renderSettingList(
          childDefs,
          false,
          childEnabled,
          disabledDeps,
          hiddenDeps,
        )}
      </div>
    </div>`;
  };

  return html`<div class="flex flex-col h-full" data-sub-tabs-group="${f.id}">
    <div
      role="tablist"
      class="sub-tabs tabs tabs-lg tabs-border flex-none flex items-center gap-1 border-b border-base-300 bg-base-200 px-6 overflow-x-auto"
    >
      ${subTabs.map(
        (s, i) =>
          html`<label class="tab flex items-center gap-2 whitespace-nowrap">
            <input
              type="radio"
              name="hub_subtabs_${f.id}"
              ?checked="${i === 0}"
              data-sub-tab="${s.id}"
            />
            ${s.icon
              ? html`<span class="size-4 flex items-center justify-center"
                  >${unsafeHTML(s.icon)}</span
                >`
              : ""}
            ${s.name}
          </label>`,
      )}
    </div>
    <div class="flex-1 min-h-0 overflow-hidden">
      ${subTabs.map(
        (s, i) =>
          html`<div
            class="sub-panel h-full overflow-y-auto ${i === 0 ? "" : "hidden"}"
            data-sub-panel="${s.id}"
          >
            ${content(s.id)}
          </div>`,
      )}
    </div>
  </div>`;
}

function loadAboutPanel(shadow: ShadowRoot): void {
  const placeholder = shadow.querySelector<HTMLElement>(
    "[data-about-placeholder]",
  );
  if (!placeholder) return;
  const target = placeholder.parentElement;
  if (!target) return;
  const slot = document.createElement("div");
  slot.className = "w-full h-full";
  render(renderAboutPanel(), slot);
  placeholder.remove();
  target.appendChild(slot);
}

function setupLazyAbout(shadow: ShadowRoot): void {
  const radio = shadow.querySelector<HTMLInputElement>(
    '[data-hub-tab="about"]',
  );
  if (!radio) return;

  const activate = () => loadAboutPanel(shadow);
  if (radio.checked) {
    activate();
    return;
  }

  const listener = () => {
    if (!radio.checked) return;
    activate();
    radio.removeEventListener("change", listener);
  };
  radio.addEventListener("change", listener);
}

const normalizeTerm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function setupSearch(shadow: ShadowRoot): void {
  const input = shadow.querySelector<HTMLInputElement>("#hub-search");
  if (!input) return;

  const panels = shadow.querySelectorAll<HTMLElement>("[data-feature-panel]");

  let activeBeforeSearch: HTMLInputElement | null = null;

  const apply = () => {
    const term = normalizeTerm(input.value.trim());
    const searching = term.length > 0;
    let firstMatch: HTMLInputElement | null = null;

    for (const panel of panels) {
      panel
        .querySelectorAll<HTMLElement>(".divider")
        .forEach((d) => d.classList.toggle("hidden", searching));

      const cards = panel.querySelectorAll<HTMLElement>("[data-search]");
      let visible = 0;
      cards.forEach((card) => {
        const match = !searching || (card.dataset.search ?? "").includes(term);
        card.classList.toggle("hidden", !match);
        if (match) visible++;
      });

      const tabId = panel.dataset.featurePanel;
      const radio = shadow.querySelector<HTMLInputElement>(
        `[data-hub-tab="${tabId}"]`,
      );
      const label = radio?.closest<HTMLElement>(".tab");
      if (label) {
        label.classList.toggle("hidden", searching && visible === 0);
      }

      const subGroups = panel.querySelectorAll<HTMLElement>(
        "[data-sub-tabs-group]",
      );
      for (const group of subGroups) {
        const subRadios = group.querySelectorAll<HTMLInputElement>(
          'input[name^="hub_subtabs_"]',
        );
        let firstSubMatch: HTMLInputElement | null = null;
        for (const sr of subRadios) {
          const subPanel = group.querySelector<HTMLElement>(
            `[data-sub-panel="${sr.dataset.subTab}"]`,
          );
          if (!subPanel) continue;
          const subCards =
            subPanel.querySelectorAll<HTMLElement>("[data-search]");
          const subVisible = [...subCards].filter(
            (c) => !c.classList.contains("hidden"),
          ).length;
          sr.closest(".tab")?.classList.toggle(
            "hidden",
            searching && subVisible === 0,
          );
          if (searching && subVisible > 0 && !firstSubMatch) {
            firstSubMatch = sr;
          }
        }
        if (searching && firstSubMatch && visible > 0) {
          const checked = group.querySelector<HTMLInputElement>(
            'input[name^="hub_subtabs_"]:checked',
          );
          if (checked && checked !== firstSubMatch) {
            checked.checked = false;
            firstSubMatch.checked = true;
            firstSubMatch.dispatchEvent(new Event("change"));
          }
        }
      }

      if (searching && visible > 0 && !firstMatch && radio) {
        firstMatch = radio;
      }
    }

    if (searching && firstMatch) {
      const current = shadow.querySelector<HTMLInputElement>(
        'input[name="hub_tabs"]:checked',
      );
      if (current && current !== firstMatch) {
        activeBeforeSearch = current;
        firstMatch.checked = true;
      }
    } else if (!searching && activeBeforeSearch) {
      activeBeforeSearch.checked = true;
      activeBeforeSearch = null;
    }
  };

  let timer: number | null = null;
  input.addEventListener("input", () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(apply, 120);
  });

  shadow
    .querySelectorAll<HTMLInputElement>('input[name="hub_tabs"]')
    .forEach((radio) => radio.addEventListener("change", apply));
}

function setupSubTabs(shadow: ShadowRoot): void {
  shadow
    .querySelectorAll<HTMLInputElement>('input[name^="hub_subtabs_"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        const group = radio.dataset.subTab ?? "";
        const container = radio.closest<HTMLElement>("[data-sub-tabs-group]");
        if (!container) return;
        container
          .querySelectorAll<HTMLInputElement>('input[name^="hub_subtabs_"]')
          .forEach((r) => {
            r.closest(".tab")?.classList.toggle(
              "tab-active",
              r.dataset.subTab === group,
            );
          });
        container
          .querySelectorAll<HTMLElement>("[data-sub-panel]")
          .forEach((p) => {
            p.classList.toggle("hidden", p.dataset.subPanel !== group);
          });
      });
    });
}

function renderDialogShell(): ReturnType<typeof html> {
  return html`
    <div
      class="w-full h-full p-0 overflow-hidden bg-base-100 rounded-3xl shadow-2xl flex flex-col relative"
    >
      <div id="hub-shadow-wrapper" class="w-full h-full"></div>
    </div>
  `;
}

async function createModal(active: FeatureId[]): Promise<void> {
  let dialog = document.getElementById("hub-dialog") as HTMLDialogElement;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "hub-dialog";
    dialog.className =
      "modal-box hub-modal-box p-0 overflow-hidden bg-base-100 rounded-3xl shadow-2xl border-none outline-none";

    const tempContainer = document.createElement("div");
    render(renderDialogShell(), tempContainer);
    dialog.appendChild(tempContainer.firstElementChild!);

    document.body.appendChild(dialog);
    dialog.addEventListener("click", (e) => {
      const dialogDimensions = dialog.getBoundingClientRect();
      if (
        e.clientX < dialogDimensions.left ||
        e.clientX > dialogDimensions.right ||
        e.clientY < dialogDimensions.top ||
        e.clientY > dialogDimensions.bottom
      ) {
        dialog.close();
      }
    });

    const applyDesktopLock = () => {
      dialog.style.width = "100%";
      dialog.style.height = "100%";

      if (window.matchMedia("(min-width: 1024px)").matches) {
        dialog.style.maxWidth = "1200px";
        dialog.style.maxHeight = "800px";
      } else {
        dialog.style.maxWidth = "calc(100dvw - 1rem)";
        dialog.style.maxHeight = "calc(100dvh - 1rem)";
      }
    };

    applyDesktopLock();
    window.addEventListener("resize", applyDesktopLock);
    dialog.addEventListener(
      "close",
      () => window.removeEventListener("resize", applyDesktopLock),
      { once: true },
    );
  }

  const wrapper = dialog.querySelector("#hub-shadow-wrapper")!;
  const shadow = wrapper.shadowRoot || wrapper.attachShadow({ mode: "open" });

  const currentTheme = await getInitialTheme();

  const depParentKeys = new Set<string>();
  for (const defs of Object.values(HUB_SETTING_DEFS)) {
    for (const def of defs) {
      if (def.dependsOn) depParentKeys.add(def.dependsOn);
    }
  }
  const depValues = await chrome.storage.local.get([...depParentKeys]);
  const disabledDeps = new Set<string>();
  const hiddenDeps = new Set<string>();
  for (const defs of Object.values(HUB_SETTING_DEFS)) {
    for (const def of defs) {
      if (def.dependsOn && def.key) {
        const parentVal =
          depValues[def.dependsOn] ?? CONFIG_DEFAULT[def.dependsOn];
        if (!parentVal) {
          disabledDeps.add(def.key);
          hiddenDeps.add(def.key);
        }
      }
    }
  }
  const cloudToken = await getConfig("CLOUD_TOKEN");
  if (!cloudToken) {
    disabledDeps.add("__CLOUD__");
    for (const defs of Object.values(HUB_SETTING_DEFS)) {
      for (const def of defs) {
        if (def.requiresCloud && def.key) disabledDeps.add(def.key);
      }
    }
  }

  try {
    const manifest = await fetchCampusList();
    dynamicCampusOptions = manifest.campuses.map((c) => ({
      label: c.name,
      value: c.id,
    }));
  } catch {
    dynamicCampusOptions = [];
  }
  await ensureCampusData();
  try {
    try {
      dynamicEventTypeOptions = await fetchEventTypes();
    } catch {
      dynamicEventTypeOptions = [];
    }
  } catch {
    dynamicEventTypeOptions = [];
  }
  const tabsContent = renderTabsContent(active, disabledDeps, hiddenDeps);
  const lastSync = (await chrome.storage.local.get("LAST_CLOUD_SYNC"))
    .LAST_CLOUD_SYNC;
  const isConnected = !!(await getConfig("CLOUD_TOKEN"));
  const authFailed = !!(await getConfig("CLOUD_AUTH_FAILED"));
  const dateString =
    typeof lastSync === "number" || typeof lastSync === "string"
      ? new Date(lastSync).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--";

  const modalTemplate = html`<style>
      :host {
        display: block;
        height: 100%;
        width: 100%;
      }
      :host {
        font-family: ${INTRA_FONT};
      }
      input,
      button,
      select,
      textarea,
      .tab,
      h2,
      h3 {
        font-family: ${INTRA_FONT} !important;
      }
      ${unsafeHTML(sharedCSS)} .tab-content {
        height: 100%;
        overflow-y: auto;
      }
    </style>
    <div
      class="flex flex-col h-full text-base-content bg-base-100"
      data-theme="${currentTheme}"
    >
      <div
        class="flex-none flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100 z-10"
      >
        <div class="flex items-center gap-3">
          <div
            class="size-8 flex items-center justify-center"
            style="color: #00babc;"
          >
            ${unsafeHTML(ICON_SVG)}
          </div>
          <div class="flex items-baseline gap-2">
            <h3 class="font-bold text-xl tracking-tight">${HUB_INFO.name}</h3>
            <p
              class="text-[14px] opacity-60 font-bold tracking-widest font-mono"
            >
              v${HUB_INFO.version}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <label
            class="input input-sm input-accent w-56 flex items-center gap-2"
          >
            <span class="h-[1em] opacity-50 flex items-center justify-center"
              >${unsafeHTML(SEARCH_SVG)}</span
            >
            <input
              id="hub-search"
              type="search"
              placeholder="Search settings..."
              class="grow"
            />
          </label>
          <button
            class="btn btn-circle btn-ghost btn-sm"
            @click="${() => dialog.close()}"
          >
            ${unsafeHTML(X_SVG.replace("<svg", '<svg width="22" height="22"'))}
          </button>
        </div>
      </div>

      ${authFailed
        ? html`<div
            class="flex-none alert alert-warning mx-4 mt-3 rounded-xl flex items-center justify-between"
          >
            <span class="text-sm font-semibold"
              >42 token expired - friends, marks, and cloud features
              stopped</span
            >
            <button
              class="btn btn-warning btn-sm font-bold"
              @click="${() => {
                dialog.close();
                loginWith42(async () => {
                  await clearAuthFailed();
                  window.location.reload();
                });
              }}"
            >
              Reconnect
            </button>
          </div>`
        : ""}

      <div
        role="tablist"
        class="tabs tabs-lg tabs-border flex-1 overflow-hidden"
      >
        ${tabsContent}
      </div>

      <div
        class="flex-none p-4 border-t border-base-200 bg-base-200/50 flex justify-between items-center"
      >
        <div class="flex items-center gap-3">
          <label
            class="swap btn btn-accent border border-base-content/20 text-center items-center"
          >
            <input
              type="checkbox"
              id="hub-theme-toggle"
              ?checked="${currentTheme === "dark"}"
            />
            <span class="swap-on flex items-center justify-center gap-1">
              ${unsafeHTML(SUN_SVG)}
              <span class="text-sm font-bold">Light</span>
            </span>
            <span class="swap-off flex items-center justify-center gap-1">
              ${unsafeHTML(MOON_SVG)}
              <span class="text-sm font-bold">Dark</span>
            </span>
          </label>
          <div class="flex items-center gap-2 text-xs">
            ${isConnected
              ? html`<span class="btn btn-success border border-base-content/20"
                  ><span class="size-4 inline-flex items-center"
                    >${unsafeHTML(CLOUD_SVG)}</span
                  >
                  Connected</span
                >`
              : html`<span class="btn btn-error border border-base-content/20"
                  >Offline</span
                >`}
            <span class="btn btn-info border border-base-content/20 font-mono"
              >Synced at ${dateString}</span
            >
            ${isConnected
              ? html`<div class="join">
                  <input
                    type="radio"
                    name="hub-auto-push"
                    class="join-item btn btn-outline border-base-content/20"
                    aria-label="Manual push"
                    value="manual"
                    @change="${() =>
                      chrome.storage.local.set({
                        CLOUD_SYNC_ENABLED: false,
                      })}"
                  />
                  <input
                    type="radio"
                    name="hub-auto-push"
                    class="join-item btn btn-outline border-base-content/20"
                    aria-label="Auto push"
                    value="auto"
                    @change="${() =>
                      chrome.storage.local.set({
                        CLOUD_SYNC_ENABLED: true,
                      })}"
                  />
                </div>`
              : ""}
          </div>
        </div>
        <button
          id="hub-reload"
          class="btn btn-success px-8 font-bold flex items-center gap-2"
        >
          <span class="size-5 flex items-center justify-center">
            ${unsafeHTML(RELOAD_SVG)}
          </span>
          Reload
        </button>
      </div>
    </div>`;

  render(modalTemplate, shadow);

  bindTooltips(shadow, getIsLight);

  setupLazyAbout(shadow);

  setupSearch(shadow);

  setupSubTabs(shadow);

  const themeToggle = shadow.querySelector(
    "#hub-theme-toggle",
  ) as HTMLInputElement;
  const hubContainer = shadow.querySelector("[data-theme]");
  const ghIcon = shadow.querySelector('img[alt="GitHub"]') as HTMLElement;

  const presetKey = (await getConfig("PROFILE_THEME_PRESET")) || "dark";
  const validPreset = HUB_SETTING_DEFS.appearance
    .find((s) => s.key === "PROFILE_THEME_PRESET")
    ?.options?.some((o) => o.value === presetKey)
    ? presetKey
    : "dark";
  hubContainer?.setAttribute("data-theme", validPreset);
  const isLightPreset =
    validPreset === "light" ||
    (validPreset !== "dark" && !!THEMES[validPreset]?.light);
  if (themeToggle) themeToggle.checked = !isLightPreset;

  themeToggle?.addEventListener("change", async () => {
    const isDark = themeToggle.checked;
    const preset = (await getConfig("PROFILE_THEME_PRESET")) || "dark";
    const isLightPreset =
      preset === "light" || (preset !== "dark" && !!THEMES[preset]?.light);
    const theme = isDark
      ? isLightPreset
        ? "dark"
        : preset
      : isLightPreset
        ? preset
        : "light";

    hubContainer?.setAttribute("data-theme", theme);
    await chrome.storage.local.set({
      BETTER_INTRA_THEME: isDark ? "dark" : "light",
    });

    if (ghIcon) {
      ghIcon.style.filter = isDark ? "none" : "invert(1) brightness(0)";
    }
  });

  const reloadBtn = shadow.querySelector("#hub-reload");
  const autoPushRadios = shadow.querySelectorAll(
    'input[name="hub-auto-push"]',
  ) as NodeListOf<HTMLInputElement>;
  const isAutoPush = (await getConfig("CLOUD_SYNC_ENABLED")) === true;
  autoPushRadios.forEach(
    (r) => (r.checked = r.value === (isAutoPush ? "auto" : "manual")),
  );

  reloadBtn?.addEventListener("click", async () => {
    const checked = shadow.querySelector(
      'input[name="hub-auto-push"]:checked',
    ) as HTMLInputElement | null;
    if (checked?.value === "auto") {
      try {
        await syncToCloud();
      } catch {}
    }
    location.reload();
  });

  shadow.querySelectorAll("input.hub-feature-toggle").forEach((toggle: any) => {
    toggle.addEventListener("change", async () => {
      const id = toggle.dataset.id;
      const isEnabled = toggle.checked;

      const panel = shadow.querySelector(`[data-feature-panel="${id}"]`);
      panel?.classList.toggle("opacity-40", !isEnabled);
      panel?.classList.toggle("grayscale", !isEnabled);
      panel
        ?.querySelectorAll("[data-setting-key]")
        .forEach((c: any) => (c.disabled = !isEnabled));
      panel?.querySelectorAll(".card").forEach((card: any) => {
        if (isEnabled) {
          card.classList.remove("opacity-40", "grayscale");
        } else {
          card.classList.add("opacity-40", "grayscale");
        }
      });

      const currentScripts = await getConfig("ACTIVE_SCRIPTS");
      const updated = isEnabled
        ? [...currentScripts, id]
        : currentScripts.filter((f: string) => f !== id);
      await chrome.storage.local.set({
        ACTIVE_SCRIPTS: JSON.stringify(updated),
      });
    });
  });

  shadow.querySelectorAll("[data-reset-feature]").forEach((btn: any) => {
    btn.addEventListener("click", async () => {
      await resetFeatureSettings(shadow, btn.dataset.resetFeature);
    });
  });

  shadow.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    const parentKey = target.dataset.settingKey;
    if (!parentKey) return;

    const depKeys: string[] = [];
    for (const defs of Object.values(HUB_SETTING_DEFS)) {
      for (const def of defs) {
        if (def.dependsOn === parentKey && def.key) depKeys.push(def.key);
      }
    }
    if (depKeys.length === 0) return;

    const on =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : true;

    for (const key of depKeys) {
      const el = shadow.querySelector<HTMLElement>(
        `[data-setting-key="${key}"]`,
      );
      if (!el) continue;
      const card = el.closest<HTMLElement>(".card");
      if (card) {
        card.classList.toggle("hidden", !on);
        if (on) {
          card.classList.remove("opacity-40", "grayscale");
        } else {
          card.classList.add("opacity-40", "grayscale");
        }
      }
      (el as any).disabled = !on;
    }
  });
}

async function resetFeatureSettings(
  root: ShadowRoot | HTMLElement,
  featureId: FeatureId,
): Promise<void> {
  const keysToRemove = (HUB_SETTING_DEFS[featureId] ?? [])
    .map((def) => def.key)
    .filter((k): k is ConfigKey => k !== undefined);
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
  (HUB_SETTING_DEFS[featureId] ?? []).forEach((def) => {
    const controls = root.querySelectorAll<HTMLInputElement>(
      `[data-setting-key="${def.key}"]`,
    );
    const val = def.defaultValue ?? (def.kind === "toggle" ? false : "");

    controls.forEach((control) => {
      if (control.type === "radio") {
        control.checked = control.value === String(val);
      } else if (control.type === "checkbox") {
        control.checked = Boolean(val);
      } else {
        control.value = String(val);
      }
    });
  });
}
