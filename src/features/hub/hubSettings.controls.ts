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
import { openThemeEditor } from "../profile/theme/theme-editor.ts";
import {
  applyThemePreset,
  THEMES,
} from "../profile/theme/theme-manager.ts";
import { openCommunityThemesDialog } from "../profile/theme/community-dialog.ts";
import {
  getCustoms,
  createCustom,
  applyTheme,
  deleteCustom,
  seedColorsFromPreset,
} from "../profile/theme/custom-themes-store.ts";
import type { CustomThemeEntry } from "../../config.ts";
import { contrastText } from "../../utils/color.ts";
import {
  CUSTOM_THEME_ROLES,
  resolvePalette,
} from "../profile/theme/custom-theme.ts";
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

function renderThemeAccentControl(
  host: HTMLElement,
  def: HubSettingDef,
  enabled: boolean,
): void {
  type RawOpt = {
    label?: string;
    value?: string;
    color?: string;
    divider?: boolean;
  };

  let isSchedule = false;
  let selected = "";
  let dayId = "";
  let nightId = "";
  let customs: CustomThemeEntry[] = [];
  let sunTimes: CampusSunTimes | null = null;

  const options = (def.options ?? []) as RawOpt[];
  const builtinOpts = options.filter((o) => o.value && o.value !== "custom");

  const builtinSections: { title?: string; items: RawOpt[] }[] = [];
  {
    let cur: { title?: string; items: RawOpt[] } = { items: [] };
    for (const raw of options) {
      if (raw.value === "custom" || raw.divider) continue;
      if (raw.label && !raw.value) {
        if (cur.items.length > 0 || cur.title) builtinSections.push(cur);
        cur = { title: raw.label, items: [] };
        continue;
      }
      if (raw.value) cur.items.push(raw);
    }
    if (cur.items.length > 0 || cur.title) builtinSections.push(cur);
  }

  const labelFor = (id: string): string => {
    const c = customs.find((x) => x.id === id);
    if (c) return c.name;
    return options.find((o) => o.value === id)?.label ?? id;
  };

  const bgFor = (id: string): string => {
    const c = customs.find((x) => x.id === id);
    if (c) return c.colors.dark.accent ?? c.colors.dark.page ?? "#280f4a";
    const o = options.find((o) => o.value === id);
    return o?.color ? `hsl(${o.color})` : "#888888";
  };

  const textFor = (id: string): string => {
    const c = customs.find((x) => x.id === id);
    if (c) return contrastText(bgFor(id));
    const lightness = parseInt(
      (options.find((o) => o.value === id)?.color ?? "0 0% 50%").split(" ")[2] ??
        "50",
    );
    return lightness > 50 ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)";
  };

  const modeFor = (id: string): "dark" | "light" => {
    if (id === "light") return "light";
    if (id === "dark") return "dark";
    const preset = THEMES[id];
    if (preset?.light && !preset?.dark) return "light";
    if (preset?.dark && !preset?.light) return "dark";
    return "dark";
  };

  /** Saved themes store their mode; infer it for legacy entries without one. */
  const entryMode = (c: CustomThemeEntry): "dark" | "light" => {
    if (c.mode) return c.mode;
    const defDark = resolvePalette(undefined, true, undefined);
    const defLight = resolvePalette(undefined, false, undefined);
    const eq = (a: Record<string, string>, b: Record<string, string>) =>
      CUSTOM_THEME_ROLES.every((r) => (a[r.id] ?? "") === b[r.id]);
    return eq(c.colors.dark, defDark) && !eq(c.colors.light, defLight)
      ? "light"
      : "dark";
  };

  const setSchedule = (on: boolean) => {
    const next = on ? "schedule" : modeFor(selected);
    void chrome.storage.local
      .set({ BETTER_INTRA_THEME: next })
      .then(() => init());
  };

  const customize = async () => {
    const existing = customs.find((c) => c.id === selected);
    if (existing) {
      void openThemeEditor(existing.id);
      return;
    }
    const entry = await createCustom(
      `${labelFor(selected)} copy`,
      seedColorsFromPreset(selected),
      undefined,
      modeFor(selected),
    );
    await applyTheme(entry.id);
    void openThemeEditor(entry.id);
  };

  const selectTheme = async (id: string) => {
    await applyTheme(id);
    selected = id;
    // Light/dark built-ins switch the mode too (so picking a light theme goes
    // light). Saved themes and System/Auto keep the current mode.
    const currentMode = await getConfig("BETTER_INTRA_THEME");
    const isMine = customs.some((c) => c.id === id);
    if (!isMine && currentMode !== "system" && currentMode !== "schedule") {
      const next = modeFor(id);
      if (next !== currentMode) {
        await chrome.storage.local.set({ BETTER_INTRA_THEME: next });
      }
    }
    void init();
  };

  const pickSlot = (slotIsDark: boolean, id: string) => {
    const key = slotIsDark
      ? "THEME_SCHEDULE_DARK_PRESET"
      : "THEME_SCHEDULE_LIGHT_PRESET";
    void chrome.storage.local.set({ [key]: id }).then(async () => {
      if (slotIsDark) dayId = id;
      else nightId = id;
      const isDark = document.documentElement.classList.contains("dark");
      if (slotIsDark === isDark) {
        await chrome.storage.local.set({ PROFILE_THEME_PRESET: id });
        await applyThemePreset();
      }
      void init();
    });
  };

  const init = async () => {
    isSchedule = (await getConfig("BETTER_INTRA_THEME")) === "schedule";
    selected = await getConfig("PROFILE_THEME_PRESET");
    dayId = await getConfig("THEME_SCHEDULE_DARK_PRESET");
    nightId = await getConfig("THEME_SCHEDULE_LIGHT_PRESET");
    customs = await getCustoms();
    const campusId = await getConfig("CLUSTERS_CAMPUS");
    sunTimes = await getCampusSunTimes(campusId);
    draw();
  };

  const swatch = (
    id: string,
    isSelected: boolean,
    ring: string,
    onClick: () => void,
  ) => {
    const bg = bgFor(id);
    return html`<button
      type="button"
      class="btn btn-sm flex-none"
      ?disabled="${!enabled}"
      style="background:${bg}; color:${textFor(
        id,
      )}; border: 2px solid ${isSelected
        ? ring
        : "transparent"}; outline: ${isSelected
        ? `2px solid ${ring}`
        : "none"}; outline-offset: 2px;"
      @click="${onClick}"
    >
      ${labelFor(id)}
    </button>`;
  };

  const mineSwatch = (
    c: CustomThemeEntry,
    isSelected: boolean,
    ring: string,
    onSelect: () => void,
  ) => {
    const bg = bgFor(c.id);
    return html`<span class="relative inline-flex flex-none">
      <button
        type="button"
        class="btn btn-sm"
        ?disabled="${!enabled}"
        style="background:${bg}; color:${textFor(
          c.id,
        )}; border: 2px solid ${isSelected
          ? ring
          : "transparent"}; outline: ${isSelected
          ? `2px solid ${ring}`
          : "none"}; outline-offset: 2px;"
        @click="${onSelect}"
      >
        ${c.name}
      </button>
      <button
        type="button"
        class="btn btn-circle btn-error"
        style="position:absolute; top:-0.45rem; right:-0.45rem; width:1.1rem; height:1.1rem; min-height:0; padding:0; font-size:0.7rem; line-height:1;"
        aria-label="Delete ${c.name}"
        @click="${(e: Event) => {
          e.stopPropagation();
          void deleteCustom(c.id).then(async () => {
            customs = await getCustoms();
            draw();
          });
        }}"
      >
        ×
      </button>
    </span>`;
  };

  const slotSection = (slotIsDark: boolean) => {
    const cur = slotIsDark ? dayId : nightId;
    const ring = slotIsDark ? "#3b82f6" : "#f59e0b";
    const sectionItems =
      builtinSections.find((s) => s.title === (slotIsDark ? "Dark" : "Light"))
        ?.items ?? builtinOpts;
    return html`<div class="flex flex-col gap-1">
      <span class="text-xs font-bold uppercase opacity-50"
        >${slotIsDark ? "Dark" : "Light"}</span
      >
      <div class="flex flex-wrap gap-1">
        ${sectionItems.map((o) =>
          swatch(o.value!, o.value === cur, ring, () =>
            pickSlot(slotIsDark, o.value!),
          ),
        )}
        ${customs
          .filter((c) => entryMode(c) === (slotIsDark ? "dark" : "light"))
          .map((c) =>
            mineSwatch(c, c.id === cur, ring, () => pickSlot(slotIsDark, c.id)),
          )}
      </div>
    </div>`;
  };

  const btnStyle =
    "display:flex; align-items:center; gap:0.5rem; box-sizing:border-box; padding:0.5rem 0.9rem; border-radius:0.75rem; border:1px solid var(--color-base-300); background:var(--color-base-100); cursor:pointer;";

  const isDarkNow = () => document.documentElement.classList.contains("dark");

  const sunChip = (
    kind: "sunset" | "sunrise",
    time: string,
    active: boolean,
  ) => html`<span
    style="display:inline-flex; align-items:center; gap:0.2rem; padding:0.05rem 0.4rem; border-radius:0.6rem; border:1.5px solid ${active
      ? "currentColor"
      : "transparent"};"
  >
    <span style="display:inline-flex; width:0.85rem; height:0.85rem;"
      >${unsafeHTML(kind === "sunset" ? SUNSET_SVG : SUNRISE_SVG)}</span
    >${time}
  </span>`;

  const draw = () => {
    render(
      html`<div class="flex flex-col gap-3 w-full">
        ${isSchedule
          ? html`<div class="flex flex-col gap-2">
              ${slotSection(false)} ${slotSection(true)}
            </div>`
          : html`<div class="flex flex-col gap-2">
              ${builtinSections.map((s) => {
                const sectionMode =
                  s.title === "Light"
                    ? "light"
                    : s.title === "Dark"
                      ? "dark"
                      : null;
                const mines = sectionMode
                  ? customs.filter((c) => entryMode(c) === sectionMode)
                  : [];
                return html`<div class="flex flex-col gap-1">
                  ${s.title
                    ? html`<span class="text-xs font-bold uppercase opacity-50"
                        >${s.title}</span
                      >`
                    : ""}
                  <div class="flex flex-wrap gap-1">
                    ${s.items.map((o) =>
                      swatch(o.value!, o.value === selected, "#ffffff", () =>
                        void selectTheme(o.value!),
                      ),
                    )}
                    ${mines.map((c) =>
                      mineSwatch(c, c.id === selected, "#ffffff", () =>
                        void selectTheme(c.id),
                      ),
                    )}
                  </div>
                </div>`;
              })}
            </div>`}
        <div class="flex flex-wrap items-stretch gap-2 w-full">
          <label
            class="cursor-pointer"
            style="display:flex; flex-direction:row; align-items:center; gap:0.5rem; box-sizing:border-box; padding:0.5rem 0.9rem; border-radius:0.75rem; border:1px solid var(--color-base-300); background:var(--color-base-100);"
          >
            <input
              type="checkbox"
              class="toggle toggle-primary"
              ?checked="${isSchedule}"
              ?disabled="${!enabled}"
              @change="${(e: Event) =>
                setSchedule((e.target as HTMLInputElement).checked)}"
            />
            <span style="font-size:0.875rem; font-weight:600;">Auto</span>
            ${sunTimes
              ? html`<span
                  style="display:flex; flex-direction:column; align-items:flex-start; gap:0.1rem; font-size:0.75rem; ${isSchedule
                    ? "opacity:0.7;"
                    : "opacity:0.4; filter:grayscale(1);"}"
                >
                  ${sunChip("sunset", sunTimes.sunset, isSchedule && isDarkNow())}
                  ${sunChip(
                    "sunrise",
                    sunTimes.sunrise,
                    isSchedule && !isDarkNow(),
                  )}
                </span>`
              : ""}
          </label>
          <button
            type="button"
            class="text-left"
            style="${btnStyle}"
            @click="${openCommunityThemesDialog}"
          >
            <span style="font-size:0.875rem; font-weight:600;"
              >Community themes</span
            >
          </button>
          <button
            type="button"
            class="text-left"
            style="${btnStyle}"
            ?disabled="${!enabled}"
            @click="${() => void customize()}"
          >
            <span style="font-size:0.875rem; font-weight:600;"
              >Customize colors</span
            >
          </button>
          ${isSchedule
            ? html`<span
                class="text-[11px] opacity-60 ml-auto self-center text-right"
                >Pick one dark theme and one light theme.</span
              >`
            : ""}
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
        changes.PROFILE_THEME_CUSTOMS ||
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
                  : "var(--color-base-300)"};"
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
                          : "2px solid var(--color-base-300)";
                    });
                }}"
              >
                ${o.label}
              </button>`;
            })}
          </div>`;

        case "font-scale": {
          const setBorders = (container: Element | null, active: string) => {
            container?.querySelectorAll("[data-font-scale]").forEach((b) => {
              const el = b as HTMLButtonElement;
              el.style.border =
                el.dataset.fontScale === active
                  ? "2px solid var(--color-primary)"
                  : "2px solid var(--color-base-300)";
            });
          };
          return html`<div class="flex flex-wrap gap-1 w-full items-center">
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
                  : "var(--color-base-300)"};"
                @mousedown="${(e: Event) => e.stopPropagation()}"
                @click="${(e: Event) => {
                  e.stopPropagation();
                  const btn = e.currentTarget as HTMLButtonElement;
                  saveSetting(def.key!, Number(o.value));
                  const container = btn.closest(".flex");
                  setBorders(container, o.value ?? "");
                  const input = container?.querySelector<HTMLInputElement>(
                    "[data-font-scale-input]",
                  );
                  if (input) input.value = String(o.value);
                }}"
              >
                ${o.label}
              </button>`;
            })}
            <label
              class="input input-sm input-accent w-16 flex-none flex items-center gap-0.5"
            >
              <input
                type="number"
                class="w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="70"
                max="150"
                step="1"
                .value="${String(value)}"
                data-font-scale-input
                ?disabled="${!enabled}"
                @mousedown="${(e: Event) => e.stopPropagation()}"
                @click="${(e: Event) => e.stopPropagation()}"
                @change="${(e: Event) => {
                  e.stopPropagation();
                  const input = e.currentTarget as HTMLInputElement;
                  const clamped = Math.min(
                    150,
                    Math.max(70, Math.round(Number(input.value) || 100)),
                  );
                  input.value = String(clamped);
                  saveSetting(def.key!, clamped);
                  setBorders(input.closest(".flex"), String(clamped));
                }}"
              />
              <span class="opacity-70">%</span>
            </label>
          </div>`;
        }

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
                  danger: true,
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
    ${renderSettingInner(def, enabled)}
  </div>`;
}

function renderSettingInner(def: HubSettingDef, enabled: boolean) {
  const isFullWidth =
    def.fullWidth ?? (def.kind === "url" || def.kind === "shortcuts");
  return html`<div
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
    <div class="${isFullWidth ? "w-full" : "flex-none self-end sm:self-auto"}">
      ${renderSettingControl(def, enabled)}
    </div>
  </div>`;
}

interface ResolvedSetting {
  def: HubSettingDef;
  enabled: boolean;
  hidden: boolean;
}

function renderGroupEntry(e: ResolvedSetting) {
  return html`<div
    class="flex flex-col gap-1.5 h-full rounded-lg p-3"
    style="border:1px solid color-mix(in oklab, var(--color-base-content) 22%, transparent); background:color-mix(in oklab, var(--color-base-content) 3%, transparent);"
  >
    <span class="text-xs opacity-60">${e.def.label}</span>
    <div class="${e.enabled ? "" : "opacity-40 grayscale"}">
      ${renderSettingControl(e.def, e.enabled)}
    </div>
  </div>`;
}

function renderSettingGroup(label: string, entries: ResolvedSetting[]) {
  const allHidden = entries.every((e) => e.hidden);
  const rows: ResolvedSetting[][] = [];
  for (const e of entries) {
    if (e.def.groupInline && rows.length > 0) rows[rows.length - 1].push(e);
    else rows.push([e]);
  }
  return html`<div
    class="card bg-base-200 shadow-sm p-3 sm:p-4 col-span-full ${allHidden
      ? "hidden"
      : ""}"
    data-search="${entries.map((e) => searchHaystack(e.def)).join(" ")}"
  >
    <span class="text-sm font-semibold">${label}</span>
    <div class="flex flex-col gap-3 mt-3">
      ${rows.map((row) =>
        row.length === 1
          ? renderGroupEntry(row[0])
          : html`<div class="flex flex-col sm:flex-row gap-3">
              ${row.map((e) => {
                const gf = e.def.groupFlex ?? 1;
                const flexStyle =
                  gf === 0 ? "flex:0 0 auto;" : `flex:${gf} 1 0%;`;
                return html`<div
                  class="min-w-0"
                  style="${flexStyle}${gf === 0 ? "margin-left:auto;" : ""}"
                >
                  ${renderGroupEntry(e)}
                </div>`;
              })}
            </div>`,
      )}
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
  const resolve = (def: HubSettingDef): ResolvedSetting => ({
    def,
    hidden: !!(def.key && hiddenDeps.has(def.key)),
    enabled:
      isAlwaysEnabled ||
      (enabled &&
        !(def.key && disabledDeps.has(def.key)) &&
        !(def.requiresCloud && disabledDeps.has("__CLOUD__"))),
  });

  const out: unknown[] = [];
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (def.group && def.kind !== "divider") {
      const entries: ResolvedSetting[] = [];
      let label = def.groupLabel ?? def.group;
      let j = i;
      while (j < defs.length && defs[j].group === def.group) {
        if (defs[j].groupLabel) label = defs[j].groupLabel!;
        entries.push(resolve(defs[j]));
        j++;
      }
      i = j - 1;
      out.push(renderSettingGroup(label, entries));
    } else {
      const { enabled: rowEnabled, hidden } = resolve(def);
      out.push(renderSetting(def, rowEnabled, hidden));
    }
  }
  return out;
}
