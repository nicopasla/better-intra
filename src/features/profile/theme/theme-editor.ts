import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { adoptShadowStyles } from "../../../utils/shadow-styles.ts";
import type { CustomThemeEntry } from "../../../config.ts";
import { contrastRatio } from "../../../utils/color.ts";
import { applyThemePreset } from "./theme-manager.ts";
import {
  buildDaisyThemeCss,
  CUSTOM_THEME_GROUPS,
  CUSTOM_THEME_ROLES,
  resolvePalette,
} from "./custom-theme.ts";
import {
  getCustomById,
  upsertCustom,
  deleteCustom,
} from "./custom-themes-store.ts";
import {
  shareCommunityTheme,
  type ShareResult,
} from "./community-themes.ts";
import X_SVG from "../../../assets/svg/x.svg?raw";

const DIALOG_ID = "ft-theme-editor";

const renderCloseIcon = () =>
  unsafeHTML(X_SVG.replace("<svg", '<svg width="20" height="20"'));

/** Edit a saved (mine) theme: colors, name, share, delete. */
export async function openThemeEditor(themeId: string): Promise<void> {
  document.getElementById(DIALOG_ID)?.remove();

  let entry = (await getCustomById(themeId)) ?? null;
  if (!entry) return;

  const dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "bg-transparent backdrop:bg-black/50";
  dialog.style.cssText =
    "margin:auto; padding:0; border:none; max-width:46rem; width:calc(100dvw - 2rem);";

  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  adoptShadowStyles(shadow);

  // Own palette for the dialog chrome, so it previews the theme being edited
  // (and stays styled even when this theme isn't the active one).
  const themeStyle = document.createElement("style");
  themeStyle.setAttribute("data-ft-editor-theme", "1");
  shadow.appendChild(themeStyle);

  let mode: "dark" | "light" = document.documentElement.classList.contains(
    "dark",
  )
    ? "dark"
    : "light";
  let name = entry.name;
  let shareOpen = false;
  let sharing = false;
  let shareResult: ShareResult | null = null;

  const palette = () => entry.colors[mode] ?? {};
  const resolved = () => resolvePalette(palette(), mode === "dark", undefined);

  const persist = async () => {
    entry.name = name;
    await upsertCustom(entry);
    await applyThemePreset();
  };

  const setColor = (roleId: string, hex: string) => {
    entry.colors = {
      ...entry.colors,
      [mode]: { ...entry.colors[mode], [roleId]: hex },
    };
    void persist();
  };

  const doShare = async () => {
    const themeName = name.trim();
    if (!themeName || sharing) return;
    sharing = true;
    shareResult = null;
    draw();
    shareResult = await shareCommunityTheme({
      name: themeName,
      mode,
      colors: {
        dark: resolvePalette(entry.colors.dark, true, undefined),
        light: resolvePalette(entry.colors.light, false, undefined),
      },
    });
    sharing = false;
    if (shareResult.ok) shareOpen = false;
    draw();
  };

  const doDelete = async () => {
    await deleteCustom(entry.id);
    close();
  };

  const close = () => {
    if (dialog.open) dialog.close();
    dialog.remove();
  };

  const draw = () => {
    themeStyle.textContent = buildDaisyThemeCss(
      palette(),
      mode === "dark",
      undefined,
      entry.id,
    );
    const res = resolved();
    const contrastChecks = [
      { label: "Text on accent", fg: res.accentText, bg: res.accent },
      { label: "Text on page", fg: res.text, bg: res.page },
      { label: "Text on cards", fg: res.text, bg: res.card },
      { label: "Secondary text", fg: res.textMuted, bg: res.page },
      { label: "Text on hover", fg: res.text, bg: res.hover },
    ].map((c) => {
      const ratio = contrastRatio(c.fg, c.bg);
      const tone =
        ratio >= 4.5 ? "#22c55e" : ratio >= 3 ? "#f59e0b" : "#ef4444";
      return { ...c, ratio, tone };
    });

    render(
      html`<div
        data-theme="${entry.id}"
        class="bg-base-100 text-base-content rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style="max-height: min(88vh, 52rem);"
      >
        <div
          class="flex items-center justify-between gap-3 px-5 py-3 border-b border-base-300"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <input
              type="text"
              class="input input-sm input-bordered w-40"
              maxlength="40"
              placeholder="Theme name"
              .value="${name}"
              @input="${(e: Event) => {
                name = (e.target as HTMLInputElement).value;
              }}"
              @change="${() => void persist()}"
            />
            <div class="join join-horizontal">
              ${(["dark", "light"] as const).map(
                (m) =>
                  html`<button
                    type="button"
                    class="btn btn-xs join-item ${mode === m
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
          </div>
          <button
            type="button"
            class="btn btn-circle btn-ghost btn-sm"
            @click=${close}
            aria-label="Close"
          >
            ${renderCloseIcon()}
          </button>
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
                      .value="${res[role.id]}"
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
              class="btn btn-sm btn-ghost text-error"
              @click="${() => void doDelete()}"
            >
              Delete
            </button>
            ${shareOpen
              ? html`<button
                    type="button"
                    class="btn btn-sm btn-primary ${sharing
                      ? "loading"
                      : ""}"
                    @click="${() => void doShare()}"
                    ?disabled="${sharing || !name.trim()}"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost"
                    @click="${() => {
                      shareOpen = false;
                      draw();
                    }}"
                    ?disabled="${sharing}"
                  >
                    Cancel
                  </button>`
              : html`<button
                  type="button"
                  class="btn btn-sm btn-outline"
                  @click="${() => {
                    shareOpen = true;
                    shareResult = null;
                    draw();
                  }}"
                >
                  Share to community
                </button>`}
            ${shareResult
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
          <button type="button" class="btn btn-sm btn-primary" @click=${close}>
            Done
          </button>
        </div>
      </div>`,
      shadow,
    );
  };

  dialog.appendChild(host);
  document.body.appendChild(dialog);
  dialog.showModal();
  draw();

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
}
