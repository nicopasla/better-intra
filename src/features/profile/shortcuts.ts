import { getConfig } from "../../config.ts";

export async function findSlotsButton() {
  const slots_redirection = await getConfig("PROFILE_SLOTS_REDIRECTION");

  const slotsBtn = document.querySelector(
    'a[href="https://profile.intra.42.fr/slots"]',
  ) as HTMLAnchorElement | null;

  if (slotsBtn && slots_redirection && !slotsBtn.dataset.customized) {
    slotsBtn.href = "https://slots.42belgium.be/slots";
    slotsBtn.target = "_blank";
    slotsBtn.rel = "noopener noreferrer";
    slotsBtn.dataset.customized = "true";
  }
}

export async function redirectDefenseLinks() {
  const slots_redirection = await getConfig("PROFILE_SLOTS_REDIRECTION");
  if (!slots_redirection) return;

  const links = document.querySelectorAll(
    'a[href*="/slots?team_id="]',
  ) as NodeListOf<HTMLAnchorElement>;

  for (const link of links) {
    if (link.dataset.customized) continue;
    link.href = "https://slots.42belgium.be/slots";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.dataset.customized = "true";
  }
}
