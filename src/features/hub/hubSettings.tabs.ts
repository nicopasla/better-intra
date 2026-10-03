import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import {
  FEATURE_DEFS,
  HUB_SETTING_DEFS,
  FeatureId,
} from "./hubSettings.data.ts";
import { renderSettingList } from "./hubSettings.controls.ts";
import FORTY_TWO_SVG from "../../assets/svg/42_Logo.svg?raw";
import RESET_SVG from "../../assets/svg/reset.svg?raw";
import CHEVRON_DOWN_SVG from "../../assets/svg/chevron-down.svg?raw";
import { clearAuthFailed } from "../account/account.ts";
import { loginWith42 } from "../account/account.ts";
import { hubTabsState, panelBuilders } from "./hubSettings.state.ts";

const GRID_COLS_CLASSES = ["", "", "md:grid-cols-2", "md:grid-cols-3"] as const;

function isAlwaysEnabledFeature(f: (typeof FEATURE_DEFS)[number]): boolean {
  return (
    f.id === "about" ||
    f.id === "appearance" ||
    f.id === "discord" ||
    f.id === "calendar" ||
    f.id === "advanced" ||
    f.id === "account" ||
    f.id === "extras"
  );
}

function buildPanelBody(
  f: (typeof FEATURE_DEFS)[number],
  enabled: boolean,
  cloudDisabled: boolean,
  isAlwaysEnabled: boolean,
  gridColsClass: string,
  disabledDeps: Set<string>,
  hiddenDeps: Set<string>,
) {
  if (f.id === "account") {
    return html`<div class="w-full p-6" data-account-panel></div>`;
  }

  const settings = renderSettingList(
    HUB_SETTING_DEFS[f.id] || [],
    isAlwaysEnabled,
    enabled,
    disabledDeps,
    hiddenDeps,
  );

  return html`
    ${!isAlwaysEnabled
      ? html`
          <div
            class="sticky top-0 z-20 flex items-center justify-between bg-base-200 px-6 py-4 border-b border-base-300 shadow-sm"
          >
            <div class="flex flex-col">
              <h2 class="text-lg font-bold leading-tight">${f.name}</h2>
              <p class="text-xs opacity-70">${f.desc}</p>
            </div>
            <div class="flex items-center gap-3">
              <button
                class="btn btn-sm btn-outline btn-error flex items-center gap-2"
                data-reset-feature="${f.id}"
              >
                <span class="size-3.5 flex items-center justify-center"
                  >${unsafeHTML(RESET_SVG)}</span
                >
                Reset
              </button>
              <input
                type="checkbox"
                class="toggle toggle-xl toggle-primary hub-feature-toggle"
                data-id="${f.id}"
                ?checked="${enabled && !cloudDisabled}"
                ?disabled="${cloudDisabled}"
              />
            </div>
          </div>
        `
      : ""}
    ${cloudDisabled
      ? html`<div
          class="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center"
        >
          <span
            class="size-14 opacity-40 flex items-center justify-center [&_path]:fill-current"
            >${unsafeHTML(FORTY_TWO_SVG)}</span
          >
          <p class="opacity-50 max-w-72 text-sm">
            Connect your 42 account to unlock this feature.
          </p>
          <button
            type="button"
            class="btn bg-[#00babc] text-white border-none hover:bg-[#1fd2d4] h-12 text-base flex items-center justify-center gap-3 transition-colors duration-200"
            @click="${async () => {
              loginWith42(async () => {
                await clearAuthFailed();
                window.location.reload();
              });
            }}"
          >
            <span class="font-bold tracking-wide">Connect with</span>
            <span
              class="size-8 flex items-center justify-center [&_path]:fill-current"
            >
              ${unsafeHTML(FORTY_TWO_SVG)}
            </span>
          </button>
        </div>`
      : "subTabs" in f && f.subTabs
        ? renderSubTabs(
            f,
            enabled,
            !!cloudDisabled,
            disabledDeps,
            hiddenDeps,
            gridColsClass,
          )
        : html`<div
            class="${f.id === "about"
              ? "p-6 w-full"
              : `grid grid-cols-1 ${gridColsClass} gap-4 p-6`}"
          >
            ${settings}
          </div>`}
  `;
}

function renderSubTabs(
  f: (typeof FEATURE_DEFS)[number] & {
    subTabs?: readonly { id: string; name: string; icon?: string }[];
  },
  enabled: boolean,
  cloudDisabled: boolean,
  disabledDeps: Set<string>,
  hiddenDeps: Set<string>,
  gridColsClass: string,
) {
  const subTabs = f.subTabs ?? [];
  const content = (subTabId: string) => {
    const parentDefs = (HUB_SETTING_DEFS[f.id] || []).filter(
      (d) => d.subTab === subTabId,
    );
    if (parentDefs.length > 0) {
      return html`<div class="grid grid-cols-1 ${gridColsClass} gap-4 p-6">
        ${renderSettingList(
          parentDefs,
          true,
          enabled,
          disabledDeps,
          hiddenDeps,
        )}
      </div>`;
    }
    const childDefs = HUB_SETTING_DEFS[subTabId as FeatureId] || [];
    const childFeature = FEATURE_DEFS.find((fd) => fd.id === subTabId);
    const childName = childFeature?.name ?? subTabId;
    const childDesc = childFeature?.desc ?? "";
    const childEnabled = enabled && !cloudDisabled;
    return html`<div class="flex flex-col h-full">
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-200 shadow-sm"
      >
        <div class="flex flex-col">
          <h2 class="text-lg font-bold leading-tight">${childName}</h2>
          <p class="text-xs opacity-70">${childDesc}</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            class="btn btn-sm btn-outline btn-error flex items-center gap-2"
            data-reset-feature="${subTabId}"
          >
            <span class="size-3.5 flex items-center justify-center"
              >${unsafeHTML(RESET_SVG)}</span
            >
            Reset
          </button>
          <input
            type="checkbox"
            class="toggle toggle-xl toggle-primary hub-feature-toggle"
            data-id="${subTabId}"
            ?checked="${childEnabled}"
            ?disabled="${cloudDisabled}"
          />
        </div>
      </div>
      <div class="grid grid-cols-1 ${gridColsClass} gap-4 p-6">
        ${renderSettingList(
          childDefs,
          false,
          childEnabled,
          disabledDeps,
          hiddenDeps,
        )}
      </div>
    </div>`;
  };

  return html`<div class="flex flex-col h-full" data-sub-tabs-group="${f.id}">
    <div
      role="tablist"
      class="sub-tabs tabs tabs-lg tabs-border flex-none flex items-center gap-1 border-b border-base-300 bg-base-200 px-6 overflow-x-auto"
    >
      ${subTabs.map(
        (s, i) =>
          html`<label class="tab flex items-center gap-2 whitespace-nowrap">
            <input
              type="radio"
              name="hub_subtabs_${f.id}"
              ?checked="${i === 0}"
              data-sub-tab="${s.id}"
            />
            ${s.icon
              ? html`<span class="size-4 flex items-center justify-center"
                  >${unsafeHTML(s.icon)}</span
                >`
              : ""}
            ${s.name}
          </label>`,
      )}
    </div>
    <div class="flex-1 min-h-0 overflow-hidden">
      ${subTabs.map(
        (s, i) =>
          html`<div
            class="sub-panel h-full overflow-y-auto ${i === 0 ? "" : "hidden"}"
            data-sub-panel="${s.id}"
          >
            ${content(s.id)}
          </div>`,
      )}
    </div>
  </div>`;
}

function renderTabsContent(
  active: FeatureId[],
  disabledDeps: Set<string>,
  hiddenDeps: Set<string>,
  initialTab?: FeatureId,
) {
  panelBuilders.clear();
  const visibleDefs = FEATURE_DEFS.filter(
    (f) => !("hideFromTopLevel" in f && f.hideFromTopLevel),
  );

  const panels = visibleDefs.map((f, idx) => {
    const isAlwaysEnabled = isAlwaysEnabledFeature(f);
    const enabled = active.includes(f.id) || isAlwaysEnabled;
    const cloudDisabled =
      "requiresCloud" in f &&
      (f as { requiresCloud?: boolean }).requiresCloud &&
      disabledDeps.has("__CLOUD__");
    const gridColsClass =
      "cols" in f && f.cols != null
        ? (GRID_COLS_CLASSES[f.cols] ?? "md:grid-cols-3")
        : "md:grid-cols-3";

    panelBuilders.set(f.id, () =>
      buildPanelBody(
        f,
        enabled,
        !!cloudDisabled,
        isAlwaysEnabled,
        gridColsClass,
        disabledDeps,
        hiddenDeps,
      ),
    );

    return html`<label class="tab flex items-center gap-2">
        <input
          type="radio"
          name="hub_tabs"
          ?checked="${initialTab ? f.id === initialTab : idx === 0}"
          data-hub-tab="${f.id}"
        />
        <span class="size-4 flex items-center justify-center">
          ${unsafeHTML(f.icon)}
        </span>
        ${f.name}
      </label>
      <div role="tabpanel" class="tab-content bg-base-100 border-base-300 p-0">
        <div
          class="flex flex-col ${enabled || isAlwaysEnabled
            ? cloudDisabled
              ? "opacity-40 grayscale"
              : ""
            : "opacity-40 grayscale"}"
          data-feature-panel="${f.id}"
        >
          <div data-lazy-panel="${f.id}"></div>
        </div>
      </div>`;
  });

  const activeDef =
    visibleDefs.find((f) => f.id === initialTab) ?? visibleDefs[0];
  const compact = html`<details
    class="dropdown hub-tabs-compact w-full hidden"
    data-hub-tabs-compact
  >
    <summary
      class="hub-tabs-summary btn btn-ghost list-none w-full justify-between gap-2 border border-base-300"
    >
      <span class="flex items-center gap-2 min-w-0">
        <span
          class="hub-tabs-summary-icon size-4 flex-none flex items-center justify-center"
        ></span>
        <span class="hub-tabs-summary-label font-semibold truncate"
          >${activeDef?.name ?? ""}</span
        >
      </span>
      <span
        class="hub-tabs-chevron size-3 flex-none flex items-center justify-center"
        >${unsafeHTML(
          CHEVRON_DOWN_SVG.replace("<svg", '<svg width="12" height="12"'),
        )}</span
      >
    </summary>
    <ul
      class="menu menu-sm hub-tabs-menu dropdown-content z-50 mt-2 w-full max-h-72 overflow-auto rounded-box bg-base-100 p-1 shadow-xl"
    >
      ${visibleDefs.map(
        (f) =>
          html`<li>
            <button type="button" data-hub-tab-jump="${f.id}">
              <span class="size-4 flex items-center justify-center"
                >${unsafeHTML(f.icon)}</span
              >
              ${f.name}
            </button>
          </li>`,
      )}
    </ul>
  </details>`;

  return html`<div
      data-hub-tabs-compact-host
      class="w-full flex-none bg-base-100 border-b border-base-300 p-3 hidden"
    >
      ${compact}
    </div>
    ${panels}`;
}

function svgFromString(svg: string): Node | null {
  const holder = document.createElement("span");
  render(unsafeHTML(svg), holder);
  const el = holder.querySelector("svg");
  return el ? document.importNode(el, true) : null;
}

function syncHubTabsActive(shadow: ShadowRoot, id: string | undefined): void {
  if (!id) return;
  const def = FEATURE_DEFS.find((f) => f.id === id);
  const summaryLabel = shadow.querySelector<HTMLElement>(
    ".hub-tabs-summary-label",
  );
  const summaryIcon = shadow.querySelector<HTMLElement>(
    ".hub-tabs-summary-icon",
  );
  if (summaryLabel && def) summaryLabel.textContent = def.name;
  if (summaryIcon && def) {
    const svg = svgFromString(def.icon);
    summaryIcon.replaceChildren();
    if (svg) summaryIcon.appendChild(svg);
  }

  shadow.querySelectorAll<HTMLElement>("[data-hub-tab-jump]").forEach((btn) => {
    btn.classList.toggle("menu-active", btn.dataset.hubTabJump === id);
  });
  shadow.querySelectorAll<HTMLElement>(".tab").forEach((tab) => {
    const radio = tab.querySelector<HTMLInputElement>("input[data-hub-tab]");
    tab.classList.toggle("tab-active", radio?.dataset.hubTab === id);
  });
}

function measureHubTabsOverflow(shadow: ShadowRoot): boolean {
  const host = shadow.querySelector<HTMLElement>('[role="tablist"].tabs');
  if (!host || host.clientWidth === 0) return false;
  const probe = document.createElement("div");
  probe.className = "tabs tabs-lg tabs-border";
  probe.style.cssText =
    "position:absolute;top:0;left:-9999px;visibility:hidden;white-space:nowrap;display:flex;width:max-content;";
  shadow
    .querySelectorAll<HTMLElement>(".tab:has(input[data-hub-tab])")
    .forEach((tab) => {
      const item = tab.cloneNode(true) as HTMLElement;
      item.classList.remove("hub-tab-hidden", "hidden");
      item.style.whiteSpace = "nowrap";
      probe.appendChild(item);
    });
  host.appendChild(probe);
  const overflows = probe.scrollWidth - host.clientWidth > 1;
  probe.remove();
  return overflows;
}

function applyHubTabsOverflow(shadow: ShadowRoot, overflowing: boolean): void {
  hubTabsState.overflowing = overflowing;
  shadow
    .querySelector<HTMLElement>("[data-hub-tabs-compact]")
    ?.classList.toggle("hidden", !overflowing);
  shadow
    .querySelector<HTMLElement>("[data-hub-tabs-compact-host]")
    ?.classList.toggle("hidden", !overflowing);
  shadow
    .querySelectorAll<HTMLInputElement>('input[name="hub_tabs"]')
    .forEach((radio) => {
      radio
        .closest<HTMLElement>(".tab")
        ?.classList.toggle("hub-tab-hidden", overflowing);
    });
}

function wireHubTabs(shadow: ShadowRoot, dialog: HTMLDialogElement): void {
  const host = shadow.querySelector<HTMLElement>('[role="tablist"].tabs');
  if (!host || hubTabsState.wired.has(host)) return;
  hubTabsState.wired.add(host);

  shadow
    .querySelectorAll<HTMLButtonElement>("[data-hub-tab-jump]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.hubTabJump;
        if (!id) return;
        const radio = shadow.querySelector<HTMLInputElement>(
          `input[data-hub-tab="${id}"]`,
        );
        if (radio && !radio.checked) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change"));
        }
        syncHubTabsActive(shadow, id);
        shadow
          .querySelector<HTMLDetailsElement>("[data-hub-tabs-compact]")
          ?.removeAttribute("open");
      });
    });

  hubTabsState.resizeObserver?.disconnect();
  hubTabsState.resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      const overflowing = measureHubTabsOverflow(shadow);
      if (overflowing === hubTabsState.overflowing) return;
      applyHubTabsOverflow(shadow, overflowing);
    });
  });
  hubTabsState.resizeObserver.observe(host);

  dialog.addEventListener(
    "close",
    () => {
      hubTabsState.resizeObserver?.disconnect();
      hubTabsState.resizeObserver = null;
    },
    { once: true },
  );

  applyHubTabsOverflow(shadow, measureHubTabsOverflow(shadow));
}

function focusHubTab(dialog: HTMLDialogElement, tab: FeatureId): void {
  const shadow = dialog.querySelector("#hub-shadow-wrapper")?.shadowRoot;
  const radio = shadow?.querySelector<HTMLInputElement>(
    `input[data-hub-tab="${tab}"]`,
  );
  if (!radio) return;
  if (!radio.checked) {
    radio.checked = true;
    radio.dispatchEvent(new Event("change"));
  }
  radio.closest<HTMLElement>(".tab")?.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
}

export { renderTabsContent, wireHubTabs, syncHubTabsActive, focusHubTab };
