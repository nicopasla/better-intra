import { CLUSTERS, getClusterData } from "../clusters/clusters.data.ts";
import { openClusterDialog } from "../clusters/map-dialog.ts";
import { getConfig } from "../../config.ts";

/** A WeakSet to keep track of labels that have already been processed. */
const processedLabels = new WeakSet<HTMLElement>();

const isSeatLike = (t: string) =>
  !!t &&
  t !== "unavailable" &&
  (CLUSTERS.some((c) => c.name && t.startsWith(c.name.toLowerCase())) ||
    /^[a-z0-9]+-\w+/.test(t));

/**
 * Intercepts clicks on the profile seat badge (and any link to the native
 * clusters page carrying a `?seat=` param) and opens the cluster map dialog
 * instead, preventing the default new-tab navigation.
 */
let seatClickGuardInstalled = false;
function installSeatClickGuard() {
  if (seatClickGuardInstalled) return;
  seatClickGuardInstalled = true;

  document.addEventListener(
    "click",
    (e: MouseEvent) => {
      const path = e.composedPath();
      for (const node of path) {
        if (!(node instanceof HTMLElement)) continue;

        if (node.classList.contains("value")) {
          const t = node.textContent?.trim().toLowerCase() || "";
          if (isSeatLike(t)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            openClusterDialog({ seatId: t });
            return;
          }
        }

        if (node.tagName === "A") {
          const href = (node as HTMLAnchorElement).href || "";
          if (href.includes("/clusters") && href.includes("seat=")) {
            try {
              const seat = new URLSearchParams(new URL(href).search).get(
                "seat",
              );
              if (seat) {
                e.preventDefault();
                e.stopImmediatePropagation();
                openClusterDialog({ seatId: seat.toLowerCase() });
                return;
              }
            } catch {}
          }
        }
      }
    },
    true,
  );
}

/**
 * Enhances the user profile page by making the seat location label a clickable
 * link that opens the cluster map dialog on the matching cluster.
 */
export async function handleProfileRedirect() {
  const label =
    Array.from(document.querySelectorAll<HTMLElement>(".value")).find((el) =>
      isSeatLike(el.textContent?.trim().toLowerCase() || ""),
    ) ||
    document.querySelector<HTMLElement>(
      ".absolute.px-2.py-1.border.rounded-full.border-neutral-600.bg-ft-gray.top-2.right-4",
    );

  if (!label || processedLabels.has(label)) return;

  const seatText = label.textContent?.trim().toLowerCase();
  if (!seatText || seatText === "unavailable") return;

  processedLabels.add(label);

  const onLabelClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openClusterDialog({ seatId: seatText });
  };

  label.style.cursor = "pointer";
  label.addEventListener("mouseenter", () => {
    label.style.textDecoration = "underline";
  });
  label.addEventListener("mouseleave", () => {
    label.style.textDecoration = "";
  });
  label.addEventListener("click", onLabelClick);
}

async function init() {
  if (CLUSTERS.length === 0) {
    try {
      const campus = await getConfig("CLUSTERS_CAMPUS");
      await getClusterData(campus);
    } catch {}
  }

  installSeatClickGuard();
}

void init();
