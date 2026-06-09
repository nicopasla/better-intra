export interface TcgSet {
  id: string;
  name: string;
  logo?: string;
  cardCount: { total: number; official: number };
  releaseDate?: string;
}

export interface TcgCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  rarity?: string;
}

export interface PulledCard {
  id: string;
  localId: string;
  name: string;
  image: string;
  rarity: string;
  setId: string;
  pulledAt: number;
  pricing?: CardPricing;
}

export interface CardPricing {
  cardmarket?: {
    unit: string;
    avg?: number;
    low?: number;
    trend?: number;
  };
  tcgplayer?: {
    unit: string;
    holofoil?: {
      marketPrice?: number;
      midPrice?: number;
      lowPrice?: number;
    };
  };
}

export interface PackCollection {
  [setId: string]: string[];
}

export const COLLECTION_KEY = "PACK_COLLECTION";
export const PULLED_CARDS_KEY = "PULLED_CARDS";

export function buildPack(cards: TcgCard[]): TcgCard[] {
  // The set endpoint returns cards without "rarity" field,
  // so we use card number position as a rarity proxy.
  // TCG sets follow: low numbers = common, high numbers = secret/ultra rare.
  const sorted = [...cards].sort((a, b) => {
    const na = parseInt(a.localId, 10);
    const nb = parseInt(b.localId, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localId.localeCompare(b.localId);
  });

  const total = sorted.length;

  const pool = (startPct: number, endPct: number): TcgCard[] =>
    sorted.slice(Math.floor(total * startPct), Math.floor(total * endPct));

  const pick = (from: TcgCard[]): TcgCard | null => {
    const avail = from.filter((c) => !used.has(c.id));
    if (avail.length === 0) return null;
    return avail[Math.floor(Math.random() * avail.length)];
  };

  const commonPool = pool(0, 0.35);
  const uncommonPool = pool(0.35, 0.55);
  const reversePool = pool(0.55, 0.75);
  const hitPool = pool(0.75, 0.9);
  const rarePool = pool(0.9, 1);

  const pack: TcgCard[] = [];
  const used = new Set<string>();

  const add = (c: TcgCard | null) => {
    if (!c) return;
    if (used.has(c.id)) return;
    used.add(c.id);
    pack.push(c);
  };

  // Real pack: 4 Common, 3 Uncommon, 1 Reverse Holo, 1 Hit, 1 Rare+ (last)
  for (let i = 0; i < 4; i++) add(pick(commonPool));
  for (let i = 0; i < 3; i++) add(pick(uncommonPool));
  add(pick(reversePool));
  add(pick(hitPool));
  add(pick(rarePool));

  while (pack.length < 10) {
    const c = sorted.find((x) => !used.has(x.id));
    if (!c) break;
    used.add(c.id);
    pack.push(c);
  }

  return pack.slice(0, 10);
}

export function rarityColor(rarity: string): string {
  const map: Record<string, string> = {
    Common: "#6b7280",
    Commune: "#6b7280",
    Uncommon: "#16a34a",
    "Peu Commune": "#16a34a",
    Rare: "#2563eb",
    "Rare Holo": "#9333ea",
    "Double rare": "#9333ea",
    "Rare Ultra": "#ca8a04",
    "Ultra Rare": "#ca8a04",
    "Rare Secret": "#dc2626",
    "Rare secrète": "#dc2626",
    "Illustration rare": "#f59e0b",
    "Illustration rare spéciale": "#dc2626",
  };
  return map[rarity] || "#6b7280";
}

export function rarityWeight(rarity: string): number {
  const tiers: Record<string, number> = {
    Common: 0,
    Commune: 0,
    Uncommon: 1,
    "Peu Commune": 1,
    Rare: 2,
    "Rare Holo": 3,
    "Double rare": 3,
    "Rare Ultra": 4,
    "Ultra Rare": 4,
    "Rare Secret": 5,
    "Rare secrète": 5,
    "Illustration rare": 6,
    "Illustration rare spéciale": 7,
  };
  return tiers[rarity] ?? 2;
}

export async function getCollection(): Promise<PackCollection> {
  const res = await chrome.storage.local.get(COLLECTION_KEY);
  return (res[COLLECTION_KEY] as PackCollection) || {};
}

export async function saveCollection(col: PackCollection): Promise<void> {
  await chrome.storage.local.set({ [COLLECTION_KEY]: col });
}

export async function addToCollection(setId: string, cardId: string): Promise<void> {
  const col = await getCollection();
  if (!col[setId]) col[setId] = [];
  if (!col[setId].includes(cardId)) col[setId].push(cardId);
  await saveCollection(col);
}

export async function getPulledCards(): Promise<PulledCard[]> {
  const res = await chrome.storage.local.get(PULLED_CARDS_KEY);
  return (res[PULLED_CARDS_KEY] as PulledCard[]) || [];
}

export async function savePulledCard(card: PulledCard): Promise<void> {
  const cards = await getPulledCards();
  if (!cards.some((c) => c.id === card.id && c.pulledAt === card.pulledAt)) {
    cards.push(card);
    await chrome.storage.local.set({ [PULLED_CARDS_KEY]: cards });
  }
}

export async function getRareCards(): Promise<PulledCard[]> {
  const cards = await getPulledCards();
  return cards.filter((c) => rarityWeight(c.rarity) >= 2);
}

export async function exportBackup(): Promise<void> {
  const res = await chrome.storage.local.get([COLLECTION_KEY, PULLED_CARDS_KEY]);
  const data = JSON.stringify(res, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `better-intra-packs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<number> {
  const text = await file.text();
  const data = JSON.parse(text) as Record<string, unknown>;
  const col = data[COLLECTION_KEY];
  const cards = data[PULLED_CARDS_KEY];
  if (!col || !cards) throw new Error("Invalid backup file");
  const cardCount = Array.isArray(cards) ? cards.length : 0;
  await chrome.storage.local.set({ [COLLECTION_KEY]: col, [PULLED_CARDS_KEY]: cards });
  return cardCount;
}
