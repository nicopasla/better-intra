import { getConfig } from "../../config.ts";

const STYLE_ID = "ft-hide-coalition-styles";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .ft-profile-card .absolute.left-4.top-0 {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

function setCoalitionVisible(visible: boolean, attempts = 0) {
  const host = document.getElementById("ft-info-card");
  if (!host) {
    if (attempts < 20)
      setTimeout(() => setCoalitionVisible(visible, attempts + 1), 50);
    return;
  }
  host
    .querySelectorAll<HTMLElement>("[data-ft-coalition]")
    .forEach((el) =>
      el.style.setProperty("display", visible ? "flex" : "none", "important"),
    );
}

export async function initHideCoalition() {
  const hideCoalition = await getConfig("PROFILE_HIDE_COALITION");
  if (hideCoalition) {
    injectStyles();
    setCoalitionVisible(false);
  } else {
    removeStyles();
    setCoalitionVisible(true);
  }
}
