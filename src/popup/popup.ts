import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { clearAuthFailed, loginWith42 } from "../features/account/account.ts";
import { getConfig } from "../config.ts";
import { initFontManager } from "../utils/font-manager.ts";
import CSS from "../assets/style.css?inline";
import ICON_SVG from "../assets/svg/icon.svg?raw";
import FORTY_TWO_SVG from "../assets/svg/42_Logo.svg?raw";

const style = document.createElement("style");
style.textContent = CSS;
document.head.appendChild(style);

void initFontManager();

function isIntraUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== "https:") return false;
    return hostname === "intra.42.fr" || hostname.endsWith(".intra.42.fr");
  } catch {
    return false;
  }
}

function renderPlaceholder(container: HTMLElement) {
  render(
    html`
      <div
        data-theme="light"
        class="w-full flex flex-col items-center justify-center p-8 gap-4"
      >
        <div class="text-center flex flex-col items-center">
          <span
            class="size-16 flex items-center justify-center [&_svg]:size-full [&_polygon]:fill-current text-[#00babc]"
          >
            ${unsafeHTML(ICON_SVG)}
          </span>
          <h2 class="text-2xl font-bold mt-2">Better Intra</h2>
          <p class="opacity-70 mt-1">Works on Intra pages only.</p>
        </div>
        <button
          class="btn bg-[#00babc] text-white border-none hover:bg-[#1fd2d4] w-full max-w-sm h-14 text-base flex items-center justify-center gap-2 transition-colors duration-200 mt-4 font-bold"
          type="button"
          @click="${() =>
            window.open("https://profile-v3.intra.42.fr/", "_blank")}"
        >
          Open Intra
        </button>
      </div>
    `,
    container,
  );
}

function renderConnectButton(label: string) {
  return html`<button
    class="btn bg-[#00babc] text-white border-none hover:bg-[#1fd2d4] w-full h-14 text-base flex items-center justify-center gap-3 transition-colors duration-200 font-bold"
    type="button"
    @click="${() =>
      loginWith42(async () => {
        await clearAuthFailed();
        window.close();
      })}"
  >
    <span class="font-bold tracking-wide">${label}</span>
    <span
      class="size-8 flex items-center justify-center [&_polygon]:fill-current"
    >
      ${unsafeHTML(FORTY_TWO_SVG)}
    </span>
  </button>`;
}

function openSettings() {
  void chrome.storage.local
    .set({ PENDING_OPEN_HUB: true })
    .then(() => chrome.runtime.sendMessage({ type: "FT_OPEN_HUB" }))
    .catch(() => undefined)
    .finally(() => window.close());
}

async function renderLauncher(container: HTMLElement) {
  const token = await getConfig("CLOUD_TOKEN");
  const login = await getConfig("CLOUD_LOGIN");
  const needsReconnect = !!(await getConfig("CLOUD_AUTH_FAILED"));
  const connected = !!token && !!login;

  render(
    html`
      <div
        data-theme="light"
        class="w-full flex flex-col items-center p-6 gap-4"
      >
        <div class="text-center flex flex-col items-center">
          <span
            class="size-14 flex items-center justify-center [&_svg]:size-full [&_polygon]:fill-current text-[#00babc]"
          >
            ${unsafeHTML(ICON_SVG)}
          </span>
          <h2 class="text-2xl font-bold mt-2">Better Intra</h2>
          ${connected
            ? html`<p class="opacity-70 mt-1">
                Connected as <span class="font-mono font-bold">${login}</span>
              </p>`
            : html`<p class="opacity-70 mt-1">
                Sync your settings across devices.
              </p>`}
          ${connected && needsReconnect
            ? html`<p class="text-warning text-sm font-semibold mt-1">
                Session expired - reconnect.
              </p>`
            : ""}
        </div>
        <div class="w-full flex flex-col gap-2 mt-2">
          ${!connected
            ? renderConnectButton("Connect with")
            : needsReconnect
              ? renderConnectButton("Reconnect with")
              : html`
                  <button
                    class="btn bg-[#00babc] text-white border-none hover:bg-[#1fd2d4] w-full h-12 font-bold transition-colors duration-200"
                    type="button"
                    @click="${openSettings}"
                  >
                    Open settings
                  </button>
                `}
          <button
            class="btn btn-outline w-full h-12 font-bold"
            type="button"
            @click="${() =>
              window.open("https://profile-v3.intra.42.fr/", "_blank")}"
          >
            Open Intra
          </button>
        </div>
      </div>
    `,
    container,
  );
}

async function main() {
  const root = document.getElementById("account-root");
  if (!root) return;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    // Close on login (token set) and on disconnect/wipe (token removed), so the
    // popup can't keep showing a stale connected state.
    if ("CLOUD_TOKEN" in changes) {
      window.close();
    }
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isIntraUrl(tab?.url)) {
    await renderLauncher(root);
  } else {
    renderPlaceholder(root);
  }
}

void main();
