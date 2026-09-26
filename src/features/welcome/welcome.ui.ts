import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { adoptShadowStyles } from "../../utils/shadow-styles.ts";
import { getConfig, CONFIG_DEFAULT } from "../../config.ts";
import {
  HUB_INFO,
  HUB_SETTING_DEFS,
  type FeatureCardOption,
} from "../hub/hubSettings.data.ts";
import FORTY_TWO_SVG from "../../assets/svg/42_Logo.svg?raw";
import ICON_SVG from "../../assets/svg/icon.svg?raw";
import X_SVG from "../../assets/svg/x.svg?raw";
import {
  applyCloudSettings,
  clearAuthFailed,
  fetchMySettings,
  getCloudLogin,
  loginWith42,
} from "../account/account.ts";
import { showConfirmDialog } from "../../utils/confirm-dialog.ts";
import { THEMES } from "../profile/theme/theme-manager.ts";

const DIALOG_ID = "welcome-dialog";
const HOST_ID = "welcome-shadow-wrapper";
const STYLE_ID = "ft-welcome-style";

type ThemeMode = "dark" | "light" | "system";

interface WelcomeState {
  theme: ThemeMode;
  preset: string;
  connected: boolean;
  login: string | null;
  busy: boolean;
  message: string;
  messageError: boolean;
}

function isLightPreset(preset: string): boolean {
  return preset === "light" || !!THEMES[preset]?.light;
}

function ensureGlobalStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${DIALOG_ID} {
      margin: auto;
      padding: 0;
      border: none;
      background: transparent;
      width: min(760px, calc(100vw - 2rem));
      max-height: 92vh;
    }
    #${DIALOG_ID}::backdrop { background: rgba(3, 6, 10, 0.62); }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function themeOptions(): readonly FeatureCardOption[] {
  const def = HUB_SETTING_DEFS.appearance.find(
    (d) => d.key === "PROFILE_THEME_PRESET",
  );
  return def?.options ?? [];
}

export async function openWelcome(): Promise<void> {
  document.getElementById(DIALOG_ID)?.remove();
  ensureGlobalStyle();

  const state: WelcomeState = {
    theme: "dark",
    preset: CONFIG_DEFAULT.PROFILE_THEME_PRESET,
    connected: false,
    login: null,
    busy: false,
    message: "",
    messageError: false,
  };

  async function refreshState() {
    const [savedTheme, savedPreset, login, token] = await Promise.all([
      getConfig("BETTER_INTRA_THEME"),
      getConfig("PROFILE_THEME_PRESET"),
      getCloudLogin(),
      getConfig("CLOUD_TOKEN"),
    ]);
    state.theme = (savedTheme as ThemeMode) || "dark";
    state.preset = savedPreset || CONFIG_DEFAULT.PROFILE_THEME_PRESET;
    state.connected = !!token && !!login;
    state.login = login;
  }

  await refreshState();

  const options = themeOptions();

  const dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;

  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  container.className = "w-full h-full";
  shadow.appendChild(container);
  adoptShadowStyles(shadow);

  let resolveClosed!: () => void;
  const closed = new Promise<void>((r) => (resolveClosed = r));
  let finished = false;

  function previewTheme(): string {
    if (state.theme === "light") {
      return isLightPreset(state.preset) ? state.preset : "light";
    }
    if (state.theme === "dark") {
      return isLightPreset(state.preset) ? "dark" : state.preset;
    }
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (sysDark) return isLightPreset(state.preset) ? "dark" : state.preset;
    return isLightPreset(state.preset) ? state.preset : "light";
  }

  function save(key: string, value: unknown): Promise<void> {
    return chrome.storage.local.set({ [key]: value });
  }

  function update() {
    render(template(), container);
  }

  function template() {
    const theme = previewTheme();
    return html`
      <div
        data-theme=${theme}
        class="bg-base-100 text-base-content rounded-2xl shadow-2xl border border-base-300 overflow-hidden"
      >
        <div
          class="p-6 sm:p-8 flex flex-col gap-6 max-h-[92vh] overflow-y-auto"
        >
          <div
            class="relative flex flex-col items-center text-center gap-2 pt-2"
          >
            <div class="flex items-center gap-3">
              <span
                class="size-14 shrink-0 [&_svg]:w-full [&_svg]:h-full"
                style="color: var(--color-primary)"
                >${unsafeHTML(ICON_SVG)}</span
              >
              <h2 class="text-2xl font-bold leading-tight">Better Intra</h2>
              <a
                href="${HUB_INFO.github}/releases"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-sm font-bold transition-all hover:scale-105 active:scale-95"
              >
                <span>v${HUB_INFO.version}</span>
              </a>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-circle btn-ghost absolute right-0 top-0"
              aria-label="Close"
              @click=${() => close()}
            >
              <span class="size-4 [&_svg]:w-full [&_svg]:h-full"
                >${unsafeHTML(X_SVG)}</span
              >
            </button>
          </div>

          <section
            class="rounded-xl border border-base-300 bg-base-200/50 p-5 flex flex-col gap-3"
          >
            <h3 class="font-bold">42 account &amp; cloud sync</h3>
            ${state.connected
              ? html`<div
                  class="flex items-center justify-between gap-4 flex-wrap"
                >
                  <p class="text-sm opacity-70">
                    Connected as
                    <span class="font-mono font-bold">${state.login}</span>.
                  </p>
                  <button
                    type="button"
                    class="btn btn-sm btn-primary font-bold"
                    ?disabled=${state.busy}
                    @click=${() => handleRestore()}
                  >
                    Restore from cloud
                  </button>
                </div>`
              : html`<p class="text-sm opacity-70">
                    Connect to sync settings across devices and unlock friends
                    stats, marks, calendar and more.
                  </p>
                  <div class="flex justify-start">
                    <button
                      type="button"
                      class="btn btn-lg bg-[#00babc] text-white border-none hover:bg-[#1fd2d4] font-bold gap-3"
                      ?disabled=${state.busy}
                      @click=${() => handleConnect()}
                    >
                      <span>Connect with</span>
                      <span
                        class="size-6 flex items-center [&_polygon]:fill-current"
                        >${unsafeHTML(FORTY_TWO_SVG)}</span
                      >
                    </button>
                  </div>`}
            ${state.message
              ? html`<p
                  class="text-xs font-medium ${state.messageError
                    ? "text-error"
                    : "text-success"}"
                >
                  ${state.message}
                </p>`
              : ""}
          </section>

          <section
            class="rounded-xl border border-base-300 bg-base-200/50 p-5 flex flex-col gap-4"
          >
            <h3 class="font-bold">Appearance</h3>
            <div class="flex flex-col gap-2">
              <span class="text-sm font-medium">Accent color</span>
              <div class="flex flex-wrap gap-1">
                ${options.map((o) => {
                  if ((o as { divider?: boolean }).divider) {
                    return html`<div
                      class="w-full h-px bg-base-300 my-1"
                    ></div>`;
                  }
                  if (o.label && !(o as { value?: string }).value) {
                    return html`<div
                      class="w-full text-xs font-bold uppercase opacity-50 pt-1"
                    >
                      ${o.label}
                    </div>`;
                  }
                  const hsl = (o as { color?: string }).color ?? "199 89% 48%";
                  const selected =
                    String((o as { value?: string }).value) ===
                    String(state.preset);
                  const lightness = parseInt(hsl.split(" ")[2] ?? "50");
                  const textColor =
                    lightness > 50 ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)";
                  return html`<button
                    type="button"
                    class="btn btn-sm flex-none"
                    aria-label=${o.label}
                    title=${o.label}
                    style="background-color: hsl(${hsl}); color: ${textColor}; border: 2px solid ${selected
                      ? "#fff"
                      : "transparent"}; outline: ${selected
                      ? `2px solid hsl(${hsl})`
                      : "none"}; outline-offset: 2px;"
                    @click=${() =>
                      setPreset(String((o as { value?: string }).value))}
                  >
                    ${o.label}
                  </button>`;
                })}
              </div>
            </div>
          </section>

          <div class="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              class="btn btn-ghost"
              @click=${() => openFullSettings()}
            >
              Open full settings
            </button>
            <div class="flex gap-2">
              <button
                type="button"
                class="btn btn-ghost"
                @click=${() => close()}
              >
                Skip tour
              </button>
              <button
                type="button"
                class="btn btn-primary font-bold"
                @click=${() => finishWithTour()}
              >
                Get started
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function setPreset(preset: string) {
    state.preset = preset;
    void save("PROFILE_THEME_PRESET", preset);
    state.theme = isLightPreset(preset) ? "light" : "dark";
    void save("BETTER_INTRA_THEME", state.theme);
    update();
  }

  async function handleConnect() {
    state.busy = true;
    state.message = "Waiting for 42…";
    state.messageError = false;
    update();

    await loginWith42(async () => {
      await clearAuthFailed();
      await chrome.storage.local.remove("PENDING_SETTINGS_RESTORE");
      state.connected = true;
      state.login = await getCloudLogin();
      state.busy = false;
      state.message = "Connected! You can now restore your cloud settings.";
      state.messageError = false;
      update();
    });
  }

  async function handleRestore() {
    if (state.busy) return;
    const ok = await showConfirmDialog({
      title: "Restore from cloud",
      message: "Overwrite your local settings with your cloud backup?",
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    state.busy = true;
    state.message = "";
    update();

    const settings = await fetchMySettings();
    if (!settings) {
      state.busy = false;
      state.message = "No cloud backup found for this account.";
      state.messageError = true;
      update();
      return;
    }
    await applyCloudSettings(settings);
    await refreshState();
    state.busy = false;
    state.message = "Settings restored from your cloud backup.";
    state.messageError = false;
    update();
  }

  async function openFullSettings() {
    close();
    const [{ openHubModal }, { getActiveFeatures }] = await Promise.all([
      import("../hub/hubSettings.ui.ts"),
      import("../hub/hubSettings.storage.ts"),
    ]);
    await openHubModal(await getActiveFeatures());
  }

  async function finishWithTour() {
    close();
    const { startTour } = await import("./tour.ts");
    await startTour();
  }

  const onStorage = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (!("CLOUD_TOKEN" in changes) && !("CLOUD_LOGIN" in changes)) return;
    void (async () => {
      const login = await getCloudLogin();
      const token = await getConfig("CLOUD_TOKEN");
      if (!token || !login) return;
      await chrome.storage.local.remove("PENDING_SETTINGS_RESTORE");
      state.connected = true;
      state.login = login;
      state.busy = false;
      state.message = "Connected! You can now restore your cloud settings.";
      state.messageError = false;
      update();
    })();
  };
  chrome.storage.onChanged.addListener(onStorage);

  function close() {
    if (finished) return;
    finished = true;
    chrome.storage.onChanged.removeListener(onStorage);
    void chrome.storage.local.remove("WELCOME_ACTIVE_UNTIL");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    dialog.close();
    dialog.remove();
    resolveClosed();
  }

  render(template(), container);
  dialog.appendChild(host);
  document.body.appendChild(dialog);

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  void chrome.storage.local.set({
    WELCOME_ACTIVE_UNTIL: Date.now() + 10 * 60 * 1000,
  });
  window.addEventListener(
    "pagehide",
    () => {
      chrome.storage.onChanged.removeListener(onStorage);
      void chrome.storage.local.remove("WELCOME_ACTIVE_UNTIL");
    },
    { once: true },
  );

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  dialog.showModal();

  return closed;
}
