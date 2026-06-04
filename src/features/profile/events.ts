import { html, render } from "lit-html";
import { getConfig } from "../../config.ts";
import { HUB_SETTING_DEFS } from "../hub/hubSettings.data.ts";
import CSS from "../../assets/style.css?inline";
import eventData from "./events.belgium.json";

export async function updateEventFilters() {
  const campus_mode = (await getConfig("PROFILE_CAMPUS_FILTER")) || "all";
  const event_mode = (await getConfig("PROFILE_EVENT_TYPE_FILTER")) || "all";

  const eventCards = document.querySelectorAll(
    "div.relative.clear-both.m-1.border.rounded",
  );

  eventCards.forEach((card) => {
    const htmlCard = card as HTMLElement;
    const typeText =
      htmlCard.querySelector("b")?.textContent?.toLowerCase() || "";
    const loc =
      htmlCard
        .querySelector("svg.lucide-map-pin")
        ?.nextElementSibling?.textContent?.toLowerCase() || "";

    const campusMatch =
      campus_mode === "all" ||
      eventData.campus[
        campus_mode as keyof typeof eventData.campus
      ]?.keywords.some((k) => loc.includes(k));

    const typeMatch =
      event_mode === "all" ||
      eventData.event_types[
        event_mode as keyof typeof eventData.event_types
      ]?.some((t) => typeText.includes(t));

    htmlCard.style.setProperty(
      "display",
      campusMatch && typeMatch ? "flex" : "none",
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
      class="select select-info select-sm rounded-none tracking-wide text-xs bg-base-100 text-base-content min-w-40"
      @change="${(e: Event) =>
        onEventChange((e.target as HTMLSelectElement).value)}"
    >
      <option
        value="all"
        disabled
        ?selected="${currentFilter === "all"}"
        class="bg-base-100 text-base-content"
      >
        Pick an Event Type
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

  const eventDef = (HUB_SETTING_DEFS as any).profile?.find(
    (d: any) => d.key === "PROFILE_EVENT_TYPE_FILTER",
  );
  if (!eventDef?.options) return;
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
  const style = document.createElement("style");
  style.textContent = `
    ${CSS}
    :host {
      --base-100: var(--color-base-100);
      --base-content: var(--color-base-content);
    }
    
    select {
      background-color: var(--base-100) !important;
      color: var(--base-content) !important;
      border-color: var(--base-content) !important;
    }
  `;
  shadowRoot.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.id = "events-shadow-wrapper";
  wrapper.setAttribute("data-theme", "light");
  wrapper.style.setProperty("display", "flex", "important");
  wrapper.style.setProperty("flex-direction", "row", "important");
  wrapper.style.setProperty("align-items", "center", "important");

  const handleEventChange = async (value: string) => {
    await chrome.storage.local.set({ PROFILE_EVENT_TYPE_FILTER: value });
    updateEventFilters();
  };

  render(
    renderFilterSelectBar(eventDef.options, currentFilter, handleEventChange),
    wrapper,
  );

  shadowRoot.appendChild(wrapper);
  agendaContainer.appendChild(shadowHost);
}
