import { gmGetValue, gmSetValue } from "../../lib/gm.ts";
import { HUB_SETTING_DEFS } from "../hub/hubSettings.data.ts";

export async function updateEventFilters() {
  const settings = {
    campus_mode: await gmGetValue<string>("PROFILE_CAMPUS_FILTER", "all"),
    event_filter_mode: await gmGetValue<string>("PROFILE_EVENT_TYPE_FILTER", "all"),
  };

  const eventCards = document.querySelectorAll("div.relative.clear-both.m-1.border.rounded");

  eventCards.forEach((card) => {
    const htmlCard = card as HTMLElement;
    const typeText = htmlCard.querySelector("b")?.textContent?.toLowerCase() || "";
    const locationText = htmlCard.querySelector("svg.lucide-map-pin")?.nextElementSibling?.textContent?.toLowerCase() || "";

    const campusMatch = settings.campus_mode === "all" || 
      (settings.campus_mode === "brussels" && (locationText.includes("brussels") || locationText.includes("bru") || /\b(shi|fu|mi|belfius)\b/i.test(locationText))) ||
      (settings.campus_mode === "antwerp" && (locationText.includes("antwerp") || locationText.includes("ant") || /\b(a1|a2)\b/i.test(locationText)));

    let typeMatch = true;
    if (settings.event_filter_mode === "exam") typeMatch = typeText.includes("exam");
    else if (settings.event_filter_mode === "pedago") typeMatch = typeText.includes("exam") || typeText.includes("challenge");
    else if (settings.event_filter_mode === "social") typeMatch = ["association", "conference", "workshop"].some(t => typeText.includes(t));

    htmlCard.style.display = campusMatch && typeMatch ? "flex" : "none";
  });
}

export async function injectEventsSelect() {
  const agendaContainer = document.querySelector('a[href*="/events"]')?.parentElement;
  if (!agendaContainer || agendaContainer.querySelector("#custom-event-filter")) return;

  const eventDef = HUB_SETTING_DEFS.profile.find(d => d.key === "PROFILE_EVENT_TYPE_FILTER");
  if (!eventDef?.options) return;

  const currentFilter = await gmGetValue<string>("PROFILE_EVENT_TYPE_FILTER", "all");

  const select = document.createElement("select");
  select.id = "custom-event-filter";
  select.className = "text-center text-legacy-main bg-transparent border border-legacy-main py-1 px-2 cursor-pointer text-xs uppercase";
  
  select.innerHTML = eventDef.options
    .map(opt => `<option value="${opt.value}" ${opt.value === currentFilter ? "selected" : ""} style="background: white; color: black;">${opt.label}</option>`)
    .join("");

  select.onchange = async (e) => {
    const newValue = (e.target as HTMLSelectElement).value;
    await gmSetValue("PROFILE_EVENT_TYPE_FILTER", newValue);
    updateEventFilters();
  };

  agendaContainer.appendChild(select);
}