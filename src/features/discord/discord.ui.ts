import { html } from "lit-html";

/**
 * Deprecated Discord integration. Evaluation DMs are no longer sent; the notice
 * is kept in the panel title so it stays visible without an expandable body.
 */
export function renderDiscordPanel() {
  return html`
    <div class="collapse bg-base-200 shadow-sm col-span-full">
      <div
        class="collapse-title text-sm opacity-70 flex flex-wrap items-center gap-2"
      >
        <span class="font-medium text-base-content">Discord</span>
        <span class="badge badge-warning badge-sm">Deprecated</span>
        <span>
          Evaluation DMs are no longer sent. Enable push notifications in the
          Better Intra mobile app instead.
        </span>
      </div>
    </div>
  `;
}
