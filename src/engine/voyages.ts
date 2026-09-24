/**
 * Voyages: timed expeditions. Your Friend leaves the island for minutes or hours and comes back with
 * treasure, simulated stock-token shares, a family relic, or nothing at all. Odds are shown up front
 * and the outcome is rolled at departure, so reloading can't change it.
 *
 * Stock tokens are SIMULATED game collectibles themed on tokenized stocks trending on Robinhood Chain.
 * They are not securities, carry no real value, and their prices come from a deterministic formula.
 */
import type { ItemId } from "./config";
import { createRng, hashSeed, weighted, type Rng } from "./rng";
import type { GameState } from "./types";

export type StockId = "NVDA" | "TSLA" | "AAPL" | "AMZN" | "MSFT" | "HOOD" | "COIN";
export const STOCKS: Record<StockId, { name: string; base: number; swing: number; period: number }> = {
  NVDA: { name: "Nvidia", base: 900, swing: 0.28, period: 31 },
  TSLA: { name: "Tesla", base: 520, swing: 0.34, period: 23 },
  AAPL: { name: "Apple", base: 480, swing: 0.14, period: 41 },
  AMZN: { name: "Amazon", base: 460, swing: 0.18, period: 37 },
  MSFT: { name: "Microsoft", base: 700, swing: 0.12, period: 47 },
  HOOD: { name: "Robinhood", base: 260, swing: 0.4, period: 19 },
  COIN: { name: "Coinbase", base: 380, swing: 0.36, period: 29 },
};
export const STOCK_IDS = Object.keys(STOCKS) as StockId[];

/** Simulated price in SHELL per share. Identical for every player at the same hour. */
export function stockPrice(id: StockId, now: number) {
  const st = STOCKS[id];
  const hour = Math.floor(now / 3_600_000);
  const wave = Math.sin((hour / st.period) * Math.PI * 2 + id.length);
  const noise = createRng(hashSeed(`${id}:${hour}`)).next() - 0.5;
  return Math.max(1, Math.round(st.base * (1 + st.swing * wave + st.swing * 0.4 * noise)));
}
export const STOCK_SELL_FEE = 0.02;

export type VoyageId = "scout" | "homeland" | "reef" | "trench";
type Outcome = { id: string; label: string; weight: number; shell?: [number, number]; rf?: [number, number]; items?: Partial<Record<ItemId, number>>; stock?: [number, number]; relic?: boolean; lost?: boolean };
export type Voyage = { id: VoyageId; name: string; blurb: string; minutes: number; costRf: number; costShell: number; food: number; minLevel: number; outcomes: Outcome[] };

const FAMILY_ISLES = ["Skeleton Isle", "Mask Atoll", "Family Cay", "Cellular Reef", "Asymmetry Rock", "Hoverer Heights", "Colossus Crag", "Sparkling Sands", "Hollow Deep"];
export const homeIsle = (family: number) => FAMILY_ISLES[((family % 9) + 9) % 9];

export const VOYAGES: Voyage[] = [
  {
    id: "scout", name: "Tide Scout", blurb: "A quick paddle around the reef. Safe and small.", minutes: 15, costRf: 0, costShell: 30, food: 1, minLevel: 1,
    outcomes: [
      { id: "haul", label: "Driftwood and stone", weight: 50, items: { wood: 12, stone: 8 } },
      { id: "shells", label: "A pouch of SHELL", weight: 30, shell: [60, 140] },
      { id: "coral", label: "Coral and sea glass", weight: 10, items: { coral: 4, glass: 2 } },
      { id: "empty", label: "Came back empty-handed", weight: 10 },
    ],
  },
  {
    id: "homeland", name: "Homeland Voyage", blurb: "Sail to your Friend's family island and search the ruins for relics.", minutes: 60, costRf: 50, costShell: 120, food: 2, minLevel: 3,
    outcomes: [
      { id: "pearls", label: "Pearls from the old shrine", weight: 30, items: { pearl: 3, coral: 6 } },
      { id: "scrolls", label: "Ancient Luck Scrolls", weight: 15, items: { blessing: 2 } },
      { id: "relic", label: "A Family Relic (+2% XP forever)", weight: 10, relic: true },
      { id: "rf", label: "A buried RF cache", weight: 5, rf: [150, 400] },
      { id: "storm", label: "Turned back by a storm", weight: 40 },
    ],
  },
  {
    id: "reef", name: "Robinhood Reef Run", blurb: "Dive the trading wrecks off Robinhood Reef for stock-token shares. Low odds, big upside.", minutes: 360, costRf: 200, costShell: 300, food: 3, minLevel: 6,
    outcomes: [
      { id: "shares", label: "Stock-token shares", weight: 22, stock: [0.1, 0.6] },
      { id: "bag", label: "A bag of stock-token shares", weight: 6, stock: [0.8, 2] },
      { id: "nvda", label: "A full NVDA share!", weight: 2, stock: [1, 1] },
      { id: "salvage", label: "Salvage: ore and glass", weight: 15, items: { ore: 12, glass: 6 } },
      { id: "wreck", label: "Only broken hulls. Nothing found", weight: 55 },
    ],
  },
  {
    id: "trench", name: "Abyssal Trench", blurb: "Twelve hours in the deepest dark. Most never find anything. Some come back rich.", minutes: 720, costRf: 400, costShell: 500, food: 4, minLevel: 12,
    outcomes: [
      { id: "hoard", label: "The Trench hoard (RF)", weight: 14, rf: [800, 2400], items: { pearl: 6 } },
      { id: "relic", label: "A Family Relic and pearls", weight: 4, relic: true, items: { pearl: 4 } },
      { id: "dark", label: "Lost in the dark. Nothing found", weight: 74 },
      { id: "lost", label: "Lost at sea: came back battered and robbed", weight: 8, lost: true },
    ],
  },
];

const FOOD_ORDER: ItemId[] = ["bread", "sardine", "kelp", "carrot", "coconut", "clownfish", "berry", "tuna", "sushi", "pumpkin", "angler", "stew", "pie"];
export const foodCount = (s: GameState) => FOOD_ORDER.reduce((n, id) => n + s.inv[id], 0);

/** Success bonus (percentage points added to good outcomes' share): level, gear, rebirths, mood. */
export function voyageBonus(s: GameState) {
  return Math.min(10, s.level * 0.2 + (s.gear.rod + s.gear.blade) * 0.5 + s.rebirths * 2 + (s.mood >= 75 ? 3 : 0));
}

/** Outcome table after the bonus: good outcomes grow, the "nothing" outcome shrinks. */
export function voyageOdds(s: GameState, v: Voyage) {
  const bonus = voyageBonus(s) / 100;
  const total = v.outcomes.reduce((n, o) => n + o.weight, 0);
  const isBust = (o: Outcome) => !o.shell && !o.rf && !o.items && !o.stock && !o.relic;
  const bust = v.outcomes.filter(isBust).reduce((n, o) => n + o.weight, 0);
  const good = total - bust;
  const shift = Math.min(bust * 0.8, total * bonus);
  return v.outcomes.map(o => ({ ...o, weight: isBust(o) ? o.weight - shift * (o.weight / bust) : o.weight + shift * (o.weight / good) }));
}

export type VoyageResult = { outcome: string; label: string; shell: number; rf: number; items: Partial<Record<ItemId, number>>; stock: { id: StockId; shares: number } | null; relic: boolean; lost: boolean };

export function rollVoyage(s: GameState, v: Voyage, rng: Rng): VoyageResult {
  const o = weighted(rng, voyageOdds(s, v));
  const span = (r?: [number, number]) => (r ? Math.round(r[0] + rng.next() * (r[1] - r[0])) : 0);
  let stock: VoyageResult["stock"] = null;
  if (o.stock) {
    const id: StockId = o.id === "nvda" ? "NVDA" : weighted(rng, STOCK_IDS.map(k => ({ k, weight: k === "NVDA" || k === "HOOD" ? 3 : 2 }))).k;
    stock = { id, shares: Math.round((o.stock[0] + rng.next() * (o.stock[1] - o.stock[0])) * 1000) / 1000 };
  }
  return { outcome: o.id, label: o.label, shell: span(o.shell), rf: span(o.rf), items: o.items ?? {}, stock, relic: !!o.relic, lost: !!o.lost };
}

