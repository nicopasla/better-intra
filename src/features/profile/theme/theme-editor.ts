import { html, render } from "lit-html";
import { ref } from "lit-html/directives/ref.js";
import { adoptShadowStyles } from "../../../utils/shadow-styles.ts";
import { getConfig, type CustomTheme } from "../../../config.ts";
import { applyThemePreset } from "./theme-manager.ts";
import {
  CUSTOM_THEME_GROUPS,
  CUSTOM_THEME_ROLES,
  resolvePalette,
} from "./custom-theme.ts";
import type { FeatureCardOption } from "../../hub/hubSettings.data.ts";

const DIALOG_ID = "ft-theme-editor";

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
  let previewHost: HTMLElement | null = null;
  let ready = false;

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

  const drawPreview = () => {
    if (!previewHost) return;
    const p = resolve();
    render(
      html`<div
        class="rounded-xl overflow-hidden border"
        style="border-color: ${p.border}; background: ${p.page};"
      >
        <div
          class="flex items-center gap-2 px-3 h-10"
          style="background: ${p.header}; border-bottom: 1px solid ${p.border};"
        >
          <div
            class="rounded-full flex-none"
            style="width: 22px; height: 22px; background: ${p.accent};"
          ></div>
          <div
            class="flex-1 rounded-md h-5 px-2 text-[10px] flex items-center"
            style="background: ${p.input}; color: ${p.textMuted}; border: 1px solid ${p.border};"
          >
            Search
          </div>
        </div>
        <div class="flex" style="height: 104px;">
          <div
            class="w-16 flex flex-col gap-1 p-2"
            style="background: ${p.sidebar}; border-right: 1px solid ${p.border};"
          >
            <div
              class="h-2 rounded"
              style="background: ${p.accent}; width: 80%;"
            ></div>
            <div
              class="h-2 rounded"
              style="background: ${p.textMuted}; opacity: 0.5;"
            ></div>
            <div
              class="h-2 rounded"
              style="background: ${p.textMuted}; opacity: 0.5; width: 70%;"
            ></div>
          </div>
          <div class="flex-1 p-2">
            <div
              class="rounded-lg p-2 h-full"
              style="background: ${p.card}; border: 1px solid ${p.border};"
            >
              <div class="text-[11px] font-bold" style="color: ${p.text};">
                Card title
              </div>
              <div class="text-[10px]" style="color: ${p.textMuted};">
                Secondary text
              </div>
              <div
                class="mt-2 inline-block text-[10px] px-2 py-1 rounded"
                style="background: ${p.accent}; color: ${p.accentText};"
              >
                Button
              </div>
            </div>
          </div>
        </div>
      </div>`,
      previewHost,
    );
  };

  const setColor = (roleId: string, hex: string) => {
    const entry = overrides[presetKey] ?? { dark: {}, light: {} };
    entry[mode] = { ...entry[mode], [roleId]: hex };
    overrides[presetKey] = entry;
    drawPreview();
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

  const close = () => {
    if (dialog.open) dialog.close();
    dialog.remove();
  };

  const draw = () => {
    if (!ready) return;
    const resolved = resolve();
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
          <button type="button" class="btn btn-sm btn-ghost" @click=${close}>
            Done
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
          <div
            class="w-full"
            ${ref((el) => {
              previewHost = (el as HTMLElement) ?? null;
            })}
          ></div>
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
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            @click=${resetPreset}
          >
            Reset this theme
          </button>
          <button type="button" class="btn btn-sm btn-primary" @click=${close}>
            Done
          </button>
        </div>
      </div>`,
      shadow,
    );
    drawPreview();
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
