import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import {
  getCloudLogin,
  syncToCloud,
  testCloudConnection,
  fetchMySettings,
  applyCloudSettings,
  logoutCloud,
  loginWith42,
  wipeAllCloudData,
} from "./account.ts";
import { getConfig } from "../../config.ts";
import FORTY_TWO_SVG from "../../assets/svg/42_Logo.svg?raw";

export interface ButtonState {
  loading: boolean;
  success: boolean;
  error: boolean;
  text: string;
}

export function renderAccountTab(
  login: string | null,
  onPush: () => void,
  onPull: () => void,
  onDelete: () => void,
  onLogin42: () => void,
  onTestConnection: () => void,
  isSyncEnabled: boolean,
  onToggleSync: (v: boolean) => void,
  hasToken: boolean,
  activeSessions: number = 0,
  pushBtnState: ButtonState,
  pullBtnState: ButtonState,
  testBtnLoading: boolean,
): ReturnType<typeof html> {
  const isConnected = activeSessions > 0;

  return html`
    <style>
      :host [data-feature-panel="account"] {
        height: 100%;
        overflow: hidden !important;
      }
    </style>

    <div
      class="account-settings relative w-full min-h-full flex flex-col items-center justify-between p-0 pb-12 bg-transparent"
    >
      <div class="grid grid-cols-2 gap-8 w-full max-w-4xl px-8 mt-4">
        <div class="flex flex-col gap-2">
          <div class="form-control">
            ${hasToken && login
              ? html`
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-sm opacity-70">Connected as:</span>
                    <div
                      class="badge badge-outline badge-info font-mono px-3 py-2"
                    >
                      ${login}
                    </div>
                  </div>
                `
              : html``}
          </div>

          ${!hasToken
            ? html`
                <div class="flex flex-col gap-2 mt-6">
                  <button
                    class="btn bg-[#00babc] text-white border-none hover:bg-[#1fd2d4] w-full h-16 text-lg flex items-center justify-center gap-3 transition-colors duration-200"
                    type="button"
                    @click="${onLogin42}"
                  >
                    <span class="font-bold tracking-wide">Connect with</span>
                    <span
                      class="size-10 flex items-center justify-center [&_polygon]:fill-current"
                    >
                      ${unsafeHTML(FORTY_TWO_SVG)}
                    </span>
                  </button>
                </div>
              `
            : html`
                <div class="flex flex-col gap-2 mt-4">
                  <div class="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <label
                      class="flex items-center gap-2 cursor-pointer p-2 bg-base-200 rounded-lg"
                    >
                      <span class="font-medium">Sync</span>
                      <input
                        type="checkbox"
                        class="toggle toggle-primary"
                        ?checked="${isSyncEnabled}"
                        @change="${(e: Event) =>
                          onToggleSync((e.target as HTMLInputElement).checked)}"
                      />
                    </label>
                    <button
                      id="push-cloud-btn"
                      class="btn ${pushBtnState.loading
                        ? "btn-info loading"
                        : pushBtnState.success
                          ? "btn-success"
                          : pushBtnState.error
                            ? "btn-error"
                            : "btn-primary"}"
                      type="button"
                      ?disabled="${pushBtnState.loading}"
                      @click="${onPush}"
                    >
                      ${pushBtnState.text}
                    </button>
                  </div>
                  <button
                    id="pull-cloud-btn"
                    class="btn ${pullBtnState.loading
                      ? "btn-info loading"
                      : pullBtnState.success
                        ? "btn-success"
                        : pullBtnState.error
                          ? "btn-error"
                          : "btn-outline btn-primary"}"
                    type="button"
                    ?disabled="${pullBtnState.loading}"
                    @click="${onPull}"
                  >
                    ${pullBtnState.text}
                  </button>
                </div>
              `}
        </div>

        <div class="flex flex-col items-center pt-2 justify-between h-[45]">
          <div class="flex flex-col items-center">
            ${hasToken
              ? html`
                  <div
                    class="mt-4 flex items-center justify-center gap-2 px-6 py-3 border border-base-300 rounded-lg"
                  >
                    <span class="text-sm opacity-70">Sessions:</span>
                    <div
                      class="badge ${isConnected
                        ? "badge-success"
                        : "badge-error"} font-mono"
                    >
                      ${activeSessions}/10
                    </div>
                    ${!isConnected
                      ? html`<button
                          class="btn btn-xs btn-ghost"
                          @click="${onTestConnection}"
                        >
                          Retry
                        </button>`
                      : ""}
                  </div>
                `
              : ""}
          </div>

          ${hasToken
            ? html`
                <button
                  class="btn btn-error btn-outline mt-4 py-3 px-6"
                  type="button"
                  @click="${onDelete}"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Disconnect
                </button>
              `
            : ""}
        </div>
      </div>

      ${hasToken
        ? html`
            <button
              class="absolute bottom-2 right-4 btn btn-link btn-xs text-error opacity-40 hover:opacity-100 transition-opacity"
              type="button"
              @click="${() => {
                if (
                  confirm(
                    "This will permanently delete ALL your saved settings and sessions from the cloud. Are you sure?",
                  )
                ) {
                  const event = new CustomEvent("wipe-cloud");
                  window.dispatchEvent(event);
                }
              }}"
            >
              Wipe all cloud backup data
            </button>
          `
        : ""}
    </div>
  `;
}

export async function initAccountSettings(container: HTMLElement) {
  const login = await getCloudLogin();
  let token = (await getConfig("CLOUD_TOKEN")) || "";
  let isSyncEnabled = (await getConfig("CLOUD_SYNC_ENABLED")) ?? true;
  let activeSessions = 0;

  const handleToggleSync = async (enabled: boolean) => {
    isSyncEnabled = enabled;
    await chrome.storage.local.set({ CLOUD_SYNC_ENABLED: enabled });
    update();
  };

  const buttonStates = {
    push: {
      loading: false,
      success: false,
      error: false,
      text: "Push Settings",
    },
    pull: {
      loading: false,
      success: false,
      error: false,
      text: "Pull Settings",
    },
    testLoading: false,
  };

  if (token && login) {
    const res = await testCloudConnection();
    activeSessions = typeof res === "number" ? res : res ? 1 : 0;
  }

  window.addEventListener("wipe-cloud", async () => {
    const success = await wipeAllCloudData();
    if (success) {
      alert("All cloud data successfully wiped.");
      window.location.reload();
    } else {
      alert("Failed to delete cloud data. Please try again.");
    }
  });

  const getSyncLabel = async () => {
    const ts = await getConfig("LAST_CLOUD_SYNC");
    if (!ts) return "Never";
    return new Date(Number(ts)).toLocaleString([], {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleLogin42 = () => {
    loginWith42(() => {
      console.log("Settings refreshed without reload!");
      update();
    });
  };

  const handleTestConnection = async () => {
    buttonStates.testLoading = true;
    update();

    const res = await testCloudConnection();
    activeSessions = typeof res === "number" ? res : res ? 1 : 0;

    buttonStates.testLoading = false;
    update();
  };

  const handleDelete = async () => {
    if (confirm("Disconnect and clear your cloud session data locally?")) {
      await logoutCloud();
      window.location.reload();
    }
  };

  const handlePush = async () => {
    if (buttonStates.push.loading) return;

    buttonStates.push = {
      loading: true,
      success: false,
      error: false,
      text: "Connecting...",
    };
    update();

    const res = await testCloudConnection();
    const isCloudAlive = !!res;

    if (!isCloudAlive) {
      buttonStates.push = {
        loading: false,
        success: false,
        error: true,
        text: "Connection Failed",
      };
      update();

      setTimeout(() => {
        buttonStates.push = {
          loading: false,
          success: false,
          error: false,
          text: "Push Settings to Cloud",
        };
        update();
      }, 2500);
      return;
    }

    const success = await syncToCloud();

    if (success) {
      await chrome.storage.local.set({ LAST_CLOUD_SYNC: Date.now() });
      buttonStates.push = {
        loading: false,
        success: true,
        error: false,
        text: "Synced!",
      };
    } else {
      buttonStates.push = {
        loading: false,
        success: false,
        error: true,
        text: "Sync Failed",
      };
    }
    update();

    setTimeout(() => {
      buttonStates.push = {
        loading: false,
        success: false,
        error: false,
        text: "Push Settings to Cloud",
      };
      update();
    }, 2500);
  };

  const handlePull = async () => {
    if (buttonStates.pull.loading) return;
    if (!confirm("Overwrite current local settings with cloud backup?")) return;

    buttonStates.pull = {
      loading: true,
      success: false,
      error: false,
      text: "Connecting...",
    };
    update();

    const res = await testCloudConnection();
    const isCloudAlive = !!res;

    if (!isCloudAlive) {
      buttonStates.pull = {
        loading: false,
        success: false,
        error: true,
        text: "Connection Failed",
      };
      update();

      setTimeout(() => {
        buttonStates.pull = {
          loading: false,
          success: false,
          error: false,
          text: "Pull Settings from Cloud",
        };
        update();
      }, 2000);
      return;
    }

    const settings = await fetchMySettings();

    if (settings) {
      await applyCloudSettings(settings);
      await chrome.storage.local.set({ LAST_CLOUD_SYNC: Date.now() });
      buttonStates.pull = {
        loading: false,
        success: true,
        error: false,
        text: "Restored!",
      };
      update();
      setTimeout(() => window.location.reload(), 1500);
    } else {
      buttonStates.pull = {
        loading: false,
        success: false,
        error: true,
        text: "No Data Found",
      };
      update();

      setTimeout(() => {
        buttonStates.pull = {
          loading: false,
          success: false,
          error: false,
          text: "Pull Settings from Cloud",
        };
        update();
      }, 2000);
    }
  };

  const update = async () => {
    const newLogin = await getCloudLogin();
    const newToken = await getConfig("CLOUD_TOKEN");

    token = newToken || "";
    const login = newLogin || "";

    if (token && login) {
      const res = await testCloudConnection();
      activeSessions = typeof res === "number" ? res : res ? 1 : 0;
    }

    render(
      renderAccountTab(
        login,
        handlePush,
        handlePull,
        handleDelete,
        handleLogin42,
        handleTestConnection,
        isSyncEnabled,
        handleToggleSync,
        !!token,
        activeSessions,
        buttonStates.push,
        buttonStates.pull,
        buttonStates.testLoading,
      ),
      container,
    );
  };

  update();
}
