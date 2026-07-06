import { html, render } from "lit-html";
import { addFriend, removeFriend, isFriend } from "./friends.ts";
import { getCloudLogin, syncToCloud } from "../account/account.ts";
import { getConfig } from "../../config.ts";

let injected = false;
let _btnRunning = false;

const checkIcon = html`<svg
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
</svg>`;
const plusIcon = html`<svg
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
</svg>`;
const xIcon = html`<svg
  width="14"
  height="14"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="3"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <line x1="18" x2="6" y1="6" y2="18" />
  <line x1="6" x2="18" y1="6" y2="18" />
</svg>`;

function styleFriendButton(
  btn: HTMLButtonElement,
  already: boolean,
  targetLogin: string,
) {
  btn.title = already ? `Remove ${targetLogin}` : `Add ${targetLogin}`;
  render(already ? checkIcon : plusIcon, btn);
  btn.style.borderColor = already ? "#16a34a" : "#00babc";
  btn.style.background = already
    ? "rgba(22,163,74,0.2)"
    : "rgba(0,186,188,0.2)";
  btn.style.color = already ? "#16a34a" : "#00babc";
}

function setupHover(btn: HTMLButtonElement, targetLogin: string) {
  btn.onmouseenter = () => {
    isFriend(targetLogin).then((already) => {
      if (already) {
        render(xIcon, btn);
        btn.title = `Remove ${targetLogin}`;
        btn.style.borderColor = "#ef4444";
        btn.style.color = "#ef4444";
        btn.style.background = "rgba(239,68,68,0.2)";
      }
    });
  };
  btn.onmouseleave = () => {
    isFriend(targetLogin).then((already) => {
      if (already) {
        render(checkIcon, btn);
        btn.title = `Add ${targetLogin}`;
        btn.style.borderColor = "#16a34a";
        btn.style.color = "#16a34a";
        btn.style.background = "rgba(22,163,74,0.2)";
      }
    });
  };
}

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
      document.getElementById("ft-friend-btn")?.remove();
      injected = false;
      _btnRunning = false;
      return;
    }

    const targetLogin = pathParts[1];
    const myLogin = await getCloudLogin();
    if (!myLogin || targetLogin === myLogin) {
      document.getElementById("ft-friend-btn")?.remove();
      injected = false;
      _btnRunning = false;
      return;
    }

    const existing = document.getElementById(
      "ft-friend-btn",
    ) as HTMLElement | null;
    if (existing) {
      if (existing.dataset.login === targetLogin) {
        _btnRunning = false;
        return;
      }
      existing.remove();
      injected = false;
    }

    const combobox = document.querySelector<HTMLElement>(
      "button[role='combobox']",
    );
    if (!combobox) {
      _btnRunning = false;
      return;
    }

    // Inject button shell immediately with a loading state
    const btn = document.createElement("button");
    btn.id = "ft-friend-btn";
    btn.dataset.login = targetLogin;
    render(html`<span style="opacity:0.5">…</span>`, btn);
    btn.title = targetLogin;
    btn.style.cssText = `
      font-size: 0.8rem;
      font-weight: 700;
      border-radius: 999px;
      border: 1px solid #00babc;
      background: rgba(0,186,188,0.2);
      color: #00babc;
      cursor: pointer;
      font-family: inherit;
      line-height: 1;
      padding: 4px 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      white-space: nowrap;
    `;

    btn.onclick = async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      render(html`…`, btn);
      try {
        const already = await isFriend(targetLogin);
        if (already) {
          await removeFriend(targetLogin);
        } else {
          await addFriend(targetLogin);
        }
        syncToCloud();
        injected = false;
        document.getElementById("ft-friend-btn")?.remove();
        injectFriendButton();
      } catch {
        btn.disabled = false;
        isFriend(targetLogin).then((already) => {
          styleFriendButton(btn, already, targetLogin);
        });
      }
    };

    combobox.insertAdjacentElement("beforebegin", btn);
    const parent = combobox.parentElement;
    if (parent) {
      parent.style.display = "flex";
      parent.style.alignItems = "center";
      parent.style.gap = "4px";
    }
    injected = true;

    // Populate friend state in background — non-blocking
    isFriend(targetLogin).then((already) => {
      styleFriendButton(btn, already, targetLogin);
      setupHover(btn, targetLogin);
    });
  } finally {
    _btnRunning = false;
  }
}
