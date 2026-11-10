/**
 * Intra closes its dialogs on press: the mousedown lands on the backdrop, the
 * dialog unmounts, and the mouseup lands on the page behind it. Chromium then
 * extends a text selection between the two points, which can highlight the
 * whole page (looking like Ctrl+A).
 *
 * Blocking `selectstart` for that one gesture stops the highlight without
 * touching `mousedown` — so Intra's dismiss logic, which may bail out when the
 * press is `defaultPrevented`, keeps working. Any selection that still slips
 * through is cleared when the press ends.
 */

const DIALOG_SELECTOR = '[role="dialog"], dialog[open], [aria-modal="true"]';

let started = false;
let armed = false;

export function initSelectionGuard(): void {
  if (started) return;
  started = true;

  document.addEventListener(
    "mousedown",
    (event) => {
      // "Inside" means inside the dialog content itself: presses on the
      // backdrop must count as outside even when it shares a portal wrapper
      // with the dialog.
      const target = event.target as Element | null;
      const inside = !!target?.closest?.(DIALOG_SELECTOR);
      const open = !!document.querySelector(DIALOG_SELECTOR);
      armed = open && !inside;
    },
    true,
  );

  document.addEventListener(
    "selectstart",
    (event) => {
      if (armed) event.preventDefault();
    },
    true,
  );

  document.addEventListener(
    "mouseup",
    () => {
      if (!armed) return;
      // Some engines still start a small range before `selectstart` is
      // cancelled; drop it once the gesture is over.
      window.getSelection()?.removeAllRanges();
      armed = false;
    },
    true,
  );
}
