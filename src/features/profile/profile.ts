import { updateEventFilters, injectEventsSelect } from "./events/events.ts";
import { findSlotsButton, redirectDefenseLinks } from "./shortcuts.ts";
import { replaceMoulinetteImage } from "./moulinette.ts";
import { injectCustomStyles, updateVisuals } from "./visuals.ts";
import { handleProfileRedirect } from "./highlight.ts";
import { initLayoutManager } from "./layout.ts";
import { initMilestones } from "./milestones.ts";
import { initFreezeCard } from "./freeze.ts";
import { initProfileCardStyling } from "./profile-card.ts";
import { injectFriendsWidget } from "../friends/friends.ui.ts";
import { injectFriendButton } from "../friends/profile-button.ts";
import { initAchievements } from "./achievements.ts";
import { initMarks } from "./marks.ts";
import { initProjectsSort } from "./projects-sort.ts";
import { initRoulette } from "./roulette.ts";
import { initEvaluations } from "./evaluations.ts";

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
  await waitForBody();
  if (location.origin === "https://projects.intra.42.fr") {
    await redirectDefenseLinks();
    replaceMoulinetteImage();
  }
  if (location.origin !== "https://profile-v3.intra.42.fr") return;

  let isUpdating = false;
  let needsRerun = false;

  const scheduleUpdate = () => {
    needsRerun = false;
    requestAnimationFrame(() => updateUI());
  };

  const updateUI = async () => {
    if (isUpdating) return;
    isUpdating = true;
    try {
      await updateVisuals();
      if (location.pathname === "/" || location.pathname.startsWith("/users")) {
        await initLayoutManager();
        await initProfileCardStyling();
        await initAchievements();
        await initMarks();
        await initProjectsSort();
        await initRoulette();
        await initEvaluations();
        await findSlotsButton();
        await injectEventsSelect();
        await updateEventFilters();
        await handleProfileRedirect();
        await initMilestones();
        await initFreezeCard();
        injectFriendsWidget();
        injectFriendButton();
      }
    } finally {
      isUpdating = false;
      if (needsRerun) scheduleUpdate();
    }
  };

  const observer = new MutationObserver(() => {
    needsRerun = true;
    if (!isUpdating) scheduleUpdate();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  scheduleUpdate();

  if (location.pathname !== "/") {
    setTimeout(() => observer.disconnect(), 10000);
  }
}
