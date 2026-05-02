import { gmDeleteValue, gmGetValue, gmSetValue } from "../lib/gm.ts";
import {
  FEATURE_DEFS,
  HUB_INFO,
  FeatureId,
  STORAGE_KEY,
  FEATURE_IDS,
  HUB_SETTING_DEFS,
  type HubSettingDef,
} from "./hubSettings.data.ts";
import GEAR_SVG from "../assets/settings_gear.svg?raw";

async function ensureStyles() {
  if (document.getElementById("wa-styles-bundle")) return;

  const link = document.createElement("link");
  link.id = "wa-styles-bundle";
  link.rel = "stylesheet";
  link.href =
    "https://cdn.jsdelivr.net/npm/@awesome.me/webawesome@latest/dist/styles/themes/default.css";

  document.head.appendChild(link);
}

async function loadComponents() {
  await Promise.all([
    import("@awesome.me/webawesome/dist/components/dialog/dialog.js"),
    import("@awesome.me/webawesome/dist/components/switch/switch.js"),
    import("@awesome.me/webawesome/dist/components/color-picker/color-picker.js"),
    import("@awesome.me/webawesome/dist/components/number-input/number-input.js"),
    import("@awesome.me/webawesome/dist/components/tab-group/tab-group.js"),
    import("@awesome.me/webawesome/dist/components/tab/tab.js"),
    import("@awesome.me/webawesome/dist/components/tab-panel/tab-panel.js"),
    import("@awesome.me/webawesome/dist/components/button/button.js"),
    import("@awesome.me/webawesome/dist/components/card/card.js"),
    import("@awesome.me/webawesome/dist/components/badge/badge.js"),
    import("@awesome.me/webawesome/dist/components/select/select.js"),
    import("@awesome.me/webawesome/dist/components/option/option.js"),
    import("@awesome.me/webawesome/dist/components/radio-group/radio-group.js"),
    import("@awesome.me/webawesome/dist/components/radio/radio.js"),
    import("@awesome.me/webawesome/dist/components/divider/divider.js"),
  ]);
}

function normalizeActive(raw: unknown): FeatureId[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) {
    return FEATURE_DEFS.map((f) => f.id);
  }
  const ids = parsed.filter((v): v is FeatureId =>
    FEATURE_IDS.has(v as FeatureId),
  );
  return ids.length ? ids : FEATURE_DEFS.map((f) => f.id);
}

export function getActiveFeatures(): FeatureId[] {
  const raw = gmGetValue<unknown>(STORAGE_KEY, null);
  const active = normalizeActive(raw);
  gmSetValue(STORAGE_KEY, JSON.stringify(active));
  return active;
}

function findSidebarMainGroup(): HTMLDivElement | null {
  const profileLink = document.querySelector<HTMLAnchorElement>(
    'a[href="https://profile-v3.intra.42.fr"]',
  );
  return (
    profileLink?.closest<HTMLDivElement>("div.flex.flex-col.w-full") ||
    document.querySelector<HTMLDivElement>(
      "div.flex.flex-col.w-full:not(.pb-16)",
    )
  );
}

function findLegacyNavList(): HTMLDivElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLDivElement>("div._"),
  );
  return (
    candidates.find(
      (root) =>
        (!!root.querySelector('a[href="https://profile.intra.42.fr"]') ||
          !!root.querySelector('a[href="https://projects.intra.42.fr"]')) &&
        root.querySelectorAll(":scope > li").length > 0,
    ) || null
  );
}

function applyDefaultSettingValue(
  control: HTMLElement,
  def: HubSettingDef,
): void {
  const anyDef = def as any;
  const value =
    anyDef.defaultValue ??
    anyDef.default ??
    (def.kind === "toggle" ? false : "");
  if ("checked" in control && def.kind === "toggle")
    (control as any).checked = Boolean(value);
  else if ("value" in control) (control as any).value = String(value);
}

function resetFeatureSettings(dialog: HTMLElement, featureId: FeatureId): void {
  for (const def of HUB_SETTING_DEFS[featureId] ?? []) {
    gmDeleteValue(def.key);
    const control = dialog.querySelector<any>(
      `[data-setting-key="${def.key}"]`,
    );
    if (control) applyDefaultSettingValue(control, def);
  }
}

function renderSetting(def: HubSettingDef, enabled: boolean): string {
  const storedValue = gmGetValue<unknown>(def.key, null);
  const value = storedValue !== null ? storedValue : (def.defaultValue ?? "");
  const disabledAttr = enabled ? "" : "disabled";
  let control = "";

  if (def.kind === "toggle") {
    control = `<wa-switch data-setting-key="${def.key}" ${value ? "checked" : ""} ${disabledAttr}></wa-switch>`;
  } else if (def.kind === "number") {
    control = `<wa-number-input
                value="${value}"
                ${disabledAttr}
                without-steppers 
                data-setting-key="${def.key}" 
                style="width: 100px;">
              </wa-number-input>`;
  } else if (def.kind === "select") {
    control = `<wa-select 
                data-setting-key="${def.key}" 
                value="${value}" 
                ${disabledAttr} 
                style="width: 160px;"
                hoist>
                ${(def.options ?? [])
                  .map(
                    (o) =>
                      `<wa-option 
                    value="${o.value}">${o.label}
                  </wa-option>
                `,
                  )
                  .join("")}
              </wa-select>`;
  } else if (def.kind === "radio-group") {
    control = `<wa-radio-group
                data-setting-key="${def.key}"
                name="${def.key}" 
                value="${value}"
                orientation="horizontal"
                ${disabledAttr}
              >
                ${(def.options ?? [])
                  .map(
                    (o) => `
                  <wa-radio 
                    appearance="button"
                    value="${o.value}"
                  >
                    ${o.label}
                  </wa-radio>
                `,
                  )
                  .join("")}
              </wa-radio-group>`;
  } else if (def.kind === "color") {
    control = `<wa-color-picker
                data-setting-key="${def.key}"
                value="${value}"
                ${disabledAttr}
                opacity>
              </wa-color-picker>`;
  } else if (def.kind === "text") {
    control = `<wa-input
                data-setting-key="${def.key}"
                value="${value}"
                style="width: 400px;"
                ${disabledAttr}>
              </wa-input>`;
  } else if (def.kind === "divider") {
   return `
    <div class="hub-divider-container" style="margin: 28px 0 12px 0; width: 100%;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="
          font-size: 11px; 
          font-weight: 800; 
          color: #94a3b8; 
          text-transform: uppercase; 
          letter-spacing: 0.05em;
          white-space: nowrap;
        ">
          ${def.label}
        </span>
        <div style="flex: 1; height: 1px; background-color: #e2e8f0;"></div>
      </div>
    </div>`;
  } else {
    control = `<wa-input
                data-setting-key="${def.key}"
                value="${value}"
                ${disabledAttr}>
              </wa-input>`;
  }
  const gridClass = def.grid === true ? "" : "hub-setting-span-full";
  return `
    <wa-card class="card-basic ${gridClass}">
      <div class="hub-setting-card">
        <div class="hub-setting-info" style="display: flex; flex-direction: column; flex: 1;">
          <span style="font-weight: 600;">${def.label}</span>
          <small style="opacity: 0.7;">${def.desc}</small>
        </div>
        <div class="hub-setting-control">
          ${control}
        </div>
      </div>
    </wa-card>`;
}

function createModal(active: FeatureId[]): void {
  let dialog = document.getElementById("hub-dialog") as any;
  if (!dialog) {
    dialog = document.createElement("wa-dialog");
    dialog.id = "hub-dialog";
    dialog.style.setProperty("--width", "850px");
    document.body.appendChild(dialog);
  }

  const tabsHtml = FEATURE_DEFS.map(
    (f) => `
  <wa-tab slot="nav" panel="${f.id}" class="hub-header-tab" style="height: auto;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <wa-icon name="${f.icon}" style="font-size: 1.2rem;"></wa-icon>
      <span style="font-weight: 500;">${f.name}</span>
    </div>
  </wa-tab>
`,
  ).join("");

  const panels = FEATURE_DEFS.map((f) => {
    const enabled = active.includes(f.id);
    const settings = (HUB_SETTING_DEFS[f.id] || [])
      .map((def) => renderSetting(def, enabled))
      .join("");

    return `
  <wa-tab-panel name="${f.id}">
    <div class="hub-panel ${enabled ? "" : "hub-is-disabled"}" data-feature-panel="${f.id}">
      
      <wa-card class="hub-feature-main-card">
        <div class="hub-panel-info">
          <div class="hub-panel-text-content">
            <div class="hub-feature-title-large" style="font-size: 1.2rem; font-weight: bold;">${f.name}</div>
            <div class="hub-desc" style="font-size: 0.9rem; opacity: 0.8;">${f.desc}</div>
          </div>
          <div class="hub-panel-actions" style="display: flex; align-items: center; gap: 10px;">
            <wa-button variant="danger" appearance="outlined" size="small" data-reset-feature="${f.id}">Reset</wa-button>
            <wa-switch style="--width: 60px; --height: 32px; --thumb-size: 28px;" class="hub-feature-toggle" data-id="${f.id}" ${enabled ? "checked" : ""}></wa-switch>
          </div>
        </div>
      </wa-card>
      <div class="hub-feature-settings">
        ${settings}
      </div>
      
    </div>
  </wa-tab-panel>`;
  }).join("");

  dialog.innerHTML = `
  <div slot="label" class="hub-title">42+ Hub</div>

  <div class="hub-body">
    <wa-tab-group placement="top" class="hub-main-tabs">
      ${tabsHtml}
      ${panels}
    </wa-tab-group>
  </div>

  <div slot="footer" class="hub-footer-content">
    <div class="hub-footer-info-group">
      <wa-badge variant="neutral" pill size="small">${HUB_INFO.name}</wa-badge>
      <wa-badge variant="neutral" pill size="small">${HUB_INFO.version}</wa-badge>
      <wa-badge variant="success" pill size="small">MIT</wa-badge>
      
      <span class="hub-separator"></span>

      <wa-badge href="${HUB_INFO.github}" target="_blank" class="hub-footer-link">GitHub</wa-badge>
      <wa-badge href="${HUB_INFO.issues}" target="_blank" class="hub-footer-link">Report issue</wa-badge>
    </div>

    <wa-button variant="success" id="hub-save" size="medium">Save & Reload</wa-button>
  </div>
`;

  dialog
    .querySelectorAll("wa-switch.hub-feature-toggle")
    .forEach((toggle: any) => {
      toggle.addEventListener("wa-change", (e: any) => {
        const id = e.target.dataset.id;
        const isEnabled = e.target.checked;
        const panel = dialog.querySelector(`[data-feature-panel="${id}"]`);
        const tab = dialog.querySelector(`wa-tab[panel="${id}"]`);

        panel?.classList.toggle("hub-is-disabled", !isEnabled);
        tab?.classList.toggle("hub-is-disabled", !isEnabled);
        panel
          ?.querySelectorAll("[data-setting-key]")
          .forEach((c: any) => (c.disabled = !isEnabled));
      });
    });

  dialog.querySelectorAll("[data-reset-feature]").forEach((btn: any) => {
    btn.addEventListener("click", () =>
      resetFeatureSettings(dialog, btn.dataset.resetFeature),
    );
  });

  dialog.querySelector("#hub-save")?.addEventListener("click", () => {
    saveHubState(dialog);
    location.reload();
  });
}

function saveHubState(dialog: HTMLElement): FeatureId[] {
  const selected = Array.from(
    dialog.querySelectorAll<any>("wa-switch.hub-feature-toggle"),
  )
    .filter((sw) => sw.checked)
    .map((sw) => sw.dataset.id as FeatureId);

  gmSetValue(STORAGE_KEY, JSON.stringify(selected));
  dialog.querySelectorAll<any>("[data-setting-key]").forEach((control) => {
    const key = control.dataset.settingKey;
    const val = control.tagName.includes("SWITCH")
      ? control.checked
      : control.value;
    if (val === "" || val === null) gmDeleteValue(key);
    else gmSetValue(key, val);
  });
  return selected;
}

export function mountGearButton(): void {
  const open = async () => {
    let dialog = document.getElementById("hub-dialog") as any;
    if (!dialog) {
      await ensureStyles();
      await loadComponents();
      createModal(getActiveFeatures());
      dialog = document.getElementById("hub-dialog");
    }
    await customElements.whenDefined("wa-dialog");
    dialog?.show();
  };
  const sidebar = findSidebarMainGroup();
  const legacy = findLegacyNavList();

  if (document.getElementById("hub-gear-btn")) return;

  if (sidebar) {
    const a = document.createElement("a");
    a.id = "hub-gear-btn";
    a.className =
      "py-5 w-full flex justify-center hover:opacity-100 opacity-40";
    a.innerHTML = GEAR_SVG;
    a.onclick = (e) => {
      e.preventDefault();
      open();
    };
    sidebar.appendChild(a);
  } else if (legacy) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.id = "hub-gear-btn";
    a.innerHTML = GEAR_SVG;
    a.onclick = (e) => {
      e.preventDefault();
      open();
    };
    li.appendChild(a);
    legacy.appendChild(li);
  }
}

export function initHubSettings(): FeatureId[] {
  const active = getActiveFeatures();
  mountGearButton();
  const hubInterval = setInterval(mountGearButton, 500);
  setTimeout(() => clearInterval(hubInterval), 10000);
  return active;
}
