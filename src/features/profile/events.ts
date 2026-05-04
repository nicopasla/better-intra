import { gmGetValue } from "../../lib/gm.ts";

export async function updateEventFilters() {
  const settings = {
    campus_mode: await gmGetValue<string>("PROFILE_CAMPUS_FILTER", "all"),
    event_filter_mode: await gmGetValue<string>("PROFILE_EVENT_TYPE_FILTER", "all"),
  };

  const eventCards = document.querySelectorAll('div.relative.clear-both.m-1.border.rounded');

  eventCards.forEach((card) => {
    const htmlCard = card as HTMLElement;
    const typeText = htmlCard.querySelector('b')?.textContent?.toLowerCase() || "";
    const locationText = htmlCard.querySelector('svg.lucide-map-pin')?.nextElementSibling?.textContent?.toLowerCase() || "";

    let campusMatch = true;
    if (settings.campus_mode === "brussels") {
      campusMatch = locationText.includes("brussels") || locationText.includes("bru") || /\b(shi|fu|mi|belfius)\b/i.test(locationText);
    } else if (settings.campus_mode === "antwerp") {
      campusMatch = locationText.includes("antwerp") || locationText.includes("ant") || /\b(a1|a2)\b/i.test(locationText);
    }

    let typeMatch = true;
    const filterMode = settings.event_filter_mode;
    if (filterMode === "exam") typeMatch = typeText.includes("exam");
    else if (filterMode === "pedago") typeMatch = typeText.includes("exam") || typeText.includes("challenge");
    else if (filterMode === "social") typeMatch = typeText.includes("association") || typeText.includes("conference") || typeText.includes("workshop");

    htmlCard.style.display = (campusMatch && typeMatch) ? "flex" : "none";
  });
}