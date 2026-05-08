import { gmGetValue, gmSetValue } from "../../lib/gm.ts";
import { HUB_SETTING_DEFS } from "../hub/hubSettings.data.ts";

export async function findSlotsButton() {
  const settings = {
    slots_redirection: await gmGetValue<boolean>(
      "PROFILE_SLOTS_REDIRECTION",
      true,
    ),
  };

  const slotsBtn = document.querySelector(
    'a[href="https://profile.intra.42.fr/slots"]',
  ) as HTMLAnchorElement | null;

  if (slotsBtn && settings.slots_redirection && !slotsBtn.dataset.customized) {
    slotsBtn.href = "https://slots.42belgium.be/slots";
    slotsBtn.target = "_blank";
    slotsBtn.rel = "noopener noreferrer";
    slotsBtn.dataset.customized = "true";
  }
}
