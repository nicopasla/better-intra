import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { adoptShadowStyles } from "../../../utils/shadow-styles.ts";
import { formatAbsoluteDateTime } from "../../../utils/dates.ts";
import { getConfig } from "../../../config.ts";
import {
  fetchCommunityThemes,
  likeTheme,
} from "./community-themes.ts";
import { getCustoms, createCustom, applyTheme } from "./custom-themes-store.ts";
import { THEMES } from "./theme-manager.ts";
import type { CommunityTheme } from "./theme-schema.ts";
import X_SVG from "../../../assets/svg/x.svg?raw";

const DIALOG_ID = "ft-community-themes";

const closeIcon = () =>
  unsafeHTML(X_SVG.replace("<svg", '<svg width="20" height="20"'));

export function openCommunityThemesDialog(): void {
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

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  let themes: CommunityTheme[] = [];
  let loading = true;
  let loadError = false;
  let filter: "all" | "dark" | "light" = "all";
  let search = "";
  let searchTimer: number | null = null;
  let likedIds = new Set<string>();
  let cloudConnected = false;
  let appliedId: string | null = null;

  const load = async () => {
    loading = true;
    loadError = false;
    draw();
    const [res, likes, token] = await Promise.all([
      fetchCommunityThemes(search),
      getConfig("PROFILE_THEME_LIKES"),
      getConfig("CLOUD_TOKEN"),
    ]);
    themes = res.themes;
    loadError = res.error;
    loading = false;
    likedIds = new Set(likes ?? []);
    cloudConnected = !!token;
    draw();
  };

  const doLike = async (t: CommunityTheme) => {
    if (!cloudConnected) return;
    const liked = likedIds.has(t.id);
    const res = await likeTheme(t.id, liked ? -1 : 1);
    if (!res.ok) return;
    t.likes = res.likes ?? t.likes ?? 0;
    if (liked) likedIds.delete(t.id);
    else likedIds.add(t.id);
    await chrome.storage.local.set({ PROFILE_THEME_LIKES: [...likedIds] });
    draw();
  };

  const apply = async (t: CommunityTheme) => {
    const existing = await getCustoms();
    const match = existing.find(
      (c) => c.name === t.name && c.author === t.author,
    );
    let id: string;
    if (match) {
      id = match.id;
      await chrome.storage.local.set({
        PROFILE_THEME_CUSTOMS: existing.map((c) =>
          c.id === id
            ? {
                ...c,
                mode: t.mode,
                colors: { dark: t.colors.dark, light: t.colors.light },
              }
            : c,
        ),
      });
    } else {
      const entry = await createCustom(
        t.name,
        { dark: t.colors.dark, light: t.colors.light },
        t.author,
        t.mode,
      );
      id = entry.id;
    }
    await applyTheme(id);
    const currentMode = await getConfig("BETTER_INTRA_THEME");
    if (currentMode !== "system" && currentMode !== "schedule") {
      await chrome.storage.local.set({ BETTER_INTRA_THEME: t.mode });
    }
    appliedId = t.id;
    draw();
  };

  const mock = (p: Record<string, string>) => html`
    <div
      class="rounded-lg overflow-hidden border"
      style="border-color:${p.border ?? "#374151"};"
    >
      <div
        class="flex items-center gap-1 px-2 h-6"
        style="background:${p.header ?? p.page ?? "#111827"};"
      >
        <span
          class="w-3 h-3 rounded-full flex-none"
          style="background:${p.accent ?? "#00babc"};"
        ></span>
        <span
          class="flex-1 h-2 rounded"
          style="background:${p.input ?? p.page ?? "#1f2937"};"
        ></span>
      </div>
      <div class="flex items-center gap-1.5 px-2 pt-2">
        <span
          class="w-5 h-5 rounded-full flex-none"
          style="background:${p.accent ?? "#00babc"};"
        ></span>
        <div class="flex flex-col gap-1">
          <span
            class="h-1.5 w-12 rounded"
            style="background:${p.text ?? "#e5e7eb"};opacity:.8;"
          ></span>
          <span
            class="h-1.5 w-8 rounded"
            style="background:${p.textMuted ?? "#9ca3af"};"
          ></span>
        </div>
        <span
          class="ml-auto text-[8px] px-1.5 py-0.5 rounded"
          style="background:${p.accent ?? "#00babc"};color:${p.accentText ??
          "#ffffff"};"
          >button</span
        >
      </div>
      <div
        class="h-1.5 rounded-full mx-2 my-2 overflow-hidden"
        style="background:${p.hover ?? p.page ?? "#1f2937"};"
      >
        <div
          class="h-full w-2/3"
          style="background:${p.accent ?? "#00babc"};"
        ></div>
      </div>
    </div>
  `;

  const draw = () => {
    const visible =
      filter === "all" ? themes : themes.filter((t) => t.mode === filter);
    render(
      html`<div
        data-theme="${dialogPreset}"
        class="bg-base-100 text-base-content rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style="height:min(88vh,48rem);"
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
            ${closeIcon()}
          </button>
        </div>
        <div class="px-5 py-2 border-b border-base-300 flex items-center gap-2">
          <input
            type="search"
            class="input input-sm input-bordered flex-1 min-w-0"
            placeholder="Search themes or authors…"
            .value="${search}"
            @input="${(e: Event) => {
              search = (e.target as HTMLInputElement).value;
              if (searchTimer !== null) window.clearTimeout(searchTimer);
              searchTimer = window.setTimeout(() => void load(), 300);
            }}"
          />
          <div class="join join-horizontal flex-none">
            ${(["all", "dark", "light"] as const).map(
              (m) => html`<button
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
            ? html`<div class="flex flex-col items-center gap-3 py-10">
                <span class="text-sm opacity-60"
                  >Couldn't load community themes.</span
                >
                <button class="btn btn-sm" @click="${() => void load()}">
                  Retry
                </button>
              </div>`
            : loading
              ? html`<div class="flex justify-center py-10">
                  <span class="loading loading-spinner loading-md"></span>
                </div>`
              : visible.length === 0
                ? html`<p class="text-sm opacity-60 py-10 text-center">
                    ${themes.length === 0
                      ? "No community themes yet."
                      : `No ${filter} themes.`}
                  </p>`
                : html`<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    ${visible.map((t) => {
                      const p = t.mode === "light"
                        ? t.colors.light
                        : t.colors.dark;
                      const liked = likedIds.has(t.id);
                      return html`<div
                        class="flex flex-col gap-2 rounded-xl border p-2"
                        style="background:${p.page ??
                        "#1f2937"}; color:${p.text ??
                        "#e5e7eb"}; border-color:${appliedId === t.id
                          ? "var(--color-primary)"
                          : (p.border ?? "#374151")};"
                      >
                        <button
                          type="button"
                          class="flex flex-col gap-2 text-left"
                          @click="${() => void apply(t)}"
                        >
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
                              style="font-size:.6rem;text-transform:uppercase;"
                              >${t.mode}</span
                            >
                          </div>
                          ${mock(p)}
                          <div class="flex items-center gap-1.5">
                            ${[
                              "page",
                              "card",
                              "accent",
                              "border",
                              "text",
                              "textMuted",
                              "input",
                              "header",
                            ].map(
                              (role) =>
                                html`<span
                                  class="w-3.5 h-3.5 rounded-full"
                                  style="background:${p[role] ??
                                  "transparent"}; border:1px solid ${p.border ??
                                  "#374151"};"
                                ></span>`,
                            )}
                          </div>
                        </button>
                        <div
                          class="flex items-center justify-between gap-2 min-w-0"
                        >
                          <span
                            class="flex items-center gap-1 text-xs opacity-60 min-w-0"
                          >
                            <a
                              href="https://profile-v3.intra.42.fr/users/${t.author}"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="truncate hover:underline"
                              @click="${(e: Event) => e.stopPropagation()}"
                              >by ${t.author}</a
                            >
                            ${t.createdAt
                              ? html`<span class="flex-none"
                                  >· ${formatAbsoluteDateTime(t.createdAt)}</span
                                >`
                              : ""}
                          </span>
                          <button
                            type="button"
                            class="btn btn-xs btn-ghost flex-none gap-1 ${liked
                              ? "text-error"
                              : ""}"
                            @click="${() => void doLike(t)}"
                          >
                            <span>${liked ? "♥" : "♡"}</span>${t.likes ?? 0}
                          </button>
                        </div>
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

  const resolveDialogPreset = async () => {
    const p = (await getConfig("PROFILE_THEME_PRESET")) as string | undefined;
    const key = p || "";
    // Only use the preset for the dialog chrome when it's a real daisyUI
    // theme; custom (mine) ids need injected CSS and can render unstyled.
    dialogPreset =
      key && !key.startsWith("mine-") && THEMES[key] ? key : daisyTheme;
  };
  void resolveDialogPreset().then(draw);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (
      area === "local" &&
      (changes.PROFILE_THEME_PRESET || changes.PROFILE_THEME_CUSTOMS)
    ) {
      void resolveDialogPreset().then(draw);
    }
  });

  void load();
}
