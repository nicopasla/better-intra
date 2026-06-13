import { getConfig } from "../../config.ts";
import { getStoredLinks, renderShortcutsDisplay } from "./shortcuts.ui.ts";
import { render, html } from "lit-html";
import { sharedCSS } from "../../assets/shared-styles.ts";

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

  const [hideImportantLinks, alignment, links] = await Promise.all([
    getConfig("SHORTCUTS_HIDE_IMPORTANT_LINKS"),
    getConfig("SHORTCUTS_ALIGNMENT"),
    getStoredLinks(),
  ]);

  const displayLinks = links.filter((l) => l.url && l.name);

  const infoBlock = banner.querySelector(
    ".flex.flex-col.text-sm.w-full.gap-1",
  ) as HTMLElement;

  if (hideImportantLinks) {
    const icon = banner.querySelector(
      "svg.hidden.lg\\:block",
    ) as HTMLElement | null;
    if (icon) icon.style.display = "none";
    if (infoBlock) infoBlock.style.display = "none";
  } else {
    if (infoBlock) {
      infoBlock.style.width = "50%";
      infoBlock.classList.remove("w-full");
    }
  }

  if (displayLinks.length === 0) {
    if (!hideImportantLinks && infoBlock) {
      infoBlock.style.width = "";
      infoBlock.classList.add("w-full");
    }
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.id = CONTAINER_ID;
  const justifyMap: Record<string, string> = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
  };
  wrapper.style.cssText = `
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: ${hideImportantLinks ? justifyMap[alignment] || "flex-start" : "flex-start"};
    gap: 16px;
    width: ${hideImportantLinks ? "100%" : "50%"};
    margin-right: 20px;
    padding: 8px 0;
    box-sizing: border-box;
  `;

  const shadowRoot = wrapper.attachShadow({ mode: "open" });
  banner.appendChild(wrapper);

  if (shadowRoot) {
    render(
      html`
        <style>
          ${sharedCSS} .separator {
            width: 3px;
            height: 100px;
            background-color: var(--base-300, #cbd5e1);
            margin: 0 8px;
            flex-shrink: 0;
          }
        </style>
        ${hideImportantLinks ? "" : html`<div class="separator"></div>`}
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
