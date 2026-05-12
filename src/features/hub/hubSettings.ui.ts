import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { gmDeleteValue, gmGetValue, gmSetValue } from "../../lib/gm.ts";
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
} from "../shortcuts/shortcuts.ui.ts";
import HUB_CSS from "../../assets/style.css?inline";

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
  const storedValue = gmGetValue<unknown>(def.key, null);
  const value = storedValue !== null ? storedValue : (def.defaultValue ?? "");

  if (def.kind === "custom" && def.key === "SHORTCUTS_LINKS") {
    const container = document.createElement("div");
    let links = getStoredLinks(gmGetValue);

    const save = () => {
      links = extractLinksFromForm(container);
      gmSetValue("SHORTCUTS_LINKS", JSON.stringify(links));
    };

    const update = () => {
      render(
        renderShortcutsSettings(
          links,
          () => {
            if (links.length < 8) {
              links = [...links, { name: "", url: "", color: "#7dd3fc" }];
              update();
            }
          },
          (idx) => {
            links = links.filter((_, i) => i !== idx);
            gmSetValue("SHORTCUTS_LINKS", JSON.stringify(links));
            update();
          },
          () => save(),
          () => update(),
        ),
        container,
      );
    };

    update();
    return container;
  }

  switch (def.kind) {
    case "toggle":
      return html`<input
        type="checkbox"
        class="toggle toggle-accent"
        data-setting-key="${def.key}"
        ?checked="${Boolean(value)}"
        ?disabled="${!enabled}"
      />`;

    case "number":
      return html`<input
        type="number"
        class="input input-accent w-24 input-sm"
        .value="${String(value)}"
        data-setting-key="${def.key}"
        ?disabled="${!enabled}"
      />`;

    case "select":
      return html`<select
        class="select select-accent select-sm"
        data-setting-key="${def.key}"
        ?disabled="${!enabled}"
      >
        ${(def.options ?? []).map(
          (o) =>
            html`<option value="${o.value}" ?selected="${o.value === value}">
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
            placeholder="https://example.com"
            .value="${String(value)}"
            data-setting-key="${def.key}"
            ?disabled="${!enabled}"
            pattern="^(https?://)?.*"
            class="grow"
          />
        </label>
      </div>`;

    case "text":
    default:
      return html`<input
        type="text"
        class="input input-bordered w-full input-sm"
        .value="${String(value || "")}"
        data-setting-key="${def.key}"
        ?disabled="${!enabled}"
      />`;
  }
}

function renderSetting(def: HubSettingDef, enabled: boolean) {
  if (def.kind === "divider") {
    return html`<div class="divider font-bold my-6 col-span-full opacity-70">
      ${def.label}
    </div>`;
  }

  const isFullWidth =
    def.fullWidth ?? (def.kind === "url" || def.kind === "custom");
  const gridClass = def.grid === true ? "" : "col-span-full";

  return html`<div class="card bg-base-200 shadow-sm p-3 sm:p-4 ${gridClass}">
    <div
      class="flex ${isFullWidth
        ? "flex-col"
        : "flex-col sm:flex-row sm:items-center"} justify-between gap-3 sm:gap-4"
    >
      <div class="flex flex-col">
        <span class="text-sm">${def.label}</span>
        ${def.desc
          ? html`<span class="text-s opacity-50">${def.desc}</span>`
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

function getInitialTheme() {
  const saved = gmGetValue<string>("BETTER_INTRA_THEME", "");
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

function renderTabsContent(active: FeatureId[]) {
  return FEATURE_DEFS.map((f, idx) => {
    const enabled = active.includes(f.id);
    const settings = (HUB_SETTING_DEFS[f.id] || []).map((def) =>
      renderSetting(def, enabled),
    );

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
          class="flex flex-col ${enabled ? "" : "opacity-40 grayscale"}"
          data-feature-panel="${f.id}"
        >
          <div
            class="sticky top-0 z-20 flex items-center justify-between bg-base-200 px-6 py-4 border-b border-base-300 shadow-sm"
          >
            <div class="flex flex-col">
              <h2 class="text-lg font-bold leading-tight">${f.name}</h2>
              <p class="text-s opacity-70">${f.desc}</p>
            </div>
            <div class="flex items-center gap-3">
              <button
                class="btn btn-sm btn-outline btn-error flex items-center gap-2"
                data-reset-feature="${f.id}"
              >
                <span class="size-3.5 flex items-center justify-center">
                  ${resetIconSvg}
                </span>
                Reset
              </button>
              <input
                type="checkbox"
                class="toggle toggle-xl toggle-primary hub-feature-toggle"
                data-id="${f.id}"
                ?checked="${enabled}"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
            ${settings}
          </div>
        </div>
      </div>`;
  });
}

function renderDialogShell(): ReturnType<typeof html> {
  return html`<div
    class="modal-box hub-modal-box p-0 overflow-hidden bg-base-100 rounded-3xl shadow-2xl flex flex-col relative"
    style="
      width: min(900px, calc(100dvw - 2rem));
      height: min(600px, calc(100dvh - 2rem));
      max-width: min(900px, calc(100dvw - 2rem));
      max-height: min(600px, calc(100dvh - 2rem));
    "
  >
    <div id="hub-shadow-wrapper"></div>
  </div>`;
}

function createModal(active: FeatureId[]): void {
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

    const box = dialog.querySelector(".hub-modal-box") as HTMLElement;
    const applyDesktopLock = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        box.style.width = "900px";
        box.style.height = "650px";
        box.style.maxWidth = "900px";
        box.style.maxHeight = "650px";
      } else {
        box.style.width = "min(900px, calc(100dvw - 2rem))";
        box.style.height = "min(650px, calc(100dvh - 2rem))";
        box.style.maxWidth = "min(900px, calc(100dvw - 2rem))";
        box.style.maxHeight = "min(650px, calc(100dvh - 2rem))";
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

  const currentTheme = getInitialTheme();
  const tabsContent = renderTabsContent(active);

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
      ${unsafeHTML(HUB_CSS)} .tab-content {
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
          <p class="text-[14px] opacity-40 font-bold tracking-widest">
            v${HUB_INFO.version}
          </p>
        </div>
        <button
          class="btn btn-sm btn-circle btn-ghost"
          @click="${() => dialog.close()}"
        >
          ✕
        </button>
      </div>

      <div role="tablist" class="tabs tabs-border flex-1 overflow-hidden">
        ${tabsContent}
      </div>

      <div
        class="flex-none p-4 border-t border-base-200 bg-base-200/50 flex justify-between items-center"
      >
        <div class="flex items-center gap-3">
          <a
            href="${HUB_INFO.github}"
            target="_blank"
            class="btn btn-ghost btn-sm opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2 px-3"
          >
            <img
              src="https://cdn.simpleicons.org/github/white"
              alt="GitHub"
              class="w-4 h-4"
              style="${currentTheme === "light"
                ? "filter: invert(1) brightness(0);"
                : ""}"
            />
            <span class="text-xs font-bold">GitHub</span>
          </a>

          <label class="swap swap-rotate btn btn-sm btn-circle btn-ghost">
            <input
              type="checkbox"
              id="hub-theme-toggle"
              ?checked="${currentTheme === "dark"}"
            />
            ${sunIconSvg} ${moonIconSvg}
          </label>
        </div>
        <button
          id="hub-save"
          class="btn btn-primary px-8 font-bold flex items-center gap-2"
        >
          <span class="size-4 flex items-center justify-center">
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

  themeToggle?.addEventListener("change", () => {
    const newTheme = themeToggle.checked ? "dark" : "light";

    hubContainer?.setAttribute("data-theme", newTheme);
    gmSetValue("BETTER_INTRA_THEME", newTheme);

    if (ghIcon) {
      ghIcon.style.filter =
        newTheme === "light" ? "invert(1) brightness(0)" : "none";
    }
  });

  const saveBtn = shadow.querySelector("#hub-save");
  saveBtn?.addEventListener("click", () => {
    saveHubState(shadow);
    location.reload();
  });

  shadow.querySelectorAll("input.hub-feature-toggle").forEach((toggle: any) => {
    toggle.addEventListener("change", () => {
      const id = toggle.dataset.id;
      const isEnabled = toggle.checked;
      const panel = shadow.querySelector(`[data-feature-panel="${id}"]`);
      panel?.classList.toggle("opacity-40", !isEnabled);
      panel?.classList.toggle("grayscale", !isEnabled);
      panel
        ?.querySelectorAll("[data-setting-key]")
        .forEach((c: any) => (c.disabled = !isEnabled));
    });
  });

  shadow.querySelectorAll("[data-reset-feature]").forEach((btn: any) => {
    btn.addEventListener("click", () =>
      resetFeatureSettings(shadow, btn.dataset.resetFeature),
    );
  });
}

function saveHubState(root: ShadowRoot | HTMLElement): FeatureId[] {
  const selected = Array.from(
    root.querySelectorAll<HTMLInputElement>("input.hub-feature-toggle"),
  )
    .filter((sw) => sw.checked)
    .map((sw) => sw.dataset.id as FeatureId);

  gmSetValue(STORAGE_KEY, JSON.stringify(selected));

  const keys = new Set<string>();
  root.querySelectorAll("[data-setting-key]").forEach((el) => {
    keys.add((el as HTMLElement).dataset.settingKey!);
  });

  keys.forEach((key) => {
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
      gmDeleteValue(key);
    } else {
      gmSetValue(key, val);
    }
  });

  const shortcutsPanel = root.querySelector(
    '[data-shortcuts-panel="true"]',
  ) as HTMLElement | null;
  if (shortcutsPanel) {
    const links = extractLinksFromForm(shortcutsPanel);

    if (links.length > 0) {
      gmSetValue("SHORTCUTS_LINKS", JSON.stringify(links));
    } else {
      gmDeleteValue("SHORTCUTS_LINKS");
    }
  }

  return selected;
}

function resetFeatureSettings(
  root: ShadowRoot | HTMLElement,
  featureId: FeatureId,
): void {
  for (const def of HUB_SETTING_DEFS[featureId] ?? []) {
    gmDeleteValue(def.key);
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
  }
}
