import { html, render } from "lit-html";
import { sharedCSS } from "../../assets/shared-styles.ts";
import { getConfig } from "../../config.ts";

const WORKER_URL = "https://api.betterintra.com";

interface RankingEntry {
  rank: number;
  login: string;
  displayname: string;
  image_url: string;
  level: number;
}

interface RankingsResponse {
  cached_at?: number;
  data?: RankingEntry[];
}

const MONTHS = [
  { value: 2, label: "February", cursusId: 64, color: "#ff6b6b" },
  { value: 3, label: "March", cursusId: 64, color: "#f06595" },
  { value: 4, label: "April", cursusId: 21, color: "#51cf66" },
  { value: 7, label: "July", cursusId: 64, color: "#ffd43b" },
  { value: 8, label: "August", cursusId: 64, color: "#da77f2" },
  { value: 10, label: "October", cursusId: 21, color: "#4dabf7" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTimeAgo(ts: number): string {
  const secs = Date.now() / 1000 - ts;
  if (secs < 3) return "now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}

async function fetchRankings(
  cursusId: number,
  rangeBegin: string,
  rangeEnd: string,
): Promise<RankingsResponse | null> {
  try {
    const res = await fetch(
      `${WORKER_URL}/api/v1/rankings?cursus_id=${cursusId}&range_begin=${rangeBegin}&range_end=${rangeEnd}&_=${Date.now()}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as RankingsResponse | RankingEntry[];
    if (Array.isArray(json)) {
      return { data: json };
    }
    return json as RankingsResponse;
  } catch {
    return null;
  }
}

export async function openRankingsDialog() {
  const campusId = await getConfig("CLUSTERS_CAMPUS");
  if (campusId !== "12") return;

  const now = new Date();
  const currentYear = now.getFullYear();

  const themePref = await getConfig("BETTER_INTRA_THEME");
  const isDark =
    themePref === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : themePref !== "light";
  const presetKey = (await getConfig("PROFILE_THEME_PRESET")) || "dark";
  const currentTheme =
    presetKey !== "dark" && presetKey !== "light"
      ? presetKey
      : isDark
        ? "dark"
        : "light";

  let selectedMonth = MONTHS[0];
  let selectedYear = currentYear;

  const saved = (await chrome.storage.local.get("RANKINGS_SELECTION")) as {
    RANKINGS_SELECTION?: { month: number; year: number };
  };
  if (saved.RANKINGS_SELECTION) {
    const m = MONTHS.find(
      (x) => x.value === saved.RANKINGS_SELECTION!.month,
    );
    if (m) selectedMonth = m;
    const y = saved.RANKINGS_SELECTION.year;
    if (y >= 2023 && y <= currentYear) selectedYear = y;
  }

  const saveSelection = () => {
    chrome.storage.local.set({
      RANKINGS_SELECTION: {
        month: selectedMonth.value,
        year: selectedYear,
      },
    });
  };

  let rankings: RankingEntry[] = [];
  let loading = true;
  let lastFetched = 0;

  const dialog = Object.assign(document.createElement("dialog"), {
    id: "rankings-dialog",
    className: "bg-transparent backdrop:bg-black/60",
  });
  Object.assign(dialog.style, {
    margin: "auto",
    width: "min(480px, calc(100dvw - 2rem))",
    maxHeight: "calc(100dvh - 2rem)",
    borderRadius: "1rem",
    overflow: "hidden",
    padding: "0",
    border: "none",
    background: "transparent",
  });

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;";
  dialog.appendChild(wrapper);

  const shadow = wrapper.attachShadow({ mode: "closed" });

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  const yearOptions = (): number[] => {
    const years: number[] = [];
    for (let y = currentYear; y >= 2023; y--) {
      years.push(y);
    }
    return years;
  };

  const load = async () => {
    const endMonth = selectedMonth.value + 1;
    const endYear = endMonth > 12 ? selectedYear + 1 : selectedYear;
    const rangeBegin = `${selectedYear}-${pad(selectedMonth.value)}-01`;
    const rangeEnd = `${endYear}-${pad(endMonth > 12 ? 1 : endMonth)}-01`;
    loading = true;
    rerender();
    const res = await fetchRankings(
      selectedMonth.cursusId,
      rangeBegin,
      rangeEnd,
    );
    if (res) {
      rankings = res.data || [];
      lastFetched = res.cached_at || 0;
    } else {
      rankings = [];
      lastFetched = 0;
    }
    loading = false;
    rerender();
  };

  function renderTemplate() {
    const years = yearOptions();
    const cursusLabel =
      selectedMonth.cursusId === 64 ? "Piscine Brussels" : "42 Cursus";
    const ago = lastFetched ? formatTimeAgo(lastFetched) : "";
    return html`
      <style>
        :host {
          display: block;
        }
        ${sharedCSS} .rank-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
        }
        .rank-row:hover {
          background: var(--color-base-200);
        }
        .rank-number {
          width: 2rem;
          text-align: center;
          font-weight: 700;
          font-size: 1rem;
          color: var(--color-base-content);
          flex-shrink: 0;
        }
        .rank-avatar {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }
        .rank-info {
          flex: 1;
          min-width: 0;
        }
        .rank-displayname {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--color-base-content);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rank-login {
          font-size: 0.75rem;
          opacity: 0.5;
        }
        .rank-level {
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--color-accent);
          flex-shrink: 0;
        }
      </style>
      <div
        data-theme="${currentTheme}"
        class="flex flex-col bg-base-100 rounded-xl"
        style="max-height:calc(100dvh - 2rem);"
      >
        <div class="sticky top-0 z-10 bg-base-100 rounded-t-xl">
        <div class="flex items-center gap-2 shrink-0 p-3">
          <select
            class="select w-36"
            @change="${async (e: Event) => {
              const v = Number((e.target as HTMLSelectElement).value);
              selectedMonth = MONTHS.find((m) => m.value === v) || MONTHS[0];
              saveSelection();
              await load();
            }}"
          >
            ${MONTHS.map(
              (m) =>
                html`<option
                  value="${m.value}"
                  ?selected="${m.value === selectedMonth.value}"
                  style="color:${m.color};font-weight:600;"
                >
                  ${m.label}
                </option>`,
            )}
          </select>
          <select
            class="select w-20"
            @change="${async (e: Event) => {
              selectedYear = Number((e.target as HTMLSelectElement).value);
              saveSelection();
              await load();
            }}"
          >
            ${years.map(
              (y) =>
                html`<option value="${y}" ?selected="${y === selectedYear}">
                  ${y}
                </option>`,
            )}
          </select>
          ${ago
            ? html`<span
                class="btn btn-accent border border-base-content/20 flex-shrink-0"
                >Updated ${ago === "now" ? ago : ago + " ago"}</span
              >`
            : ""}
          <button
            class="btn btn-circle btn-ghost btn-sm text-xl ml-auto"
            @click="${close}"
          >
            ✕
          </button>
        </div>
        <div class="px-3 pb-2 text-xs opacity-50 text-center">
          ${cursusLabel} &mdash; ${selectedMonth.label} ${selectedYear}
        </div>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto p-3">
          ${loading
            ? html`<div class="flex items-center justify-center p-8">
                <span class="loading loading-spinner loading-lg"></span>
              </div>`
            : rankings.length === 0
              ? html`<div class="text-center p-6 text-base-content/50">
                  No data
                </div>`
              : html`
                  <div class="flex flex-col gap-1">
                    ${rankings.map(
                      (r) =>
                        html`<div
                          class="rank-row"
                          style="cursor:pointer;"
                          @click="${() => {
                            window.open(
                              `https://profile.intra.42.fr/users/${r.login}`,
                              "_blank",
                            );
                          }}"
                        >
                          <span class="rank-number">#${r.rank}</span>
                          <img
                            class="rank-avatar"
                            src="${r.image_url}"
                            alt="${r.login}"
                            loading="lazy"
                          />
                          <div class="rank-info">
                            <div class="rank-displayname">
                              ${r.displayname || r.login}
                            </div>
                            <div class="rank-login">${r.login}</div>
                          </div>
                          <span class="rank-level">${r.level.toFixed(2)}</span>
                        </div>`,
                    )}
                  </div>
                `}
        </div>
      </div>
    `;
  }

  const rerender = () => {
    render(renderTemplate(), shadow);
  };

  rerender();
  document.body.appendChild(dialog);
  dialog.showModal();
  await load();
}
