import { html, render } from "lit-html";
import { addFriend, removeFriend, isFriend } from "./friends.ts";
import { getCloudLogin, syncToCloud } from "../account/account.ts";
import { getConfig } from "../../config.ts";
import { sharedCSS } from "../../assets/shared-styles.ts";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import CHECK_SVG from "../../assets/svg/check.svg?raw";
import PLUS_SVG from "../../assets/svg/plus.svg?raw";

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
              ? html`<span
                  class="size-3.5 flex items-center justify-center"
                  >${unsafeHTML(CHECK_SVG)}</span
                >`
              : html`<span
                  class="size-3.5 flex items-center justify-center"
                  >${unsafeHTML(PLUS_SVG)}</span
                >`}
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
