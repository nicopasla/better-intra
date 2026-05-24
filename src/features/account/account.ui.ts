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
          <span class="font-bold tracking-wide">Connect with</span>
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
    <div
      class="w-full h-full p-6 pt-2 pb-2 flex flex-col justify-between gap-4"
    >
      <!-- Top Section: Status & Sync Info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Left Card: Account Status -->
        <div class="card bg-base-200 shadow-sm p-3 sm:p-4">
          <h2 class="text-lg font-bold">Account Status</h2>
          <div class="flex flex-col gap-4 mt-3">
            <div class="flex items-center justify-between">
              <span class="font-medium text-sm">Login:</span>
              <div class="badge badge-outline badge-info font-mono">
                ${state.login}
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="font-medium text-sm">Cloud:</span>
              <div
                class="badge ${isConnected ? "badge-success" : "badge-error"}"
              >
                ${isConnected ? "Connected" : "Disconnected"}
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="font-medium text-sm">Active Sessions:</span>
              <div class="badge badge-success">${state.activeSessions}/10</div>
            </div>
          </div>
        </div>

        <!-- Right Card: Cloud Sync -->
        <div class="card bg-base-200 shadow-sm p-3 sm:p-4">
          <h2 class="text-lg font-bold">Cloud Sync</h2>
          <div class="flex flex-col gap-4 mt-3">
            <button
              id="pull-cloud-btn"
              class="btn btn-primary h-12 text-base ${
                state.buttons.pull.loading
                  ? "loading"
                  : state.buttons.pull.success
                    ? "btn-success"
                    : state.buttons.pull.error
                      ? "btn-error"
                      : ""
              }"
              type="button"
              ?disabled="${state.buttons.pull.loading}"
              @click="${handlers.handlePull}"
            >
              ${state.buttons.pull.text}
            </button>
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  ?checked="${state.isSyncEnabled}"
                  @change="${(e: Event) =>
                    handlers.handleToggleSync(
                      (e.target as HTMLInputElement).checked,
                    )}"
                />
                <span class="font-medium">Auto-sync</span>
              </label>
              <button
                id="push-cloud-btn"
                class="btn btn-sm ${
                  state.buttons.push.loading
                    ? "btn-ghost loading"
                    : "btn-success"
                }"
                type="button"
                ?disabled="${state.buttons.push.loading}"
                @click="${handlers.handlePush}"
              >
                ${state.buttons.push.text}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Card: Actions -->
      <div class="card bg-base-200 shadow-sm p-3 sm:p-4 mt-auto">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex items-center">
            <button
              class="btn btn-outline btn-error w-full"
              type="button"
              @click="${handlers.handleDelete}"
            >
              Disconnect
            </button>
          </div>
          <div class="flex items-center">
            <div
              tabindex="0"
              class="collapse collapse-arrow border border-error/50 rounded-box w-full"
            >
              <div class="collapse-title text-sm font-medium text-error">
                Wipe All Data
              </div>
                <div class="collapse-content text-sm">
                  Permanently delete all synced settings from the cloud.
                  <strong>This action cannot be undone.</strong>
                  <div class="flex justify-end">
                  <button
                    class="btn btn-xs btn-error"
                    type="button"
                    @click="${handlers.handleWipe}"
                  >
                    Wipe All Data
                  </button>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
