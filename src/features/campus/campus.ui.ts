import { html } from "lit-html";
import { detectCampus } from "./campus.ts";
import { getClusterData } from "../clusters/clusters.data.ts";

export function renderCampusCard(
  campusOptions: { label: string; value: string }[],
  currentCampus: string,
  isAutoDetected: boolean,
): ReturnType<typeof html> {
  const handleDetect = async (e: Event) => {
    const btn = e.currentTarget as HTMLElement;
    const statusEl = btn.nextElementSibling as HTMLElement;
    btn.classList.add("loading", "loading-spinner");
    try {
      const id = await detectCampus();
      if (!id) throw new Error("Not found");
      const match = campusOptions.find((c) => c.value === id);
      const name = match?.label || id;
      await chrome.storage.local.set({
        CLUSTERS_CAMPUS: id,
        CLUSTERS_CAMPUS_AUTO: true,
      });
      getClusterData(id);
      const root = btn.getRootNode() as ShadowRoot;
      const select = root.querySelector(
        "select[data-setting-key='CLUSTERS_CAMPUS']",
      ) as HTMLSelectElement;
      if (select) select.value = id;
      if (statusEl) {
        statusEl.textContent = `✓ ${name}`;
        statusEl.className = "badge badge-success font-bold";
      }
    } catch {
      if (statusEl) {
        statusEl.textContent = "✗ Failed";
        statusEl.className = "badge badge-error font-bold";
      }
    } finally {
      btn.classList.remove("loading", "loading-spinner");
    }
  };

  return html`
    <div class="flex items-center gap-1">
      <select
        class="select select-accent"
        data-setting-key="CLUSTERS_CAMPUS"
        @change="${(e: Event) => {
          e.stopPropagation();
          const value = (e.target as HTMLSelectElement).value;
          chrome.storage.local.set({
            CLUSTERS_CAMPUS: value,
            CLUSTERS_CAMPUS_AUTO: false,
          });
          if (value) getClusterData(value);
        }}"
      >
        ${campusOptions.map(
          (o) =>
            html`<option
              value="${o.value}"
              ?selected="${o.value === currentCampus}"
            >
              ${o.label}
            </option>`,
        )}
      </select>
      ${currentCampus && isAutoDetected
        ? html`<span class="text-success font-bold shrink-0">✓ Auto</span>`
        : ""}
      <button
        type="button"
        class="btn btn-primary font-bold shrink-0"
        @click="${(e: Event) => handleDetect(e)}"
        title="Auto-detect campus"
      >
        Auto
      </button>
      <a
        href="https://github.com/nicopasla/better-intra/tree/main/campuses"
        target="_blank"
        class="text-sm opacity-40 hover:opacity-80 link link-hover shrink-0 ml-1"
        >Missing your campus? Or clusters incomplete?</a
      >
    </div>
  `;
}
