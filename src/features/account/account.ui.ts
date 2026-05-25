import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { getCloudLogin, testCloudConnection } from "./account.ts";
import { getConfig } from "../../config.ts";
import FORTY_TWO_SVG from "../../assets/svg/42_Logo.svg?raw";
import { AccountState, createInitialState } from "./state.ts";
import { createHandlers } from "./handlers.ts";

function renderAccountTab(
  state: AccountState,
  handlers: ReturnType<typeof createHandlers>,
): ReturnType<typeof html> {
  const isConnected = state.activeSessions > 0;

  // If not logged in, show a simple, centered connect button.
  if (!state.token) {
    return html`
      <div
        class="w-full h-full flex flex-col items-center justify-center p-8 gap-4"
      >
        <div class="text-center">
          <h2 class="text-2xl font-bold">Connect your Account</h2>
          <p class="opacity-70 mt-1">Sync your settings across devices.</p>
        </div>
        <button
          class="btn bg-[#00babc] text-white border-none hover:bg-[#1fd2d4] w-full max-w-sm h-16 text-lg flex items-center justify-center gap-3 transition-colors duration-200 mt-4"
          type="button"
          @click="${handlers.handleLogin42}"
        >
          <span class="font-bold tracking-wide text-base">Connect with</span>
          <span
            class="size-10 flex items-center justify-center [&_polygon]:fill-current"
          >
            ${unsafeHTML(FORTY_TWO_SVG)}
          </span>
        </button>
      </div>
    `;
  }

  // Main dashboard view for logged-in users.
  return html`
    <div class="w-full h-full flex flex-col gap-4 overflow-y-auto">
      <!-- Top Section: Status & Sync Info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Left Card: Account Status -->
        <div class="card bg-base-200 shadow-md p-5 border border-base-300">
          <h2 class="text-lg font-bold text-base-content mb-4">
            Account Status
          </h2>
          <div class="flex flex-col gap-3">
            <div
              class="flex items-center justify-between bg-base-100 p-3 rounded-lg border border-base-300"
            >
              <span class="font-medium text-sm text-base-content">Login</span>
              <div
                class="badge badge-info font-mono font-bold text-info-content"
              >
                ${state.login}
              </div>
            </div>
            <div
              class="flex items-center justify-between bg-base-100 p-3 rounded-lg border border-base-300"
            >
              <span class="font-medium text-sm text-base-content"
                >Cloud Status</span
              >
              <div
                class="badge ${isConnected
                  ? "badge-success"
                  : "badge-warning"} font-bold"
              >
                ${isConnected ? "Connected" : "Offline"}
              </div>
            </div>
            <div
              class="flex items-center justify-between bg-base-100 p-3 rounded-lg border border-base-300"
            >
              <span class="font-medium text-sm text-base-content"
                >Sessions</span
              >
              <div class="badge badge-success font-bold text-success-content">
                ${state.activeSessions}/10
              </div>
            </div>
          </div>
        </div>

        <!-- Right Card: Cloud Sync -->
        <div class="card bg-base-200 shadow-md p-5 border border-base-300">
          <h2 class="text-lg font-bold text-base-content mb-4">Cloud Sync</h2>
          <div class="grid grid-cols-2 gap-3">
            <!-- Pull Button -->
            <button
              id="pull-cloud-btn"
              class="btn btn-info font-bold transition-all text-info-content h-full py-3 text-base row-span-2 ${state
                .buttons.pull.loading
                ? "loading"
                : state.buttons.pull.success
                  ? "btn-success text-success-content"
                  : state.buttons.pull.error
                    ? "btn-error text-error-content"
                    : ""}"
              type="button"
              ?disabled="${state.buttons.pull.loading}"
              @click="${handlers.handlePull}"
            >
              ${state.buttons.pull.loading
                ? "Pulling..."
                : state.buttons.pull.text}
            </button>

            <!-- Auto-sync Toggle -->
            <div
              class="bg-base-100 p-3 rounded-lg border border-base-300 flex items-center justify-between"
            >
              <label class="flex items-center gap-2 cursor-pointer w-full">
                <input
                  type="checkbox"
                  class="toggle toggle-info"
                  ?checked="${state.isSyncEnabled}"
                  @change="${(e: Event) =>
                    handlers.handleToggleSync(
                      (e.target as HTMLInputElement).checked,
                    )}"
                />
                <span class="font-medium text-base text-base-content"
                  >Auto-sync</span
                >
              </label>
            </div>

            <!-- Push Button -->
            <button
              id="push-cloud-btn"
              class="btn btn-success text-success-content font-bold transition-all text-base h-auto py-3 ${state
                .buttons.push.loading
                ? "loading"
                : ""}"
              type="button"
              ?disabled="${state.buttons.push.loading}"
              @click="${handlers.handlePush}"
            >
              ${state.buttons.push.loading
                ? "Pushing..."
                : state.buttons.push.text}
            </button>
          </div>
        </div>
      </div>

      <!-- Bottom Section: Action Buttons -->
      <div class="flex justify-between gap-4 mt-auto pt-4">
        <button
          class="btn btn-error text-error-content font-bold transition-all text-base"
          type="button"
          @click="${handlers.handleDelete}"
        >
          Disconnect
        </button>
        <button
          class="btn btn-error text-error-content font-bold transition-all text-base"
          type="button"
          @click="${handlers.handleWipe}"
        >
          Wipe All Data
        </button>
      </div>
    </div>
  `;
}

export async function initAccountSettings(container: HTMLElement) {
  const state = createInitialState();
  const handlers = createHandlers(state, update);

  async function update() {
    // Fetch latest state before re-rendering
    state.login = await getCloudLogin();
    state.token = (await getConfig("CLOUD_TOKEN")) || "";
    if (state.token && state.login) {
      state.activeSessions = await testCloudConnection();
    }

    render(renderAccountTab(state, handlers), container);
  }

  // Initial load
  state.isSyncEnabled = (await getConfig("CLOUD_SYNC_ENABLED")) ?? true;
  await update();
}
