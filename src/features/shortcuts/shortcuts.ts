import { gmGetValue } from "../../lib/gm.ts";
import { getStoredLinks, renderShortcutsDisplay } from "./shortcuts.ui.ts";
import { render } from "lit-html";

const CONTAINER_ID = "42-shortcuts-display-wrapper";

export async function injectShortcutsDisplay() {
  const activeFeatures = await gmGetValue("ACTIVE_SCRIPTS", "[]");
  let active: string[] = [];

  try {
    active =
      typeof activeFeatures === "string"
        ? JSON.parse(activeFeatures)
        : activeFeatures;
  } catch {
    return;
  }

  if (!active.includes("shortcuts")) {
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

  let wrapper = document.getElementById(CONTAINER_ID);
  if (!wrapper) {
    wrapper = document.createElement("div");
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
    banner.appendChild(wrapper);
  }

  render(renderShortcutsDisplay(links), wrapper);
}

export function setupShortcutsObserver() {
  let timer: number | undefined;

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      injectShortcutsDisplay();
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
