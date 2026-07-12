import { html, render } from "lit-html";
import { addFriend, removeFriend, isFriend } from "./friends.ts";
import { getCloudLogin, syncToCloud } from "../account/account.ts";
import { getConfig } from "../../config.ts";
import { sharedCSS } from "../../assets/shared-styles.ts";

let injected = false;
let _btnRunning = false;

export async function injectFriendButton() {
  if (_btnRunning) return;
  _btnRunning = true;
  try {
    const show = await getConfig("SHOW_FRIENDS_WIDGET");
    if (!show) {
      _btnRunning = false;
      return;
    }

    const pathParts = location.pathname.split("/").filter((p) => p);
    if (pathParts[0] !== "users" || !pathParts[1]) {
      document.getElementById("ft-friend-btn-shadow")?.remove();
      injected = false;
      _btnRunning = false;
      return;
    }

    const targetLogin = pathParts[1];
    const myLogin = await getCloudLogin();
    if (!myLogin || targetLogin === myLogin) {
      document.getElementById("ft-friend-btn-shadow")?.remove();
      injected = false;
      _btnRunning = false;
      return;
    }

    const existing = document.getElementById(
      "ft-friend-btn-shadow",
    ) as HTMLElement | null;
    if (existing) {
      if (existing.dataset.login === targetLogin) {
        _btnRunning = false;
        return;
      }
      existing.remove();
      injected = false;
    }

    const isDark = document.documentElement.classList.contains("dark");

    const host = document.createElement("span");
    host.id = "ft-friend-btn-shadow";
    host.style.display = "inline-flex";
    host.dataset.login = targetLogin;
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `${sharedCSS}`;
    root.appendChild(style);

    const wrapper = document.createElement("span");
    wrapper.setAttribute("data-theme", isDark ? "dark" : "light");
    root.appendChild(wrapper);

    let friend = false;
    const renderBtn = () => {
      render(
        html`
          <button
            type="button"
            class="btn btn-xs btn-square ${friend
              ? "btn-success"
              : "btn-accent"}"
            title="${friend ? "Remove" : "Add"}"
            @click="${async (e: Event) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.disabled = true;
              btn.classList.add("loading");
              try {
                if (friend) {
                  await removeFriend(targetLogin);
                } else {
                  await addFriend(targetLogin);
                }
                syncToCloud();
                injected = false;
                document.getElementById("ft-friend-btn-shadow")?.remove();
                injectFriendButton();
              } catch {
                btn.disabled = false;
                btn.classList.remove("loading");
              }
            }}"
          >
            ${friend
              ? html`<svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>`
              : html`<svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>`}
          </button>
        `,
        wrapper,
      );
    };

    renderBtn();

    const combobox = document.querySelector<HTMLElement>(
      "button[role='combobox']",
    );
    if (combobox) {
      const parent = combobox.parentElement;
      if (parent) {
        parent.style.display = "flex";
        parent.style.alignItems = "center";
        parent.style.gap = "4px";
      }
      combobox.insertAdjacentElement("beforebegin", host);
      injected = true;
    }

    isFriend(targetLogin).then((already) => {
      friend = already;
      renderBtn();
    });
  } finally {
    _btnRunning = false;
  }
}
