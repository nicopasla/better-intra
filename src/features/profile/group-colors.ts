import { getConfig } from "../../config.ts";
import { getLoginFromPage } from "../../utils/profile-login.ts";
import { syncToCloud } from "../account/account.ts";

const GROUPS_EVENT = "42_GROUPS_DATA";
const GROUPS_REQUEST = "42_GROUPS_REQUEST";
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

interface GroupsDetail {
  login?: string | null;
  groups?: { name?: string; color?: string }[];
}

let started = false;
/** Ensures the stored colours get pushed once per page load, even when they
 *  were captured (and saved locally) before the sync code existed. */
let syncedThisPage = false;

/**
 * profile-v3's API returns the user's groups with their 42 colours, unlike the
 * public API v2. The hook captures that payload; we keep a name → colour map in
 * the synced visual settings so the PWA can colour the same badges.
 */
export function initGroupColors(): void {
  if (started) return;
  started = true;

  document.addEventListener(GROUPS_EVENT, ((event: Event) => {
    void storeGroups((event as CustomEvent<GroupsDetail>).detail);
  }) as EventListener);

  // The page may have fetched its data before the content script attached.
  document.dispatchEvent(new CustomEvent(GROUPS_REQUEST));
}

async function storeGroups(
  detail: GroupsDetail | null | undefined,
): Promise<void> {
  const groups = detail?.groups;
  if (!Array.isArray(groups) || groups.length === 0) return;

  const payloadLogin = detail?.login?.trim().toLowerCase() || null;
  const cloudLogin =
    (await getConfig("CLOUD_LOGIN"))?.trim().toLowerCase() || null;
  const expectedLogin = cloudLogin || getLoginFromPage()?.toLowerCase() || null;

  // Only keep colours from the signed-in user's own payload, so browsing other
  // profiles doesn't leak their groups into these settings.
  if (!payloadLogin || !expectedLogin || payloadLogin !== expectedLogin) {
    return;
  }

  const stored = (await getConfig("PROFILE_GROUP_COLORS")) ?? {};
  const next: Record<string, string> = { ...stored };
  let changed = false;

  for (const group of groups) {
    const name = typeof group?.name === "string" ? group.name.trim() : "";
    const color = typeof group?.color === "string" ? group.color.trim() : "";
    if (!name || !HEX_COLOR.test(color)) continue;
    if (next[name] !== color) {
      next[name] = color;
      changed = true;
    }
  }

  if (changed) {
    await chrome.storage.local.set({ PROFILE_GROUP_COLORS: next });
  }
  if (!changed && syncedThisPage) return;
  syncedThisPage = true;

  // Push the new colours (and the rest of the settings) so the PWA gets them.
  await syncToCloud();
}
