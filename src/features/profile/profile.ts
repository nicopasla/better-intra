import { updateEventFilters, injectEventsSelect } from "./events/events.ts";
import { findSlotsButton, redirectDefenseLinks } from "./shortcuts.ts";
import { replaceMoulinetteImage } from "./moulinette.ts";
import {
  holdAvatar,
  injectCustomStyles,
  releaseAvatar,
  updateVisuals,
} from "./visuals.ts";
import { handleProfileRedirect } from "./highlight.ts";
import { initLayoutManager } from "./layout.ts";
import { initMilestones } from "./milestones.ts";
import { initFreezeCard } from "./freeze.ts";
import { findProfileCard, initProfileCardStyling } from "./profile-card.ts";
import { injectFriendsWidget } from "../friends/friends.ui.ts";
import { colorTrackerBadge } from "../logtime/tracker-card.ts";
import { initAchievements } from "./achievements.ts";
import { initMarks } from "./marks.ts";
import { initProjectBadges } from "./project-badges.ts";
import { initProjectsSort } from "./projects-sort.ts";
import { initRouletteStats } from "./roulette-stats.ts";
import { initEvaluations } from "./evaluations.ts";
import { initBadges, applyTitleBadgeWrap } from "./badges.ts";
import { initTranscript } from "./transcript.ts";
import { initPace } from "./pace.ts";
import { initBlackholeMode } from "./blackhole.ts";
import { ensureCampusData } from "../campus/campus.ts";

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
  void initBlackholeMode();
  await waitForBody();
  if (location.origin === "https://projects.intra.42.fr") {
    await redirectDefenseLinks();
    replaceMoulinetteImage();
  }
  if (location.origin !== "https://profile-v3.intra.42.fr") return;

  await ensureCampusData();

  let isUpdating = false;
  let needsRerun = false;
  let initialised = false;
  let initedPath: string | null = null;

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
        if (!findProfileCard()) return;
        initialised = true;

        if (initedPath !== location.pathname) {
          initedPath = location.pathname;
          // Fire-and-forget: features with >2s timeouts or slow network fetches
          initFreezeCard();
          injectFriendsWidget();
          if (location.pathname === "/") colorTrackerBadge();
          await Promise.allSettled([
            initLayoutManager(),
            initProfileCardStyling(),
            initAchievements(),
            initMarks(),
            initProjectBadges(),
            initProjectsSort(),
            initRouletteStats(),
            initEvaluations(),
            findSlotsButton(),
            injectEventsSelect(),
            updateEventFilters(),
            handleProfileRedirect(),
            initMilestones(),
            initBadges(),
            applyTitleBadgeWrap(),
            initTranscript(),
            initPace(),
          ]);
        }
      }
    } finally {
      isUpdating = false;
      if (needsRerun) {
        scheduleUpdate();
      } else if (initialised && location.pathname.startsWith("/users")) {
        observer.disconnect();
        releaseAvatar();
      }
    }
  };

  holdAvatar();

  const OWN_SELECTOR =
    "#hub-dialog,#logtime-shadow-wrapper,#shortcuts-shadow-wrapper,#friends-widget-host,#ft-floating-tooltip,#profile-modal-host,#ft-blackhole-v2,#ft-announcement-banner,#ft-v2-warning";

  const isOwnNode = (node: Node): boolean => {
    if (!(node instanceof Element)) return false;
    return (
      node.matches(OWN_SELECTOR) ||
      !!node.closest(OWN_SELECTOR) ||
      !!node.querySelector(OWN_SELECTOR)
    );
  };

  const isOwnMutation = (m: MutationRecord): boolean => {
    const nodes = [...m.addedNodes, ...m.removedNodes];
    if (nodes.length > 0) return nodes.every(isOwnNode);
    return isOwnNode(m.target);
  };

  const observer = new MutationObserver((mutations) => {
    if (mutations.every(isOwnMutation)) return;
    if (isUpdating) {
      needsRerun = true;
    } else {
      scheduleUpdate();
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  scheduleUpdate();

  if (location.pathname !== "/") {
    setTimeout(() => {
      observer.disconnect();
      releaseAvatar();
    }, 10000);
  } else {
    setTimeout(() => {
      observer.disconnect();
      releaseAvatar();
    }, 30000);
    window.addEventListener(
      "pagehide",
      () => {
        observer.disconnect();
        releaseAvatar();
      },
      { once: true },
    );
  }
}
