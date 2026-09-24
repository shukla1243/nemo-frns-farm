import {
  HOMES, ITEM_IDS, NEEDS, PROSPERITY, RIVAL_NAMES, START, START_PLOTS, TRAP_DEFENSE, ZONE_ORDER,
  traitFor, xpToNext, MAX_LEVEL, titleFor, RIVAL_RAID_INTERVAL, EVENT_INTERVAL, MARKET_TIDE_MS, BOSS, ITEMS, SINK, SEASON, REBIRTH, seasonIdAt,
  type Cost, type ItemId, type TraitId, type ZoneId,
} from "./config";
import { createRng, type Rng } from "./rng";
import type { GameEvent, GameState, Rival, Stats, Tone } from "./types";
import { newQuest } from "./quests";
import { createPool } from "./amm";
import { STOCK_IDS, type StockId } from "./voyages";

export const emptyStocks = () => Object.fromEntries(STOCK_IDS.map(id => [id, 0])) as Record<StockId, number>;

export const emptyStats = (): Stats => ({
  burned: 0, rfWon: 0, rfLost: 0, shellEarned: 0, shellSpent: 0,
  fish: 0, harvests: 0, gathered: 0, dives: 0, bestDive: 0,
  minesCashouts: 0, bestMinesTiles: 0, raidsWon: 0, raidsLost: 0, defended: 0, raidedBy: 0,
  bossDamage: 0, bossKills: 0, ascends: 0, ascendFails: 0, forges: 0, forgeFails: 0,
  spins: 0, jackpots: 0, swaps: 0, voyages: 0, voyageWins: 0, creatorFees: 0, toPool: 0, trueBurn: 0, seasonWins: 0, seasonRf: 0, flipsWon: 0, flipsLost: 0, cooked: 0, goldnemo: 0,
});

function createRivals(rng: Rng, now: number): Rival[] {
  return RIVAL_NAMES.map((r, i) => {
    const level = 1 + i + rng.int(0, 2);
    return {
      id: `bot-${i}`, name: r.name, color: r.color, level,
      power: 10 + level * 5 + rng.int(0, 10), defense: 5 + level * 4 + rng.int(0, 15),
      vault: 60 + level * 40 + rng.int(0, 80), burned: level * 60 + rng.int(0, 200), bot: true, lastRaidedAt: 0,
    };
  });
}

export function createState(opts: { friendId: string; name: string; family: number; guest: boolean; now: number; seed: number }): GameState {
  const rng = createRng(opts.seed);
  const inv = Object.fromEntries(ITEM_IDS.map(id => [id, 0])) as Record<ItemId, number>;
  for (const [id, n] of Object.entries(START.items)) inv[id as ItemId] = n!;
  const zones = Object.fromEntries(ZONE_ORDER.map(z => [z, z === "beach" || z === "grove"])) as Record<ZoneId, boolean>;
  const state: GameState = {
    v: 1, friendId: opts.friendId, name: opts.name, family: opts.family, trait: traitFor(opts.family), guest: opts.guest,
    createdAt: opts.now, lastTick: opts.now, lastActive: opts.now, seed: 0,
    rf: START.rf, shell: START.shell, inv,
    hunger: 80, energy: 100, mood: 70,
    level: 1, xp: 0, ascendPity: 0,
    gear: { rod: 0, pick: 0, blade: 0 }, forgePity: { rod: 0, pick: 0, blade: 0 },
    home: 0,
    plots: Array.from({ length: START_PLOTS }, () => ({ crop: null, plantedAt: 0, readyAt: 0, withered: false })),
    zones,
    sleeping: null, buffs: {}, cooldowns: {}, run: null, lastWin: null,
    quests: [], questSeq: 0, achievements: [],
    rivals: createRivals(rng, opts.now),
    nextRivalRaidAt: opts.now + RIVAL_RAID_INTERVAL[1], shieldUntil: 0, revenge: null,
    event: null, nextEventAt: opts.now + EVENT_INTERVAL[0],
    marketTide: 1, nextTideAt: opts.now + MARKET_TIDE_MS,
    wheelFreeAt: opts.now,
    boss: { epoch: Math.floor(opts.now / BOSS.periodMs), damage: 0, claimed: false },
    pool: createPool(opts.now), world: { burned: 0, creatorFees: 0, volumeRf: 0, seasonPool: 0 },
    season: { id: seasonIdAt(opts.now), xp: 0, sunk: 0 }, lastSeason: null,
    story: 0, npcGifts: {}, rebirths: 0, milestones: {}, streak: { day: 0, count: 0 }, voyage: null, stocks: emptyStocks(), relics: 0, stats: emptyStats(), log: [],
  };
  state.seed = rng.state();
  for (let i = 0; i < 3; i++) state.quests.push(newQuest(state, rng));
  state.seed = rng.state();
  return state;
}

// ---------- Derived stats ----------
export const hasTrait = (s: GameState, t: TraitId) => s.trait === t;
export const maxEnergy = (s: GameState) => NEEDS.baseMaxEnergy + (s.level - 1) * NEEDS.maxEnergyPerLevel;
const buffActive = (s: GameState, id: string, now: number) => (s.buffs[id] ?? 0) > now;
const isHungry = (s: GameState) => s.hunger < NEEDS.hungryAt;
const isHappy = (s: GameState) => s.mood >= NEEDS.happyAt;
const isGrumpy = (s: GameState) => s.mood < NEEDS.grumpyAt;
/** Luck in [-0.1, 0.15]: shifts rarity rolls. */
export const luck = (s: GameState, now: number) => (isHappy(s) ? 0.05 : 0) - (isGrumpy(s) ? 0.1 : 0) + (buffActive(s, "wellfed", now) ? 0.05 : 0) + (hasTrait(s, "shiny") ? 0.05 : 0);
export const power = (s: GameState) => Math.round((10 + s.level * 5 + s.gear.blade * 6) * (hasTrait(s, "titan") ? 1.25 : 1) * (isHappy(s) ? 1.05 : 1) * (isGrumpy(s) ? 0.9 : 1));
export const defense = (s: GameState) => HOMES[s.home].defense + s.inv.trap * TRAP_DEFENSE + s.level * 3;
export const prosperityPct = (s: GameState) => Math.min(PROSPERITY.cap, Math.floor(s.stats.burned / PROSPERITY.rfPerPercent));
/** Multiplier on gathered/harvested quantities. */
export function yieldMult(s: GameState, now: number) {
  let m = 1;
  if (isHungry(s)) m -= NEEDS.hungryYieldPenalty;
  if (buffActive(s, "wellfed", now)) m += 0.15;
  if (buffActive(s, "rested", now)) m += 0.1;
  return m;
}
/** Multiplier on SHELL earned from selling and quests: burn-to-earn prosperity. */
export const shellMult = (s: GameState) => (1 + prosperityPct(s) / 100) * (1 + s.rebirths * REBIRTH.shellBonus);
export const netWorth = (s: GameState) => s.shell + s.rf * 1.5 + Object.entries(s.inv).reduce((sum, [id, n]) => sum + (ITEMS[id as ItemId].sell ?? 0) * n, 0);
export const title = (s: GameState) => titleFor(s.level);

// ---------- Mutating helpers (operate on a draft) ----------
export function log(s: GameState, events: GameEvent[], text: string, tone: Tone, extra: Partial<GameEvent> = {}, now = s.lastTick) {
  events.push({ tone, text, ...extra });
  s.log.unshift({ t: now, text, tone });
  if (s.log.length > 100) s.log.length = 100;
}

export function discounted(s: GameState, cost: Cost, kind: "build" | "other" = "other"): Cost {
  if (kind === "build" && hasTrait(s, "homebody") && cost.shell) return { ...cost, shell: Math.round(cost.shell * 0.9) };
  return cost;
}

export function missing(s: GameState, cost: Cost): string | null {
  if (cost.rf && s.rf < cost.rf) return `Need ${(cost.rf / 100).toFixed(2)} RF`;
  if (cost.shell && s.shell < cost.shell) return `Need ${cost.shell} SHELL`;
  for (const [id, n] of Object.entries(cost.items ?? {})) {
    if (n && s.inv[id as ItemId] < n) return `Need ${n} ${ITEMS[id as ItemId].name}`;
  }
  return null;
}

/**
 * RF sink: 70% Season Prize Pool, 25% creator treasury, 5% burned forever.
 * The caller has already removed the RF from the player's balance.
 */
export function sink(s: GameState, amount: number) {
  if (amount <= 0) return;
  const pool = Math.floor(amount * SINK.pool), burn = Math.floor(amount * SINK.burn), creator = amount - pool - burn;
  s.stats.burned += amount; s.stats.toPool += pool; s.stats.creatorFees += creator; s.stats.trueBurn += burn;
  s.world.seasonPool += pool; s.world.creatorFees += creator; s.world.burned += burn;
  s.season.sunk += amount;
}
export const seasonScore = (s: GameState) => s.season.xp + Math.floor(s.season.sunk / 100 * SEASON.rfScore);

/** Pay a cost. RF paid goes through the sink split. */
export function pay(s: GameState, cost: Cost) {
  if (cost.rf) { s.rf -= cost.rf; sink(s, cost.rf); }
  if (cost.shell) { s.shell -= cost.shell; s.stats.shellSpent += cost.shell; }
  for (const [id, n] of Object.entries(cost.items ?? {})) if (n) s.inv[id as ItemId] -= n;
}

export function giveShell(s: GameState, amount: number) {
  const n = Math.max(0, Math.floor(amount));
  s.shell += n; s.stats.shellEarned += n;
  return n;
}
export function giveRf(s: GameState, amount: number) {
  const n = Math.max(0, Math.floor(amount));
  s.rf += n; s.stats.rfWon += n;
  return n;
}
/** RF lost in a risk game flows through the sink split (70% returns to players via seasons). */
export function loseRf(s: GameState, amount: number) {
  s.rf -= amount; s.stats.rfLost += amount; sink(s, amount);
}
/** An RF stake already removed from the balance was lost. */
export function forfeitRf(s: GameState, amount: number) {
  s.stats.rfLost += amount; sink(s, amount);
}

export function addXp(s: GameState, events: GameEvent[], amount: number) {
  const gain = Math.round(amount * (isHappy(s) ? 1.1 : 1) * (1 + s.rebirths * REBIRTH.xpBonus + s.relics * 0.02));
  s.season.xp += gain;
  if (s.level >= MAX_LEVEL) return;
  const cap = xpToNext(s.level);
  const before = s.xp;
  s.xp = Math.min(cap, s.xp + gain);
  if (before < cap && s.xp >= cap) log(s, events, "XP full! Visit the Coral Shrine to Ascend.", "epic", { cue: "action-ready" });
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clampNeeds = (s: GameState) => {
  s.hunger = clamp(s.hunger, 0, 100);
  s.mood = clamp(s.mood, 0, 100);
  s.energy = clamp(s.energy, 0, maxEnergy(s));
};

/**
 * Best food to eat right now. For hunger: the smallest item that fills the gap (so feasts aren't wasted),
 * otherwise the biggest one available. For mood: the item with the most mood.
 */
export function bestFood(s: GameState, need: "hunger" | "mood"): ItemId | null {
  const foods = (Object.keys(ITEMS) as ItemId[]).filter(id => ITEMS[id].food && s.inv[id] > 0);
  if (!foods.length) return null;
  if (need === "mood") return foods.reduce((a, b) => (ITEMS[b].food!.mood > ITEMS[a].food!.mood ? b : a));
  const gap = 100 - s.hunger;
  const filling = foods.filter(id => ITEMS[id].food!.hunger >= gap).sort((a, b) => ITEMS[a].food!.hunger - ITEMS[b].food!.hunger);
  return filling[0] ?? foods.reduce((a, b) => (ITEMS[b].food!.hunger > ITEMS[a].food!.hunger ? b : a));
}
