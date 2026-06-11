import { html, render } from "lit-html";
import { addFriend, removeFriend, isFriend } from "./friends.ts";
import { getCloudLogin, syncToCloud } from "../account/account.ts";
import { getConfig } from "../../config.ts";

let injected = false;

export async function injectFriendButton() {
  const show = await getConfig("SHOW_FRIENDS_WIDGET");
  if (!show) return;

  const pathParts = location.pathname.split("/").filter((p) => p);
  if (pathParts[0] !== "users" || !pathParts[1]) {
    document.getElementById("ft-friend-btn")?.remove();
    injected = false;
    return;
  }

  const targetLogin = pathParts[1];
  const loginEl = document.querySelector<HTMLElement>('p[class="text-sm"]');
  if (!loginEl || loginEl.textContent?.trim() !== targetLogin) return;

  const myLogin = await getCloudLogin();
  if (!myLogin || targetLogin === myLogin) {
    document.getElementById("ft-friend-btn")?.remove();
    injected = false;
    return;
  }

  const existing = document.getElementById("ft-friend-btn");
  if (existing) {
    if (existing.dataset.login === targetLogin) return;
    existing.remove();
    injected = false;
  }

  const already = await isFriend(targetLogin);

  const combobox = document.querySelector<HTMLElement>(
    'button[role="combobox"]',
  );
  if (!combobox) return;

  const btn = document.createElement("button");
  btn.id = "ft-friend-btn";
  btn.dataset.login = targetLogin;
  btn.title = already ? `Remove ${targetLogin}` : `Add ${targetLogin}`;
  const checkIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const plusIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  const xIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>`;
  render(already ? checkIcon : plusIcon, btn);
  btn.style.cssText = `
    font-size: 0.8rem;
    font-weight: 700;
    border-radius: 999px;
    border: 1px solid ${already ? "#16a34a" : "#00babc"};
    background: ${already ? "rgba(22,163,74,0.2)" : "rgba(0,186,188,0.2)"};
    color: ${already ? "#16a34a" : "#00babc"};
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

  btn.onmouseenter = () => {
    if (already) {
      render(xIcon, btn);
      btn.title = `Remove ${targetLogin}`;
      btn.style.borderColor = "#ef4444";
      btn.style.color = "#ef4444";
      btn.style.background = "rgba(239,68,68,0.2)";
    }
  };
  btn.onmouseleave = () => {
    if (already) {
      render(checkIcon, btn);
      btn.style.borderColor = "#16a34a";
      btn.style.color = "#16a34a";
      btn.style.background = "rgba(22,163,74,0.2)";
    }
  };

  btn.onclick = async (e) => {
    e.stopPropagation();
    btn.disabled = true;
    render(html`…`, btn);
    try {
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
      render(already ? checkIcon : plusIcon, btn);
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
}
