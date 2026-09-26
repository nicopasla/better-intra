import { AVATAR_SELECTOR } from "../profile/selectors.ts";
import { runTour, type TourStep } from "../../utils/tour.ts";

const TOUR_STEPS: TourStep[] = [
  {
    target: "#hub-gear-btn",
    title: "Your control center",
    body: "Open all Better Intra settings here: themes, features, backup, cloud sync and more.",
    placement: "right",
  },
  {
    target: "#ft-students-btn",
    title: "Students",
    body: "Browse every student and pisciner on your campus, with levels and online status.",
    placement: "right",
  },
  {
    target: "#ft-clusters-btn",
    title: "Cluster map",
    body: "See where everyone is sitting on the cluster map, across every campus.",
    placement: "right",
  },
  {
    target: AVATAR_SELECTOR,
    title: "Make it yours",
    body: "On your profile, click your avatar to change your profile picture, banner and background.",
    placement: "right",
  },
  {
    target: "#shortcuts-shadow-wrapper",
    title: "Shortcuts",
    body: "Your custom navigation links, always one click away.",
    placement: "bottom",
  },
  {
    target: () =>
      document
        .getElementById("friends-widget-host")
        ?.shadowRoot?.querySelector<HTMLElement>(".friends-fab") ?? null,
    title: "Friends",
    body: "Track your friends' levels, wallets and correction points at a glance.",
    placement: "left",
  },
  {
    target: "#logtime-shadow-wrapper",
    title: "Logtime",
    body: "A redesigned logtime with weekly totals, goals and earning estimates.",
    placement: "bottom",
  },
];

export function startTour(): Promise<void> {
  return runTour({
    steps: TOUR_STEPS,
    hostId: "welcome-tour-host",
    onEnd: () => window.scrollTo({ top: 0, behavior: "smooth" }),
  });
}
