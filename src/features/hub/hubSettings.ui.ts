import { gmDeleteValue, gmGetValue, gmSetValue } from "../../lib/gm.ts";
import {
  FEATURE_DEFS,
  HUB_INFO,
  FeatureId,
  STORAGE_KEY,
  HUB_SETTING_DEFS,
  type HubSettingDef,
} from "./hubSettings.data.ts";
import HUB_CSS from "../../assets/style.css?inline";

export async function openHubModal(active: FeatureId[]) {
  await ensureStyles();
  await loadComponents();

  let dialog = document.getElementById("hub-dialog") as any;
  if (!dialog) {
    createModal(active);
    dialog = document.getElementById("hub-dialog");
  }

  await customElements.whenDefined("wa-dialog");
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  dialog?.show();
  dialog.addEventListener("wa-after-hide", () => {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  });
}

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
    import("@awesome.me/webawesome/dist/components/tooltip/tooltip.js"),
  ]);
}

function renderSetting(def: HubSettingDef, enabled: boolean): string {
  const storedValue = gmGetValue<unknown>(def.key, null);
  const value = storedValue !== null ? storedValue : (def.defaultValue ?? "");
  const disabledAttr = enabled ? "" : "disabled";
  let control = "";

  if (def.kind === "toggle") {
    control = `<wa-switch
                style="--width: 48px; --height: 24px; --thumb-size: 20px;"
                data-setting-key="${def.key}" ${value ? "checked" : ""}
                 ${disabledAttr}
                 >
                 </wa-switch>`;
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
                with-clear
                style="width: 400px;"
                ${disabledAttr}>
              </wa-input>`;
  } else if (def.kind === "url") {
    control = `<wa-input
                data-setting-key="${def.key}"
                value="${value}"
                inputmode="url"
                placeholder="PNG/GIF/JPEG URL"
                type="url"
                with-clear
                style="width: 400px;"
                ${disabledAttr}>
              </wa-input>`;
  } else if (def.kind === "divider") {
    return `
        <div style="display: flex; align-items: center; gap: 15px; width: 100%; justify-content: center;">
            <wa-divider style="--width: 4px; flex: 1;"></wa-divider>
            <span style="white-space: nowrap; font-weight: bold;">
                ${def.label}
            </span>
            <wa-divider style="--width: 4px; flex: 1;"></wa-divider>
        </div>
        `;
  } else {
    control = `<wa-input
                data-setting-key="${def.key}"
                value="${value}"
                ${disabledAttr}>
              </wa-input>`;
  }
  const cardId = `hub-card-${def.key}`;
  const triggerId = `trigger-${def.key}`;
  const tooltip = def.desc
    ? `
    <wa-tooltip for="${triggerId}" placement="top" without-arrow show-delay="150">
      ${def.desc}
    </wa-tooltip>
  `
    : "";
  const gridClass = def.grid === true ? "" : "hub-setting-span-full";

  return `
  <wa-card id="${cardId}" class="card-basic ${gridClass}">
    <div class="hub-setting-card">
      <div class="hub-setting-info" style="display: flex; align-items: center; gap: 6px;">
        <span class="setting-label-text">${def.label}</span>
        <wa-badge id="${triggerId}" variant="brand" style="font-size: 8px; width: 14px; height: 14px; padding: 0; display: inline-flex; align-items: center; justify-content: center; min-height: 0; min-width: 0;" pill>i</wa-badge>
      </div>
      <div class="hub-setting-control">
        ${control}
      </div>
    </div>
  </wa-card>
  ${tooltip}
`;
}

function createModal(active: FeatureId[]): void {
  let dialog = document.getElementById("hub-dialog") as any;
  if (!dialog) {
    dialog = document.createElement("wa-dialog");
    dialog.id = "hub-dialog";
    dialog.lightDismiss = true;
    dialog.style.setProperty("--width", "900px");
    dialog.innerHTML = `
        <div slot="label" class="hub-dialog-header">
          <div class="hub-header-left">
            <span class="hub-title">${HUB_INFO.name}</span>
            <wa-badge 
              variant="neutral" 
              appearance="outlined" 
              pill 
              size="small" 
              class="hub-version-badge"
            >
              ${HUB_INFO.version}
            </wa-badge>
          </div>
        </div>
        <div id="hub-shadow-wrapper"></div>
    `;
    document.body.appendChild(dialog);
  }
  const wrapper = dialog.querySelector("#hub-shadow-wrapper");
  const shadow = wrapper.shadowRoot || wrapper.attachShadow({ mode: "open" });

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
            <div class="hub-feature-title-large">${f.name}</div>
            <div class="hub-desc">${f.desc}</div>
          </div>
          <div class="hub-panel-actions">
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

  const metaSection = `
    <wa-divider slot="nav" style="margin: 16px 16px ; --width: 3px;"></wa-divider>  
      <a slot="nav" href="${HUB_INFO.github}" target="_blank" class="hub-sidebar-link">
        <wa-icon name="github" family="brands"></wa-icon>
        <span>GitHub</span>
      </a>
    `;

  shadow.innerHTML = `
<style>${HUB_CSS}</style>
<div id="hub-sidebar-layout">
  <div id="hub-sidebar-left">
    <wa-tab-group placement="start" class="hub-main-tabs">
      ${tabsHtml}
      ${metaSection}
      ${panels}
    </wa-tab-group>
    <div id="hub-sidebar-footer">
      <wa-button id="hub-save" variant="success" size="medium" pill>
        <wa-icon name="floppy-disk"></wa-icon>
        Save
      </wa-button>
    </div>
  </div>
</div>
`;

  const floatingFooter = shadow.querySelector("#hub-floating-footer");
  const saveBtn = shadow.querySelector("#hub-save");

  const triggerSave = () => {
    if (floatingFooter?.classList.contains("hub-footer-hidden")) {
      floatingFooter.classList.replace(
        "hub-footer-hidden",
        "hub-footer-visible",
      );
    }
  };

  saveBtn?.addEventListener("click", () => {
    saveHubState(shadow);
    location.reload();
  });

  shadow.addEventListener("wa-change", triggerSave);
  shadow.addEventListener("input", (e: any) => {
    if (e.target.dataset.settingKey) triggerSave();
  });

  shadow
    .querySelectorAll("wa-switch.hub-feature-toggle")
    .forEach((toggle: any) => {
      toggle.addEventListener("click", (e: any) => {
        console.log("Toggle activé via click");

        const id = toggle.dataset.id;
        const isEnabled = toggle.checked;

        const panel = shadow.querySelector(`[data-feature-panel="${id}"]`);
        const tab = shadow.querySelector(`wa-tab[panel="${id}"]`);

        panel?.classList.toggle("hub-is-disabled", !isEnabled);
        tab?.classList.toggle("hub-is-disabled", !isEnabled);

        panel
          ?.querySelectorAll("[data-setting-key]")
          .forEach((c: any) => (c.disabled = !isEnabled));

        triggerSave();
      });
    });

  shadow.querySelectorAll("[data-reset-feature]").forEach((btn: any) => {
    btn.addEventListener("click", () => {
      resetFeatureSettings(shadow as any, btn.dataset.resetFeature);
      triggerSave();
    });
  });

  shadow.querySelector("#hub-save")?.addEventListener("click", () => {
    saveHubState(shadow);
    location.reload();
  });
}

function saveHubState(root: ShadowRoot | HTMLElement): FeatureId[] {
  const selected = Array.from(
    root.querySelectorAll<any>("wa-switch.hub-feature-toggle"),
  )
    .filter((sw) => sw.checked)
    .map((sw) => sw.dataset.id as FeatureId);

  gmSetValue(STORAGE_KEY, JSON.stringify(selected));
  root.querySelectorAll<any>("[data-setting-key]").forEach((control) => {
    const key = control.dataset.settingKey;
    const val = control.tagName.includes("SWITCH")
      ? control.checked
      : control.value;
    if (val === "" || val === null) gmDeleteValue(key);
    else gmSetValue(key, val);
  });
  return selected;
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

function resetFeatureSettings(
  root: ShadowRoot | HTMLElement,
  featureId: FeatureId,
): void {
  for (const def of HUB_SETTING_DEFS[featureId] ?? []) {
    gmDeleteValue(def.key);
    const control = root.querySelector<any>(`[data-setting-key="${def.key}"]`);
    if (control) applyDefaultSettingValue(control, def);
  }
}
