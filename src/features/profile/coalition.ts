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
    .ft-profile-card .border-t-neutral-600 > :nth-child(2) {
      display: none !important;
    }
    .ft-profile-card .border-t-neutral-600 > button {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

export async function initHideCoalition() {
  const hideCoalition = await getConfig("PROFILE_HIDE_COALITION");
  if (hideCoalition) {
    injectStyles();
  } else {
    removeStyles();
  }
}
