import { showConfirmDialog } from "../utils/confirm-dialog.ts";

const BACK_TO_V2_HREF = "https://profile.intra.42.fr/v3_early_access";

export function initBackToV2Confirm(): void {
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      if (!target) return;

      const anchor = target.closest<HTMLAnchorElement>(
        `a[href="${BACK_TO_V2_HREF}"]`,
      );
      if (!anchor || !anchor.querySelector(".lucide-undo2")) return;

      // Only intercept plain left-clicks (let new-tab / modifier clicks through).
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      void (async () => {
        const ok = await showConfirmDialog({
          title: "Switch back to v2?",
          message:
            "You're leaving the new v3 profile. Better Intra is designed for v3, so its customizations won't apply on v2.",
          confirmLabel: "Switch to v2",
          cancelLabel: "Stay on v3",
        });
        if (ok) {
          window.location.href = anchor.href;
        }
      })();
    },
    true,
  );
}
