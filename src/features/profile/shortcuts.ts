import { getBadgeUrl } from "./badges.ts";

export async function findSlotsButton() {
  const slotsUrl = await getBadgeUrl("SLOTS");
  if (!slotsUrl) return;

  const slotsBtn = document.querySelector(
    'a[href="https://profile.intra.42.fr/slots"]',
  ) as HTMLAnchorElement | null;

  if (slotsBtn && !slotsBtn.dataset.customized) {
    slotsBtn.href = slotsUrl;
    slotsBtn.target = "_blank";
    slotsBtn.rel = "noopener noreferrer";
    slotsBtn.dataset.customized = "true";
  }
}

export async function redirectDefenseLinks() {
  const slotsUrl = await getBadgeUrl("SLOTS");
  if (!slotsUrl) return;

  const links = document.querySelectorAll(
    'a[href*="/slots?team_id="]',
  ) as NodeListOf<HTMLAnchorElement>;

  for (const link of links) {
    if (link.dataset.customized) continue;
    link.href = slotsUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.dataset.customized = "true";
  }
}
