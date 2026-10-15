import {
  ASCEND, BOSS, CRAB, CROPS, DIVE, ENERGY_DRINK, FISH_ENERGY, FISH_FIRST_CATCH_ZONE, FISH_TABLE, FISH_ZONE_BASE, FISH_ZONE_PER_ROD, FLIP, FORGE_CHANCE,
  FORGE_PITY_STEP, GATHER, GEAR, GOLDEN_CROP_CHANCE, HOMES, ITEMS, MAX_GEAR, MAX_LEVEL, MAX_PLOTS, MINES, RAID, RECIPES,
  SHOP, WELL_FED_MS, WHEEL, WHEEL_FREE_MS, ZONES, ascendCost, diveMultiplierAt, forgeCost, plotCost,
  titleFor, xpToNext, type CropId, type GearId, type ItemId, type MealId, type ZoneId,
} from "./config";
import { createRng, hashSeed, weighted, type Rng } from "./rng";
import {
  addXp, clamp, clampNeeds, discounted, giveShell, hasTrait, log, luck, maxEnergy, missing, pay,
  power, shellMult, yieldMult,
} from "./state";
import { bossStatus, cropReady, eventActive, growMs, startSleep, tick, wakeUp } from "./systems";
import { NPC_GIFTS, REBIRTH, dayNumber, rebirthCost } from "./config";
import { chapterAt } from "./story";
import { checkMilestones } from "./milestones";
import { claimPass, passClaimable } from "./pass";
import { STOCKS, STOCK_SELL_FEE, VOYAGES, VOYAGE_CHAPTER, foodCount, homeIsle, rollVoyage, stockPrice, voyageGateText, voyagesOpen, type StockId, type VoyageId } from "./voyages";
import { checkAchievements, newQuest, progress } from "./quests";
import type { GameEvent, GameState, Rival } from "./types";

export type Action =
  | { type: "tick" }
  | { type: "eat"; item: ItemId }
  | { type: "drink" }
  | { type: "sleep" } | { type: "wake" }
  | { type: "buildHome" }
  | { type: "buy"; item: ItemId; qty?: number }
  | { type: "sell"; item: ItemId; qty?: number }
  | { type: "plant"; plot: number; crop: CropId }
  | { type: "harvest"; plot: number }
  | { type: "clearPlot"; plot: number }
  | { type: "buyPlot" }
  | { type: "gather"; kind: "chop" | "quarry" }
  | { type: "cook"; meal: MealId }
  | { type: "unlockZone"; zone: ZoneId }
  | { type: "ascend"; blessing?: boolean; charm?: boolean }
  | { type: "forge"; gear: GearId; blessing?: boolean; charm?: boolean }
  | { type: "diveStart"; stake: number }
  | { type: "diveCashout" }
  | { type: "diveCrash" }
  | { type: "minesStart"; stake: number; traps: number }
  | { type: "minesReveal"; index: number }
  | { type: "minesCashout" }
  | { type: "fishCast" }
  | { type: "fishReel"; hit: boolean }
  | { type: "crabStart" }
  | { type: "crabFinish"; score: number }
  | { type: "crabQuit" }
  | { type: "flip" } | { type: "keepWin" }
  | { type: "raid"; rivalId: string }
  | { type: "bossAttack" }
  | { type: "bossClaim" }
  | { type: "spin"; free: true }
  | { type: "claimQuest"; id: number }
  | { type: "passClaim" }
  | { type: "forage" }
  | { type: "storyClaim" }
  | { type: "npcGift"; npc: string }
  | { type: "rebirth" }
  | { type: "voyageStart"; id: VoyageId }
  | { type: "voyageClaim" }
  | { type: "voyageRecall" }
  | { type: "sellStock"; id: StockId; shares: number };

export type Result = { state: GameState; events: GameEvent[]; ok: boolean; data?: Record<string, unknown> };

class Reject extends Error {}
const fail = (message: string): never => { throw new Reject(message); };

/** JSON deep copy: game state is plain JSON, and the Nakama runtime has no structuredClone. */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function dispatch(prev: GameState, action: Action, now: number): Result {
  const s: GameState = clone(prev);
  // Mix server time and the action into the seed, so the stored seed alone never predicts the next roll.
  s.seed = hashSeed(`${s.seed}:${now}:${action.type}`);
  const events: GameEvent[] = [];
  let data: Record<string, unknown> | undefined;
  tick(s, now, events);
  const rng = createRng(s.seed);
  try {
    data = apply(s, action, now, rng, events) ?? undefined;
  } catch (error) {
    if (error instanceof Reject) {
      // Discard partial mutations: re-derive the state from prev + time only.
      const base: GameState = clone(prev);
      tick(base, now, []);
      return { state: base, events: [...events, { tone: "bad", text: error.message, cue: "select" }], ok: false };
    }
    throw error;
  }
  s.seed = rng.state();
  if (action.type !== "tick") s.lastActive = now;
  clampNeeds(s);
  checkAchievements(s, events);
  checkMilestones(s, events, now);
  return { state: s, events, ok: true, data };
}

function requireAwake(s: GameState) { if (s.sleeping) fail("Your Friend is asleep. Wake them first."); }
function requireZone(s: GameState, zone: ZoneId) { if (!s.zones[zone]) fail(`${ZONES[zone].name} is locked. Expand your island first.`); }
function requireEnergy(s: GameState, n: number) {
  requireAwake(s);
  requirePresent(s);
  if (s.hunger <= 0) fail("Your Friend is starving! Eat something first.");
  if (s.energy < n) fail(`Too tired (need ${n} energy). Sleep or drink a Kelp Brew.`);
}
function requireNoRun(s: GameState) { if (s.run) fail("Finish your current game first."); }
function requirePresent(s: GameState) { if (s.voyage) fail("Your Friend is away on a voyage. Check the Voyage Pier."); }
function cooldown(s: GameState, key: string, ms: number, now: number) {
  if ((s.cooldowns[key] ?? 0) > now) fail("Not so fast!");
  s.cooldowns[key] = now + ms;
}
function stakeCheck(s: GameState, stake: number, minShell: number) {
  if (!Number.isFinite(stake) || stake <= 0 || Math.floor(stake) !== stake) fail("Invalid stake.");
  if (stake < minShell) fail(`Minimum stake is ${minShell} SHELL.`);
  if (s.shell < stake) fail("Not enough SHELL.");
}
function takeStake(s: GameState, stake: number) {
  s.shell -= stake; s.stats.shellSpent += stake;
}
function giveItems(s: GameState, items: Partial<Record<ItemId, number>>) {
  for (const [id, n] of Object.entries(items)) if (n) s.inv[id as ItemId] += n;
}
const itemsText = (items: Partial<Record<ItemId, number>>) => Object.entries(items).filter(([, n]) => n).map(([id, n]) => `${n} ${ITEMS[id as ItemId].name}`).join(", ");

export const diveEdge = (s: GameState) => Math.max(0.02, DIVE.edge - s.gear.blade * DIVE.edgePerBlade);
export const minesMultiplier = (traps: number, safe: number, edge = MINES.edge) => {
  let m = 1 - edge;
  for (let i = 0; i < safe; i++) m *= (MINES.size - i) / (MINES.size - traps - i);
  return Math.floor(m * 100) / 100;
};
const fishZone = (s: GameState, difficulty: number) => {
  const zone = clamp(FISH_ZONE_BASE + s.gear.rod * FISH_ZONE_PER_ROD + (hasTrait(s, "glider") ? 0.05 : 0) - difficulty * 0.3, 0.07, 0.6);
  return s.stats.fish === 0 ? Math.max(zone, FISH_FIRST_CATCH_ZONE) : zone;
};
export const ascendChance = (s: GameState, blessing: boolean) => Math.min(100, Math.max(ASCEND.floor, ASCEND.base - ASCEND.perLevel * s.level) + s.ascendPity * ASCEND.pityStep + (blessing ? ASCEND.blessing : 0) + (s.mood >= 75 ? ASCEND.happy : 0) + (hasTrait(s, "shiny") ? 4 : 0));
export const forgeChance = (s: GameState, gear: GearId, blessing: boolean) => Math.min(100, FORGE_CHANCE[s.gear[gear]] + s.forgePity[gear] * FORGE_PITY_STEP + (blessing ? 10 : 0) + (hasTrait(s, "shiny") ? 4 : 0));
export const raidChance = (s: GameState, target: Rival, now: number) => {
  const atk = power(s), def = target.defense;
  const revenge = s.revenge && s.revenge.rivalId === target.id && s.revenge.until > now ? RAID.revengeBonus : 0;
  return clamp(0.5 + 0.5 * (atk - def) / (atk + def) + (hasTrait(s, "trickster") ? 0.05 : 0) + revenge, 0.08, 0.92);
};
export const sellPrice = (s: GameState, item: ItemId, now: number) => Math.max(1, Math.floor((ITEMS[item].sell ?? 0) * s.marketTide * (eventActive(s, "boom", now) ? 1.5 : 1)));

function apply(s: GameState, a: Action, now: number, rng: Rng, events: GameEvent[]): Record<string, unknown> | void {
  switch (a.type) {
    case "tick": return;

    // ---------------- Needs ----------------
    case "forage": {
      // Safety net: a Friend with no food can always scrounge a little, so nobody gets stuck starving and broke.
      requireAwake(s); requirePresent(s);
      if (foodCount(s) > 0) fail("You still have food in your backpack. Eat that first.");
      cooldown(s, "forage", 60_000, now);
      s.inv.coconut += 2;
      log(s, events, "You found 2 coconuts under the palms. Eat up!", "good", { cue: "reward", icon: "coconut" }, now);
      return;
    }
    case "eat": {
      requireAwake(s);
      const food = ITEMS[a.item]?.food;
      if (!food) fail("That isn't edible.");
      if (s.inv[a.item] < 1) fail(`No ${ITEMS[a.item].name} left.`);
      if (s.hunger >= 99) fail("Your Friend is full!");
      s.inv[a.item]--;
      s.hunger += food!.hunger; s.mood += food!.mood; s.energy += food!.energy ?? 0;
      if (a.item === "feast") s.buffs.wellfed = now + WELL_FED_MS;
      log(s, events, `Ate ${ITEMS[a.item].name}: +${food!.hunger} hunger${food!.mood ? `, +${food!.mood} mood` : ""}${a.item === "feast" ? ". Well Fed: +15% yields for 5 min!" : ""}`, "good", { cue: "select", icon: a.item }, now);
      return;
    }
    case "drink": {
      requireAwake(s);
      if (s.inv.energyDrink < 1) fail("No Kelp Brew. Buy some at the market.");
      if (s.energy >= maxEnergy(s)) fail("Already full of energy.");
      s.inv.energyDrink--; s.energy += ENERGY_DRINK.energy; s.mood += ENERGY_DRINK.mood;
      log(s, events, `Kelp Brew! +${ENERGY_DRINK.energy} energy.`, "good", { cue: "select" }, now);
      return;
    }
    case "sleep": {
      requireAwake(s); requireNoRun(s); requirePresent(s);
      if (s.energy >= maxEnergy(s) - 1) fail("Not sleepy: energy is full.");
      startSleep(s, now);
      log(s, events, `Sleeping in your ${HOMES[s.home].name}…`, "info", { cue: "action-start" }, now);
      return;
    }
    case "wake": {
      if (!s.sleeping) fail("Already awake.");
      wakeUp(s, events, rng, now, false);
      return;
    }

    // ---------------- Home & island ----------------
    case "buildHome": {
      requireAwake(s);
      if (s.home >= HOMES.length - 1) fail("Your Sea Castle is already maxed.");
      const next = HOMES[s.home + 1];
      const cost = discounted(s, next.cost, "build");
      const need = missing(s, cost); if (need) fail(need);
      pay(s, cost);
      s.home++;
      addXp(s, events, 30 * s.home);
      log(s, events, `Built ${next.name}! ${next.perk}`, "epic", { cue: "reveal-rare", fx: "confetti" }, now);
      return;
    }
    case "unlockZone": {
      requireAwake(s);
      if (s.zones[a.zone]) fail("Already unlocked.");
      const cost = discounted(s, ZONES[a.zone].cost, "build");
      const need = missing(s, cost); if (need) fail(need);
      pay(s, cost);
      s.zones[a.zone] = true;
      addXp(s, events, 25);
      log(s, events, `The island grows! ${ZONES[a.zone].name} unlocked.`, "epic", { cue: "reveal-rare", fx: "confetti" }, now);
      return;
    }
    case "buyPlot": {
      requireAwake(s);
      if (s.plots.length >= MAX_PLOTS) fail("Your farm is at max size.");
      const cost = plotCost(s.plots.length);
      const need = missing(s, cost); if (need) fail(need);
      pay(s, cost);
      s.plots.push({ crop: null, plantedAt: 0, readyAt: 0, withered: false });
      log(s, events, `New farm plot #${s.plots.length}!`, "good", { cue: "purchase" }, now);
      return;
    }

    // ---------------- Farming ----------------
    case "plant": {
      requireAwake(s);
      const plot = s.plots[a.plot]; if (!plot) fail("No such plot.");
      if (plot!.crop) fail("Plot is occupied.");
      const def = CROPS[a.crop];
      if (s.inv[def.seed] < 1) fail(`No ${ITEMS[def.seed].name}. Buy some at the market.`);
      s.inv[def.seed]--;
      Object.assign(plot!, { crop: a.crop, plantedAt: now, readyAt: now + growMs(s, a.crop), withered: false });
      log(s, events, `Planted ${ITEMS[a.crop].name}.`, "info", { cue: "select" }, now);
      return;
    }
    case "harvest": {
      requireAwake(s);
      const plot = s.plots[a.plot]; if (!plot?.crop) fail("Nothing planted.");
      if (plot!.withered) fail("This crop withered. Clear the plot.");
      if (!cropReady(s, a.plot, now)) fail("Not ready yet.");
      const crop = plot!.crop!, def = CROPS[crop];
      const golden = rng.chance(GOLDEN_CROP_CHANCE * (hasTrait(s, "grower") ? 2 : 1));
      const qty = Math.max(1, Math.round(rng.int(def.yield[0], def.yield[1]) * yieldMult(s, now) * (golden ? 3 : 1)));
      s.inv[crop] += qty;
      Object.assign(plot!, { crop: null, plantedAt: 0, readyAt: 0, withered: false });
      s.stats.harvests++;
      addXp(s, events, def.xp);
      progress(s, events, "harvest");
      log(s, events, `${golden ? "GOLDEN HARVEST! " : ""}+${qty} ${ITEMS[crop].name}`, golden ? "epic" : "good", { cue: golden ? "reveal-rare" : "reward", fx: golden ? "confetti" : undefined, icon: crop }, now);
      return { qty, golden };
    }
    case "clearPlot": {
      const plot = s.plots[a.plot]; if (!plot?.crop) fail("Nothing to clear.");
      Object.assign(plot!, { crop: null, plantedAt: 0, readyAt: 0, withered: false });
      return;
    }

    // ---------------- Gathering ----------------
    case "gather": {
      const g = GATHER[a.kind];
      requireZone(s, g.zone); requireEnergy(s, g.energy);
      cooldown(s, a.kind, g.cooldownMs, now);
      s.energy -= g.energy;
      const found: Partial<Record<ItemId, number>> = {};
      const mult = yieldMult(s, now);
      if (a.kind === "chop") {
        found.wood = Math.max(1, Math.round(rng.int(2, 4) * mult));
        if (rng.chance(0.06)) found.coconut = 1;
      } else {
        found.stone = Math.max(1, Math.round(rng.int(2, 3) * mult));
        if (rng.chance(0.1)) found.glass = 1;
        if (rng.chance(0.08)) found.coral = 1;
        if (rng.chance(0.12 + s.gear.pick * 0.02)) found.ore = (1 + Math.floor(s.gear.pick / 3)) * (eventActive(s, "meteor", now) ? 2 : 1);
      }
      giveItems(s, found);
      s.stats.gathered++;
      addXp(s, events, g.xp);
      progress(s, events, "gather");
      log(s, events, `${a.kind === "chop" ? "" : ""} ${itemsText(found)}`, "good", { cue: "select" }, now);
      return { found };
    }

    // ---------------- Kitchen ----------------
    case "cook": {
      requireAwake(s);
      if (s.home < 1) fail("You need a Driftwood Hut kitchen to cook.");
      const recipe = RECIPES[a.meal];
      const need = missing(s, { items: recipe }); if (need) fail(need);
      pay(s, { items: recipe });
      s.inv[a.meal]++;
      s.stats.cooked++;
      addXp(s, events, 8);
      progress(s, events, "cook");
      log(s, events, `Cooked ${ITEMS[a.meal].name}!`, "good", { cue: "reward", icon: a.meal }, now);
      return;
    }

    // ---------------- Market ----------------
    case "buy": {
      requireAwake(s);
      const offer = SHOP.find(o => o.id === a.item); if (!offer) fail("Not for sale.");
      const qty = clamp(Math.floor(a.qty ?? 1), 1, 99);
      const cost = { shell: (offer!.price.shell ?? 0) * qty, items: Object.fromEntries(Object.entries(offer!.price.items ?? {}).map(([k, v]) => [k, (v ?? 0) * qty])) };
      const need = missing(s, cost); if (need) fail(need);
      pay(s, cost);
      s.inv[a.item] += offer!.qty * qty;
      log(s, events, `Bought ${qty}x ${ITEMS[a.item].name}.`, "info", { cue: "purchase" }, now);
      return;
    }
    case "sell": {
      requireAwake(s);
      if (!ITEMS[a.item].sell) fail("The market won't buy that.");
      const qty = clamp(Math.floor(a.qty ?? 1), 1, s.inv[a.item]);
      if (s.inv[a.item] < 1) fail("You have none.");
      s.inv[a.item] -= qty;
      const got = giveShell(s, sellPrice(s, a.item, now) * qty * shellMult(s));
      log(s, events, `Sold ${qty}x ${ITEMS[a.item].name} for ${got} SHELL.`, "good", { cue: "reward" }, now);
      return { got };
    }
    // ---------------- Abyss Dive (crash) ----------------
    case "diveStart": {
      requireZone(s, "abyss"); requireNoRun(s); requireEnergy(s, DIVE.energy);
      stakeCheck(s, a.stake, DIVE.minShell);
      takeStake(s, a.stake);
      s.energy -= DIVE.energy;
      const u = rng.next();
      const crashAt = Math.max(1, Math.floor(100 * (1 - diveEdge(s)) / (1 - u)) / 100);
      s.run = { kind: "dive", stake: a.stake, crashAt, startedAt: now };
      s.lastWin = null;
      s.stats.dives++;
      addXp(s, events, 4);
      events.push({ tone: "info", text: "Diving…", cue: "action-start" });
      return;
    }
    case "diveCashout":
    case "diveCrash": {
      const run = s.run; if (!run || run.kind !== "dive") fail("You aren't diving.");
      const r = run as Extract<typeof run, { kind: "dive" }>;
      const mult = diveMultiplierAt(now - r.startedAt);
      s.run = null;
      if (a.type === "diveCrash" || mult >= r.crashAt) {
        s.mood -= 6;
        log(s, events, `The abyss bit at ${r.crashAt.toFixed(2)}x! Lost ${r.stake} SHELL.`, "bad", { cue: "impact", fx: "shake" }, now);
        return { crashed: true, crashAt: r.crashAt };
      }
      const win = giveShell(s, r.stake * mult);
      // Loot from the deep: one roll per full multiplier step past 1x.
      const loot: Partial<Record<ItemId, number>> = {};
      const rolls = Math.floor((mult - 1) / DIVE.lootEvery) * (eventActive(s, "frenzy", now) ? 2 : 1);
      for (let i = 0; i < rolls; i++) {
        const drop = weighted(rng, [{ id: "coral" as ItemId, weight: 55 }, { id: "glass" as ItemId, weight: 30 }, { id: "pearl" as ItemId, weight: 15 * (1 + luck(s, now)) }]);
        loot[drop.id] = (loot[drop.id] ?? 0) + (hasTrait(s, "bonediver") && rng.chance(0.3) ? 2 : 1);
      }
      giveItems(s, loot);
      s.stats.bestDive = Math.max(s.stats.bestDive, mult);
      if (mult >= 2) progress(s, events, "dive");
      addXp(s, events, Math.round(4 * mult));
      s.mood += mult >= 3 ? 8 : 3;
      s.lastWin = { amount: win, flips: 0, source: "dive" };
      log(s, events, `Cashed out at ${mult.toFixed(2)}x: +${win} SHELL ${itemsText(loot)}`, mult >= 5 ? "epic" : "good", { cue: mult >= 10 ? "reveal-legendary" : mult >= 3 ? "reveal-rare" : "reward", fx: mult >= 5 ? "confetti" : undefined }, now);
      return { crashed: false, mult, win, loot, crashAt: r.crashAt };
    }

    // ---------------- Tide Mines ----------------
    case "minesStart": {
      requireZone(s, "mines"); requireNoRun(s); requireEnergy(s, MINES.energy);
      if (!MINES.trapOptions.includes(a.traps)) fail("Invalid trap count.");
      stakeCheck(s, a.stake, MINES.minShell);
      takeStake(s, a.stake);
      s.energy -= MINES.energy;
      const tiles = Array.from({ length: MINES.size }, (_, i) => i);
      for (let i = tiles.length - 1; i > 0; i--) { const j = rng.int(0, i); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
      const traps = tiles.slice(0, a.traps).sort((x, y) => x - y);
      const safe = tiles.slice(a.traps);
      s.run = { kind: "mines", stake: a.stake, traps, revealed: [], trapCount: a.traps, loot: {}, safeHint: hasTrait(s, "void") ? safe[0] : null };
      s.lastWin = null;
      addXp(s, events, 3);
      events.push({ tone: "info", text: `${a.traps} traps hidden. Dig carefully…`, cue: "action-start" });
      return;
    }
    case "minesReveal": {
      const run = s.run; if (!run || run.kind !== "mines") fail("No mines run.");
      const r = run as Extract<typeof run, { kind: "mines" }>;
      if (a.index < 0 || a.index >= MINES.size || r.revealed.includes(a.index)) fail("Pick another tile.");
      if (r.traps.includes(a.index)) {
        s.run = null;
        s.mood -= 5;
        log(s, events, `TRAP! Lost ${r.stake} SHELL and the loot.`, "bad", { cue: "impact", fx: "shake" }, now);
        return { trap: true, traps: r.traps };
      }
      r.revealed.push(a.index);
      const drop = weighted(rng, [{ id: "stone", weight: 36 }, { id: "ore", weight: 30 + s.gear.pick * 3 }, { id: "coral", weight: 10 }, { id: "glass", weight: 8 }, { id: "none", weight: 16 }]);
      if (drop.id !== "none") {
        const n = (drop.id === "ore" ? 1 + Math.floor(s.gear.pick / 4) : 1) * (drop.id === "ore" && eventActive(s, "meteor", now) ? 2 : 1);
        r.loot[drop.id as ItemId] = (r.loot[drop.id as ItemId] ?? 0) + n;
      }
      const safeTiles = MINES.size - r.trapCount;
      events.push({ tone: "good", text: `Safe! ${minesMultiplier(r.trapCount, r.revealed.length).toFixed(2)}x`, cue: r.revealed.length > 5 ? "anticipation" : "select" });
      if (r.revealed.length >= safeTiles) return apply(s, { type: "minesCashout" }, now, rng, events);
      return { trap: false, mult: minesMultiplier(r.trapCount, r.revealed.length) };
    }
    case "minesCashout": {
      const run = s.run; if (!run || run.kind !== "mines") fail("No mines run.");
      const r = run as Extract<typeof run, { kind: "mines" }>;
      if (r.revealed.length === 0) fail("Dig at least one tile first.");
      const mult = minesMultiplier(r.trapCount, r.revealed.length);
      s.run = null;
      const win = giveShell(s, r.stake * mult);
      giveItems(s, r.loot);
      s.stats.minesCashouts++;
      s.stats.bestMinesTiles = Math.max(s.stats.bestMinesTiles, r.revealed.length);
      progress(s, events, "mines");
      addXp(s, events, 2 * r.revealed.length);
      s.mood += 4;
      s.lastWin = { amount: win, flips: 0, source: "mines" };
      log(s, events, `Mines cashout ${mult.toFixed(2)}x: +${win} SHELL ${itemsText(r.loot)}`, mult >= 5 ? "epic" : "good", { cue: mult >= 5 ? "reveal-rare" : "reward", fx: mult >= 5 ? "confetti" : undefined }, now);
      return { mult, win, traps: r.traps };
    }

    // ---------------- Double or nothing ----------------
    case "flip": {
      const w = s.lastWin; if (!w) fail("Nothing to flip.");
      if (w!.flips >= FLIP.maxFlips) fail("Max flips reached. Bank it!");
      const chance = FLIP.winChance + (hasTrait(s, "chaos") ? 0.02 : 0);
      if (rng.chance(chance)) {
        giveShell(s, w!.amount);
        w!.amount *= 2; w!.flips++;
        s.stats.flipsWon++;
        s.mood += 3;
        log(s, events, `DOUBLED! Now ${w!.amount} SHELL.`, "epic", { cue: "reveal-rare", fx: w!.flips >= 3 ? "jackpot" : "confetti" }, now);
        return { won: true };
      }
      s.shell = Math.max(0, s.shell - w!.amount);
      s.stats.flipsLost++;
      s.mood -= 6;
      log(s, events, `Flip lost… ${w!.amount} SHELL gone.`, "bad", { cue: "impact", fx: "shake" }, now);
      s.lastWin = null;
      return { won: false };
    }
    case "keepWin": { s.lastWin = null; return; }

    // ---------------- Fishing ----------------
    case "fishCast": {
      requireNoRun(s); requireEnergy(s, FISH_ENERGY);
      if (s.inv.bait < 1) fail("No bait! Buy some at the market (6 SHELL).");
      s.inv.bait--; s.energy -= FISH_ENERGY;
      const boost = s.gear.rod * 0.08 + luck(s, now);
      const golden = eventActive(s, "goldtide", now);
      const fish = weighted(rng, FISH_TABLE.map((f, i) => ({ ...f, weight: f.weight * Math.max(0.2, 1 + boost * i) * (golden && i >= 2 ? 2 : 1) })));
      s.run = { kind: "fish", fish: fish.id, zone: fishZone(s, fish.difficulty), castAt: now };
      events.push({ tone: "info", text: "Cast! Wait for the bite…", cue: "action-start", quiet: true });
      return { zone: (s.run as { zone: number }).zone, difficulty: fish.difficulty };
    }
    case "fishReel": {
      const run = s.run; if (!run || run.kind !== "fish") fail("Cast first.");
      const r = run as Extract<typeof run, { kind: "fish" }>;
      s.run = null;
      if (!a.hit) { s.mood -= 2; log(s, events, "It got away…", "bad", { cue: "select", quiet: true }, now); return { caught: false, fish: r.fish }; }
      const def = FISH_TABLE.find(f => f.id === r.fish)!;
      s.inv[r.fish]++;
      s.stats.fish++;
      if (r.fish === "goldnemo") s.stats.goldnemo++;
      addXp(s, events, def.xp);
      progress(s, events, "fish");
      s.mood += 2;
      const rare = r.fish === "angler" || r.fish === "goldnemo";
      log(s, events, `Caught a ${ITEMS[r.fish].name}!${r.fish === "goldnemo" ? " LEGENDARY!" : ""}`, rare ? "epic" : "good", { cue: r.fish === "goldnemo" ? "reveal-legendary" : rare ? "reveal-rare" : "reveal-common", fx: rare ? "confetti" : undefined, icon: r.fish, quiet: true }, now);
      return { caught: true, fish: r.fish, xp: def.xp };
    }

    // ---------------- Crab Dash (skill, SHELL only) ----------------
    case "crabStart": {
      requireNoRun(s); requireEnergy(s, CRAB.energy);
      s.energy -= CRAB.energy;
      s.run = { kind: "crab", startedAt: now };
      events.push({ tone: "info", text: "Crab Dash! Catch every crab you can.", cue: "action-start" });
      return { startedAt: now };
    }
    case "crabFinish": {
      const run = s.run; if (!run || run.kind !== "crab") fail("Start a Crab Dash round first.");
      const r = run as Extract<typeof run, { kind: "crab" }>;
      if (now < r.startedAt + CRAB.roundMs - CRAB.finishGraceMs) fail("The round is still running.");
      s.run = null;
      const score = Number.isFinite(a.score) ? clamp(Math.floor(a.score), 0, CRAB.maxScore) : 0;
      const shell = giveShell(s, score * CRAB.shellPerPoint * shellMult(s));
      const xp = 5 + Math.floor(score / 4);
      addXp(s, events, xp);
      const items: Partial<Record<ItemId, number>> = {};
      if (score >= CRAB.baitAt) items.bait = 1;
      if (score >= CRAB.pearlAt) items.pearl = 1;
      giveItems(s, items);
      s.stats.crabRuns++;
      const best = score > s.stats.crabBest;
      if (best) s.stats.crabBest = score;
      const extra = Object.keys(items).length ? `, ${itemsText(items)}` : "";
      log(s, events, `Crab Dash: ${score} points. +${shell} SHELL, +${xp} XP${extra}.${best ? " New personal best!" : ""}`, best ? "epic" : "good",
        { cue: best ? "reveal-rare" : "reward", fx: best && score > 0 ? "confetti" : undefined, icon: "crab" }, now);
      return { score, shell, xp, best };
    }
    case "crabQuit": {
      const run = s.run; if (!run || run.kind !== "crab") fail("No Crab Dash round to leave.");
      s.run = null;
      log(s, events, "Crab Dash round left early. No reward.", "info", { cue: "select" }, now);
      return;
    }

    // ---------------- Raids ----------------
    case "raid": {
      requireZone(s, "harbor"); requireNoRun(s); requireEnergy(s, RAID.energy);
      cooldown(s, "raid", RAID.cooldownMs, now);
      // The engine looks up its own simulated rival; the request only names it.
      const t = s.rivals.find(r => r.id === a.rivalId);
      if (!t) return fail("No such rival.");
      s.energy -= RAID.energy;
      const chance = raidChance(s, t, now);
      if (rng.next() < chance) {
        const frac = RAID.stealFraction[0] + rng.next() * (RAID.stealFraction[1] - RAID.stealFraction[0]);
        const stolen = Math.max(1, Math.floor(Math.floor(t.vault) * frac * (hasTrait(s, "trickster") ? 1.25 : 1)));
        giveShell(s, stolen);
        let bonus = 0;
        if (rng.chance(0.15)) bonus = giveShell(s, rng.int(30, 120));
        t.vault = Math.max(0, t.vault - stolen); t.lastRaidedAt = now;
        if (s.revenge?.rivalId === t.id) s.revenge = null;
        s.stats.raidsWon++;
        s.mood += 8;
        addXp(s, events, 25);
        progress(s, events, "raid");
        log(s, events, `Raid on ${t.name} succeeded! +${stolen} SHELL${bonus ? ` +${bonus} bonus SHELL` : ""}`, "epic", { cue: "reveal-rare", fx: "confetti" }, now);
        return { won: true, stolen, bonus, chance };
      }
      const fee = Math.floor(s.shell * RAID.hospitalFraction);
      s.shell -= fee; s.stats.shellSpent += fee;
      s.mood -= RAID.moodLoss;
      s.stats.raidsLost++;
      addXp(s, events, 5);
      log(s, events, `${t.name}'s defenses held. Clinic fee ${fee} SHELL, -${RAID.moodLoss} mood.`, "bad", { cue: "impact", fx: "shake" }, now);
      return { won: false, fee, chance };
    }

    // ---------------- Kraken world boss ----------------
    case "bossAttack": {
      requireZone(s, "reef"); requireNoRun(s);
      syncBoss(s, now);
      const status = bossStatus(now, s.boss.damage);
      if (!status.active) fail("The Kraken is sleeping. Wait for the next rising.");
      if (status.defeated) fail("The Kraken is defeated! Claim your share.");
      requireEnergy(s, BOSS.energy);
      cooldown(s, "boss", BOSS.cooldownMs, now);
      s.energy -= BOSS.energy;
      const crit = rng.chance(0.15 + luck(s, now));
      const damage = Math.round(power(s) * (0.8 + rng.next() * 0.4) * (crit ? (hasTrait(s, "chaos") ? 4 : 2) : 1) * 3);
      s.boss.damage += damage; s.stats.bossDamage += damage;
      progress(s, events, "boss");
      addXp(s, events, 6);
      let text = `${crit ? "CRIT! " : ""}Hit the Kraken for ${damage}.`;
      if (rng.chance(BOSS.counterChance)) { s.energy -= 10; s.mood -= 8; text += " Tentacle slam! -10 energy."; }
      log(s, events, text, crit ? "epic" : "good", { cue: crit ? "impact" : "select", fx: crit ? "shake" : undefined }, now);
      return { damage, crit };
    }
    case "bossClaim": {
      syncBoss(s, now);
      const status = bossStatus(now, s.boss.damage);
      if (!status.defeated) fail("The Kraken still stands!");
      if (s.boss.claimed) fail("Already claimed for this rising.");
      if (s.boss.damage <= 0) fail("You didn't hit the Kraken this time.");
      s.boss.claimed = true;
      const share = Math.min(1, s.boss.damage / BOSS.hp);
      const shell = giveShell(s, Math.max(15, BOSS.poolShell * share) + 50 + s.boss.damage / 20);
      const loot: Partial<Record<ItemId, number>> = { coral: rng.int(3, 8), pearl: rng.chance(0.4 + share) ? 1 : 0 };
      giveItems(s, loot);
      s.stats.bossKills++;
      log(s, events, `Kraken slain! Your share: +${shell} SHELL ${itemsText(loot)}`, "epic", { cue: "reveal-legendary", fx: "jackpot" }, now);
      return { shell };
    }

    // ---------------- Tide Wheel ----------------
    case "spin": {
      requireAwake(s);
      if (s.wheelFreeAt > now) fail("Free spin not ready yet.");
      s.wheelFreeAt = now + WHEEL_FREE_MS;
      const prize = weighted(rng, WHEEL);
      const big = (prize.shell ?? 0) >= 150;
      if (prize.shell) giveShell(s, prize.shell);
      if (prize.items) giveItems(s, prize.items);
      s.stats.spins++;
      if (prize.jackpot) s.stats.jackpots++;
      log(s, events, `Tide Wheel: ${prize.label}!`, prize.jackpot ? "epic" : big ? "good" : "info", { cue: prize.jackpot ? "reveal-legendary" : big ? "reveal-rare" : "reward", fx: prize.jackpot ? "jackpot" : big ? "confetti" : undefined }, now);
      return { prize: prize.id, index: WHEEL.indexOf(prize) };
    }

    // ---------------- Progression ----------------
    case "ascend": {
      requireAwake(s);
      if (s.level >= MAX_LEVEL) fail("Max level reached!");
      if (s.xp < xpToNext(s.level)) fail(`Need ${xpToNext(s.level) - s.xp} more XP.`);
      const cost = ascendCost(s.level);
      const need = missing(s, cost); if (need) fail(need);
      if (a.blessing && s.inv.blessing < 1) fail("No Luck Scroll.");
      if (a.charm && s.inv.charm < 1) fail("No Protection Charm.");
      const chance = ascendChance(s, !!a.blessing);
      pay(s, cost);
      if (a.blessing) s.inv.blessing--;
      progress(s, events, "spend", cost.shell ?? 0);
      const roll = rng.next() * 100;
      if (roll < chance) {
        const oldTitle = titleFor(s.level);
        s.level++; s.xp = 0; s.ascendPity = 0; s.stats.ascends++;
        s.energy = maxEnergy(s); s.mood += 20;
        const newTitle = titleFor(s.level);
        log(s, events, `ASCENDED to level ${s.level}!${newTitle !== oldTitle ? ` New title: ${newTitle}!` : ""}`, "epic", { cue: "reveal-legendary", fx: "levelup" }, now);
        if (a.charm) { /* charm unused on success */ }
        return { success: true, chance, roll };
      }
      s.ascendPity++; s.stats.ascendFails++; s.mood -= 10;
      let text = `Ascension failed (${chance.toFixed(0)}% chance). ${cost.shell ?? 0} SHELL spent. Pity +${ASCEND.pityStep}% next try.`;
      if (a.charm) {
        s.inv.charm--;
        const refundShell = Math.floor((cost.shell ?? 0) / 2);
        s.shell += refundShell;
        for (const [id, n] of Object.entries(cost.items ?? {})) if (n) s.inv[id as ItemId] += Math.floor(n / 2);
        text += ` Charm refunded ${refundShell} SHELL and half the materials.`;
      }
      log(s, events, text, "bad", { cue: "impact", fx: "shake" }, now);
      return { success: false, chance, roll };
    }
    case "forge": {
      requireZone(s, "forge"); requireAwake(s);
      const lvl = s.gear[a.gear];
      if (lvl >= MAX_GEAR) fail("Already +10. Legendary!");
      const cost = forgeCost(lvl + 1);
      const need = missing(s, cost); if (need) fail(need);
      if (a.blessing && s.inv.blessing < 1) fail("No Luck Scroll.");
      if (a.charm && s.inv.charm < 1) fail("No Protection Charm.");
      const chance = forgeChance(s, a.gear, !!a.blessing);
      pay(s, cost);
      if (a.blessing) s.inv.blessing--;
      s.stats.forges++;
      progress(s, events, "forge");
      progress(s, events, "spend", cost.shell ?? 0);
      if (rng.next() * 100 < chance) {
        s.gear[a.gear]++; s.forgePity[a.gear] = 0;
        addXp(s, events, 10 * s.gear[a.gear]);
        const n = s.gear[a.gear];
        log(s, events, `${GEAR[a.gear].name} forged to +${n}!`, n >= 7 ? "epic" : "good", { cue: n >= 7 ? "reveal-legendary" : "reveal-rare", fx: n >= 5 ? "confetti" : undefined }, now);
        return { success: true, chance };
      }
      s.forgePity[a.gear]++; s.stats.forgeFails++; s.mood -= 5;
      let text = `The hammer slipped! ${GEAR[a.gear].name} stays +${lvl}. ${cost.shell ?? 0} SHELL spent. Pity +${FORGE_PITY_STEP}%.`;
      if (a.charm) {
        s.inv.charm--;
        for (const [id, n] of Object.entries(cost.items ?? {})) if (n) s.inv[id as ItemId] += Math.floor(n / 2);
        s.shell += Math.floor((cost.shell ?? 0) / 2);
        text += " Charm saved half your materials.";
      }
      log(s, events, text, "bad", { cue: "impact", fx: "shake" }, now);
      return { success: false, chance };
    }

    // ---------------- Islander gifts ----------------
    case "npcGift": {
      const gift = NPC_GIFTS[a.npc];
      if (!gift) fail("They have nothing for you.");
      const today = dayNumber(now);
      if (s.npcGifts[a.npc] === today) fail("Come back tomorrow for another gift.");
      s.npcGifts[a.npc] = today;
      if (gift!.shell) giveShell(s, gift!.shell);
      if (gift!.items) giveItems(s, gift!.items);
      addXp(s, events, 5);
      const what = [gift!.shell ? `${gift!.shell} SHELL` : "", gift!.items ? itemsText(gift!.items) : ""].filter(Boolean).join(", ");
      log(s, events, `Daily gift: ${what}`, "good", { cue: "reward", icon: gift!.items ? Object.keys(gift!.items)[0] : "shell" }, now);
      return;
    }

    // ---------------- Voyages ----------------
    case "voyageStart": {
      requireAwake(s); requireNoRun(s); requirePresent(s);
      if (!voyagesOpen(s)) fail(voyageGateText());
      const v = VOYAGES.find(x => x.id === a.id);
      if (!v) fail("Unknown voyage.");
      if (s.level < v!.minLevel && s.rebirths === 0) fail(`${v!.name} needs level ${v!.minLevel}.`);
      if (s.hunger < 40) fail("Your Friend is too hungry to sail. Eat first.");
      if (foodCount(s) < v!.food) fail(`Pack ${v!.food} food for the trip (bread, fish or crops).`);
      const need = missing(s, { shell: v!.costShell }); if (need) fail(need);
      pay(s, { shell: v!.costShell });
      let packed = v!.food;
      for (const id of ["bread", "sardine", "kelp", "carrot", "coconut", "clownfish", "berry", "tuna", "sushi", "pumpkin", "angler", "stew", "pie"] as ItemId[]) {
        while (packed > 0 && s.inv[id] > 0) { s.inv[id]--; packed--; }
      }
      s.voyage = { id: v!.id, startedAt: now, endsAt: now + v!.minutes * 60_000, result: rollVoyage(s, v!, rng), announced: false };
      s.stats.voyages++;
      const where = v!.id === "homeland" ? `${homeIsle(s.family)}` : v!.name;
      log(s, events, `Your Friend set sail for ${where}. Back in ${v!.minutes >= 60 ? `${v!.minutes / 60} h` : `${v!.minutes} min`}.`, "info", { cue: "action-start", icon: "anchor" }, now);
      return;
    }
    case "voyageRecall": {
      if (!s.voyage) fail("Your Friend is already home.");
      if (now >= s.voyage!.endsAt) fail("They're already back. Claim the voyage.");
      s.voyage = null;
      s.mood -= 10;
      log(s, events, "You called your Friend home early. The voyage found nothing.", "bad", { cue: "impact", icon: "anchor" }, now);
      return;
    }
    case "voyageClaim": {
      const v = s.voyage;
      if (!v) fail("No voyage to claim.");
      if (now < v!.endsAt) fail("Your Friend is still at sea.");
      const r = v!.result;
      s.voyage = null;
      if (r.shell) giveShell(s, r.shell);
      giveItems(s, r.items);
      if (r.stock) s.stocks[r.stock.id] = Math.round((s.stocks[r.stock.id] + r.stock.shares) * 1000) / 1000;
      if (r.relic) s.relics++;
      if (r.lost) { const lost = Math.floor(s.shell * 0.1); s.shell -= lost; s.mood -= 30; s.energy = Math.min(s.energy, 10); }
      const won = !!(r.shell || Object.keys(r.items).length || r.stock || r.relic);
      if (won) s.stats.voyageWins++;
      addXp(s, events, won ? 40 : 15);
      const parts = [r.shell ? `${r.shell} SHELL` : "", itemsText(r.items), r.stock ? `${r.stock.shares} ${r.stock.id} island company shares` : "", r.relic ? "a Family Relic (+2% XP forever)" : ""].filter(Boolean);
      log(s, events, won ? `Voyage success: ${r.label}! +${parts.join(", ")}` : `Voyage: ${r.label}.`, won ? "epic" : "bad", { cue: won ? "reveal-rare" : "impact", fx: won ? "confetti" : "shake", icon: won ? "chest" : "skull" }, now);
      return { result: r, won };
    }
    case "sellStock": {
      requireAwake(s);
      const held = s.stocks[a.id] ?? 0;
      const shares = Math.min(held, Math.round(a.shares * 1000) / 1000);
      if (!STOCKS[a.id] || shares <= 0) fail("No shares to sell.");
      const gross = stockPrice(a.id, now) * shares;
      const got = giveShell(s, gross * (1 - STOCK_SELL_FEE));
      s.stocks[a.id] = Math.round((held - shares) * 1000) / 1000;
      log(s, events, `Sold ${shares} ${a.id} for ${got} SHELL (simulated).`, "good", { cue: "reward", icon: "coin" }, now);
      return { got };
    }

    // ---------------- Rebirth ----------------
    case "rebirth": {
      requireAwake(s); requireNoRun(s);
      requirePresent(s);
      if (s.level < REBIRTH.minLevel) fail(`Rebirth unlocks at level ${REBIRTH.minLevel}.`);
      const cost = { shell: rebirthCost(s.rebirths) };
      const need = missing(s, cost); if (need) fail(need);
      pay(s, cost);
      s.rebirths++;
      s.level = 1; s.xp = 0; s.ascendPity = 0;
      s.energy = maxEnergy(s); s.mood = 100;
      log(s, events, `Reborn! Rebirth ${s.rebirths}: permanent +${Math.round(s.rebirths * REBIRTH.xpBonus * 100)}% XP and +${Math.round(s.rebirths * REBIRTH.shellBonus * 100)}% SHELL. Your home, gear and items stay with you.`, "epic", { cue: "reveal-legendary", fx: "levelup", icon: "star" }, now);
      return;
    }

    // ---------------- Story ----------------
    case "storyClaim": {
      const ch = chapterAt(s.story);
      if (!ch.done(s)) fail(`Chapter goal: ${ch.goal}`);
      if (ch.reward.shell) giveShell(s, ch.reward.shell);
      if (ch.reward.items) giveItems(s, ch.reward.items);
      addXp(s, events, 20 + s.story * 10);
      s.story++;
      const next = chapterAt(s.story);
      log(s, events, `Chapter complete: ${ch.title}! Next: ${next.title}`, "epic", { cue: "reveal-rare", fx: "confetti" }, now);
      if (s.story === VOYAGE_CHAPTER && !s.rebirths) log(s, events, "The Voyage Pier is open! Send your Friend on a 15-minute Tide Scout while you play.", "info", { cue: "action-ready", icon: "anchor" }, now);
      return;
    }

    // ---------------- Seasons ----------------
    case "passClaim": {
      if (!passClaimable(s)) fail("No Season Journey tiers to claim yet. Earn more season points.");
      return claimPass(s, events, now);
    }

    // ---------------- Quests ----------------
    case "claimQuest": {
      const i = s.quests.findIndex(q => q.id === a.id);
      if (i < 0) fail("No such bounty.");
      const q = s.quests[i];
      if (q.progress < q.target) fail("Bounty not complete.");
      const got = giveShell(s, q.reward.shell * shellMult(s));
      addXp(s, events, q.reward.xp);
      if (q.reward.items) giveItems(s, q.reward.items);
      s.quests.splice(i, 1, newQuest(s, rng));
      log(s, events, `Bounty claimed: +${got} SHELL +${q.reward.xp} XP ${q.reward.items ? itemsText(q.reward.items) : ""}`, "good", { cue: "reward", fx: "confetti" }, now);
      return;
    }    default: return fail("Unknown action.");
  }
}

function syncBoss(s: GameState, now: number) {
  const epoch = Math.floor(now / BOSS.periodMs);
  if (s.boss.epoch !== epoch) s.boss = { epoch, damage: 0, claimed: false };
}

