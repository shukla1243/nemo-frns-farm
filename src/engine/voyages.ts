/**
 * Voyages: timed expeditions. Your Friend leaves the island for minutes or hours and comes back with
 * treasure, simulated island company shares, a family relic, or nothing at all. Odds are shown up front
 * and the outcome is rolled at departure, so reloading can't change it.
 *
 * Island company shares are SIMULATED game collectibles from fictional NEMO sea companies.
 * They are not securities, carry no real value, and their prices come from a deterministic formula.
 */
import type { ItemId } from "./config";
import { createRng, hashSeed, weighted, type Rng } from "./rng";
import { chapterAt } from "./story";
import type { GameState } from "./types";

/** Voyages open once this story chapter starts, right after "A Roof Over Fins" gives the Friend a home to come back to. */
export const VOYAGE_CHAPTER = 5;
export const voyagesOpen = (s: GameState) => s.story >= VOYAGE_CHAPTER || s.rebirths > 0;
export const voyageGateText = () => `The Voyage Pier opens after the chapter "${chapterAt(VOYAGE_CHAPTER - 1).title}".`;

export type StockId = "FINX" | "URCH" | "CLAM" | "KRLL" | "KELP" | "GULL" | "DUBL";
export const STOCKS: Record<StockId, { name: string; base: number; swing: number; period: number }> = {
  FINX: { name: "Finlight Lanterns", base: 900, swing: 0.28, period: 31 },
  URCH: { name: "Urchin Motorworks", base: 520, swing: 0.34, period: 23 },
  CLAM: { name: "Clamshell Devices", base: 480, swing: 0.14, period: 41 },
  KRLL: { name: "Krill Freight Co.", base: 460, swing: 0.18, period: 37 },
  KELP: { name: "Kelpsoft Systems", base: 700, swing: 0.12, period: 47 },
  GULL: { name: "Gullwing Traders", base: 260, swing: 0.4, period: 19 },
  DUBL: { name: "Doubloon Bay Mint", base: 380, swing: 0.36, period: 29 },
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
type Outcome = { id: string; label: string; weight: number; shell?: [number, number]; items?: Partial<Record<ItemId, number>>; stock?: [number, number]; relic?: boolean; lost?: boolean };
export type Voyage = { id: VoyageId; name: string; blurb: string; minutes: number; costShell: number; food: number; minLevel: number; outcomes: Outcome[] };

const FAMILY_ISLES = ["Skeleton Isle", "Mask Atoll", "Family Cay", "Cellular Reef", "Asymmetry Rock", "Hoverer Heights", "Colossus Crag", "Sparkling Sands", "Hollow Deep"];
export const homeIsle = (family: number) => FAMILY_ISLES[((family % 9) + 9) % 9];

export const VOYAGES: Voyage[] = [
  {
    id: "scout", name: "Tide Scout", blurb: "A quick paddle around the reef. Safe and small.", minutes: 15, costShell: 30, food: 1, minLevel: 1,
    outcomes: [
      { id: "haul", label: "Driftwood and stone", weight: 50, items: { wood: 12, stone: 8 } },
      { id: "shells", label: "A pouch of SHELL", weight: 30, shell: [60, 140] },
      { id: "coral", label: "Coral and sea glass", weight: 10, items: { coral: 4, glass: 2 } },
      { id: "empty", label: "Came back empty-handed", weight: 10 },
    ],
  },
  {
    id: "homeland", name: "Homeland Voyage", blurb: "Sail to your Friend's family island and search the ruins for relics.", minutes: 60, costShell: 195, food: 2, minLevel: 3,
    outcomes: [
      { id: "pearls", label: "Pearls from the old shrine", weight: 30, items: { pearl: 3, coral: 6 } },
      { id: "scrolls", label: "Ancient Luck Scrolls", weight: 15, items: { blessing: 2 } },
      { id: "relic", label: "A Family Relic (+2% XP forever)", weight: 10, relic: true },
      { id: "cache", label: "A buried SHELL cache", weight: 5, shell: [225, 600] },
      { id: "storm", label: "Turned back by a storm", weight: 40 },
    ],
  },
  {
    id: "reef", name: "Shipwreck Salvage Run", blurb: "Dive the merchant wrecks off Barnacle Shoals for island company shares. Low odds, big upside.", minutes: 360, costShell: 600, food: 3, minLevel: 6,
    outcomes: [
      { id: "shares", label: "Island company shares", weight: 22, stock: [0.1, 0.6] },
      { id: "bag", label: "A bag of island company shares", weight: 6, stock: [0.8, 2] },
      { id: "fullshare", label: "A full FINX share!", weight: 2, stock: [1, 1] },
      { id: "salvage", label: "Salvage: ore and glass", weight: 15, items: { ore: 12, glass: 6 } },
      { id: "wreck", label: "Only broken hulls. Nothing found", weight: 55 },
    ],
  },
  {
    id: "trench", name: "Abyssal Trench", blurb: "Twelve hours in the deepest dark. Most never find anything. Some come back rich.", minutes: 720, costShell: 1100, food: 4, minLevel: 12,
    outcomes: [
      { id: "hoard", label: "The Trench hoard", weight: 14, shell: [1200, 3600], items: { pearl: 6 } },
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
  const isBust = (o: Outcome) => !o.shell && !o.items && !o.stock && !o.relic;
  const bust = v.outcomes.filter(isBust).reduce((n, o) => n + o.weight, 0);
  const good = total - bust;
  const shift = Math.min(bust * 0.8, total * bonus);
  return v.outcomes.map(o => ({ ...o, weight: isBust(o) ? o.weight - shift * (o.weight / bust) : o.weight + shift * (o.weight / good) }));
}

export type VoyageResult = { outcome: string; label: string; shell: number; items: Partial<Record<ItemId, number>>; stock: { id: StockId; shares: number } | null; relic: boolean; lost: boolean };

export function rollVoyage(s: GameState, v: Voyage, rng: Rng): VoyageResult {
  const o = weighted(rng, voyageOdds(s, v));
  const span = (r?: [number, number]) => (r ? Math.round(r[0] + rng.next() * (r[1] - r[0])) : 0);
  let stock: VoyageResult["stock"] = null;
  if (o.stock) {
    const id: StockId = o.id === "fullshare" ? "FINX" : weighted(rng, STOCK_IDS.map(k => ({ k, weight: k === "FINX" || k === "GULL" ? 3 : 2 }))).k;
    stock = { id, shares: Math.round((o.stock[0] + rng.next() * (o.stock[1] - o.stock[0])) * 1000) / 1000 };
  }
  return { outcome: o.id, label: o.label, shell: span(o.shell), items: o.items ?? {}, stock, relic: !!o.relic, lost: !!o.lost };
}

