import { updateEventFilters, injectEventsSelect } from "./events/events.ts";
import { findSlotsButton } from "./shortcuts.ts";
import { injectCustomStyles, updateVisuals } from "./visuals.ts";
import { handleProfileRedirect } from "./highlight.ts";
import { initLayoutManager } from "./layout.ts";
import { initMilestones } from "./milestones.ts";
import { initProfileCardStyling } from "./profile-card.ts";
import { injectFriendsWidget } from "../friends/friends.ui.ts";
import { initMarks } from "./marks.ts";

const waitForBody = () =>
  document.body
    ? Promise.resolve()
    : new Promise<void>((r) => {
        const id = setInterval(() => {
          if (document.body) {
            clearInterval(id);
            r();
          }
        }, 10);
      });

export async function initProfile() {
  injectCustomStyles();
  if (location.origin !== "https://profile-v3.intra.42.fr") return;

  await waitForBody();

  let isUpdating = false;
  const updateUI = async () => {
    if (isUpdating) return;
    isUpdating = true;
    try {
      await updateVisuals();
      if (location.pathname === "/" || location.pathname.startsWith("/users")) {
        await initLayoutManager();
        await initProfileCardStyling();
        await initMarks();
        await findSlotsButton();
        await injectEventsSelect();
        await updateEventFilters();
        await handleProfileRedirect();
        await initMilestones();
        injectFriendsWidget();
      }
    } finally {
      isUpdating = false;
    }
  };

  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      updateUI();
    });
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  void updateUI();
}
