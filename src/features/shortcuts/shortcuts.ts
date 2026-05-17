import { getConfig } from "../../config.ts";
import { getStoredLinks, renderShortcutsDisplay } from "./shortcuts.ui.ts";
import { render, html } from "lit-html";
import CSS from "../../assets/style.css?inline";

const CONTAINER_ID = "shortcuts-shadow-wrapper";

export async function injectShortcutsDisplay() {
  if (document.getElementById(CONTAINER_ID)) return;

  const activeFeatures = await getConfig("ACTIVE_SCRIPTS");
  let active: string[] = [];

  try {
    active =
      typeof activeFeatures === "string"
        ? JSON.parse(activeFeatures)
        : activeFeatures;
  } catch {
    return;
  }

  if (!Array.isArray(active) || !active.includes("shortcuts")) {
    document.getElementById(CONTAINER_ID)?.remove();
    return;
  }

  const banner = document.querySelector(
    ".w-full.flex.flex-row.gap-8.py-4.px-8.items-center",
  );
  if (!banner) return;

  const infoBlock = banner.querySelector(
    ".flex.flex-col.text-sm.w-full.gap-1",
  ) as HTMLElement;
  if (infoBlock) {
    infoBlock.style.width = "50%";
    infoBlock.classList.remove("w-full");
  }

  const links = await getStoredLinks();

  const wrapper = document.createElement("div");
  wrapper.id = CONTAINER_ID;
  wrapper.style.cssText = `
    display: flex; 
    flex-direction: row; 
    align-items: center; 
    gap: 16px; 
    width: 50%; 
    margin-right: 20px; 
    box-sizing: border-box;
  `;

  const shadowRoot = wrapper.attachShadow({ mode: "open" });
  banner.appendChild(wrapper);

  if (shadowRoot) {
    render(
      html`
        <style>
          ${CSS}
        </style>
        ${renderShortcutsDisplay(links)}
      `,
      shadowRoot,
    );
  }
}

export function setupShortcutsObserver() {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const observer = new MutationObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!document.getElementById(CONTAINER_ID)) {
        injectShortcutsDisplay();
      }
    }, 300);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("pagehide", () => observer.disconnect(), {
    once: true,
  });
}

export async function initShortcuts() {
  await injectShortcutsDisplay();
  setupShortcutsObserver();
}
