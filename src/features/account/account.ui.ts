import { html, render } from "lit-html";
import { getIntraLogin, syncToCloud, testCloudConnection } from "./account.ts";
import { gmSetValue } from "../../lib/gm.ts";
import { getConfig } from "../../config.ts";

export function renderAccountTab(
  login: string | null,
  lastSync: string,
  onPush: () => void,
  onDelete: () => void,
  onPasswordChange: (e: Event) => void,
  onTestConnection: () => void,
  currentPassword: string,
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
            <label class="label py-1">
              <span class="label-text">Username</span>
            </label>
            <input
              type="text"
              class="input input-bordered w-full cursor-not-allowed bg-base-200"
              .value="${login || ""}"
              readonly
            />
          </div>

          <div class="form-control">
            <label class="label py-1">
              <span class="label-text">Password</span>
            </label>
            <input
              type="password"
              class="input input-bordered w-full h-9 min-h-0 focus:input-primary"
              placeholder="******"
              required
              .value="${currentPassword}"
              @input="${onPasswordChange}"
            />
          </div>

          <div class="flex flex-col mt-4">
            <button
              id="push-cloud-btn"
              class="btn btn-primary"
              type="button"
              @click="${onPush}"
            >
              Push Settings to Cloud
            </button>
          </div>
        </div>

        <div class="flex flex-col items-center pt-2 justify-between h-[45]">
          <div class="flex flex-col items-center">
            <span class="text ">Last synced</span>
            <div class="flex items-center gap-4">
              <div
                class="size-4 rounded-full ${isConnected
                  ? "status status-success"
                  : "status status-error"}"
              ></div>
              <span class="text-4xl font-mono font-bold tracking-tight"
                >${lastSync}</span
              >
            </div>
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
          </div>

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
            Reset Session
          </button>
        </div>
      </div>
    </div>
  `;
}

export async function initAccountSettings(container: HTMLElement) {
  const login = getIntraLogin();
  let currentPassword = (await getConfig("CLOUD_PASSWORD")) || "";
  let isConnected = false;

  if (currentPassword && login) {
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

  const handlePasswordChange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    currentPassword = target.value;
    gmSetValue("CLOUD_PASSWORD", currentPassword);
    isConnected = false;
    update();
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
    if (confirm("Delete and reset the session data?")) {
      const { logoutCloud } = await import("./account.ts");
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

    const success = await syncToCloud();

    btn.classList.remove("btn-info", "loading");
    if (success) {
      gmSetValue("LAST_CLOUD_SYNC", Date.now());
      btn.classList.add("btn-success");
      btn.innerHTML = "Synced!";
    } else {
      btn.classList.add("btn-error");
      btn.innerHTML = "Error";
    }

    setTimeout(() => {
      btn.classList.remove("btn-success", "btn-error");
      btn.classList.add("btn-primary");
      btn.innerHTML = originalContent;
      update();
    }, 2500);
  };

  const update = async () => {
    const syncLabel = await getSyncLabel();
    render(
      renderAccountTab(
        login,
        syncLabel,
        handlePush,
        handleDelete,
        handlePasswordChange,
        handleTestConnection,
        currentPassword,
        isConnected,
      ),
      container,
    );
  };

  update();
}
