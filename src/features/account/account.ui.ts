import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { fetchSessions, getCloudLogin } from "./account.ts";
import { getConfig } from "../../config.ts";
import { formatRelative } from "../../utils/dates.ts";
import FORTY_TWO_SVG from "../../assets/svg/42_Logo.svg?raw";
import { AccountState, createInitialState } from "./state.ts";
import { createHandlers } from "./handlers.ts";

function formatSessionDate(ts: number): string {
  if (!ts) return "Unknown date";
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function monogram(value: string): string {
  return (value.trim().charAt(0) || "?").toUpperCase();
}

function syncButton(
  kind: "pull" | "push",
  button: AccountState["buttons"]["pull"],
  onClick: () => void,
): ReturnType<typeof html> {
  const color = button.success
    ? "btn-success text-success-content"
    : button.error
      ? "btn-error text-error-content"
      : kind === "pull"
        ? "btn-info"
        : "btn-secondary";
  return html`<button
    class="btn h-12 w-full text-base font-bold ${color} ${button.loading
      ? "loading"
      : ""}"
    type="button"
    ?disabled="${button.loading}"
    @click="${onClick}"
  >
    ${button.loading
      ? kind === "pull"
        ? "Pulling..."
        : "Pushing..."
      : button.text}
  </button>`;
}

function renderAccountTab(
  state: AccountState,
  handlers: ReturnType<typeof createHandlers>,
): ReturnType<typeof html> {
  const isConnected = state.activeSessions > 0;
  const sessionsMax = state.sessionsMax || 20;
  const othersCount = state.sessions.filter((s) => !s.current).length;

  if (!state.token) {
    return html`
      <div class="card bg-base-200 shadow-sm p-5 sm:p-6 w-full">
        <span class="text-base font-medium">Account</span>
        <p class="text-sm opacity-60 mt-1 mb-4">
          ${state.needsReconnect
            ? "Reconnect to restore your settings and sessions."
            : "Sync your settings across devices and manage your sessions."}
        </p>
        <div class="flex items-center gap-4">
          <span
            class="size-12 shrink-0 flex items-center justify-center rounded-xl bg-base-300/50 text-[#00babc] [&_polygon]:fill-current"
          >
            ${unsafeHTML(FORTY_TWO_SVG)}
          </span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium">
              ${state.needsReconnect
                ? "Session expired"
                : "Connect your 42 account"}
            </div>
            <div class="text-xs opacity-50">
              Cloud features need a connected account.
            </div>
          </div>
          <button
            class="btn bg-[#00babc] text-white border-none hover:bg-[#1fd2d4] h-12 px-6 font-bold flex items-center gap-2 transition-colors duration-200 shrink-0"
            type="button"
            @click="${handlers.handleLogin42}"
          >
            Connect with
            <span
              class="size-6 flex items-center justify-center [&_polygon]:fill-current"
            >
              ${unsafeHTML(FORTY_TWO_SVG)}
            </span>
          </button>
        </div>
      </div>
    `;
  }

  return html`
    <div
      class="card bg-base-200 shadow-sm p-5 sm:p-6 w-full h-full min-h-0 flex flex-col gap-4"
    >
      <div>
        <span class="text-base font-medium">Account</span>
        <p class="text-sm opacity-60 mt-1">
          Connect, sync, and manage your sessions.
        </p>
      </div>

      ${state.needsReconnect
        ? html`<div
            class="alert alert-warning rounded-xl flex items-center justify-between py-2"
          >
            <span class="text-sm font-semibold">Session expired</span>
            <button
              class="btn btn-warning btn-sm font-bold"
              type="button"
              @click="${handlers.handleLogin42}"
            >
              Reconnect
            </button>
          </div>`
        : ""}

      <div
        class="stats stats-vertical sm:stats-horizontal bg-base-300/40 border border-base-300 rounded-xl w-full"
      >
        <div class="stat" style="padding:0.75rem 1rem;">
          <div class="stat-title opacity-70" style="font-size:0.8rem;">
            Account
          </div>
          <div
            class="stat-value font-mono truncate"
            style="font-size:1.25rem;font-weight:700;"
          >
            ${state.login}
          </div>
        </div>
        <div class="stat" style="padding:0.75rem 1rem;">
          <div class="stat-title opacity-70" style="font-size:0.8rem;">
            Cloud
          </div>
          <div
            class="stat-value flex items-center gap-2"
            style="font-size:1.25rem;font-weight:700;"
          >
            <span
              class="status ${isConnected ? "status-success" : "status-error"}"
            ></span>
            ${isConnected ? "Online" : "Offline"}
          </div>
        </div>
        <div class="stat" style="padding:0.75rem 1rem;">
          <div class="stat-title opacity-70" style="font-size:0.8rem;">
            Sessions
          </div>
          <div
            class="stat-value font-mono"
            style="font-size:1.25rem;font-weight:700;"
          >
            ${state.sessions.length}/${sessionsMax}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        <div class="rounded-xl bg-base-300/40 p-4 flex flex-col gap-3 min-h-0">
          <div class="flex items-center justify-between gap-3">
            <div class="flex flex-col">
              <span class="text-sm font-semibold">Sessions</span>
              <span class="text-xs opacity-50">Where you're signed in</span>
            </div>
            <span class="badge badge-ghost font-mono"
              >${state.sessions.length}/${sessionsMax}</span
            >
          </div>

          ${state.sessions.length === 0
            ? html`<p class="text-xs opacity-50">No active sessions.</p>`
            : html`<ul
                class="list bg-base-100 rounded-box border border-base-300 flex-1 min-h-0 overflow-y-auto"
              >
                ${state.sessions.map(
                  (s) => html`
                    <li class="list-row items-center">
                      <div class="avatar avatar-placeholder">
                        <div
                          class="w-9 rounded-full bg-base-300 text-base-content/70"
                          style="display:grid;place-items:center;"
                        >
                          <span class="text-xs font-bold"
                            >${monogram(s.name || s.label)}</span
                          >
                        </div>
                      </div>
                      <div class="list-col-grow min-w-0">
                        <div
                          class="flex items-center gap-2 text-sm font-semibold"
                        >
                          <span class="truncate">${s.label}</span>
                          ${s.current
                            ? html`<span class="badge badge-success badge-sm"
                                >This session</span
                              >`
                            : ""}
                        </div>
                        <div class="text-xs opacity-50 truncate">
                          ${s.name ? `${s.name} · ` : ""}${s.country ||
                          "Unknown location"}
                          · ${formatSessionDate(s.createdAt)}
                        </div>
                      </div>
                      ${s.current
                        ? ""
                        : html`<button
                            class="btn btn-xs btn-ghost text-error font-bold ${state.revokingId ===
                            s.id
                              ? "loading"
                              : ""}"
                            type="button"
                            ?disabled="${state.revokingId === s.id}"
                            @click="${() => handlers.handleRevokeSession(s.id)}"
                          >
                            Revoke
                          </button>`}
                    </li>
                  `,
                )}
              </ul>`}
          ${othersCount > 0
            ? html`<button
                class="btn btn-xs btn-ghost text-error font-bold self-end ${state.revokingOthers
                  ? "loading"
                  : ""}"
                type="button"
                ?disabled="${state.revokingOthers}"
                @click="${handlers.handleRevokeOthers}"
              >
                Sign out other sessions
              </button>`
            : ""}
        </div>

        <div class="flex flex-col gap-4 min-h-0">
          <div class="rounded-xl bg-base-300/40 p-4 flex flex-col gap-3">
            <div class="flex flex-col">
              <span class="text-sm font-semibold">Cloud sync</span>
              <span class="text-xs opacity-50">Push or pull your settings</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              ${syncButton("pull", state.buttons.pull, handlers.handlePull)}
              ${syncButton("push", state.buttons.push, handlers.handlePush)}
              <button
                class="badge h-12 w-full text-sm font-bold cursor-pointer ${state.autoPush
                  ? "badge-success text-success-content"
                  : "badge-ghost"}"
                type="button"
                @click="${() => handlers.handleToggleAutoPush(!state.autoPush)}"
              >
                Auto push ${state.autoPush ? "on" : "off"}
              </button>
              <span
                class="badge badge-ghost h-12 w-full text-sm font-mono opacity-80"
              >
                Last synced ${formatRelative(state.lastSynced)}
              </span>
            </div>
          </div>

          <div
            class="mt-auto rounded-xl bg-base-300/40 p-4 flex flex-col gap-3 border border-error/30"
          >
            <div class="flex flex-col">
              <span class="text-sm font-semibold">Danger zone</span>
              <span class="text-xs opacity-50">
                Disconnect this session or permanently delete your cloud data.
              </span>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <button
                class="btn btn-error btn-sm font-bold"
                type="button"
                @click="${handlers.handleDelete}"
              >
                Disconnect
              </button>
              <button
                class="btn btn-outline btn-error btn-sm font-bold"
                type="button"
                @click="${handlers.handleWipe}"
              >
                Wipe all data
              </button>
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
    state.needsReconnect = !!(await getConfig("CLOUD_AUTH_FAILED"));
    if (state.token && state.login) {
      const { sessions, max } = await fetchSessions();
      state.sessions = sessions;
      state.sessionsMax = max;
      state.activeSessions = sessions.length;
    } else {
      state.sessions = [];
      state.sessionsMax = 0;
      state.activeSessions = 0;
    }

    state.autoPush = (await getConfig("CLOUD_SYNC_ENABLED")) === true;
    state.lastSynced = (await getConfig("LAST_CLOUD_SYNC")) ?? null;

    render(renderAccountTab(state, handlers), container);
  }

  // Initial load
  await update();
}
