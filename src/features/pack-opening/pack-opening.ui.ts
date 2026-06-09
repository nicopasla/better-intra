import { html, render } from "lit-html";
import CSS from "./pack-opening.css?inline";
import { fetchSets, openPack, fetchCardDetails } from "./pack-opening.ts";
import { TcgSet, PulledCard, rarityColor, getCollection, getRareCards, getPulledCards, exportBackup, importBackup } from "./pack-opening.data.ts";

type View = "open" | "rares" | "history";
type Phase = "idle" | "revealing" | "done";

interface State {
  sets: TcgSet[];
  selectedSet: string;
  cards: PulledCard[] | null;
  isNew: boolean[];
  opening: boolean;
  totalPulled: number;
  loading: boolean;
  error: string;
  view: View;
  rareCards: PulledCard[];
  loadingRares: boolean;
  phase: Phase;
  currentIndex: number;
  historyCards: PulledCard[];
  loadingHistory: boolean;
  setDropdownOpen: boolean;
  cardBack: boolean[];
  dropdownRect: { top: number; left: number; width: number } | null;
  detailCard: PulledCard | null;
}

function state(): State {
  const s = window.__PACK_STATE__;
  if (s) return s;
  const ns: State = {
    sets: [],
    selectedSet: "",
    cards: null,
    isNew: [],
    opening: false,
    totalPulled: 0,
    loading: true,
    error: "",
    view: "open",
    rareCards: [],
    loadingRares: false,
    phase: "idle",
    currentIndex: 0,
    historyCards: [],
    loadingHistory: false,
    setDropdownOpen: false,
    cardBack: [],
    dropdownRect: null,
    detailCard: null,
  };
  window.__PACK_STATE__ = ns;
  return ns;
}

declare global {
  interface Window {
    __PACK_STATE__: State | undefined;
  }
}

async function loadCollectionCount(): Promise<number> {
  const col = await getCollection();
  return Object.values(col).reduce((sum, ids) => sum + ids.length, 0);
}

export async function showPackOverlay(): Promise<void> {
  const existing = document.getElementById("ft-pack-root");
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = "ft-pack-root";
  host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  const st = state();
  st.totalPulled = await loadCollectionCount();

  const close = () => host.remove();

  const nextCard = () => {
    if (st.cardBack[st.currentIndex]) {
      st.cardBack[st.currentIndex] = false;
      const c = st.cards?.[st.currentIndex];
      if (c && !c.pricing) {
        fetchCardDetails(c.id).then((details) => {
          if (details && st.cards?.[st.currentIndex]) {
            if (details.pricing) st.cards[st.currentIndex].pricing = details.pricing;
            if (details.rarity) st.cards[st.currentIndex].rarity = details.rarity;
            ui();
          }
        });
      }
      ui();
      return;
    }
    advanceToNext();
  };

  const advanceToNext = () => {
    const c = st.cards?.[st.currentIndex];
    if (c && !c.pricing) {
      fetchCardDetails(c.id).then((details) => {
        if (details && st.cards?.[st.currentIndex]) {
          if (details.pricing) st.cards[st.currentIndex].pricing = details.pricing;
          if (details.rarity) st.cards[st.currentIndex].rarity = details.rarity;
          ui();
        }
      });
    }
    if (st.currentIndex < (st.cards?.length ?? 1) - 1) {
      st.currentIndex++;
      ui();
    } else {
      st.phase = "done";
      ui();
    }
  };

  const revealAll = () => {
    st.phase = "done";
    st.cardBack = st.cards?.map(() => false) ?? [];
    ui();
    st.cards?.forEach((c) => {
      if (c && !c.pricing) {
        fetchCardDetails(c.id).then((details) => {
          if (details && st.cards) {
            const idx = st.cards.indexOf(c);
            if (idx !== -1) {
              if (details.pricing) st.cards[idx].pricing = details.pricing;
              if (details.rarity) st.cards[idx].rarity = details.rarity;
              ui();
            }
          }
        });
      }
    });
  };

  const goToPackList = () => {
    st.phase = "idle";
    st.currentIndex = 0;
    st.cards = null;
    st.cardBack = [];
    st.setDropdownOpen = false;
    st.dropdownRect = null;
    ui();
  };

  const showCardDetail = (card: PulledCard) => {
    st.detailCard = card;
    ui();
  };

  const closeDetail = () => {
    st.detailCard = null;
    ui();
  };

  const showRares = async () => {
    st.view = "rares";
    st.loadingRares = true;
    ui();
    st.rareCards = await getRareCards();
    st.loadingRares = false;
    ui();
  };

  const showHistory = async () => {
    st.view = "history";
    st.loadingHistory = true;
    ui();
    st.historyCards = await getPulledCards();
    st.loadingHistory = false;
    ui();
  };

  const handleBackup = async () => {
    await exportBackup();
  };

  const restoreInput = document.createElement("input");
  restoreInput.type = "file";
  restoreInput.accept = ".json";
  restoreInput.style.display = "none";
  restoreInput.addEventListener("change", async () => {
    const file = restoreInput.files?.[0];
    if (!file) return;
    try {
      const count = await importBackup(file);
      st.totalPulled = await loadCollectionCount();
      ui();
    } catch {
      // ignore invalid files
    }
    restoreInput.value = "";
  });
  host.shadowRoot?.appendChild(restoreInput);

  const handleRestore = () => {
    restoreInput.click();
  };

  const ui = () => {
    if (!host.shadowRoot) return;

    const renderCard = (c: PulledCard) => html`
      <div class="card-inner flipped">
        <div class="card-face card-back">
          <div class="card-back-icon">⚡</div>
        </div>
        <div class="card-face card-front">
          <img src=${c.image} alt=${c.name} loading="lazy" />
          <div class="card-label">
            <span class="name">${c.name}</span>
            <span class="rarity" style="color:${rarityColor(c.rarity)}">
              ${c.rarity}
            </span>
            ${c.pricing
              ? html`<span class="price">${(() => {
                    const cm = c.pricing.cardmarket;
                    if (cm?.avg != null) return `€${cm.avg.toFixed(2)}`;
                    if (cm?.low != null) return `€${cm.low.toFixed(2)}`;
                    const tp = c.pricing.tcgplayer?.holofoil;
                    if (tp?.marketPrice != null) return `$${tp.marketPrice.toFixed(2)}`;
                    return "";
                  })()}</span>`
              : ""}
          </div>
        </div>
      </div>
    `;

    const content = st.view === "rares"
      ? html`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <button class="btn btn-secondary" @click=${() => { st.view = "open"; ui(); }}>← Back</button>
          <span style="font-size:0.85rem;color:#a6adc8">${st.rareCards.length} rare+ cards</span>
        </div>
        ${st.loadingRares
          ? html`<div class="status">Loading collection...</div>`
          : st.rareCards.length === 0
            ? html`<div class="status">No rare cards pulled yet. Open some packs!</div>`
            : html`<div class="card-grid">${st.rareCards.map((c) => html`<div class="card-slot" @click=${() => showCardDetail(c)}>${renderCard(c)}</div>`)}</div>`
        }
      `
      : st.view === "history"
        ? html`
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <button class="btn btn-secondary" @click=${() => { st.view = "open"; ui(); }}>← Back</button>
            <span style="font-size:0.85rem;color:#a6adc8">${st.historyCards.length} cards opened</span>
          </div>
          ${st.loadingHistory
            ? html`<div class="status">Loading history...</div>`
            : st.historyCards.length === 0
              ? html`<div class="status">No cards opened yet. Open some packs!</div>`
              : html`${(() => {
                  const groups = new Map<string, PulledCard[]>();
                  for (const c of st.historyCards) {
                    const arr = groups.get(c.setId) || [];
                    arr.push(c);
                    groups.set(c.setId, arr);
                  }
                  const sorted = [...groups.entries()].sort((a, b) => {
                    const ma = Math.max(...a[1].map((c) => c.pulledAt));
                    const mb = Math.max(...b[1].map((c) => c.pulledAt));
                    return mb - ma;
                  });
                  return sorted.map(([setId, cards]) => {
                    const set = st.sets.find((s) => s.id === setId);
                    return html`
                      <div style="margin-bottom:16px">
                        <div style="font-size:0.85rem;font-weight:600;color:#cdd6f4;margin-bottom:8px">${set?.name ?? setId} (${cards.length})</div>
                        <div class="card-grid">${cards.map((c) => html`<div class="card-slot" @click=${() => showCardDetail(c)}>${renderCard(c)}</div>`)}</div>
                      </div>
                    `;
                  });
                })()}`
          }
        `
        : html`
        <div class="stats">${st.totalPulled} cards pulled</div>

        ${st.loading
          ? html`<div class="status">Loading sets...</div>`
          : st.error
            ? html`<div class="status" style="color:#f38ba8">${st.error}</div>`
            : st.phase === "idle"
              ? html`
                  <div class="set-dropdown">
                  <div class="set-dropdown-trigger" @click=${(e: PointerEvent) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); st.dropdownRect = { top: r.bottom + 4, left: r.left, width: r.width }; st.setDropdownOpen = !st.setDropdownOpen; ui(); }}>
                    ${(() => {
                      const s = st.sets.find((x) => x.id === st.selectedSet);
                      const logo = s?.logo ? `${s.logo}.png` : "";
                      return html`
                        ${logo ? html`<img class="set-logo" src=${logo} alt="" />` : ""}
                        <span>${s?.name ?? "Select a set"}</span>
                        <span class="set-dropdown-arrow ${st.setDropdownOpen ? "open" : ""}">▼</span>
                      `;
                    })()}
                  </div>
                </div>
                <div class="actions">
                  <button class="btn btn-primary" ?disabled=${st.opening} @click=${handleOpen}>Open Pack</button>
                  <button class="btn btn-secondary" @click=${showRares}>My Rares</button>
                  <button class="btn btn-secondary" @click=${showHistory}>History</button>
                </div>
                <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
                  <button class="btn btn-secondary" style="font-size:0.75rem;padding:4px 12px" @click=${handleBackup}>Backup</button>
                  <button class="btn btn-secondary" style="font-size:0.75rem;padding:4px 12px" @click=${handleRestore}>Restore</button>
                </div>
              `
              : ""}

        ${st.opening ? html`<div class="status">Opening pack...</div>` : ""}

        ${st.phase === "revealing" && st.cards
          ? html`
            <div class="reveal-area">
              <div class="card-stack">
                ${(() => {
                  const c = st.cards![st.currentIndex];
                  const remaining = st.cards!.length - st.currentIndex - 1;
                  return html`
                    ${remaining > 0 ? html`
                      <div class="stack-backdrop">
                        <div class="stack-backdrop-icon">⚡</div>
                      </div>
                    ` : ""}
                    <div class="stack-card-wrap stack-pos-0">
                      ${st.cardBack[st.currentIndex]
                        ? html`
                          <div class="stack-first-back" @click=${() => nextCard()}>
                            <div class="card-inner">
                              <div class="card-face card-back">
                                <div class="card-back-icon" style="font-size:3.5rem;opacity:0.4">⚡</div>
                              </div>
                              <div class="card-face card-front">
                                <img src=${c.image} alt=${c.name} />
                              </div>
                            </div>
                          </div>
                        `
                        : html`
                          <figure style="width:100%;height:100%;margin:0;border-radius:12px;overflow:hidden;cursor:pointer" @click=${() => advanceToNext()}>
                            <img src=${c.image} alt=${c.name} style="width:100%;height:100%;object-fit:contain;display:block" />
                          </figure>
                        `}
                    </div>
                  `;
                })()}
              </div>
              <div style="text-align:center;font-size:0.9rem;color:#a6adc8">
                Card ${st.currentIndex + 1} of ${st.cards.length}
              </div>
              <div style="display:flex;gap:12px;align-items:center;justify-content:center">
                <span style="font-size:0.85rem;color:#585b70">${st.cardBack[st.currentIndex] ? "Click to reveal" : "Click for next card"}</span>
                <button class="btn btn-secondary" @click=${revealAll}>Skip</button>
              </div>
            </div>
          `
          : ""}

        ${st.phase === "done" && st.cards
          ? html`
            <div class="card-grid">
              ${st.cards.map((c) => html`<div class="card-slot" @click=${() => showCardDetail(c)}>${renderCard(c)}</div>`)}
            </div>
            <div class="actions">
              <button class="btn btn-primary" @click=${goToPackList}>Open Another</button>
              <button class="btn btn-secondary" @click=${showRares}>My Rares</button>
              <button class="btn btn-secondary" @click=${showHistory}>History</button>
              <button class="btn btn-secondary" @click=${close}>Close</button>
            </div>
          `
          : ""}
      `;

    render(
      html`
        <style>${CSS}</style>
        <div class="overlay" @click=${(e: MouseEvent) => { if (st.setDropdownOpen) { st.setDropdownOpen = false; st.dropdownRect = null; ui(); } if (e.target === e.currentTarget) close(); }}>
          <div class="modal">
            <div class="header">
              <h2>⚡ Pack Opening</h2>
              <button class="close-btn" @click=${close}>✕</button>
            </div>
            ${content}
          </div>
        </div>
        ${st.setDropdownOpen && st.dropdownRect
          ? html`
            <div class="set-dropdown-menu"
              style="top:${st.dropdownRect.top}px;left:${st.dropdownRect.left}px;width:${st.dropdownRect.width}px"
              @click=${(e: Event) => e.stopPropagation()}>
              ${st.sets.map((s) => {
                const logo = s.logo ? `${s.logo}.png` : "";
                return html`
                  <div class="set-dropdown-item ${s.id === st.selectedSet ? "active" : ""}"
                    @click=${() => { st.selectedSet = s.id; st.setDropdownOpen = false; st.dropdownRect = null; ui(); }}>
                    ${logo ? html`<img class="set-logo" src=${logo} alt="" />` : ""}
                    <span>${s.name}</span>
                    <span class="set-card-count">${s.cardCount?.official ?? s.cardCount?.total ?? "?"}</span>
                  </div>
                `;
              })}
            </div>
          `
          : ""}
        ${st.detailCard
          ? html`
            <div class="detail-overlay" @click=${closeDetail}>
              <div class="detail-card">
                <div class="hover-3d" @click=${(e: Event) => e.stopPropagation()}>
                  <figure><img src=${st.detailCard.image} alt=${st.detailCard.name} /></figure>
                  <div></div><div></div><div></div><div></div>
                  <div></div><div></div><div></div><div></div>
                </div>
              </div>
            </div>
          `
          : ""}
      `,
      host.shadowRoot,
    );
  };

  const handleOpen = async () => {
    if (!st.selectedSet || st.opening || st.loading) return;
    st.opening = true;
    st.cards = null;
    st.phase = "idle";
    st.currentIndex = 0;
    ui();

    try {
      const result = await openPack(st.selectedSet);
      st.cards = result.cards;
      st.isNew = result.isNew;
      st.totalPulled += result.cards.length;
      st.currentIndex = 0;
      st.cardBack = result.cards.map((_, i) => i === 0);
      st.phase = "revealing";
      st.opening = false;
      ui();
      st.totalPulled = await loadCollectionCount();
      ui();
    } catch {
      st.opening = false;
      ui();
    }
  };

  ui();

  try {
    st.sets = await fetchSets();
    st.selectedSet = st.sets[0]?.id || "";
    st.loading = false;
  } catch {
    st.loading = false;
    st.error = "Failed to load sets. Check your network connection.";
  }
  ui();
}
