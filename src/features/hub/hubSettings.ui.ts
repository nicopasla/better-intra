import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { until } from "lit-html/directives/until.js";
import { ref } from "lit-html/directives/ref.js";
import { getConfig, CONFIG_DEFAULT, type ConfigKey } from "../../config.ts";
import {
  FEATURE_DEFS,
  HUB_INFO,
  FeatureId,
  STORAGE_KEY,
  INTRA_FONT,
  HUB_SETTING_DEFS,
  type HubSettingDef,
} from "./hubSettings.data.ts";
import {
  getStoredLinks,
  extractLinksFromForm,
  renderShortcutsSettings,
  type ShortcutLink,
} from "../shortcuts/shortcuts.ui.ts";
import { syncToCloud, clearAuthFailed } from "../account/account.ts";
import { loginWith42 } from "../account/account.ts";
import { sharedCSS } from "../../assets/shared-styles.ts";
import EYE_SVG from "../../assets/svg/eye.svg?raw";
import EYE_SLASH_SVG from "../../assets/svg/eye-slash.svg?raw";
import FORTY_TWO_SVG from "../../assets/svg/42_Logo.svg?raw";
import { renderAboutPanel } from "./hub.about.ts";
import { renderDiscordPanel } from "../discord/discord.ui.ts";

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

function renderSettingControl(def: HubSettingDef, enabled: boolean) {
  if (def.kind === "shortcuts" && def.key === "SHORTCUTS_LINKS") {
    const container = document.createElement("div");
    container.setAttribute("data-shortcuts-panel", "true");
    let links: ShortcutLink[] = [];

    const save = async () => {
      links = extractLinksFromForm(container);
      await chrome.storage.local.set({
        SHORTCUTS_LINKS: JSON.stringify(links),
      });
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
          () => save(),
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
    return renderAboutPanel();
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="size-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"
              />
            </svg>
            Reset
          </button>

          <div
            class="flex flex-wrap gap-3 items-center p-4 bg-base-300/30 rounded-xl border border-base-300 w-full"
          >
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
                  ${displayName.toUpperCase().trim() !== "EVALUATIONS" &&
                  displayName.toUpperCase().trim() !== "PENDING EVALUATIONS" &&
                  displayName.toUpperCase().trim() !== "PROJECTS"
                    ? html`
                        <button
                          type="button"
                          class="p-1 -ml-1 rounded hover:bg-black/10 transition-colors pointer-events-auto cursor-pointer flex items-center justify-center"
                          @click="${toggleVisibility}"
                          title="${isDisabled ? "Show card" : "Hide card"}"
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
    };

    const resetToDefault = () => {
      renderCardOrder((def.defaultValue as string[]) || []);
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

  return until(
    (async () => {
      const value = def.key
        ? ((await getConfig(def.key)) ?? def.defaultValue ?? "")
        : (def.defaultValue ?? "");

      switch (def.kind) {
        case "toggle":
          return html`<input
            type="checkbox"
            class="toggle toggle-lg toggle-accent"
            data-setting-key="${def.key}"
            ?checked="${Boolean(value)}"
            ?disabled="${!enabled}"
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
                />
                <span class="opacity-70">€</span>
              </label>`
            : html`<input
                type="number"
                class="input input-accent w-24"
                .value="${String(value)}"
                data-setting-key="${def.key}"
                ?disabled="${!enabled}"
              />`;
        }

        case "select":
          return html`<select
            class="select select-accent w-60"
            data-setting-key="${def.key}"
            ?disabled="${!enabled}"
            @mousedown="${(e: Event) => e.stopPropagation()}"
            @click="${(e: Event) => e.stopPropagation()}"
          >
            ${(def.options ?? []).map(
              (o) =>
                html`<option
                  value="${o.value}"
                  ?selected="${String(o.value) === String(value)}"
                >
                  ${o.label}
                </option>`,
            )}
          </select>`;

        case "color":
          return html`<input
            type="color"
            class="input input-accent p-1 w-20 h-10"
            .value="${String(value)}"
            data-setting-key="${def.key}"
            ?disabled="${!enabled}"
          />`;

        case "radio-group":
          return html`<div class="flex flex-wrap gap-2 sm:gap-4">
            ${(def.options ?? []).map(
              (o) =>
                html`<label class="label cursor-pointer gap-2 py-1">
                  <span class="label-text text-xs sm:text-sm">${o.label}</span>
                  <input
                    type="radio"
                    name="${def.key}"
                    value="${o.value}"
                    class="radio radio-accent radio-xs sm:radio-sm"
                    ?checked="${o.value === value}"
                    data-setting-key="${def.key}"
                    ?disabled="${!enabled}"
                  />
                </label>`,
            )}
          </div>`;

        case "theme-preset":
          return html`<div class="flex flex-wrap gap-2">
              <input
                type="hidden"
                data-setting-key="${def.key}"
                .value="${String(value)}"
              />
              ${(def.options ?? []).map(
                (o) => {
                  const hsl = (o as { color?: string }).color ?? "199 89% 48%";
                  const selected = String(o.value) === String(value);
                  const parts = hsl.split(" ");
                  const lightness = parseInt(parts[2] ?? "50");
                  const textColor = lightness > 50 ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)";
                  return html`<button
                    type="button"
                    class="btn btn-xs font-bold"
                    data-preset-value="${o.value}"
                    data-preset-hsl="${hsl}"
                    style="background-color: hsl(${hsl}); color: ${textColor}; border: ${selected ? '2px solid #fff' : '2px solid transparent'}; outline: ${selected ? '2px solid hsl(' + hsl + ')' : 'none'}; outline-offset: 1px;"
                    ?disabled="${!enabled}"
                    @mousedown="${(e: Event) => e.stopPropagation()}"
                    @click="${(e: Event) => {
                      e.stopPropagation();
                      const btn = e.target as HTMLElement;
                      const wrapper = btn.parentElement!;
                      const hidden = wrapper.querySelector('input[type="hidden"]') as HTMLInputElement;
                      if (hidden) hidden.value = o.value;
                      const allBtns = wrapper.querySelectorAll('button[data-preset-value]');
                      allBtns.forEach((b: Element) => {
                        const bEl = b as HTMLElement;
                        const bHsl = bEl.dataset.presetHsl ?? hsl;
                        const bParts = bHsl.split(" ");
                        const bLight = parseInt(bParts[2] ?? "50");
                        const bText = bLight > 50 ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)";
                        bEl.style.color = bText;
                        bEl.style.border = '2px solid transparent';
                        bEl.style.outline = 'none';
                      });
                      btn.style.color = textColor;
                      btn.style.border = '2px solid #fff';
                      btn.style.outline = '2px solid hsl(' + hsl + ')';
                      const root = btn.getRootNode() as ShadowRoot;
                      const container = root.querySelector('[data-theme]') as HTMLElement;
                      if (container) container.setAttribute('data-theme', o.value);
                    }}"
                  >${o.label}</button>`;
                },
              )}
            </div>`;

        case "url":
          return html`<div class="w-full">
            <label
              class="input input-accent validator flex items-center gap-2 w-full"
            >
              <svg
                class="h-[1em] opacity-50"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <g
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                >
                  <path
                    d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                  ></path>
                  <path
                    d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                  ></path>
                </g>
              </svg>
              <input
                type="url"
                required
                placeholder="https://beemovie.com/beemovie.gif"
                .value="${String(value)}"
                data-setting-key="${def.key}"
                ?disabled="${!enabled}"
                pattern="^(https?://)?.*"
                class="grow"
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
          />`;

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
          />`;
      }
    })(),
    html`<div class="loading loading-spinner loading-sm"></div>`,
  );
}

function renderSetting(def: HubSettingDef, enabled: boolean, hidden?: boolean) {
  if (def.kind === "divider") {
    return html`<div class="divider font-bold my-2 col-span-full opacity-70">
      ${def.label}
    </div>`;
  }

  if (def.kind === "discord-panel") {
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
  const saved = await getConfig("BETTER_INTRA_THEME");
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

const resetIconSvg = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 640 640"
  fill="currentColor"
>
  <path
    d="M320 128C263.2 128 212.1 152.7 176.9 192L224 192C241.7 192 256 206.3 256 224C256 241.7 241.7 256 224 256L96 256C78.3 256 64 241.7 64 224L64 96C64 78.3 78.3 64 96 64C113.7 64 128 78.3 128 96L128 150.7C174.9 97.6 243.5 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C233 576 156.1 532.6 109.9 466.3C99.8 451.8 103.3 431.9 117.8 421.7C132.3 411.5 152.2 415.1 162.4 429.6C197.2 479.4 254.8 511.9 320 511.9C426 511.9 512 425.9 512 319.9C512 213.9 426 128 320 128z"
  />
</svg>`;
const saveIconSvg = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 640 640"
  fill="currentColor"
>
  <path
    d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 237.3C544 220.3 537.3 204 525.3 192L448 114.7C436 102.7 419.7 96 402.7 96L160 96zM192 192C192 174.3 206.3 160 224 160L384 160C401.7 160 416 174.3 416 192L416 256C416 273.7 401.7 288 384 288L224 288C206.3 288 192 273.7 192 256L192 192zM320 352C355.3 352 384 380.7 384 416C384 451.3 355.3 480 320 480C284.7 480 256 451.3 256 416C256 380.7 284.7 352 320 352z"
  />
</svg>`;
const sunIconSvg = html`<svg
  class="swap-on h-5 w-5 fill-current"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
>
  <path
    d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
  />
</svg>`;
const moonIconSvg = html`<svg
  class="swap-off h-5 w-5 fill-current"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
>
  <path
    d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"
  />
</svg>`;

const GRID_COLS_CLASSES = ["", "", "md:grid-cols-2", "md:grid-cols-3"] as const;

function renderTabsContent(
  active: FeatureId[],
  disabledDeps: Set<string>,
  hiddenDeps: Set<string>,
) {
  return FEATURE_DEFS.map((f, idx) => {
    const enabled = active.includes(f.id);
    const cloudDisabled =
      "requiresCloud" in f &&
      (f as { requiresCloud?: boolean }).requiresCloud &&
      disabledDeps.has("__CLOUD__");
    const settings = (HUB_SETTING_DEFS[f.id] || []).map((def) => {
      const hidden = !!(def.key && hiddenDeps.has(def.key));
      return renderSetting(
        def,
        f.id === "about" ||
          f.id === "discord" ||
          (enabled &&
            !(def.key && disabledDeps.has(def.key)) &&
            !(def.requiresCloud && disabledDeps.has("__CLOUD__"))),
        hidden,
      );
    });
    const gridColsClass =
      "cols" in f && f.cols != null
        ? (GRID_COLS_CLASSES[f.cols] ?? "md:grid-cols-3")
        : "md:grid-cols-3";

    return html`<label class="tab flex items-center gap-2">
        <input type="radio" name="hub_tabs" ?checked="${idx === 0}" />
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
          class="flex flex-col ${enabled ||
          f.id === "about" ||
          f.id === "discord"
            ? cloudDisabled
              ? "opacity-40 grayscale"
              : ""
            : "opacity-40 grayscale"}"
          data-feature-panel="${f.id}"
        >
          ${f.id !== "about" && f.id !== "discord"
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
                        >${resetIconSvg}</span
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
                  @click="${() => {
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
      font-family: ${INTRA_FONT};
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
        <div class="flex items-baseline gap-2">
          <h3 class="font-bold text-xl tracking-tight">${HUB_INFO.name}</h3>
          <p class="text-[14px] opacity-60 font-bold tracking-widest">
            v${HUB_INFO.version}
          </p>
        </div>
        <button
          class="btn btn-circle btn-ghost"
          @click="${() => dialog.close()}"
        >
          ✕
        </button>
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
          <label class="swap swap-rotate btn btn-circle btn-ghost">
            <input
              type="checkbox"
              id="hub-theme-toggle"
              ?checked="${currentTheme === "dark"}"
            />
            ${sunIconSvg} ${moonIconSvg}
          </label>
          <div class="flex items-center gap-2 text-xs font-bold opacity-60">
            <div
              class="size-2 rounded-full ${isConnected
                ? "bg-success"
                : "bg-error"}"
            ></div>
            ${isConnected
              ? html`<span class="flex items-center gap-1">
                  ☁️ Connected
                </span>`
              : "Offline"}
            <span class="text-[10px] opacity-40 font-mono"
              >Synced at ${dateString}</span
            >
          </div>
        </div>
        <button
          id="hub-save"
          class="btn btn-success px-8 font-bold flex items-center gap-2"
        >
          <span class="size-5 flex items-center justify-center">
            ${saveIconSvg}
          </span>
          Save & Reload
        </button>
      </div>
    </div>`;

  render(modalTemplate, shadow);

  const themeToggle = shadow.querySelector(
    "#hub-theme-toggle",
  ) as HTMLInputElement;
  const hubContainer = shadow.querySelector("[data-theme]");
  const ghIcon = shadow.querySelector('img[alt="GitHub"]') as HTMLElement;

  const presetKey = (await getConfig("PROFILE_THEME_PRESET")) || "dark";
  const validPreset = HUB_SETTING_DEFS.profile
    .find((s) => s.key === "PROFILE_THEME_PRESET")
    ?.options?.some((o) => o.value === presetKey)
    ? presetKey
    : "dark";
  const storedTheme = (await getConfig("BETTER_INTRA_THEME")) || "dark";
  const effective = storedTheme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : storedTheme;
  hubContainer?.setAttribute("data-theme", effective === "light" ? "light" : validPreset);

  themeToggle?.addEventListener("change", async () => {
    const isDark = themeToggle.checked;
    const preset = (await getConfig("PROFILE_THEME_PRESET")) || "dark";
    const validPreset = HUB_SETTING_DEFS.profile
      .find((s) => s.key === "PROFILE_THEME_PRESET")
      ?.options?.some((o) => o.value === preset)
      ? preset
      : "dark";

    hubContainer?.setAttribute("data-theme", isDark ? validPreset : "light");
    await chrome.storage.local.set({ BETTER_INTRA_THEME: isDark ? "dark" : "light" });

    if (ghIcon) {
      ghIcon.style.filter =
        isDark ? "none" : "invert(1) brightness(0)";
    }
  });

  const saveBtn = shadow.querySelector("#hub-save");
  saveBtn?.addEventListener("click", async () => {
    await saveHubState(shadow);
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

async function saveHubState(root: ShadowRoot | HTMLElement) {
  const saveBtn = root.querySelector("#hub-save") as HTMLButtonElement;

  if (!saveBtn) return;

  // Store original state for error recovery
  const originalText = saveBtn.innerText;
  const originalDisabled = saveBtn.disabled;

  try {
    // Disable button and show saving state
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving local...";
    saveBtn.classList.add("opacity-70", "animate-pulse");

    // Collect and save local settings
    const selected = Array.from(
      root.querySelectorAll<HTMLInputElement>("input.hub-feature-toggle"),
    )
      .filter((sw) => sw.checked)
      .map((sw) => sw.dataset.id as FeatureId);

    const batchData: Record<string, any> = {
      [STORAGE_KEY]: JSON.stringify(selected),
    };
    const keys = new Set<string>();

    root.querySelectorAll("[data-setting-key]").forEach((el) => {
      keys.add((el as HTMLElement).dataset.settingKey!);
    });

    const keysToRemove: string[] = [];
    Array.from(keys).forEach((key) => {
      const controls = root.querySelectorAll(`[data-setting-key="${key}"]`);
      if (controls.length === 0) return;
      const first = controls[0] as HTMLInputElement;
      let val: any;

      if (first.type === "radio") {
        const checkedRadio = Array.from(controls).find(
          (r) => (r as HTMLInputElement).checked,
        ) as HTMLInputElement;
        val = checkedRadio ? checkedRadio.value : null;
      } else if (first.type === "checkbox") {
        val = first.checked;
      } else {
        val = first.value;
      }

      if (val === "" || val === null || val === undefined) {
        keysToRemove.push(key);
      } else {
        batchData[key] = val;
      }
    });

    // Handle shortcuts panel
    const shortcutsPanel = root.querySelector(
      '[data-shortcuts-panel="true"]',
    ) as HTMLElement | null;
    if (shortcutsPanel) {
      const links = extractLinksFromForm(shortcutsPanel);
      if (links.length > 0) {
        batchData["SHORTCUTS_LINKS"] = JSON.stringify(links);
      } else {
        keysToRemove.push("SHORTCUTS_LINKS");
      }
    }

    // Save to local storage
    if (Object.keys(batchData).length > 0) {
      await chrome.storage.local.set(batchData);
    }
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }

    // Check if cloud sync is enabled and attempt sync
    const isSyncEnabled = await getConfig("CLOUD_SYNC_ENABLED");
    const hasCloudToken = await getConfig("CLOUD_TOKEN");

    if (isSyncEnabled && hasCloudToken) {
      // User has enabled cloud sync and is logged in
      saveBtn.innerText = "☁️ Syncing to cloud...";

      const syncSuccess = await syncToCloud();

      if (syncSuccess) {
        // Cloud sync succeeded
        await chrome.storage.local.set({ LAST_CLOUD_SYNC: Date.now() });
        saveBtn.innerText = "✓ Cloud synced!";
        saveBtn.classList.remove("opacity-70", "animate-pulse");
        saveBtn.classList.add("btn-success");
      } else {
        // Cloud sync failed but local saved
        console.warn("Cloud sync failed, but local settings were saved");
        saveBtn.innerText = "⚠️ Local saved (cloud failed)";
        saveBtn.classList.remove("opacity-70", "animate-pulse");
        saveBtn.classList.add("btn-warning");

        // Wait before reloading
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    } else if (isSyncEnabled && !hasCloudToken) {
      // Cloud sync is enabled but user is not logged in
      saveBtn.innerText = "⚠️ Not logged in to cloud";
      saveBtn.classList.remove("opacity-70", "animate-pulse");
      saveBtn.classList.add("btn-info");
    } else {
      // Cloud sync is disabled
      saveBtn.innerText = "Settings saved";
      saveBtn.classList.remove("opacity-70", "animate-pulse");
      saveBtn.classList.add("btn-success");
    }

    // Wait for user to see the result, then reload
    await new Promise((resolve) => setTimeout(resolve, 500));
    location.reload();
  } catch (error) {
    // Error handling: allow user to retry
    console.error("Error saving hub state:", error);
    saveBtn.innerText = "✗ Save failed, retrying...";
    saveBtn.classList.remove("opacity-70", "animate-pulse");
    saveBtn.classList.add("btn-error");

    // Reset button after 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3000));
    saveBtn.innerText = originalText;
    saveBtn.disabled = originalDisabled;
    saveBtn.classList.remove(
      "btn-error",
      "btn-success",
      "btn-warning",
      "btn-info",
    );
    saveBtn.classList.add("btn-success");
  }
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
