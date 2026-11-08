import type { DialogState } from "./context";
import { WORKER_URL } from "./context";

/** The floor plan only exists for the Belgian campus. */
export const PLAN_CAMPUS_ID = "12";
export const PLAN_CLUSTER_ID = "plan";
export const PLAN_MAP_URL = `${WORKER_URL}/api/v1/public/campus-map/belgium/plan.svg`;

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Maps a plan zone (`data-cluster="shi"`, `"fu"`, `"mi"`) to the campus cluster
 * it opens. The plan uses cluster names, while the dialog keys clusters by id.
 */
export function findClusterForPlanZone(
  state: DialogState,
  zone: string,
) {
  const name = zone.trim().toLowerCase();
  if (!name) return undefined;
  return state.clusters.find(
    (c) => c.id !== PLAN_CLUSTER_ID && c.name.trim().toLowerCase() === name,
  );
}

/** Paints the occupied/total count under each cluster label on the floor plan. */
export function applyPlanCounts(
  state: DialogState,
  counts: Map<string, { taken: number; total: number }>,
): void {
  const mapArea = state.shadow.getElementById("map-area");
  const svg = mapArea?.querySelector("svg") as SVGSVGElement | null;
  if (!svg) return;

  for (const group of svg.querySelectorAll<SVGGElement>("[data-cluster]")) {
    const cluster = findClusterForPlanZone(
      state,
      group.getAttribute("data-cluster") ?? "",
    );
    if (!cluster) continue;

    const label = group.querySelector<SVGTextElement>(".plan-label");
    const centerY = Number(
      label?.getAttribute("data-center-y") ?? label?.getAttribute("y") ?? 0,
    );

    let count = group.querySelector<SVGTextElement>(".plan-count");
    if (!count) {
      count = document.createElementNS(SVG_NS, "text");
      count.setAttribute("class", "plan-count");
      count.setAttribute("x", label?.getAttribute("x") ?? "0");
      group.appendChild(count);
    }
    count.setAttribute("y", String(centerY + 13));

    const entry = counts.get(cluster.id);
    const visible = Boolean(entry && entry.total > 0);
    // Keep the label itself centered when there is no count under it.
    label?.setAttribute("y", String(visible ? centerY - 13 : centerY));
    count.textContent =
      visible && entry ? `${entry.taken}/${entry.total}` : "";
    count.style.display = visible ? "" : "none";
  }
}
