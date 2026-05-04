import { gmGetValue } from "../../lib/gm.ts";

export const MARKERS_VISIBLE_KEY = "CLUSTERS_SHOW_MARKERS";
export const DEFAULT_ID_KEY = "CLUSTERS_DEFAULT_ID";

export const getBoolValue = (key: string, fallback: boolean): boolean => {
  const raw = gmGetValue(key, fallback);
  if (typeof raw === "boolean") return raw;
  if (raw === null || raw === undefined) return fallback;
  return raw === "true" || raw === "1" || raw === 1;
};

export function getClusterTabsList() {
  const links = document.querySelectorAll('a[href^="#cluster-"]');
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (/^#cluster-\d+$/.test(href)) {
      return link.closest("ul, ol");
    }
  }
  return null;
}