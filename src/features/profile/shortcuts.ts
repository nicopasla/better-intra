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
