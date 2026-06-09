import { TcgSet, TcgCard, PulledCard, CardPricing, buildPack, addToCollection, getCollection, savePulledCard, rarityWeight } from "./pack-opening.data.ts";
import { showPackOverlay } from "./pack-opening.ui.ts";

const BASE = "https://api.tcgdex.net/v2/fr";

let cachedSets: TcgSet[] | null = null;

export async function fetchSets(): Promise<TcgSet[]> {
  if (cachedSets) return cachedSets;
  const res = await fetch(`${BASE}/sets`);
  if (!res.ok) throw new Error("Failed to fetch sets");
  const sets = await res.json() as TcgSet[];
  sets.sort((a, b) => {
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return a.releaseDate.localeCompare(b.releaseDate);
  });
  cachedSets = sets;
  return cachedSets;
}

export async function fetchSetCards(setId: string): Promise<TcgCard[]> {
  const res = await fetch(`${BASE}/sets/${setId}`);
  if (!res.ok) throw new Error(`Failed to fetch set ${setId}`);
  const data = await res.json() as { cards: TcgCard[] };
  return data.cards || [];
}

export async function fetchCardDetails(cardId: string): Promise<{ pricing?: CardPricing; rarity?: string } | undefined> {
  const res = await fetch(`${BASE}/cards/${cardId}`);
  if (!res.ok) return undefined;
  const data = await res.json() as { pricing?: CardPricing; rarity?: string };
  return { pricing: data.pricing, rarity: data.rarity };
}

function preloadImage(url: string, timeout = 8000): Promise<void> {
  return Promise.race([
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    }),
    new Promise<void>((resolve) => setTimeout(resolve, timeout)),
  ]);
}

async function preloadCards(cards: PulledCard[]): Promise<void> {
  await Promise.all(
    cards.map((c) => preloadImage(c.image)),
  );
}

export async function openPack(setId: string): Promise<{
  cards: PulledCard[];
  isNew: boolean[];
}> {
  const all = await fetchSetCards(setId);
  const picked = buildPack(all);
  const col = await getCollection();
  const existing = col[setId] || [];

  // Fetch real rarity + pricing for all 10 cards before sorting
  const details = await Promise.all(
    picked.map((c) => fetchCardDetails(c.id)),
  );

  const now = Date.now();
  const cards: PulledCard[] = picked.map((c, i) => ({
    id: c.id,
    localId: c.localId,
    name: c.name,
    image: `${c.image}/high.png`,
    rarity: details[i]?.rarity || c.rarity || "Common",
    setId,
    pulledAt: now,
    pricing: details[i]?.pricing,
  }));
  // Sort by rarity (commons first, rares last)
  cards.sort((a, b) => rarityWeight(a.rarity) - rarityWeight(b.rarity));

  await preloadCards(cards);

  const isNew = cards.map((c) => !existing.includes(c.id));

  for (const c of cards) {
    await addToCollection(setId, c.id);
    await savePulledCard(c);
  }

  return { cards, isNew };
}

export function getSetLogo(setId: string): string {
  return `https://assets.tcgdex.net/en/${setId}/logo.png`;
}

const FAB_ID = "ft-pack-fab-host";

let fabInjected = false;

export async function initPackOpening(): Promise<void> {
  if (fabInjected) return;
  fabInjected = true;

  const host = document.createElement("div");
  host.id = FAB_ID;
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  const style = document.createElement("style");
  style.textContent = `
    .fab {
      position: fixed;
      bottom: 24px;
      right: 88px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #89b4fa, #74c7ec);
      border: none;
      color: #1e1e2e;
      font-size: 1.6rem;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(137, 180, 250, 0.4);
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(137, 180, 250, 0.6);
    }
    .fab:active {
      transform: scale(0.95);
    }
  `;
  shadow.appendChild(style);

  const btn = document.createElement("button");
  btn.className = "fab";
  btn.textContent = "⚡";
  btn.title = "Open Pokémon Pack";
  btn.addEventListener("click", () => showPackOverlay());
  shadow.appendChild(btn);
}
