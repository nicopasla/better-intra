import { waitFor } from "../../utils/wait-for.ts";

const CAMPUS_FLAGS: Record<string, string> = {
  "42 Central": "🇫🇷",
  "42Network": "🇫🇷",
  "42next": "🇫🇷",
  "Abu Dhabi": "🇦🇪",
  Adelaide: "🇦🇺",
  "Al-Aïn": "🇦🇪",
  Alicante: "🇪🇸",
  Amman: "🇯🇴",
  Amsterdam: "🇳🇱",
  Angouleme: "🇫🇷",
  Antananarivo: "🇲🇬",
  Antwerp: "🇧🇪",
  Bangkok: "🇹🇭",
  Barcelona: "🇪🇸",
  Beirut: "🇱🇧",
  Belgium: "🇧🇪",
  "Belo Horizonte": "🇧🇷",
  Benguerir: "🇲🇦",
  Berlin: "🇩🇪",
  Bucharest: "🇷🇴",
  "Cape-Town": "🇿🇦",
  Chisinau: "🇲🇩",
  Cluj: "🇷🇴",
  CoderDojoSV: "🇺🇸",
  Florence: "🇮🇹",
  Forty2: "🇫🇷",
  Fremont: "🇺🇸",
  Gyeongsan: "🇰🇷",
  "Hack High School - Fremont": "🇺🇸",
  Heilbronn: "🇩🇪",
  Helsinki: "🇫🇮",
  iTouchUP: "🇺🇸",
  IskandarPuteri: "🇲🇾",
  Istanbul: "🇹🇷",
  Johannesburg: "🇿🇦",
  Kazan: "🇷🇺",
  Khouribga: "🇲🇦",
  Kocaeli: "🇹🇷",
  "Kuala Lumpur": "🇲🇾",
  Kyiv: "🇺🇦",
  Lausanne: "🇨🇭",
  "Le Havre": "🇫🇷",
  Lisboa: "🇵🇹",
  London: "🇬🇧",
  Luanda: "🇦🇴",
  Luxembourg: "🇱🇺",
  Lyon: "🇫🇷",
  Madrid: "🇪🇸",
  Malaga: "🇪🇸",
  Milano: "🇮🇹",
  Montrouge: "🇫🇷",
  Moscow: "🇷🇺",
  Mulhouse: "🇫🇷",
  Nablus: "🇵🇸",
  "New Vegas": "🇫🇷",
  Nice: "🇫🇷",
  Novosibirsk: "🇷🇺",
  Paris: "🇫🇷",
  Penang: "🇲🇾",
  Perpignan: "🇫🇷",
  Porto: "🇵🇹",
  Prague: "🇨🇿",
  Quebec: "🇨🇦",
  Rabat: "🇲🇦",
  "Rio de Janeiro": "🇧🇷",
  Rome: "🇮🇹",
  "São-Paulo": "🇧🇷",
  Seoul: "🇰🇷",
  Singapore: "🇸🇬",
  Tétouan: "🇲🇦",
  Tokyo: "🇯🇵",
  Urduliz: "🇪🇸",
  Vienna: "🇦🇹",
  Warsaw: "🇵🇱",
  Wolfsburg: "🇩🇪",
  Yerevan: "🇦🇲",
};

export function getCampusFlag(name: string): string {
  return CAMPUS_FLAGS[name] || "";
}

const CAMPUS_ROW_SELECTOR = ".flex.flex-col.justify-center.gap-4 .text-white";
const OBSERVE_DURATION_MS = 30000;

function campusName(el: HTMLElement): string {
  return el.dataset.ftCampusName || el.textContent?.trim() || "";
}

function hasCampusRow(): boolean {
  for (const el of document.querySelectorAll<HTMLElement>(
    CAMPUS_ROW_SELECTOR,
  )) {
    if (CAMPUS_FLAGS[campusName(el)]) return true;
  }
  return false;
}

export function injectCampusFlag(): void {
  for (const el of document.querySelectorAll<HTMLElement>(
    CAMPUS_ROW_SELECTOR,
  )) {
    const name = campusName(el);
    const flag = CAMPUS_FLAGS[name];
    if (!flag) continue;
    el.dataset.ftCampusName = name;
    const row = el.parentElement;
    const svg = row?.querySelector("svg");
    if (!svg) continue;
    if ((row?.textContent ?? "").includes(flag)) continue;
    svg.insertAdjacentHTML("beforebegin", flag);
    svg.remove();
  }
}

/**
 * Flags the campus as soon as the profile header renders, then keeps it alive
 * across Intra re-renders. Independent of campus data and cloud visuals, which
 * is why it is started before those fetches.
 */
export function initCampusFlag(): () => void {
  let stopped = false;
  let observer: MutationObserver | null = null;
  let raf = 0;
  let stopTimer = 0;

  const run = () => {
    raf = 0;
    if (!stopped) injectCampusFlag();
  };
  const schedule = () => {
    if (stopped || raf) return;
    raf = requestAnimationFrame(run);
  };
  const stop = () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = 0;
    observer?.disconnect();
    observer = null;
    window.removeEventListener("pagehide", stop);
  };

  void waitFor(hasCampusRow, 15000).then((found) => {
    if (!found || stopped) return;
    run();
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    stopTimer = window.setTimeout(stop, OBSERVE_DURATION_MS);
    window.addEventListener("pagehide", stop, { once: true });
  });

  return stop;
}
