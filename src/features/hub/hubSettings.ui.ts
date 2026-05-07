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

function renderSetting(def: HubSettingDef, enabled: boolean): string {
  const storedValue = gmGetValue<unknown>(def.key, null);
  const value = storedValue !== null ? storedValue : (def.defaultValue ?? "");
  const disabledAttr = enabled ? "" : "disabled";
  let control = "";

  switch (def.kind) {
    case "toggle":
      control = `<input type="checkbox" class="toggle toggle-accent" 
                data-setting-key="${def.key}" ${value ? "checked" : ""} ${disabledAttr} />`;
      break;

    case "number":
      control = `<input type="number" class="input input-accent w-24 input-sm" 
                value="${value}" data-setting-key="${def.key}" ${disabledAttr} />`;
      break;

    case "select":
      control = `
      <select class="select select-accent select-sm" data-setting-key="${def.key}" ${disabledAttr}>
        ${(def.options ?? []).map((o) => `<option value="${o.value}" ${o.value === value ? "selected" : ""}>${o.label}</option>`).join("")}
      </select>`;
      break;

    case "color":
      control = `<input type="color" class="input input-accent p-1 w-20 h-10" 
                value="${value}" data-setting-key="${def.key}" ${disabledAttr} />`;
      break;

    case "radio-group":
      control = `
    <div class="flex flex-wrap gap-2 sm:gap-4">
      ${(def.options ?? [])
        .map(
          (o) => `
        <label class="label cursor-pointer gap-2 py-1">
          <span class="label-text text-xs sm:text-sm">${o.label}</span>
          <input type="radio" name="${def.key}" value="${o.value}" class="radio radio-accent radio-xs sm:radio-sm" 
            ${o.value === value ? "checked" : ""} data-setting-key="${def.key}" ${disabledAttr} />
        </label>
      `,
        )
        .join("")}
    </div>`;
      break;

    case "divider":
      return `<div class="divider font-bold my-6 col-span-full opacity-70">${def.label}</div>`;

    case "url":
      control = `
    <div class="w-full">
      <label class="input input-accent validator flex items-center gap-2 w-full">
        <svg class="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></g></svg>
        <input
          type="url"
          required
          placeholder="https://example.com"
          value="${value}" 
          data-setting-key="${def.key}" 
          ${disabledAttr}
          pattern="^(https?://)?.*" 
          class="grow"
        />
      </label>
    </div>`;
      break;
    case "text":
    default:
      control = `<input type="text" 
                class="input input-bordered w-full input-sm" 
                value="${value || ""}" data-setting-key="${def.key}" ${disabledAttr} />`;
      break;
  }
  const isFullWidth = def.fullWidth ?? def.kind === "url";
  const gridClass = def.grid === true ? "" : "col-span-full";

  return `
    <div class="card bg-base-200 shadow-sm p-3 sm:p-4 ${gridClass}">
      <div class="flex ${isFullWidth ? "flex-col" : "flex-col sm:flex-row sm:items-center"} justify-between gap-3 sm:gap-4">
        <div class="flex flex-col">
          <span class="text-sm">${def.label}</span>
          ${def.desc ? `<span class="text-s opacity-50">${def.desc}</span>` : ""}
        </div>
        <div class="${isFullWidth ? "w-full" : "flex-none self-end sm:self-auto"}">
          ${control}
        </div>
      </div>
    </div>`;
}

function createModal(active: FeatureId[]): void {
  let dialog = document.getElementById("hub-dialog") as HTMLDialogElement;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "hub-dialog";
    dialog.className = "modal-box hub-modal-box p-0 overflow-hidden bg-base-100 rounded-3xl shadow-2xl border-none outline-none";
    dialog.innerHTML = `
      <div
        class="modal-box hub-modal-box p-0 overflow-hidden bg-base-100 rounded-3xl shadow-2xl flex flex-col relative"        style="
          width:min(900px, calc(100dvw - 2rem));
          height:min(600px, calc(100dvh - 2rem));
          max-width:min(900px, calc(100dvw - 2rem));
          max-height:min(600px, calc(100dvh - 2rem));
        "
      >
        <div id="hub-shadow-wrapper"></div>
      </div>
    `;
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

  const tabsContent = FEATURE_DEFS.map((f, idx) => {
    const enabled = active.includes(f.id);
    const settings = (HUB_SETTING_DEFS[f.id] || [])
      .map((def) => renderSetting(def, enabled))
      .join("");

    return `
      <input type="radio" name="hub_tabs" role="tab" class="tab whitespace-nowrap!" aria-label="${f.name}" ${idx === 0 ? "checked" : ""} />
      <div role="tabpanel" class="tab-content bg-base-100 border-base-300 p-0 overflow-y-auto">
        <div class="flex flex-col ${enabled ? "" : "opacity-40 grayscale"}" data-feature-panel="${f.id}">
          
          <div class="sticky top-0 z-20 flex items-center justify-between bg-base-200 px-6 py-4 border-b border-base-300 shadow-sm">
            <div class="flex flex-col">
              <h2 class="text-lg font-bold leading-tight">${f.name}</h2>
              <p class="text-s opacity-70">${f.desc}</p>
            </div>
            <div class="flex items-center gap-3">
              <button class="btn btn-sm btn-outline btn-error" data-reset-feature="${f.id}">Reset</button>
              <input type="checkbox" class="toggle toggle-xl toggle-primary hub-feature-toggle" data-id="${f.id}" ${enabled ? "checked" : ""} />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
            ${settings}
          </div>
        </div>
      </div>
    `;
  }).join("");

  shadow.innerHTML = `
    <style>
      :host { display: block; height: 100%; width: 100%; }
      font-family: ${INTRA_FONT};
      input, button, select, textarea, .tab, h2, h3 {
      font-family: ${INTRA_FONT} !important;
    }
      ${HUB_CSS}
      .tab-content { height: 100%; overflow-y: auto; }
    </style>
    <div class="flex flex-col h-full text-base-content bg-base-100" data-theme="dark">
      <div class="flex-none flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100 z-10">
        <div>
          <h3 class="font-bold text-xl tracking-tight">${HUB_INFO.name} </h3>
          <p class="text-[10px] uppercase opacity-40 font-bold tracking-widest">${HUB_INFO.version}</p>
        </div>
        <button class="btn btn-sm btn-circle btn-ghost" onclick="this.getRootNode().host.closest('dialog').close()">✕</button>
      </div>

      <div role="tablist" class="tabs tabs-lifted flex-1 overflow-hidden">
        ${tabsContent}
      </div>

    <div class="flex-none p-4 border-t border-base-200 bg-base-200/50 flex justify-between items-center">
      <a href="${HUB_INFO.github}" target="_blank" class="btn btn-ghost btn-sm opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2 px-3">
        <img 
          src="https://cdn.simpleicons.org/github/white" 
          alt="GitHub" 
          class="w-4 h-4" 
        />
        <span class="text-xs font-bold">GitHub</span>
      </a>
      <button id="hub-save" class="btn btn-primary px-8 font-bold">Save & Reload</button>
    </div>
  `;

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
