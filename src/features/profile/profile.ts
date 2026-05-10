import { updateEventFilters, injectEventsSelect } from "./events.ts";
import { findSlotsButton } from "./shortcuts.ts";
import { injectCustomStyles, updateVisuals } from "./visuals.ts";

export async function initProfile() {
  "use strict";

  injectCustomStyles();

  if (location.origin !== "https://profile-v3.intra.42.fr" || location.pathname !== "/") return;

  const updateUI = async () => {
    await updateVisuals();
    await findSlotsButton();
    await injectEventsSelect();
    await updateEventFilters();
  };

  const observer = new MutationObserver(() => requestAnimationFrame(() => updateUI()));
  observer.observe(document.body, { childList: true, subtree: true });
  
  updateUI();
  console.log("Profile loaded!");
}