import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { getConfig, CONFIG_DEFAULT } from "../../config.ts";
import {
  HUB_INFO,
  INTRA_FONT,
  HUB_SETTING_DEFS,
  type FeatureId,
} from "./hubSettings.data.ts";
import {
  clearAuthFailed,
  loginWith42,
  syncToCloud,
} from "../account/account.ts";
import { adoptShadowStyles } from "../../utils/shadow-styles.ts";
import X_SVG from "../../assets/svg/x.svg?raw";
import CLOUD_SVG from "../../assets/svg/cloud-lucide.svg?raw";
import CLOUD_OFF_SVG from "../../assets/svg/cloud-off.svg?raw";
import CLOUD_ALERT_SVG from "../../assets/svg/cloud-alert.svg?raw";
import ICON_SVG from "../../assets/svg/icon.svg?raw";
import RELOAD_SVG from "../../assets/svg/reload.svg?raw";
import SEARCH_SVG from "../../assets/svg/search.svg?raw";
import {
  getEffectiveTheme,
  getIsLight,
} from "../profile/theme/theme-manager.ts";
import { bindTooltips } from "../../utils/tooltip.ts";
import { fetchCampusList, fetchEventTypes } from "../clusters/clusters.data.ts";
import { ensureCampusData } from "../campus/campus.ts";
import {
  renderTabsContent,
  wireHubTabs,
  syncHubTabsActive,
  focusHubTab,
} from "./hubSettings.tabs.ts";
import { setupSearch } from "./hubSettings.search.ts";
import {
  bindPanelControls,
  setupSubTabs,
  loadAboutPanel,
} from "./hubSettings.panel.ts";
import {
  setDynamicCampusOptions,
  setDynamicEventTypeOptions,
  panelBuilders,
} from "./hubSettings.state.ts";

const renderCloseIcon = () =>
  unsafeHTML(X_SVG.replace("<svg", '<svg width="22" height="22"'));

export async function openHubModal(
  active: FeatureId[],
  initialTab?: FeatureId,
) {
  let dialog = document.getElementById("hub-dialog") as HTMLDialogElement;
  if (!dialog) {
    createModal(active, initialTab);
    dialog = document.getElementById("hub-dialog") as HTMLDialogElement;
  } else if (initialTab) {
    focusHubTab(dialog, initialTab);
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

function renderDialogShell(): ReturnType<typeof html> {
  return html`
    <div
      class="w-full h-full p-0 overflow-hidden bg-base-100 rounded-3xl shadow-2xl flex flex-col relative"
    >
      <div id="hub-shadow-wrapper" class="w-full h-full"></div>
    </div>
  `;
}

async function createModal(
  active: FeatureId[],
  initialTab?: FeatureId,
): Promise<void> {
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

    const applyDesktopLock = () => {
      dialog.style.width = "100%";
      dialog.style.height = "100%";

      if (window.matchMedia("(min-width: 1024px)").matches) {
        dialog.style.maxWidth = "1200px";
        dialog.style.maxHeight = "800px";
      } else {
        dialog.style.maxWidth = "calc(100dvw - 1rem)";
        dialog.style.maxHeight = "calc(100dvh - 1rem)";
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

  const currentTheme = await getEffectiveTheme();

  const depParentKeys = new Set<string>();
  for (const defs of Object.values(HUB_SETTING_DEFS)) {
    for (const def of defs) {
      if (def.dependsOn) depParentKeys.add(def.dependsOn);
    }
  }
  const depValues = await chrome.storage.local.get([...depParentKeys]);
  const disabledDeps = new Set<string>();
  const hiddenDeps = new Set<string>();
  for (const defs of Object.values(HUB_SETTING_DEFS)) {
    for (const def of defs) {
      if (def.dependsOn && def.key) {
        const parentVal =
          depValues[def.dependsOn] ?? CONFIG_DEFAULT[def.dependsOn];
        if (!parentVal) {
          disabledDeps.add(def.key);
          hiddenDeps.add(def.key);
        }
      }
    }
  }
  const cloudToken = await getConfig("CLOUD_TOKEN");
  if (!cloudToken) {
    disabledDeps.add("__CLOUD__");
    for (const defs of Object.values(HUB_SETTING_DEFS)) {
      for (const def of defs) {
        if (def.requiresCloud && def.key) disabledDeps.add(def.key);
      }
    }
  }

  const [manifestResult, eventTypesResult] = await Promise.allSettled([
    fetchCampusList(),
    fetchEventTypes(),
  ]);
  setDynamicCampusOptions(
    manifestResult.status === "fulfilled"
      ? manifestResult.value.campuses.map((c) => ({
          label: c.name,
          value: c.id,
        }))
      : [],
  );
  setDynamicEventTypeOptions(
    eventTypesResult.status === "fulfilled" ? eventTypesResult.value : [],
  );
  void ensureCampusData();
  const tabsContent = renderTabsContent(
    active,
    disabledDeps,
    hiddenDeps,
    initialTab,
  );
  const isConnected = !!(await getConfig("CLOUD_TOKEN"));
  const authFailed = !!(await getConfig("CLOUD_AUTH_FAILED"));

  const modalTemplate = html`<style>
      :host {
        display: block;
        height: 100%;
        width: 100%;
      }
      :host {
        font-family: ${INTRA_FONT};
      }
      input,
      button,
      select,
      textarea,
      .tab,
      h2,
      h3 {
        font-family: ${INTRA_FONT} !important;
      }
      .tab-content {
        height: auto !important;
        overflow: visible !important;
      }
      .tabs {
        align-content: flex-start !important;
      }
      .tab-content:has([data-account-panel]) {
        height: calc(100% - var(--tab-height, 3rem)) !important;
        overflow: hidden !important;
      }
      [data-feature-panel="account"],
      [data-feature-panel="account"] [data-lazy-panel],
      [data-account-panel] {
        height: 100%;
        min-height: 0;
      }
    </style>
    <div
      class="flex flex-col h-full text-base-content bg-base-100"
      data-theme="${currentTheme}"
    >
      <div
        class="flex-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-base-200 bg-base-100 z-10"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div
              class="size-8 flex items-center justify-center"
              style="color: #00babc;"
            >
              ${unsafeHTML(ICON_SVG)}
            </div>
            <div class="flex items-baseline gap-2">
              <h3 class="font-bold text-xl tracking-tight">${HUB_INFO.name}</h3>
              <p
                class="text-[14px] opacity-60 font-bold tracking-widest font-mono"
              >
                v${HUB_INFO.version}
              </p>
            </div>
          </div>
          <button
            class="btn btn-circle btn-ghost btn-sm sm:hidden"
            @click="${() => dialog.close()}"
          >
            ${renderCloseIcon()}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <label
            class="input input-sm input-accent flex-1 sm:flex-none sm:w-56 flex items-center gap-2"
          >
            <span class="h-[1em] opacity-50 flex items-center justify-center"
              >${unsafeHTML(SEARCH_SVG)}</span
            >
            <input
              id="hub-search"
              type="search"
              placeholder="Search settings..."
              class="grow"
            />
          </label>
          <button
            class="btn btn-circle btn-ghost btn-sm hidden sm:inline-flex"
            @click="${() => dialog.close()}"
          >
            ${renderCloseIcon()}
          </button>
        </div>
      </div>

      ${authFailed
        ? html`<div
            class="flex-none alert alert-warning mx-4 mt-3 rounded-xl flex items-center justify-between"
          >
            <span class="text-sm font-semibold"
              >42 token expired - friends, marks, and cloud features
              stopped</span
            >
            <button
              class="btn btn-warning btn-sm font-bold"
              @click="${() => {
                dialog.close();
                loginWith42(async () => {
                  await clearAuthFailed();
                  window.location.reload();
                });
              }}"
            >
              Reconnect
            </button>
          </div>`
        : ""}

      <div
        role="tablist"
        class="tabs tabs-lg tabs-border flex-1 overflow-y-auto min-h-0"
        style="min-height:0;"
      >
        ${tabsContent}
      </div>
      <div
        id="hub-search-empty"
        class="hidden flex-1 items-center justify-center p-10 text-center text-base-content/50"
      >
        <span class="text-sm"></span>
      </div>

      <div
        class="flex-none p-4 border-t border-base-200 bg-base-200/50 flex justify-between items-center"
      >
        <div class="flex items-center gap-3">
          ${authFailed
            ? html`<button
                type="button"
                class="flex items-center gap-2 text-error font-bold text-sm cursor-pointer"
                data-tip="Token expired — reconnect with 42"
                data-tip-size="14px"
                @click="${() => {
                  loginWith42(async () => {
                    await clearAuthFailed();
                    window.location.reload();
                  });
                }}"
              >
                <span
                  class="size-7 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:stroke-current"
                  >${unsafeHTML(CLOUD_ALERT_SVG)}</span
                >
                <span>Error</span>
              </button>`
            : isConnected
              ? html`<span
                  class="flex items-center gap-2 text-success font-bold text-sm"
                  data-tip="Connected"
                  data-tip-size="14px"
                >
                  <span
                    class="size-7 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:stroke-current"
                    >${unsafeHTML(CLOUD_SVG)}</span
                  >
                  <span>Connected</span>
                </span>`
              : html`<button
                  type="button"
                  class="flex items-center gap-2 text-error font-bold text-sm cursor-pointer"
                  data-tip="Offline — connect with 42"
                  data-tip-size="14px"
                  @click="${() => {
                    loginWith42(async () => {
                      await clearAuthFailed();
                      window.location.reload();
                    });
                  }}"
                >
                  <span
                    class="size-7 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:stroke-current"
                    >${unsafeHTML(CLOUD_OFF_SVG)}</span
                  >
                  <span>Disconnected</span>
                </button>`}
        </div>
        <button
          id="hub-reload"
          class="btn btn-success btn-square sm:btn-wide font-bold flex items-center gap-2"
          aria-label="Save and reload"
          data-tip="Save & Reload"
          data-tip-size="14px"
        >
          <span class="size-5 flex items-center justify-center">
            ${unsafeHTML(RELOAD_SVG)}
          </span>
          <span class="hidden sm:inline">Save & Reload</span>
        </button>
      </div>
    </div>`;

  render(modalTemplate, shadow);
  adoptShadowStyles(shadow);

  bindTooltips(shadow, getIsLight);

  const activatePanel = (id: string | undefined) => {
    if (!id) return;
    const el = shadow.querySelector<HTMLElement>(`[data-lazy-panel="${id}"]`);
    if (!el || el.dataset.built === "1") return;
    const builder = panelBuilders.get(id);
    if (!builder) return;
    el.dataset.built = "1";
    render(builder(), el);
    bindPanelControls(el, shadow);
    setupSubTabs(el);
    if (id === "about") loadAboutPanel(shadow);
    if (id === "account") {
      const mount = el.querySelector<HTMLElement>("[data-account-panel]") ?? el;
      void import("../account/account.ui.ts").then((m) =>
        m.initAccountSettings(mount),
      );
    }
  };

  const ensureAllPanels = () => {
    for (const id of panelBuilders.keys()) activatePanel(id);
  };

  const firstTab = shadow.querySelector<HTMLInputElement>(
    'input[name="hub_tabs"][data-hub-tab]',
  );
  activatePanel(initialTab ?? firstTab?.dataset.hubTab);
  if (initialTab) focusHubTab(dialog, initialTab);

  shadow
    .querySelectorAll<HTMLInputElement>('input[name="hub_tabs"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        activatePanel(radio.dataset.hubTab);
        syncHubTabsActive(shadow, radio.dataset.hubTab);
      });
    });

  syncHubTabsActive(
    shadow,
    shadow.querySelector<HTMLInputElement>(
      'input[name="hub_tabs"][data-hub-tab]:checked',
    )?.dataset.hubTab,
  );

  wireHubTabs(shadow, dialog);

  setupSearch(shadow, ensureAllPanels);

  const hubContainer = shadow.querySelector("[data-theme]");

  const presetKey = (await getConfig("PROFILE_THEME_PRESET")) || "dark";
  const validPreset = HUB_SETTING_DEFS.appearance
    .find((s) => s.key === "PROFILE_THEME_PRESET")
    ?.options?.some((o) => o.value === presetKey)
    ? presetKey
    : "dark";
  hubContainer?.setAttribute("data-theme", validPreset);

  const reloadBtn = shadow.querySelector("#hub-reload");
  reloadBtn?.addEventListener("click", async () => {
    if ((await getConfig("CLOUD_SYNC_ENABLED")) === true) {
      try {
        await syncToCloud();
      } catch {}
    }
    location.reload();
  });

  shadow.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    const parentKey = target.dataset.settingKey;
    if (!parentKey) return;

    const depKeys: string[] = [];
    for (const defs of Object.values(HUB_SETTING_DEFS)) {
      for (const def of defs) {
        if (def.dependsOn === parentKey && def.key) depKeys.push(def.key);
      }
    }
    if (depKeys.length === 0) return;

    const on =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : true;

    for (const key of depKeys) {
      const el = shadow.querySelector<HTMLElement>(
        `[data-setting-key="${key}"]`,
      );
      if (!el) continue;
      const card = el.closest<HTMLElement>(".card");
      if (card) {
        card.classList.toggle("hidden", !on);
        if (on) {
          card.classList.remove("opacity-40", "grayscale");
        } else {
          card.classList.add("opacity-40", "grayscale");
        }
      }
      (el as any).disabled = !on;
    }
  });
}
