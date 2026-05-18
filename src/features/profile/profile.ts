import { updateEventFilters, injectEventsSelect } from "./events.ts";
import { findSlotsButton } from "./shortcuts.ts";
import { injectCustomStyles, updateVisuals } from "./visuals.ts";
import { handleProfileRedirect } from "./highlight.ts"; 
import { initLayoutManager } from "./layout.ts";

export async function initProfile() {
  injectCustomStyles();
  if (location.origin !== "https://profile-v3.intra.42.fr") return;

  const updateUI = async () => {
    await updateVisuals();
    if (location.pathname === "/" || location.pathname.startsWith("/users")) {
      await initLayoutManager(); 
      await findSlotsButton();
      await injectEventsSelect();
      await updateEventFilters();
      await handleProfileRedirect();
    }
  };

  const observer = new MutationObserver(() =>
    requestAnimationFrame(() => updateUI()),
  );
  observer.observe(document.body, { childList: true, subtree: true });
  void updateUI();
}