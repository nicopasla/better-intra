import { html, render } from "lit-html";
import { getConfig } from "../../../config.ts";
import { fetchEventTypes } from "../../clusters/clusters.data.ts";
import { loadEventTypeKeywords } from "../../campus/campus.ts";
import { sharedCSS } from "../../../assets/shared-styles.ts";
import { THEMES } from "../theme/theme-manager.ts";

let eventKeywordsCache: Record<string, string[]> | null = null;

async function getKeywords(): Promise<Record<string, string[]>> {
  if (eventKeywordsCache) return eventKeywordsCache;
  const campus = (await getConfig("CLUSTERS_CAMPUS")) || "12";
  eventKeywordsCache = await loadEventTypeKeywords(campus);
  return eventKeywordsCache;
}

export async function updateEventFilters() {
  const event_mode = (await getConfig("PROFILE_EVENT_TYPE_FILTER")) || "all";

  const eventCards = document.querySelectorAll(
    "div.relative.clear-both.m-1.border.rounded",
  );

  if (event_mode === "all") {
    eventCards.forEach((card) => {
      (card as HTMLElement).style.setProperty("display", "flex", "important");
    });
    return;
  }

  const keywords = await getKeywords();
  const matchKeywords = keywords[event_mode] ?? [event_mode];

  eventCards.forEach((card) => {
    const htmlCard = card as HTMLElement;
    const typeText =
      htmlCard.querySelector("b")?.textContent?.toLowerCase() || "";

    const typeMatch = matchKeywords.some((kw) => typeText.includes(kw));

    htmlCard.style.setProperty(
      "display",
      typeMatch ? "flex" : "none",
      "important",
    );
  });
}

function renderFilterSelectBar(
  eventOptions: Array<{ value: string; label: string }>,
  currentFilter: string,
  onEventChange: (value: string) => void,
): ReturnType<typeof html> {
  return html`
    <select
      class="select select-sm rounded-none tracking-wide text-xs bg-base-100 text-base-content min-w-40"
      @change="${(e: Event) =>
        onEventChange((e.target as HTMLSelectElement).value)}"
    >
      <option
        value="all"
        ?selected="${currentFilter === "all"}"
        class="bg-base-100 text-base-content"
      >
        Show All
      </option>

      ${eventOptions.map(
        (opt) => html`
          <option
            value="${opt.value}"
            ?selected="${currentFilter === opt.value}"
            class="bg-base-100 text-base-content"
          >
            ${opt.label === "all" ? "SHOW ALL" : opt.label}
          </option>
        `,
      )}
    </select>
  `;
}

export async function injectEventsSelect() {
  const agendaContainer =
    document.querySelector('a[href*="/events"]')?.parentElement;
  if (!agendaContainer || agendaContainer.dataset.filterInjected === "true")
    return;

  const campus = (await getConfig("CLUSTERS_CAMPUS")) || "12";
  const eventOptions = await fetchEventTypes(campus);
  if (eventOptions.length === 0) return;
  agendaContainer.dataset.filterInjected = "true";

  agendaContainer.style.setProperty("display", "flex", "important");
  agendaContainer.style.setProperty("flex-direction", "row", "important");
  agendaContainer.style.setProperty("align-items", "center", "important");
  agendaContainer.style.setProperty("gap", "12px", "important");

  const currentFilter = (await getConfig("PROFILE_EVENT_TYPE_FILTER")) || "all";

  const shadowHost = document.createElement("div");
  shadowHost.id = "events-shadow-host";
  shadowHost.style.setProperty("display", "inline-flex", "important");

  const shadowRoot = shadowHost.attachShadow({ mode: "open" });
  const effectiveTheme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  const presetKey = await getConfig("PROFILE_THEME_PRESET");
  const preset = THEMES[presetKey] ?? THEMES["dark"];
  const isLightPreset = !preset.dark && !!preset.light;
  const daisyTheme =
    presetKey !== "dark" && presetKey !== "light"
      ? presetKey
      : isLightPreset
        ? "light"
        : "dark";
  const isLight = daisyTheme === "light" || isLightPreset;
  const primaryHsl = preset.primary;
  const presetVars = isLight && preset.light ? preset.light : null;
  const base100 = presetVars
    ? `hsl(${presetVars.card})`
    : effectiveTheme === "light"
      ? "hsl(0 0% 100%)"
      : "hsl(225 17% 14%)";
  const baseContent = presetVars
    ? `hsl(${presetVars.foreground})`
    : effectiveTheme === "light"
      ? "hsl(0 0% 10%)"
      : "hsl(210 20% 98%)";
  const style = document.createElement("style");
  style.textContent = `
    ${sharedCSS}
    select {
      background-color: var(--color-base-100) !important;
      color: var(--color-primary) !important;
      border-color: var(--color-primary) !important;
    }
    select > option {
      background-color: var(--color-base-100) !important;
      color: var(--color-base-content) !important;
    }
  `;
  shadowRoot.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.id = "events-shadow-wrapper";
  wrapper.setAttribute("data-theme", daisyTheme);
  wrapper.style.setProperty(
    "--color-primary",
    `hsl(${primaryHsl})`,
    "important",
  );
  wrapper.style.setProperty("--color-base-100", base100, "important");
  wrapper.style.setProperty("--color-base-content", baseContent, "important");
  wrapper.style.setProperty("display", "flex", "important");
  wrapper.style.setProperty("flex-direction", "row", "important");
  wrapper.style.setProperty("align-items", "center", "important");

  const handleEventChange = async (value: string) => {
    await chrome.storage.local.set({ PROFILE_EVENT_TYPE_FILTER: value });
    updateEventFilters();
  };

  render(
    renderFilterSelectBar(eventOptions, currentFilter, handleEventChange),
    wrapper,
  );

  shadowRoot.appendChild(wrapper);
  agendaContainer.appendChild(shadowHost);
}
