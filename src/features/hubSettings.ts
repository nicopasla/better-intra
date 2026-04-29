import { gmDeleteValue, gmGetValue, gmSetValue } from "../lib/gm.ts";
import "../assets/style.css";
import {
  FEATURE_DEFS,
  HUB_INFO,
  FeatureId,
  STORAGE_KEY,
  FEATURE_IDS,
  FEATURE_PAGE_GUARDS,
  FEATURE_PAGE_URLS,
  HUB_SETTING_DEFS,
  type HubSettingDef,
} from "./hubSettings.data.ts";
import GEAR_SVG from "../assets/settings_gear.svg?raw";

function isFeatureAllowedOnPage(
  id: FeatureId,
  loc: Location = location,
): boolean {
  return FEATURE_PAGE_GUARDS[id](loc);
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

function safeStringify(value: unknown): string {
  try {
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildDebugInfo(activeSelected?: FeatureId[]): string {
  const rawStored = gmGetValue<unknown>(STORAGE_KEY, null);
  const stored = normalizeActive(rawStored);
  const selected = activeSelected ?? stored;
  const allowedHere = selected.filter((id) => isFeatureAllowedOnPage(id));

  const hasV3Sidebar = !!findSidebarMainGroup();
  const hasLegacyNav = !!findLegacyNavList();
  const hasHeaderTarget = !!document.querySelector(
    ".flex.flex-row.grow.h-16.gap-3",
  );
  const gear = document.getElementById("hub-gear-btn");

  const featureMatrix = FEATURE_DEFS.map((f) => {
    const enabled = selected.includes(f.id);
    const allowed = isFeatureAllowedOnPage(f.id);
    return `${f.id}=enabled:${enabled},allowed_here:${allowed}`;
  }).join(" | ");

  return [
    `name=${HUB_INFO.name}`,
    `version=${HUB_INFO.version}`,
    `author=${HUB_INFO.author}`,
    `license=${HUB_INFO.license}`,
    `url=${location.href}`,
    `origin=${location.origin}`,
    `hostname=${location.hostname}`,
    `pathname=${location.pathname}`,
    `search=${location.search || "(empty)"}`,
    `hash=${location.hash || "(empty)"}`,
    `referrer=${document.referrer || "(none)"}`,
    `readyState=${document.readyState}`,
    `raw_active_storage=${safeStringify(rawStored)}`,
    `stored_active=${stored.join(",") || "none"}`,
    `selected_active=${selected.join(",") || "none"}`,
    `active_on_this_page=${allowedHere.join(",") || "none"}`,
    `features=${featureMatrix}`,
    `layout_v3_sidebar=${hasV3Sidebar}`,
    `layout_legacy_nav=${hasLegacyNav}`,
    `layout_header_target=${hasHeaderTarget}`,
    `gear_present=${!!gear}`,
    `gear_tag=${gear?.tagName ?? "(none)"}`,
    `gear_parent_class=${gear?.parentElement?.className ?? "(none)"}`,
    `overlay_present=${!!document.getElementById("hub-overlay")}`,
    `modal_present=${!!document.getElementById("hub-modal")}`,
    `lang=${navigator.language}`,
    `platform=${navigator.platform}`,
    `ua=${navigator.userAgent}`,
    `time_iso=${new Date().toISOString()}`,
    `time_local=${new Date().toString()}`,
  ].join("\n");
}

async function copyDebugInfo(activeSelected?: FeatureId[]): Promise<boolean> {
  const text = buildDebugInfo(activeSelected);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function findSidebarMainGroup(): HTMLDivElement | null {
  const profileLink = document.querySelector<HTMLAnchorElement>(
    'a[href="https://profile-v3.intra.42.fr"]',
  );
  const fromProfile = profileLink?.closest<HTMLDivElement>(
    "div.flex.flex-col.w-full",
  );
  if (fromProfile) return fromProfile;

  return document.querySelector<HTMLDivElement>(
    "div.flex.flex-col.w-full:not(.pb-16)",
  );
}

function findLegacyNavList(): HTMLDivElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLDivElement>("div._"),
  );
  for (const root of candidates) {
    const hasKnownLinks =
      !!root.querySelector('a[href="https://profile.intra.42.fr"]') ||
      !!root.querySelector('a[href="https://projects.intra.42.fr"]') ||
      !!root.querySelector('a[href="https://meta.intra.42.fr"]');
    const hasLi = root.querySelectorAll(":scope > li").length > 0;
    if (hasKnownLinks && hasLi) return root;
  }
  return null;
}

function getSettingDefaultValue(def: HubSettingDef): unknown {
  const anyDef = def as HubSettingDef & {
    default?: unknown;
    defaultValue?: unknown;
  };

  if (anyDef.defaultValue !== undefined) return anyDef.defaultValue;
  if (anyDef.default !== undefined) return anyDef.default;

  if (def.kind === "toggle") return false;
  if (def.kind === "number") return def.min ?? 0;
  if (def.kind === "select") return def.options?.[0]?.value ?? "";
  return "";
}

function applyDefaultSettingValue(
  control: HTMLInputElement | HTMLSelectElement,
  def: HubSettingDef,
): void {
  const value = getSettingDefaultValue(def);

  if (control instanceof HTMLInputElement) {
    if (control.type === "checkbox") {
      control.checked = Boolean(value);
      return;
    }

    if (control.type === "number") {
      control.value =
        value === null || value === undefined ? "" : String(value);
      return;
    }

    control.value = value === null || value === undefined ? "" : String(value);
    return;
  }

  if (control instanceof HTMLSelectElement) {
    const next = value === null || value === undefined ? "" : String(value);
    const hasOption = Array.from(control.options).some(
      (opt) => opt.value === next,
    );
    control.value = hasOption ? next : (control.options[0]?.value ?? "");
  }
}

function resetFeatureSettings(
  overlay: HTMLElement,
  featureId: FeatureId,
): void {
  for (const def of HUB_SETTING_DEFS[featureId] ?? []) {
    gmDeleteValue(def.key);

    const control = overlay.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-setting-key="${def.key}"]`,
    );
    if (!control) continue;

    applyDefaultSettingValue(control, def);
  }
}

function renderSetting(def: HubSettingDef, enabled: boolean): string {
  const storedValue = gmGetValue<unknown>(def.key, null);

  // 2. Priorité : Valeur stockée > Valeur par défaut > Chaîne vide
  const value = storedValue !== null ? storedValue : (def.defaultValue ?? "");
  const disabled = enabled ? "" : "disabled";
  let control = "";
  if (def.kind === "toggle") {
    control = `
      <label class="hub-setting-toggle-small">
        <input type="checkbox" data-setting-key="${def.key}" ${value ? "checked" : ""} ${disabled} />
        <span class="hub-check"></span>
      </label>
    `;
  } else if (def.kind === "number") {
    control = `
      <input
        class="hub-setting-input"
        type="number"
        data-setting-key="${def.key}"
        min="${def.min ?? ""}"
        max="${def.max ?? ""}"
        step="${def.step ?? 1}"
        value="${typeof value === "number" ? value : ""}"
        ${disabled}
      />
    `;
  } else if (def.kind === "select") {
    control = `
      <select class="hub-setting-input" data-setting-key="${def.key}" ${disabled}>
        ${(def.options ?? [])
          .map(
            (opt) =>
              `<option value="${opt.value}" ${value === opt.value ? "selected" : ""}>${opt.label}</option>`,
          )
          .join("")}
      </select>
    `;
  } else {
    const isColor = def.placeholder?.startsWith("#");
    const inputType = isColor ? "color" : "text";
    control = `
      <input
        class="hub-setting-input"
        type="${inputType}"
        data-setting-key="${def.key}"
        ${!isColor ? `placeholder="${def.placeholder ?? ""}"` : ""}
        value="${typeof value === "string" ? value : (def.placeholder ?? "")}"
        ${disabled}
      />
    `;
  }

  return `
    <div class="hub-setting">
      <div class="hub-setting-copy">
        <div class="hub-setting-label">${def.label}</div>
        <div class="hub-setting-desc">${def.desc}</div>
      </div>
      <div class="hub-setting-control">${control}</div>
    </div>
  `;
}

function createModal(active: FeatureId[]): void {
  if (document.getElementById("hub-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "hub-overlay";

  const featureCards = FEATURE_DEFS.map((f, index) => {
    const enabled = active.includes(f.id);
    const runsHere = isFeatureAllowedOnPage(f.id);

    return `
      <button
        type="button"
        class="hub-feature-card ${index === 0 ? "is-active" : ""} ${enabled ? "" : "hub-is-disabled"}"
        data-feature-card="${f.id}"
        aria-pressed="${index === 0 ? "true" : "false"}"
      >
        <div class="hub-feature-card__title">${f.name}</div>
        <div class="hub-feature-card__desc">${f.desc}</div>
        <div class="hub-feature-card__meta">
          <span class="hub-run-pill ${runsHere ? "is-on" : "is-off"}">
            ${runsHere ? "Available here" : "Different page"}
          </span>
        </div>
      </button>
    `;
  }).join("");

  const panels = FEATURE_DEFS.map((f, index) => {
    const enabled = active.includes(f.id);

    const settingsDefs = HUB_SETTING_DEFS[f.id] || [];

    const settings = settingsDefs
      .map((def) => renderSetting(def, enabled))
      .join("");

    return `
      <section
        class="hub-panel ${index === 0 ? "is-active" : ""} ${enabled ? "" : "hub-is-disabled"}"
        data-feature-panel="${f.id}"
      >
        <div class="hub-panel-head">
          <div>
            <div class="hub-desc">${f.desc}</div>
          </div>
          <div class="hub-panel-head-right">
            <button
              type="button"
              class="hub-reset-cfg"
              data-reset-feature="${f.id}"
            >Reset</button>
            <label class="hub-toggle-switch">
              <input type="checkbox" class="hub-feature-toggle" data-id="${f.id}" ${enabled ? "checked" : ""} />
              <div class="hub-toggle-bg"></div>
              <div class="hub-toggle-handle"></div>
            </label>
          </div>
        </div>

        <div class="hub-feature-settings">
          ${settings}
        </div>
      </section>
    `;
  }).join("");

  const about = `
  <div class="hub-about">
    <div class="hub-about-chips">
      <span class="hub-about-chip">${HUB_INFO.name}</span>
      <span class="hub-about-chip">${HUB_INFO.version}</span>
      <span class="hub-about-chip">MIT</span>
    </div>
    <div class="hub-about-links">
      <a href="${HUB_INFO.github}" target="_blank" rel="noopener">GitHub</a>
      <a href="${HUB_INFO.issues}" target="_blank" rel="noopener">Report issue</a>
      <button id="hub-copy-debug" type="button">Copy debug</button>
    </div>
  </div>
`;

  overlay.innerHTML = `
    <div id="hub-modal">
      <div class="hub-head">
        <span class="hub-title">42+</span>
        <button id="close-settings-modal" type="button" aria-label="Close"></button>
      </div>

      <div class="hub-body">
        <div class="hub-feature-picker">${featureCards}</div>
        <div class="hub-panels">${panels}</div>
      </div>

      <div class="hub-footer">
        ${about} <button class="hub-save" id="hub-save" type="button">Save & Reload</button> </div>
      
      <div class="hub-resize-handle" aria-hidden="true"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  const setActiveFeature = (id: FeatureId) => {
    overlay
      .querySelectorAll<HTMLElement>("[data-feature-card]")
      .forEach((el) => {
        const isActive = el.dataset.featureCard === id;
        el.classList.toggle("is-active", isActive);
        el.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

    overlay
      .querySelectorAll<HTMLElement>("[data-feature-panel]")
      .forEach((el) => {
        el.classList.toggle("is-active", el.dataset.featurePanel === id);
      });
  };

  overlay
    .querySelector(".hub-feature-picker")
    ?.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-feature-card]",
      );
      const id = target?.dataset.featureCard as FeatureId | undefined;
      if (id && FEATURE_IDS.has(id)) setActiveFeature(id);
    });

  overlay
    .querySelectorAll<HTMLInputElement>(".hub-feature-toggle")
    .forEach((toggle) => {
      const id = toggle.dataset.id as FeatureId | undefined;
      if (!id || !FEATURE_IDS.has(id)) return;

      const syncState = () => {
        const enabled = toggle.checked;
        const panel = overlay.querySelector<HTMLElement>(
          `[data-feature-panel="${id}"]`,
        );
        const card = overlay.querySelector<HTMLElement>(
          `[data-feature-card="${id}"]`,
        );
        panel?.classList.toggle("hub-is-disabled", !enabled);
        card?.classList.toggle("hub-is-disabled", !enabled);

        panel
          ?.querySelectorAll<
            HTMLInputElement | HTMLSelectElement
          >("[data-setting-key]")
          .forEach((control) => {
            control.disabled = !enabled;
          });

        panel
          ?.querySelector(".hub-state-pill")
          ?.replaceChildren(
            document.createTextNode(enabled ? "Enabled" : "Disabled"),
          );
        card
          ?.querySelector(".hub-state-pill")
          ?.replaceChildren(
            document.createTextNode(enabled ? "Enabled" : "Disabled"),
          );
      };

      syncState();
      toggle.addEventListener("change", syncState);
    });

  overlay
    .querySelectorAll<HTMLButtonElement>("[data-reset-feature]")
    .forEach((btn) => {
      const id = btn.dataset.resetFeature as FeatureId | undefined;
      if (!id || !FEATURE_IDS.has(id)) return;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetFeatureSettings(overlay, id);
      });
    });

  const close = () => (overlay.style.display = "none");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  document
    .getElementById("close-settings-modal")
    ?.addEventListener("click", close);

  document.getElementById("hub-save")?.addEventListener("click", () => {
    saveHubState(overlay);
    location.reload();
  });

  document
    .getElementById("hub-copy-debug")
    ?.addEventListener("click", async () => {
      const selected = Array.from(
        overlay.querySelectorAll<HTMLInputElement>(
          ".hub-feature-toggle:checked",
        ),
      )
        .map((el) => el.dataset.id)
        .filter((id): id is FeatureId => FEATURE_IDS.has(id as FeatureId));

      const ok = await copyDebugInfo(selected);
      const btn = document.getElementById(
        "hub-copy-debug",
      ) as HTMLButtonElement | null;
      if (!btn) return;
      const prev = btn.textContent;
      btn.textContent = ok ? "Copied" : "Copy failed";
      window.setTimeout(() => {
        btn.textContent = prev ?? "Copy debug info";
      }, 1200);
    });
}

function readSettingValue(
  control: HTMLInputElement | HTMLSelectElement,
): unknown {
  if (control instanceof HTMLInputElement) {
    if (control.type === "checkbox") return control.checked;
    if (control.type === "number")
      return control.value === "" ? "" : Number(control.value);
  }
  return control.value;
}

function saveHubState(overlay: HTMLElement): FeatureId[] {
  const selected = Array.from(
    overlay.querySelectorAll<HTMLInputElement>(".hub-feature-toggle:checked"),
  )
    .map((el) => el.dataset.id)
    .filter((id): id is FeatureId => FEATURE_IDS.has(id as FeatureId));

  gmSetValue(STORAGE_KEY, JSON.stringify(selected));

  overlay
    .querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >("[data-setting-key]")
    .forEach((control) => {
      const key = control.dataset.settingKey;
      if (!key) return;

      const value = readSettingValue(control);
      if (value === "") {
        gmDeleteValue(key);
      } else {
        gmSetValue(key, value);
      }
    });

  return selected;
}

function mountGearButton(): void {
  const openModal = () => {
    const overlay = document.getElementById("hub-overlay");
    if (overlay) overlay.style.display = "flex";
  };

  const sidebarMainGroup = findSidebarMainGroup();
  const legacyNavList = findLegacyNavList();
  const oldTarget = document.querySelector(".flex.flex-row.grow.h-16.gap-3");

  document.getElementById("hub-gear-item")?.remove();
  const existing = document.getElementById("hub-gear-btn");
  existing?.remove();

  if (sidebarMainGroup) {
    const a = document.createElement("a");
    a.id = "hub-gear-btn";
    a.href = "#";
    a.title = "Extension settings";
    a.setAttribute("aria-label", "Extension settings");
    a.className =
      "py-5 w-full flex justify-center hover:opacity-100 opacity-40";
    a.innerHTML = GEAR_SVG;
    a.onclick = (e) => {
      e.preventDefault();
      openModal();
    };
    sidebarMainGroup.appendChild(a);
    return;
  }

  if (legacyNavList) {
    const li = document.createElement("li");
    li.id = "hub-gear-item";

    const a = document.createElement("a");
    a.id = "hub-gear-btn";
    a.href = "#";
    a.className = "inactive";
    a.title = "Extension settings";
    a.setAttribute("aria-label", "Extension settings");
    a.innerHTML = GEAR_SVG;
    a.onclick = (e) => {
      e.preventDefault();
      openModal();
    };

    li.appendChild(a);
    legacyNavList.appendChild(li);
    return;
  }

  if (oldTarget) {
    const b = document.createElement("button");
    b.id = "hub-gear-btn";
    b.type = "button";
    b.title = "Extension settings";
    b.setAttribute("aria-label", "Extension settings");
    b.innerHTML = GEAR_SVG;
    b.onclick = openModal;
    oldTarget.appendChild(b);
    return;
  }

  const b = document.createElement("button");
  b.id = "hub-gear-btn";
  b.type = "button";
  b.title = "Extension settings";
  b.setAttribute("aria-label", "Extension settings");
  b.innerHTML = "⚙️";
  b.onclick = openModal;
  b.style.position = "fixed";
  b.style.right = "14px";
  b.style.bottom = "14px";
  b.style.zIndex = "9999";
  document.body.appendChild(b);
}

export function initHubSettings(): FeatureId[] {
  const active = getActiveFeatures();
  createModal(active);

  mountGearButton();
  const iv = window.setInterval(() => {
    mountGearButton();
  }, 300);
  window.setTimeout(() => window.clearInterval(iv), 8000);

  return active.filter((id) => isFeatureAllowedOnPage(id));
}
