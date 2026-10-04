import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { adoptShadowStyles } from "../../../utils/shadow-styles.ts";
import { formatAbsoluteDateTime } from "../../../utils/dates.ts";
import { getConfig, type CustomTheme } from "../../../config.ts";
import { contrastRatio } from "../../../utils/color.ts";
import { applyThemePreset } from "./theme-manager.ts";
import {
  CUSTOM_THEME_GROUPS,
  CUSTOM_THEME_ROLES,
  resolvePalette,
} from "./custom-theme.ts";
import {
  fetchCommunityThemes,
  shareCommunityTheme,
  type ShareResult,
} from "./community-themes.ts";
import type { CommunityTheme } from "./theme-schema.ts";
import type { FeatureCardOption } from "../../hub/hubSettings.data.ts";
import X_SVG from "../../../assets/svg/x.svg?raw";

const DIALOG_ID = "ft-theme-editor";

const renderCloseIcon = () =>
  unsafeHTML(X_SVG.replace("<svg", '<svg width="20" height="20"'));

/**
 * Theme editor dialog: every named preset plus "custom" can be recolored
 * per component. Colors are stored as overrides keyed by preset id.
 */
export function openThemeEditor(options: readonly FeatureCardOption[]): void {
  document.getElementById(DIALOG_ID)?.remove();

  const dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "bg-transparent backdrop:bg-black/50";
  dialog.style.margin = "auto";
  dialog.style.padding = "0";
  dialog.style.border = "none";
  dialog.style.maxWidth = "46rem";
  dialog.style.width = "calc(100dvw - 2rem)";

  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  adoptShadowStyles(shadow);

  let presetKey = "dark";
  let mode: "dark" | "light" = "dark";
  let overrides: Record<string, CustomTheme> = {};
  let ready = false;

  let shareOpen = false;
  let shareName = "";
  let sharing = false;
  let shareResult: ShareResult | null = null;

  const baseKey = (key: string) => (key === "custom" ? undefined : key);
  const currentPalette = () => overrides[presetKey]?.[mode] ?? {};
  const resolve = () =>
    resolvePalette(currentPalette(), mode === "dark", baseKey(presetKey));

  /** Persist and re-apply immediately so the page updates while editing. */
  const persist = () => {
    void chrome.storage.local
      .set({ PROFILE_THEME_OVERRIDES: overrides })
      .then(() => applyThemePreset());
  };

  const setColor = (roleId: string, hex: string) => {
    const entry = overrides[presetKey] ?? { dark: {}, light: {} };
    entry[mode] = { ...entry[mode], [roleId]: hex };
    overrides[presetKey] = entry;
    persist();
  };

  const choosePreset = (value: string) => {
    presetKey = value;
    void chrome.storage.local.set({ PROFILE_THEME_PRESET: value });
    draw();
  };

  const resetPreset = () => {
    delete overrides[presetKey];
    persist();
    draw();
  };

  const toggleShare = () => {
    shareOpen = !shareOpen;
    shareName = "";
    shareResult = null;
    draw();
  };

  const doShare = async () => {
    const name = shareName.trim();
    if (!name || sharing) return;
    sharing = true;
    shareResult = null;
    draw();
    const base = baseKey(presetKey);
    const palette = overrides[presetKey] ?? { dark: {}, light: {} };
    shareResult = await shareCommunityTheme({
      name,
      mode,
      colors: {
        dark: resolvePalette(palette.dark, true, base),
        light: resolvePalette(palette.light, false, base),
      },
    });
    sharing = false;
    if (shareResult.ok) shareOpen = false;
    draw();
  };

  const previewOnIntra = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  const close = () => {
    if (dialog.open) dialog.close();
    dialog.remove();
  };

  const draw = () => {
    if (!ready) return;
    const resolved = resolve();
    const contrastChecks = [
      { label: "Text on accent", fg: resolved.accentText, bg: resolved.accent },
      { label: "Text on page", fg: resolved.text, bg: resolved.page },
      { label: "Text on cards", fg: resolved.text, bg: resolved.card },
      { label: "Secondary text", fg: resolved.textMuted, bg: resolved.page },
      { label: "Text on hover", fg: resolved.text, bg: resolved.hover },
    ].map((c) => {
      const ratio = contrastRatio(c.fg, c.bg);
      const tone =
        ratio >= 4.5 ? "#22c55e" : ratio >= 3 ? "#f59e0b" : "#ef4444";
      return { ...c, ratio, tone };
    });
    render(
      html`<div
        data-theme="${presetKey}"
        class="bg-base-100 text-base-content rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style="max-height: min(88vh, 52rem);"
      >
        <div
          class="flex items-center justify-between gap-3 px-5 py-3 border-b border-base-300"
        >
          <h3 class="font-bold text-lg">Theme editor</h3>
          <button
            type="button"
            class="btn btn-circle btn-ghost btn-sm"
            @click=${close}
            aria-label="Close"
          >
            ${renderCloseIcon()}
          </button>
        </div>

        <div class="px-5 py-3 border-b border-base-300 flex flex-col gap-3">
          <div class="flex flex-wrap gap-1">
            ${options.map((raw) => {
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
              const isSelected = String(o.value) === presetKey;
              const lightness = parseInt(hsl.split(" ")[2] ?? "50");
              const textColor =
                lightness > 50 ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)";
              return html`<button
                type="button"
                class="btn btn-sm flex-none"
                style="background-color: hsl(${hsl}); color: ${textColor}; border: 2px solid ${isSelected
                  ? "#fff"
                  : "transparent"}; outline: ${isSelected
                  ? "2px solid hsl(" + hsl + ")"
                  : "none"}; outline-offset: 2px;"
                @click=${() => choosePreset(o.value!)}
              >
                ${o.label}
              </button>`;
            })}
          </div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex gap-1">
              ${(["dark", "light"] as const).map(
                (m) =>
                  html`<button
                    type="button"
                    class="btn btn-xs ${mode === m
                      ? "btn-primary"
                      : "btn-ghost"}"
                    @click=${() => {
                      mode = m;
                      draw();
                    }}
                  >
                    ${m === "dark" ? "Dark" : "Light"}
                  </button>`,
              )}
            </div>
            <span class="text-xs opacity-50">Editing ${mode} colors</span>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-bold uppercase opacity-50">Contrast</span>
            ${contrastChecks.map(
              (c) =>
                html`<div
                  class="flex items-center justify-between gap-2 text-sm"
                >
                  <span>${c.label}</span>
                  <span class="flex items-center gap-1.5">
                    <span
                      class="w-2.5 h-2.5 rounded-full"
                      style="background:${c.tone}"
                      data-tip="WCAG ratio ${c.ratio.toFixed(1)}:1"
                    ></span>
                    <span class="font-mono text-xs"
                      >${c.ratio.toFixed(1)}:1</span
                    >
                  </span>
                </div>`,
            )}
          </div>

          ${CUSTOM_THEME_GROUPS.map((group) => {
            const roles = CUSTOM_THEME_ROLES.filter((r) => r.group === group);
            if (roles.length === 0) return "";
            return html`<div class="flex flex-col gap-1">
              <span class="text-xs font-bold uppercase opacity-50"
                >${group}</span
              >
              ${roles.map(
                (role) =>
                  html`<label
                    class="flex items-center justify-between gap-3 bg-base-200 rounded-lg px-3 py-2"
                  >
                    <span class="flex flex-col">
                      <span class="text-sm">${role.label}</span>
                      <span class="text-xs opacity-50">${role.desc}</span>
                    </span>
                    <input
                      type="color"
                      class="input input-accent p-1 w-12 h-8 flex-none"
                      .value="${resolved[role.id]}"
                      @input="${(e: Event) =>
                        setColor(
                          role.id,
                          (e.target as HTMLInputElement).value,
                        )}"
                    />
                  </label>`,
              )}
            </div>`;
          })}
        </div>

        <div
          class="flex items-center justify-between gap-2 px-5 py-3 border-t border-base-300"
        >
          <div class="flex items-center gap-2 min-w-0">
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              @click=${resetPreset}
            >
              Reset this theme
            </button>
            ${shareOpen
              ? html`<input
                    type="text"
                    class="input input-sm input-bordered w-40"
                    placeholder="Theme name"
                    maxlength="40"
                    .value="${shareName}"
                    @input="${(e: Event) => {
                      shareName = (e.target as HTMLInputElement).value;
                      draw();
                    }}"
                    ?disabled="${sharing}"
                  />
                  <button
                    type="button"
                    class="btn btn-sm btn-primary ${sharing ? "loading" : ""}"
                    @click="${() => void doShare()}"
                    ?disabled="${sharing || !shareName.trim()}"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost"
                    @click="${toggleShare}"
                    ?disabled="${sharing}"
                  >
                    Cancel
                  </button>`
              : html`<button
                  type="button"
                  class="btn btn-sm btn-outline"
                  @click="${toggleShare}"
                >
                  Share to community
                </button>`}
            ${shareResult && !shareOpen
              ? html`<span
                  class="text-xs ${shareResult.ok
                    ? "text-success"
                    : "text-error"} truncate"
                  >${shareResult.ok
                    ? "Shared! 🎉"
                    : (shareResult.error ?? "Couldn't share")}</span
                >`
              : ""}
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline"
            @click=${previewOnIntra}
          >
            Preview on intra
          </button>
          <button type="button" class="btn btn-sm btn-primary" @click=${close}>
            Done
          </button>
        </div>
      </div>`,
      shadow,
    );
  };

  void (async () => {
    const [savedPreset, savedOverrides] = await Promise.all([
      getConfig("PROFILE_THEME_PRESET"),
      getConfig("PROFILE_THEME_OVERRIDES"),
    ]);
    presetKey = savedPreset || "dark";
    overrides = savedOverrides ?? {};
    // Edit the palette that is actually applied on the page right now.
    mode = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    ready = true;
    draw();
  })();

  dialog.appendChild(host);
  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
}

export function openCommunityThemesDialog(): void {
  const DIALOG_ID = "ft-community-themes";
  document.getElementById(DIALOG_ID)?.remove();

  const dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "bg-transparent backdrop:bg-black/50";
  dialog.style.cssText =
    "margin:auto; padding:0; border:none; max-width:52rem; width:calc(100dvw - 2rem);";

  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  adoptShadowStyles(shadow);
  dialog.appendChild(host);
  document.body.appendChild(dialog);
  dialog.showModal();

  const daisyTheme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  let dialogPreset = daisyTheme;
  void getConfig("PROFILE_THEME_PRESET").then((p) => {
    dialogPreset = (p as string) || daisyTheme;
    draw();
  });

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const hex = (pal: Record<string, string>, key: string, fb: string) =>
    pal[key] ?? fb;

  const apply = async (theme: CommunityTheme) => {
    const existing = await getConfig("PROFILE_THEME_OVERRIDES");
    await chrome.storage.local.set({
      BETTER_INTRA_THEME: theme.mode,
      PROFILE_THEME_PRESET: "custom",
      PROFILE_THEME_OVERRIDES: {
        ...existing,
        custom: { dark: theme.colors.dark, light: theme.colors.light },
      },
      THEME_SCHEDULE_DARK_PRESET: "custom",
      THEME_SCHEDULE_LIGHT_PRESET: "custom",
    });
    await applyThemePreset();
    close();
  };

  let filter: "all" | "dark" | "light" = "all";
  let loadedThemes: CommunityTheme[] = [];
  let loadError = false;
  let loading = true;

  const draw = () => {
    const visible =
      filter === "all"
        ? loadedThemes
        : loadedThemes.filter((t) => t.mode === filter);
    render(
      html`<div
        data-theme="${dialogPreset}"
        class="bg-base-100 text-base-content rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style="max-height:min(88vh,48rem);"
      >
        <div
          class="flex items-center justify-between gap-3 px-5 py-3 border-b border-base-300"
        >
          <h3 class="font-bold text-lg">Community themes</h3>
          <button
            type="button"
            class="btn btn-circle btn-ghost btn-sm"
            @click=${close}
            aria-label="Close"
          >
            ${renderCloseIcon()}
          </button>
        </div>
        <div
          class="flex items-center justify-between gap-3 px-5 py-2 border-b border-base-300"
        >
          <span class="text-sm font-semibold">Filter</span>
          <div class="join join-horizontal">
            ${(["all", "dark", "light"] as const).map(
              (m) =>
                html`<button
                  type="button"
                  class="btn btn-xs join-item ${filter === m
                    ? "btn-primary"
                    : "btn-ghost"}"
                  @click="${() => {
                    filter = m;
                    draw();
                  }}"
                >
                  ${m === "all" ? "All" : m === "dark" ? "Dark" : "Light"}
                </button>`,
            )}
          </div>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-4">
          ${loadError
            ? html`<p class="text-sm opacity-60">
                Couldn't load community themes.
              </p>`
            : loading
              ? html`<div class="flex justify-center py-10">
                  <span class="loading loading-spinner loading-md"></span>
                </div>`
              : loadedThemes.length === 0
                ? html`<p class="text-sm opacity-60">
                    No community themes yet.
                  </p>`
                : visible.length === 0
                  ? html`<p class="text-sm opacity-60">
                      No ${filter} themes yet.
                    </p>`
                  : html`<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      ${visible.map((t) => {
                        const p =
                          t.mode === "light" ? t.colors.light : t.colors.dark;
                        return html`<div
                          role="button"
                          tabindex="0"
                          class="flex flex-col items-stretch gap-2 rounded-xl border border-base-300 p-2 text-left cursor-pointer hover:border-base-content/40 transition-colors"
                          style="background:${hex(
                            p,
                            "page",
                            "#1f2937",
                          )}; color:${hex(p, "text", "#e5e7eb")};"
                          @click="${() => apply(t)}"
                          data-tip="Apply ${t.name}"
                        >
                          <div
                            class="rounded-lg overflow-hidden border"
                            style="border-color:${hex(p, "border", "#374151")};"
                          >
                            <div
                              class="flex items-center gap-1 px-2 h-6"
                              style="background:${hex(
                                p,
                                "header",
                                hex(p, "page", "#111827"),
                              )};"
                            >
                              <span
                                class="w-3 h-3 rounded-full flex-none"
                                style="background:${hex(
                                  p,
                                  "accent",
                                  "#00babc",
                                )};"
                              ></span>
                              <span
                                class="flex-1 h-2 rounded"
                                style="background:${hex(
                                  p,
                                  "input",
                                  hex(p, "page", "#1f2937"),
                                )};"
                              ></span>
                            </div>
                            <div class="flex items-center gap-1.5 px-2 pt-2">
                              <span
                                class="w-5 h-5 rounded-full flex-none"
                                style="background:${hex(
                                  p,
                                  "accent",
                                  "#00babc",
                                )};"
                              ></span>
                              <div class="flex flex-col gap-1">
                                <span
                                  class="h-1.5 w-12 rounded"
                                  style="background:${hex(
                                    p,
                                    "text",
                                    "#e5e7eb",
                                  )}; opacity:.8;"
                                ></span>
                                <span
                                  class="h-1.5 w-8 rounded"
                                  style="background:${hex(
                                    p,
                                    "textMuted",
                                    "#9ca3af",
                                  )};"
                                ></span>
                              </div>
                              <span
                                class="ml-auto text-[8px] px-1.5 py-0.5 rounded"
                                style="background:${hex(
                                  p,
                                  "accent",
                                  "#00babc",
                                )}; color:${hex(p, "accentText", "#ffffff")};"
                                >button</span
                              >
                            </div>
                            <div
                              class="h-1.5 rounded-full mx-2 my-2 overflow-hidden"
                              style="background:${hex(
                                p,
                                "hover",
                                hex(p, "page", "#1f2937"),
                              )};"
                            >
                              <div
                                class="h-full w-2/3"
                                style="background:${hex(
                                  p,
                                  "accent",
                                  "#00babc",
                                )};"
                              ></div>
                            </div>
                          </div>
                          <div
                            class="flex items-center justify-between gap-1 min-w-0"
                          >
                            <span class="text-sm font-semibold truncate"
                              >${t.name}</span
                            >
                            <span
                              class="badge badge-sm flex-none ${t.mode ===
                              "light"
                                ? "badge-ghost"
                                : "badge-neutral"}"
                              style="font-size:.6rem; text-transform:uppercase;"
                              >${t.mode}</span
                            >
                          </div>
                          <span
                            class="flex items-center gap-1 text-xs opacity-60 min-w-0"
                          >
                            <a
                              href="https://profile-v3.intra.42.fr/users/${t.author}"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="truncate hover:opacity-100 hover:underline"
                              title="${t.author}"
                              @click="${(e: Event) => e.stopPropagation()}"
                              >by ${t.author}</a
                            >
                            ${t.createdAt
                              ? html`<span class="flex-none"
                                  >·
                                  ${formatAbsoluteDateTime(t.createdAt)}</span
                                >`
                              : ""}
                          </span>
                        </div>`;
                      })}
                    </div>`}
        </div>
      </div>`,
      shadow,
    );
  };

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  draw();
  void fetchCommunityThemes().then(({ themes, error }) => {
    loadedThemes = themes;
    loadError = error;
    loading = false;
    draw();
  });
}
