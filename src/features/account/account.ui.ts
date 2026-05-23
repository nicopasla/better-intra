import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { getCloudLogin, testCloudConnection } from "./account.ts";
import { getConfig } from "../../config.ts";
import FORTY_TWO_SVG from "../../assets/svg/42_Logo.svg?raw";
import { AccountState, ButtonState, createInitialState } from "./state.ts";
import { createHandlers } from "./handlers.ts";

function renderAccountTab(
  state: AccountState,
  handlers: ReturnType<typeof createHandlers>,
): ReturnType<typeof html> {
  const isConnected = state.activeSessions > 0;

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
            ${state.token && state.login
              ? html`
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-sm opacity-70">Connected as:</span>
                    <div
                      class="badge badge-outline badge-info font-mono px-3 py-2"
                    >
                      ${state.login}
                    </div>
                  </div>
                `
              : html``}
          </div>

          ${!state.token
            ? html`
                <div class="flex flex-col gap-2 mt-6">
                  <button
                    class="btn bg-[#00babc] text-white border-none hover:bg-[#1fd2d4] w-full h-16 text-lg flex items-center justify-center gap-3 transition-colors duration-200"
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
                        ?checked="${state.isSyncEnabled}"
                        @change="${(e: Event) =>
                          handlers.handleToggleSync(
                            (e.target as HTMLInputElement).checked,
                          )}"
                      />
                    </label>
                    <button
                      id="push-cloud-btn"
                      class="btn ${state.buttons.push.loading
                        ? "btn-info loading"
                        : state.buttons.push.success
                          ? "btn-success"
                          : state.buttons.push.error
                            ? "btn-error"
                            : "btn-primary"}"
                      type="button"
                      ?disabled="${state.buttons.push.loading}"
                      @click="${handlers.handlePush}"
                    >
                      ${state.buttons.push.text}
                    </button>
                  </div>
                  <button
                    id="pull-cloud-btn"
                    class="btn ${state.buttons.pull.loading
                      ? "btn-info loading"
                      : state.buttons.pull.success
                        ? "btn-success"
                        : state.buttons.pull.error
                          ? "btn-error"
                          : "btn-outline btn-primary"}"
                    type="button"
                    ?disabled="${state.buttons.pull.loading}"
                    @click="${handlers.handlePull}"
                  >
                    ${state.buttons.pull.text}
                  </button>
                </div>
              `}
        </div>

        <div class="flex flex-col items-center pt-2 justify-between h-[45]">
          <div class="flex flex-col items-center">
            ${state.token
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
                      ${state.activeSessions}/10
                    </div>
                    ${!isConnected
                      ? html`<button
                          class="btn btn-xs btn-ghost ${state.buttons
                            .testLoading
                            ? "loading"
                            : ""}"
                          @click="${handlers.handleTestConnection}"
                          ?disabled="${state.buttons.testLoading}"
                        >
                          Retry
                        </button>`
                      : ""}
                  </div>
                `
              : ""}
          </div>

          ${state.token
            ? html`
                <button
                  class="btn btn-error btn-outline mt-4 py-3 px-6"
                  type="button"
                  @click="${handlers.handleDelete}"
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

      ${state.token
        ? html`
            <button
              class="absolute bottom-2 right-4 btn btn-link btn-xs text-error opacity-40 hover:opacity-100 transition-opacity"
              type="button"
              @click="${handlers.handleWipe}"
            >
              Wipe all cloud backup data
            </button>
          `
        : ""}
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
