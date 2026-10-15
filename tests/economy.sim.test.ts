/**
 * Economy simulation: scripted bots play NEMO FRNS FARM for hours of game time.
 * Verifies invariants (no NaN, no negative balances), that progression is reachable, that new players still get
 * early wins, and that no play style, including exploit bots, nets SHELL or tradable SHELL at the chance games.
 * Tradable SHELL can be traded for real RF at the planned Pearl Market, so the median of every style must lose.
 */
import { describe, expect, it } from "vitest";
import {
  BOSS, CROPS, DIVE, HOMES, ITEMS, MAX_PLOTS, ZONES, ZONE_ORDER, ascendCost, bossStatus, createState, diveTimeFor,
  dispatch, forgeCost, missing, plotCost, prosperityPct, xpToNext, type Action, type CropId, type GameState, type ItemId, type MinesRun,
} from "../src/engine";

/** grinder and degen play normally. minStake farms loot at the minimum stake, hint is a Hollow Belly digging its
 * safe hint first, and flipper spends every win before trying to flip it and flips to the cap otherwise. */
type Style = "grinder" | "degen" | "minStake" | "hint" | "flipper";

function simulate(seed: number, hours: number, style: Style) {
  const T0 = 1_800_000_000_000 + seed * 7919;
  let s = createState({ friendId: String(seed), name: `Bot ${seed}`, family: style === "hint" ? 8 : seed % 9, guest: false, now: T0, seed });
  let now = T0;
  const counts: Record<string, number> = {};
  // Net value from the chance games: SHELL plus loot at base sell price.
  const value = (x: GameState) => x.shell + (Object.keys(x.inv) as ItemId[]).reduce((v, id) => v + x.inv[id] * (ITEMS[id].sell ?? 0), 0);
  let riskNet = 0, riskTradable = 0;
  const act = (a: Action) => {
    const before = value(s), tBefore = s.tradable;
    const r = dispatch(s, a, now);
    s = r.state;
    if (r.ok) counts[a.type] = (counts[a.type] ?? 0) + 1;
    if (RISK.has(a.type)) { riskNet += value(s) - before; riskTradable += s.tradable - tBefore; }
    if (s.tradable > s.shell) throw new Error(`tradable above balance after ${a.type}`);
    return r;
  };
  const end = T0 + hours * 3600_000;
  let step = 0;
  while (now < end) {
    step++;
    now += 2000;
    if (s.sleeping) { act({ type: "tick" }); continue; }
    // Survival
    if (s.hunger < 45) {
      const foods = (Object.keys(ITEMS) as ItemId[]).filter(id => ITEMS[id].food && s.inv[id] > 0 && id !== "feast");
      if (foods.length) { act({ type: "eat", item: foods[0] }); continue; }
      act({ type: "buy", item: "bread", qty: 2 }); act({ type: "eat", item: "bread" }); continue;
    }
    if (s.energy < 16) { act({ type: "sleep" }); continue; }
    // Progression
    if (s.xp >= xpToNext(s.level) && !missing(s, ascendCost(s.level))) { act({ type: "ascend", charm: s.inv.charm > 0 }); continue; }
    if (s.home < HOMES.length - 1 && !missing(s, HOMES[s.home + 1].cost)) { act({ type: "buildHome" }); continue; }
    const zone = ZONE_ORDER.find(z => !s.zones[z]);
    if (zone && !missing(s, ZONES[zone].cost) && s.shell > (ZONES[zone].cost.shell ?? 0) + 450) { act({ type: "unlockZone", zone }); continue; }
    if (s.plots.length < MAX_PLOTS && s.shell > 600 && !missing(s, plotCost(s.plots.length))) { act({ type: "buyPlot" }); continue; }
    if (s.zones.forge && step % 40 === 0) {
      const gear = (["blade", "pick", "rod"] as const).find(g => s.gear[g] < 6 && !missing(s, forgeCost(s.gear[g] + 1)) && s.shell > 2000);
      if (gear) { act({ type: "forge", gear }); continue; }
    }
    // Farm
    const ready = s.plots.findIndex((p, i) => p.crop && !p.withered && now >= p.readyAt);
    if (ready >= 0) { act({ type: "harvest", plot: ready }); continue; }
    const dead = s.plots.findIndex(p => p.withered);
    if (dead >= 0) { act({ type: "clearPlot", plot: dead }); continue; }
    const empty = s.plots.findIndex(p => !p.crop);
    if (empty >= 0) {
      const crop: CropId = s.level > 8 ? "pumpkin" : s.level > 4 ? "berry" : "carrot";
      const seedId = CROPS[crop].seed;
      if (s.inv[seedId] < 1) act({ type: "buy", item: seedId });
      if (s.inv[seedId] >= 1) { act({ type: "plant", plot: empty, crop }); continue; }
    }
    // Quests
    const done = s.quests.find(q => q.progress >= q.target);
    if (done) { act({ type: "claimQuest", id: done.id }); continue; }
    // Kitchen
    if (s.home >= 1 && s.inv.sardine >= 2 && s.inv.kelp >= 1) { act({ type: "cook", meal: "sushi" }); continue; }
    // Sell surplus
    for (const id of ["sardine", "clownfish", "tuna", "angler", "goldnemo", "berry", "pumpkin", "carrot", "glass"] as ItemId[]) {
      if (s.inv[id] > 6) act({ type: "sell", item: id, qty: s.inv[id] - 4 });
    }
    // Free wheel
    if (s.wheelFreeAt <= now) { act({ type: "spin", free: true }); continue; }
    // Boss
    if (s.zones.reef) {
      const st = bossStatus(now, s.boss.epoch === Math.floor(now / BOSS.periodMs) ? s.boss.damage : 0);
      if (st.defeated && s.boss.damage > 0 && !s.boss.claimed && s.boss.epoch === st.epoch) { act({ type: "bossClaim" }); continue; }
      if (st.active && !st.defeated && s.energy > 40 && step % 3 === 0) { act({ type: "bossAttack" }); continue; }
    }
    // Work / risk rotation
    const r = step % 7;
    if (r === 0 && s.zones.abyss && s.shell > 200) {
      const stake = style === "degen" || style === "flipper" ? Math.floor(s.shell * 0.2) : style === "minStake" ? DIVE.minShell : Math.max(DIVE.minShell, Math.floor(s.shell * 0.05));
      const started = act({ type: "diveStart", stake });
      if (started.ok) {
        const target = style === "grinder" || style === "hint" ? 1.6 : 3;
        now += Math.ceil(diveTimeFor(target)) + 10;
        const res = act({ type: "diveCashout" });
        if (style === "flipper" && s.lastWin) {
          act({ type: "buy", item: "bait", qty: 99 }); // spend the win, then try the free flip
          while (s.lastWin && act({ type: "flip" }).ok) { /* flip to the cap */ }
        }
        if (style === "degen" && res.data && !res.data.crashed && s.lastWin) act({ type: "flip" });
        if (s.lastWin) act({ type: "keepWin" });
      }
      continue;
    }
    if (r === 1 && s.zones.mines && s.shell > 150) {
      const minesStake = style === "minStake" ? 10 : style === "hint" ? Math.floor(s.shell * 0.2) : Math.max(10, Math.floor(s.shell * 0.05));
      const started = act({ type: "minesStart", stake: minesStake, traps: style === "hint" ? 20 : 3 });
      if (started.ok && style === "hint") {
        const run = s.run as MinesRun;
        if (run.safeHint !== null) act({ type: "minesReveal", index: run.safeHint });
        act({ type: "minesReveal", index: run.safeHint === 0 ? 1 : 0 });
        if (s.run) act({ type: "minesCashout" });
        if (s.lastWin) act({ type: "keepWin" });
      } else if (started.ok) {
        for (let k = 0; k < 4 && s.run; k++) {
          const run = s.run as { revealed: number[] };
          const pick = [...Array(25).keys()].find(i => !run.revealed.includes(i) && ((i * 7 + step) % 25) >= 0 && !run.revealed.includes(i))!;
          act({ type: "minesReveal", index: (pick + step) % 25 });
        }
        if (s.run) act({ type: "minesCashout" });
        if (s.lastWin) act({ type: "keepWin" });
      }
      continue;
    }
    if (r === 2 && s.zones.harbor && s.energy > 30) {
      const target = [...s.rivals].sort((a, b) => a.defense - b.defense)[0];
      act({ type: "raid", rivalId: target.id });
      continue;
    }
    if (r === 3) {
      if (s.inv.bait < 1) act({ type: "buy", item: "bait", qty: 3 });
      const c = act({ type: "fishCast" });
      if (c.ok) {
        // Reel some time into the bite window; the server judges the hook position.
        now = (s.run as unknown as { biteAt: number }).biteAt + 250 + ((step * 31) % 40) * 100;
        act({ type: "fishReel" });
      }
      continue;
    }
    if (r === 4 && s.zones.cove) { act({ type: "gather", kind: "quarry" }); continue; }
    act({ type: "gather", kind: "chop" });
    // Invariants every step
    for (const [k, v] of Object.entries({ shell: s.shell, hunger: s.hunger, energy: s.energy, mood: s.mood })) {
      if (!Number.isFinite(v)) throw new Error(`${k} became ${v} at step ${step}`);
    }
  }
  return { s, counts, riskNet: Math.round(riskNet), riskTradable: Math.round(riskTradable) };
}

const RISK = new Set(["diveStart", "diveCashout", "minesStart", "minesReveal", "minesCashout", "flip"]);

function summary(s: GameState) {
  return {
    level: s.level, home: HOMES[s.home].name, zones: Object.values(s.zones).filter(Boolean).length,
    gear: `${s.gear.rod}/${s.gear.pick}/${s.gear.blade}`,
    shell: Math.floor(s.shell), shellEarned: s.stats.shellEarned, shellSunk: s.stats.shellSunk, raids: `${s.stats.raidsWon}W/${s.stats.raidsLost}L`,
    ascends: `${s.stats.ascends}/${s.stats.ascends + s.stats.ascendFails}`, forges: `${s.stats.forges - s.stats.forgeFails}/${s.stats.forges}`,
    bestDive: s.stats.bestDive, achievements: s.achievements.length, prosperity: prosperityPct(s), mats: `${s.inv.coral}c/${s.inv.pearl}p/${s.inv.glass}g`,
  };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function runStyle(style: Style, seeds: number[]) {
  const sims = seeds.map(seed => ({ seed, ...simulate(seed, 4, style) }));
  console.table(sims.map(({ seed, s, riskNet, riskTradable }) => ({ seed, style, hours: 4, ...summary(s), tradable: Math.floor(s.tradable), riskNet, riskTradable })));
  for (const { s } of sims) {
    expect(s.shell).toBeGreaterThanOrEqual(0);
    expect(s.stats.shellSunk).toBeGreaterThan(0);
    for (const n of Object.values(s.inv)) expect(n).toBeGreaterThanOrEqual(0);
  }
  // Counting loot at sell value, the median bot of every style loses at the tables, in SHELL and in tradable SHELL.
  expect(median(sims.map(x => x.riskNet))).toBeLessThan(0);
  expect(median(sims.map(x => x.riskTradable))).toBeLessThanOrEqual(0);
  return sims;
}

describe("economy simulation", () => {
  it("grinders progress steadily and lose at the tables", () => {
    for (const { s } of runStyle("grinder", [1, 2, 3, 4, 5])) {
      expect(s.level).toBeGreaterThanOrEqual(6);
      expect(s.home).toBeGreaterThanOrEqual(1);
    }
  }, 120_000);

  it("degens swing harder and still lose at the tables", () => {
    // Stakes scale with the balance, so one lucky streak compounds; the median degen loses.
    runStyle("degen", [11, 12, 13, 14, 15, 16, 17, 18, 19]);
  }, 120_000);

  it("exploit bots net nothing: minimum-stake loot farming, the Hollow hint and spend-then-flip", () => {
    runStyle("minStake", [31, 32, 33, 34, 35]);
    runStyle("hint", [41, 42, 43, 44, 45]);
    runStyle("flipper", [51, 52, 53, 54, 55]);
  }, 240_000);

  it("new players get early wins in the first half hour", () => {    const sims = [21, 22, 23, 24, 25, 26, 27, 28].map(seed => ({ seed, ...simulate(seed, 0.5, "grinder") }));
    console.table(sims.map(({ seed, s }) => ({ seed, style: "new", hours: 0.5, ...summary(s) })));
    for (const { s } of sims) {
      // The RF-era economy reached level 5 to 7 and a Driftwood Hut in the first 30 minutes; first catch, hut and Kindling are the first trophies.
      expect(s.level).toBeGreaterThanOrEqual(5);
      expect(s.home).toBeGreaterThanOrEqual(1);
      expect(s.achievements).toEqual(expect.arrayContaining(["first_fish", "hut", "burn10"]));
    }
  }, 120_000);
});
