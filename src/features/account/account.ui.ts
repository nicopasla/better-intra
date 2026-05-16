import { html, render } from "lit-html";
import {
  getIntraLogin,
  syncToCloud,
  testCloudConnection,
  fetchMySettings,
  applyCloudSettings,
  logoutCloud,
  loginWith42,
} from "./account.ts";
import { gmSetValue } from "../../lib/gm.ts";
import { getConfig } from "../../config.ts";

export function renderAccountTab(
  login: string | null,
  lastSync: string,
  onPush: () => void,
  onPull: () => void,
  onDelete: () => void,
  onLogin42: () => void,
  onTestConnection: () => void,
  hasToken: boolean,
  isConnected: boolean = false,
): ReturnType<typeof html> {
  return html`
    <style>
      :host [data-feature-panel="account"] {
        height: 100%;
        overflow: hidden !important;
      }
    </style>

    <div
      class="account-settings h-full w-full flex flex-col items-center justify-start p-0 overflow-hidden bg-transparent"
    >
      <div class="grid grid-cols-2 gap-8 w-full max-w-4xl px-8 mt-4">
        <div class="flex flex-col gap-2">
          <div class="form-control">
            ${hasToken && login
              ? html`
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-sm opacity-70">Connected as:</span>
                    <div
                      class="badge badge-primary font-mono text-sm px-3 py-2"
                    >
                      ${login}
                    </div>
                  </div>
                `
              : html`
                  <label class="label py-1">
                    <span class="label-text opacity-50"
                      >Not connected to Cloud</span
                    >
                  </label>
                `}
          </div>

          ${!hasToken
            ? html`
                <div class="flex flex-col gap-2 mt-6">
                  <button
                    class="btn btn-primary w-full flex items-center justify-center gap-2"
                    type="button"
                    @click="${onLogin42}"
                  >
                    <span>⚡</span> Connect with 42
                  </button>
                </div>
              `
            : html`
                <div class="flex flex-col gap-2 mt-4">
                  <button
                    id="push-cloud-btn"
                    class="btn btn-primary"
                    type="button"
                    @click="${onPush}"
                  >
                    Push Settings to Cloud
                  </button>
                  <button
                    id="pull-cloud-btn"
                    class="btn btn-outline btn-primary"
                    type="button"
                    @click="${onPull}"
                  >
                    Pull Settings from Cloud
                  </button>
                </div>
              `}
        </div>

        <div class="flex flex-col items-center pt-2 justify-between h-[45]">
          <div class="flex flex-col items-center">
            <span class="text">Last synced</span>
            <div class="flex items-center gap-4">
              <div
                class="size-3 rounded-full ${isConnected
                  ? "status status-success"
                  : "status status-error"}"
              ></div>
              <span class="text-xl font-mono">${lastSync}</span>
            </div>

            ${hasToken
              ? html`
                  <button
                    id="test-conn-btn"
                    class="mt-4 btn py-3 px-6 ${isConnected
                      ? "btn-success text-white"
                      : "btn-info"}"
                    type="button"
                    @click="${onTestConnection}"
                  >
                    ${isConnected ? "Connected" : "Test connection"}
                  </button>
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
    </div>
  `;
}

export async function initAccountSettings(container: HTMLElement) {
  const login = getIntraLogin();
  let token = (await getConfig("CLOUD_TOKEN")) || "";
  let isConnected = false;

  if (token && login) {
    isConnected = await testCloudConnection();
  }

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
    loginWith42();
  };

  const handleTestConnection = async () => {
    const btn = container.querySelector("#test-conn-btn") as HTMLButtonElement;
    if (!btn) return;

    btn.classList.add("loading");
    isConnected = await testCloudConnection();
    btn.classList.remove("loading");

    update();
  };

  const handleDelete = async () => {
    if (confirm("Disconnect and clear your cloud session data locally?")) {
      await logoutCloud();
      window.location.reload();
    }
  };

  const handlePush = async () => {
    const btn = container.querySelector("#push-cloud-btn") as HTMLButtonElement;
    if (!btn) return;

    const originalContent = btn.innerHTML;
    btn.classList.remove("btn-primary", "btn-success", "btn-error");
    btn.classList.add("btn-info", "loading");

    const isCloudAlive = await testCloudConnection();
    if (!isCloudAlive) {
      btn.classList.remove("btn-info", "loading");
      btn.classList.add("btn-error");
      btn.innerHTML = "Connection Failed";

      setTimeout(() => {
        btn.classList.remove("btn-error");
        btn.classList.add("btn-primary");
        btn.innerHTML = originalContent;
        update();
      }, 2500);
      return;
    }

    const success = await syncToCloud();

    btn.classList.remove("btn-info", "loading");
    if (success) {
      await gmSetValue("LAST_CLOUD_SYNC", Date.now());
      btn.classList.add("btn-success");
      btn.innerHTML = "Synced!";
    } else {
      btn.classList.add("btn-error");
      btn.innerHTML = "Sync Failed";
    }

    setTimeout(() => {
      btn.classList.remove("btn-success", "btn-error");
      btn.classList.add("btn-primary");
      btn.innerHTML = originalContent;
      update();
    }, 2500);
  };

  const handlePull = async () => {
    const btn = container.querySelector("#pull-cloud-btn") as HTMLButtonElement;
    if (!btn) return;

    if (!confirm("Overwrite current local settings with cloud backup?")) return;

    const originalContent = btn.innerHTML;
    btn.classList.remove("btn-primary", "btn-success", "btn-error");
    btn.classList.add("btn-info", "loading");

    const isCloudAlive = await testCloudConnection();

    if (!isCloudAlive) {
      btn.classList.remove("btn-info", "loading");
      btn.classList.add("btn-error");
      btn.innerHTML = "Connection Failed";

      setTimeout(() => {
        btn.classList.remove("btn-error");
        btn.classList.add("btn-primary");
        btn.innerHTML = originalContent;
        update();
      }, 2500);
      return;
    }

    const settings = await fetchMySettings();

    btn.classList.remove("btn-info", "loading");
    if (settings) {
      await applyCloudSettings(settings);
      await gmSetValue("LAST_CLOUD_SYNC", Date.now());
      btn.classList.add("btn-success");
      btn.innerHTML = "Restored!";
      setTimeout(() => window.location.reload(), 1500);
    } else {
      btn.classList.add("btn-error");
      btn.innerHTML = "No Data Found";
      setTimeout(() => {
        btn.classList.remove("btn-error");
        btn.classList.add("btn-primary");
        btn.innerHTML = originalContent;
        update();
      }, 2500);
    }
  };

  const update = async () => {
    const syncLabel = await getSyncLabel();
    token = (await getConfig("CLOUD_TOKEN")) || "";

    render(
      renderAccountTab(
        login,
        syncLabel,
        handlePush,
        handlePull,
        handleDelete,
        handleLogin42,
        handleTestConnection,
        !!token,
        isConnected,
      ),
      container,
    );
  };

  update();
}
