import { hubTabsState } from "./hubSettings.state.ts";
import { syncHubTabsActive } from "./hubSettings.tabs.ts";

export const normalizeTerm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function setupSearch(
  shadow: ShadowRoot,
  ensureAllPanels: () => void,
): void {
  const input = shadow.querySelector<HTMLInputElement>("#hub-search");
  if (!input) return;

  let activeBeforeSearch: HTMLInputElement | null = null;

  const emptyState = shadow.querySelector<HTMLElement>("#hub-search-empty");

  const apply = () => {
    const panels = shadow.querySelectorAll<HTMLElement>("[data-feature-panel]");
    const term = normalizeTerm(input.value.trim());
    const searching = term.length > 0;
    let firstMatch: HTMLInputElement | null = null;
    let totalMatches = 0;

    for (const panel of panels) {
      panel
        .querySelectorAll<HTMLElement>(".divider")
        .forEach((d) => d.classList.toggle("hidden", searching));

      const cards = panel.querySelectorAll<HTMLElement>("[data-search]");
      let visible = 0;
      cards.forEach((card) => {
        const match = !searching || (card.dataset.search ?? "").includes(term);
        card.classList.toggle("hidden", !match);
        if (match) visible++;
      });
      totalMatches += visible;

      const tabId = panel.dataset.featurePanel;
      const radio = shadow.querySelector<HTMLInputElement>(
        `[data-hub-tab="${tabId}"]`,
      );
      const label = radio?.closest<HTMLElement>(".tab");
      if (label) {
        label.classList.toggle(
          "hub-tab-hidden",
          hubTabsState.overflowing || (searching && visible === 0),
        );
      }

      const subGroups = panel.querySelectorAll<HTMLElement>(
        "[data-sub-tabs-group]",
      );
      for (const group of subGroups) {
        const subRadios = group.querySelectorAll<HTMLInputElement>(
          'input[name^="hub_subtabs_"]',
        );
        let firstSubMatch: HTMLInputElement | null = null;
        for (const sr of subRadios) {
          const subPanel = group.querySelector<HTMLElement>(
            `[data-sub-panel="${sr.dataset.subTab}"]`,
          );
          if (!subPanel) continue;
          const subCards =
            subPanel.querySelectorAll<HTMLElement>("[data-search]");
          const subVisible = [...subCards].filter(
            (c) => !c.classList.contains("hidden"),
          ).length;
          sr.closest(".tab")?.classList.toggle(
            "hub-tab-hidden",
            searching && subVisible === 0,
          );
          if (searching && subVisible > 0 && !firstSubMatch) {
            firstSubMatch = sr;
          }
        }
        if (searching && firstSubMatch && visible > 0) {
          const checked = group.querySelector<HTMLInputElement>(
            'input[name^="hub_subtabs_"]:checked',
          );
          if (checked && checked !== firstSubMatch) {
            checked.checked = false;
            firstSubMatch.checked = true;
            firstSubMatch.dispatchEvent(new Event("change"));
          }
        }
      }

      if (searching && visible > 0 && !firstMatch && radio) {
        firstMatch = radio;
      }
    }

    const noResults = searching && totalMatches === 0;
    if (emptyState) {
      emptyState.classList.toggle("hidden", !noResults);
      emptyState.classList.toggle("flex", noResults);
      const msg = emptyState.querySelector("span");
      if (msg) {
        msg.textContent = noResults
          ? `No settings match "${input.value.trim()}"`
          : "";
      }
    }
    const tabsHost = shadow.querySelector<HTMLElement>('[role="tablist"].tabs');
    tabsHost?.classList.toggle("hidden", noResults);

    shadow
      .querySelectorAll<HTMLButtonElement>("[data-hub-tab-jump]")
      .forEach((btn) => {
        const radio = shadow.querySelector<HTMLInputElement>(
          `[data-hub-tab="${btn.dataset.hubTabJump}"]`,
        );
        const label = radio?.closest<HTMLElement>(".tab");
        btn
          .closest("li")
          ?.classList.toggle(
            "hidden",
            !!label?.classList.contains("hidden") || noResults,
          );
      });
    const compactHost = shadow.querySelector<HTMLElement>(
      "[data-hub-tabs-compact-host]",
    );
    compactHost?.classList.toggle("hidden", noResults);

    if (searching && firstMatch) {
      const current = shadow.querySelector<HTMLInputElement>(
        'input[name="hub_tabs"]:checked',
      );
      if (current && current !== firstMatch) {
        activeBeforeSearch = current;
        firstMatch.checked = true;
      }
      syncHubTabsActive(shadow, firstMatch.dataset.hubTab);
    } else if (!searching && activeBeforeSearch) {
      activeBeforeSearch.checked = true;
      syncHubTabsActive(shadow, activeBeforeSearch.dataset.hubTab);
      activeBeforeSearch = null;
    }
  };

  let timer: number | null = null;
  input.addEventListener("input", () => {
    if (input.value.trim()) ensureAllPanels();
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(apply, 120);
  });

  shadow
    .querySelectorAll<HTMLInputElement>('input[name="hub_tabs"]')
    .forEach((radio) => radio.addEventListener("change", apply));
}
