import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { adoptShadowStyles } from "../../utils/shadow-styles.ts";
import { WORKER_URL } from "../../utils/worker.ts";
import { getConfig } from "../../config.ts";
import { THEMES } from "../profile/theme/theme-manager.ts";
import { HUB_INFO } from "./hubSettings.data.ts";
import X_SVG from "../../assets/svg/x.svg?raw";

const DIALOG_ID = "ft-changelog-dialog";
const CHANGELOG_URL = `${WORKER_URL}/gh/changelog.json`;
const MAX_VERSIONS = 3;

interface ChangelogEntry {
  version: string;
  date?: string;
  highlights: string[];
}

const closeIcon = () =>
  unsafeHTML(X_SVG.replace("<svg", '<svg width="20" height="20"'));

/** Opens the user-friendly "What's new" changelog, fetched from the repo. */
export function openChangelogDialog(): void {
  document.getElementById(DIALOG_ID)?.remove();

  const dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "bg-transparent backdrop:bg-black/50";
  dialog.style.cssText =
    "margin:auto; padding:0; border:none; max-width:40rem; width:calc(100dvw - 2rem);";

  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  adoptShadowStyles(shadow);

  let entries: ChangelogEntry[] = [];
  let loading = true;
  let error = false;
  let expanded = false;
  let dialogPreset = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";

  const resolveDialogPreset = async () => {
    const key = ((await getConfig("PROFILE_THEME_PRESET")) as string) || "";
    dialogPreset =
      key && THEMES[key]
        ? key
        : document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
  };

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const markSeen = () => {
    void chrome.storage.local
      .set({ CHANGELOG_LAST_SEEN_VERSION: HUB_INFO.version })
      .then(() => document.dispatchEvent(new CustomEvent("ft-changelog-seen")));
  };

  const onThemeChange = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ) => {
    if (
      area === "local" &&
      (changes.PROFILE_THEME_PRESET || changes.PROFILE_THEME_CUSTOMS)
    ) {
      void resolveDialogPreset().then(draw);
    }
  };

  const body = () => {
    if (loading) {
      return html`<div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md"></span>
      </div>`;
    }
    if (error || entries.length === 0) {
      return html`<div class="flex flex-col items-center gap-3 py-16">
        <span class="text-sm opacity-60"
          >Couldn't load what's new right now.</span
        >
        <button type="button" class="btn btn-sm" @click="${() => void load()}">
          Retry
        </button>
      </div>`;
    }
    return html`<div class="flex flex-col gap-6">
      ${(expanded ? entries : entries.slice(0, MAX_VERSIONS)).map(
        (entry, i) =>
          html`<div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="badge badge-primary badge-sm font-bold font-mono"
                >v${entry.version}</span
              >
              ${i === 0
                ? html`<span class="badge badge-success badge-sm font-bold"
                    >New</span
                  >`
                : ""}
              ${entry.date
                ? html`<span class="text-xs opacity-50">${entry.date}</span>`
                : ""}
              <div class="flex-1 h-px bg-base-300/50"></div>
            </div>
            <ul class="flex flex-col gap-1.5 pl-1">
              ${entry.highlights.map(
                (h) =>
                  html`<li class="flex gap-2 text-sm">
                    <span class="text-primary mt-0.5 flex-none">•</span>
                    <span class="opacity-90">${h}</span>
                  </li>`,
              )}
            </ul>
          </div>`,
      )}
      ${entries.length > MAX_VERSIONS
        ? html`<button
            type="button"
            class="btn btn-sm btn-ghost self-center"
            @click=${() => {
              expanded = !expanded;
              draw();
            }}
          >
            ${expanded
              ? "Show fewer"
              : `Show older versions (${entries.length - MAX_VERSIONS})`}
          </button>`
        : ""}
    </div>`;
  };

  const draw = () => {
    render(
      html`<div
        data-theme="${dialogPreset}"
        class="bg-base-100 text-base-content rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style="height:min(80vh,40rem);"
      >
        <div
          class="flex items-center justify-between gap-3 px-5 py-3 border-b border-base-300"
        >
          <div class="flex items-center gap-2 min-w-0">
            <h3 class="font-bold text-lg">What's new</h3>
            <span class="badge badge-sm font-mono opacity-70"
              >v${HUB_INFO.version}</span
            >
          </div>
          <button
            type="button"
            class="btn btn-circle btn-ghost btn-sm"
            @click=${close}
            aria-label="Close"
          >
            ${closeIcon()}
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-4">${body()}</div>
        <div
          class="flex items-center justify-between gap-2 px-5 py-3 border-t border-base-300"
        >
          <a
            href="${HUB_INFO.github}/releases"
            target="_blank"
            rel="noopener noreferrer"
            class="link text-sm"
            >See all releases</a
          >
          <button type="button" class="btn btn-sm btn-primary" @click=${close}>
            Got it
          </button>
        </div>
      </div>`,
      shadow,
    );
  };

  const load = async () => {
    loading = true;
    error = false;
    draw();
    try {
      const res = await fetch(`${CHANGELOG_URL}?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("bad status");
      const data = (await res.json()) as { entries?: ChangelogEntry[] };
      entries = (data.entries ?? [])
        .filter(
          (e) =>
            e && typeof e.version === "string" && Array.isArray(e.highlights),
        )
        .slice(0, MAX_VERSIONS);
    } catch {
      error = true;
    }
    loading = false;
    draw();
  };

  dialog.appendChild(host);
  document.body.appendChild(dialog);
  dialog.showModal();
  markSeen();
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  chrome.storage.onChanged.addListener(onThemeChange);
  dialog.addEventListener("close", () =>
    chrome.storage.onChanged.removeListener(onThemeChange),
  );

  void resolveDialogPreset().then(() => load());
}
