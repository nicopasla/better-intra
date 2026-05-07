import { FeatureId } from "./hubSettings.data.ts";
import GEAR_SVG from "../../assets/settings_gear.svg?raw";

import { getActiveFeatures } from "./hubSettings.storage.ts";

function findSidebarMainGroup(): HTMLDivElement | null {
  const profileLink = document.querySelector<HTMLAnchorElement>(
    'a[href="https://profile-v3.intra.42.fr"]',
  );
  return (
    profileLink?.closest<HTMLDivElement>("div.flex.flex-col.w-full") ||
    document.querySelector<HTMLDivElement>(
      "div.flex.flex-col.w-full:not(.pb-16)",
    )
  );
}

function findLegacyNavList(): HTMLDivElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLDivElement>("div._"),
  );
  return (
    candidates.find(
      (root) =>
        (!!root.querySelector('a[href="https://profile.intra.42.fr"]') ||
          !!root.querySelector('a[href="https://projects.intra.42.fr"]')) &&
        root.querySelectorAll(":scope > li").length > 0,
    ) || null
  );
}

export function mountGearButton(): void {
  const open = async () => {
    const { openHubModal } = await import("./hubSettings.ui.ts");
    await openHubModal(getActiveFeatures());
  };
  const sidebar = findSidebarMainGroup();
  const legacy = findLegacyNavList();

  if (document.getElementById("hub-gear-btn")) return;

  if (sidebar) {
    const a = document.createElement("a");
    a.id = "hub-gear-btn";
    a.className =
      "py-5 w-full flex justify-center hover:opacity-100 opacity-40";
    a.innerHTML = GEAR_SVG;
    a.onclick = (e) => {
      e.preventDefault();
      open();
    };
    sidebar.appendChild(a);
  } else if (legacy) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.id = "hub-gear-btn";
    a.innerHTML = GEAR_SVG;
    a.onclick = (e) => {
      e.preventDefault();
      open();
    };
    li.appendChild(a);
    legacy.appendChild(li);
  }
}

export function initHubSettings(): FeatureId[] {
  const active = getActiveFeatures();
  mountGearButton();
  const hubInterval = setInterval(mountGearButton, 500);
  setTimeout(() => clearInterval(hubInterval), 10000);
  return active;
}
