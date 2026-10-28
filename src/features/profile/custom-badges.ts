import { getConfig } from "../../config.ts";
import { hashLogin } from "../../utils/crypto.ts";
import { workerFetch } from "../../utils/worker.ts";
import { getLoginFromPage } from "../../utils/profile-login.ts";
import { contrastText } from "../../utils/color.ts";

/**
 * Admin-granted profile badges, read from the worker (D1 `custom_badges`).
 * They are appended to the native role-badge row so they sit with the 42
 * groups, and marked so re-runs never duplicate them.
 */

export interface CustomBadge {
  id: string;
  label: string;
  color: string | null;
  icon: string | null;
  tooltip: string | null;
}

const ROW_SELECTOR = "[data-ft-badges-row]";
const MARKER = "data-ft-badges-signature";
const BADGE_ATTR = "data-ft-custom-badge";

const cache = new Map<string, CustomBadge[]>();
const inFlight = new Map<string, Promise<CustomBadge[]>>();

/** Worker response, trimmed to renderable badges. */
export function sanitizeBadges(value: unknown): CustomBadge[] {
  if (!Array.isArray(value)) return [];
  const badges: CustomBadge[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const id = String(raw.id ?? "").trim();
    const label = String(raw.label ?? "").trim();
    if (!id || !label) continue;
    const color = typeof raw.color === "string" ? raw.color.trim() : "";
    badges.push({
      id,
      label: label.slice(0, 32),
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : null,
      icon:
        typeof raw.icon === "string" && raw.icon.trim()
          ? raw.icon.trim()
          : null,
      tooltip:
        typeof raw.tooltip === "string" && raw.tooltip.trim()
          ? raw.tooltip.trim().slice(0, 160)
          : null,
    });
  }
  return badges;
}

/** Native intra badge classes, so custom badges sit in the row identically. */
const NATIVE_BADGE_CLASS =
  "inline-flex items-center text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-primary hover:bg-primary/80 border-transparent text-primary-foreground flex-shrink-0 mx-1 px-3.5 py-1.5 rounded border shadow-base";

/** One span per badge, matching the native role badges (colours inline). */
export function buildCustomBadge(badge: CustomBadge): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = NATIVE_BADGE_CLASS;
  el.setAttribute(BADGE_ATTR, badge.id);

  if (badge.color) {
    el.style.backgroundColor = badge.color;
    el.style.borderColor = badge.color;
    el.style.color = contrastText(badge.color);
  }
  if (badge.tooltip) el.title = badge.tooltip;
  el.textContent = badge.label;

  if (badge.icon) {
    const icon = document.createElement("span");
    icon.style.cssText =
      "margin-left:0.25rem;display:inline-flex;align-items:center;";
    icon.textContent = badge.icon;
    el.appendChild(icon);
  }
  return el;
}

async function fetchBadges(login: string): Promise<CustomBadge[]> {
  const cached = cache.get(login);
  if (cached) return cached;
  const pending = inFlight.get(login);
  if (pending) return pending;

  const request = (async () => {
    try {
      const [token, cloudLogin] = await Promise.all([
        getConfig("CLOUD_TOKEN"),
        getConfig("CLOUD_LOGIN"),
      ]);
      if (!token || !cloudLogin) return [];
      const hashed = await hashLogin(cloudLogin);
      const res = await workerFetch(
        `/api/v1/private/custom-badges?target=${encodeURIComponent(login)}&login=${encodeURIComponent(hashed)}`,
        { token },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { badges?: unknown };
      const badges = sanitizeBadges(data?.badges);
      cache.set(login, badges);
      return badges;
    } catch {
      return [];
    } finally {
      inFlight.delete(login);
    }
  })();

  inFlight.set(login, request);
  return request;
}

/** Placeholder row when the profile has no native role badges to attach to. */
const PLACEHOLDER_ROW = "data-ft-custom-badges-row";

/** Finds the native badge row, or creates one above the level/cursus bar. */
function ensureRow(): HTMLElement | null {
  const native = document.querySelector<HTMLElement>(ROW_SELECTOR);
  if (native) {
    // Native badges showed up after our placeholder: move over and drop it.
    document
      .querySelectorAll(`[${PLACEHOLDER_ROW}]`)
      .forEach((el) => el.remove());
    return native;
  }

  const placeholder = document.querySelector<HTMLElement>(
    `[${PLACEHOLDER_ROW}]`,
  );
  if (placeholder) return placeholder;

  const levelEl =
    document.querySelector<HTMLElement>(".ft-profile-card h1.text-4xl") ??
    document.querySelector<HTMLElement>("h1.text-4xl");
  const levelBar = levelEl?.parentElement;
  if (!levelBar?.parentElement) return null;

  const row = document.createElement("div");
  row.setAttribute(PLACEHOLDER_ROW, "true");
  row.style.cssText =
    "display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;padding-bottom:0.25rem;";
  levelBar.parentElement.insertBefore(row, levelBar);
  return row;
}

/**
 * Adds the badges to the profile's badge row. Safe to call repeatedly: the row
 * is only touched when the badge set changes.
 */
export async function injectCustomBadges(): Promise<void> {
  const login = getLoginFromPage()?.trim().toLowerCase();
  if (!login) return;

  const badges = await fetchBadges(login);
  if (badges.length === 0) return;

  const row = ensureRow();
  if (!row) return;

  const signature = badges.map((badge) => badge.id).join(",");
  if (row.getAttribute(MARKER) === signature) return;

  row.querySelectorAll(`[${BADGE_ATTR}]`).forEach((el) => el.remove());
  for (const badge of badges) row.appendChild(buildCustomBadge(badge));
  row.setAttribute(MARKER, signature);
}
