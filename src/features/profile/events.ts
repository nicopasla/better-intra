import { html, render } from "lit-html";
import { gmSetValue } from "../../lib/gm.ts";
import { getConfig } from "../../config.ts";
import { HUB_SETTING_DEFS } from "../hub/hubSettings.data.ts";

export async function updateEventFilters() {
  const campus_mode = await getConfig("PROFILE_CAMPUS_FILTER");
  const event_filter_mode = await getConfig("PROFILE_EVENT_TYPE_FILTER");

  const eventCards = document.querySelectorAll(
    "div.relative.clear-both.m-1.border.rounded",
  );

  eventCards.forEach((card) => {
    const htmlCard = card as HTMLElement;
    const typeText =
      htmlCard.querySelector("b")?.textContent?.toLowerCase() || "";
    const locationText =
      htmlCard
        .querySelector("svg.lucide-map-pin")
        ?.nextElementSibling?.textContent?.toLowerCase() || "";

    const campusMatch =
      campus_mode === "all" ||
      (campus_mode === "brussels" &&
        (locationText.includes("brussels") ||
          locationText.includes("bru") ||
          /\b(shi|fu|mi|belfius)\b/i.test(locationText))) ||
      (campus_mode === "antwerp" &&
        (locationText.includes("antwerp") ||
          locationText.includes("ant") ||
          /\b(a1|a2)\b/i.test(locationText)));

    let typeMatch = true;
    if (event_filter_mode === "exam") typeMatch = typeText.includes("exam");
    else if (event_filter_mode === "pedago")
      typeMatch = typeText.includes("exam") || typeText.includes("challenge");
    else if (event_filter_mode === "social")
      typeMatch = ["association", "conference", "workshop"].some((t) =>
        typeText.includes(t),
      );

    htmlCard.style.display = campusMatch && typeMatch ? "flex" : "none";
  });
}

function renderEventFilterSelect(
  options: Array<{ value: string; label: string }>,
  currentValue: string,
  onchange: (value: string) => void,
): ReturnType<typeof html> {
  return html`<select
    id="custom-event-filter"
    class="text-center text-legacy-main bg-transparent border border-legacy-main py-1 px-2 cursor-pointer text-xs uppercase"
    @change="${(e: Event) => onchange((e.target as HTMLSelectElement).value)}"
  >
    ${options.map(
      (opt) =>
        html`<option
          value="${opt.value}"
          ?selected="${opt.value === currentValue}"
          style="background: white; color: black;"
        >
          ${opt.label}
        </option>`,
    )}
  </select>`;
}

export async function injectEventsSelect() {
  const agendaContainer =
    document.querySelector('a[href*="/events"]')?.parentElement;
  if (!agendaContainer || agendaContainer.querySelector("#custom-event-filter"))
    return;

  const eventDef = (HUB_SETTING_DEFS as any).profile?.find(
    (d: any) => d.key === "PROFILE_EVENT_TYPE_FILTER",
  );
  if (!eventDef?.options) return;

  const currentFilter = await getConfig("PROFILE_EVENT_TYPE_FILTER");

  const container = document.createElement("div");

  const handleChange = async (value: string) => {
    await gmSetValue("PROFILE_EVENT_TYPE_FILTER", value);
    updateEventFilters();
  };

  render(
    renderEventFilterSelect(eventDef.options, currentFilter, handleChange),
    container,
  );

  agendaContainer.appendChild(container.firstElementChild!);
}
