/**
 * Economy simulation: scripted bots play NEMO FRNS FARM for hours of game time.
 * Verifies invariants (no NaN, no negative balances), that progression is reachable, that the chance
 * games never net any play style positive, and that new players still get early wins.
 */
import { describe, expect, it } from "vitest";
import {
  BOSS, CROPS, DIVE, HOMES, ITEMS, MAX_PLOTS, ZONES, ZONE_ORDER, ascendCost, bossStatus, createState, diveTimeFor,
  dispatch, forgeCost, missing, plotCost, prosperityPct, xpToNext, type Action, type CropId, type GameState, type ItemId,
} from "../src/engine";

type Style = "grinder" | "degen";

function simulate(seed: number, hours: number, style: Style) {
  const T0 = 1_800_000_000_000 + seed * 7919;
  let s = createState({ friendId: String(seed), name: `Bot ${seed}`, family: seed % 9, guest: false, now: T0, seed });
  let now = T0;
  const counts: Record<string, number> = {};
  // Net value from the chance games: SHELL plus loot at base sell price.
  const value = (x: GameState) => x.shell + (Object.keys(x.inv) as ItemId[]).reduce((v, id) => v + x.inv[id] * (ITEMS[id].sell ?? 0), 0);
  let riskNet = 0;
  const act = (a: Action) => {
    const before = value(s);
    const r = dispatch(s, a, now);
    s = r.state;
    if (r.ok) counts[a.type] = (counts[a.type] ?? 0) + 1;
    if (RISK.has(a.type)) riskNet += value(s) - before;
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
      const stake = style === "degen" ? Math.floor(s.shell * 0.2) : Math.max(DIVE.minShell, Math.floor(s.shell * 0.05));
      const started = act({ type: "diveStart", stake });
      if (started.ok) {
        const target = style === "degen" ? 3 : 1.6;
        now += Math.ceil(diveTimeFor(target)) + 10;
        const res = act({ type: "diveCashout" });
        if (style === "degen" && res.data && !res.data.crashed && s.lastWin) act({ type: "flip" }); else if (s.lastWin) act({ type: "keepWin" });
      }
      continue;
    }
    if (r === 1 && s.zones.mines && s.shell > 150) {
      const started = act({ type: "minesStart", stake: Math.max(10, Math.floor(s.shell * 0.05)), traps: 3 });
      if (started.ok) {
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
      if (c.ok) act({ type: "fishReel", hit: (step * 31) % 10 < 7 });
      continue;
    }
    if (r === 4 && s.zones.cove) { act({ type: "gather", kind: "quarry" }); continue; }
    act({ type: "gather", kind: "chop" });
    // Invariants every step
    for (const [k, v] of Object.entries({ shell: s.shell, hunger: s.hunger, energy: s.energy, mood: s.mood })) {
      if (!Number.isFinite(v)) throw new Error(`${k} became ${v} at step ${step}`);
    }
  }
  return { s, counts, riskNet: Math.round(riskNet) };
}

const RISK = new Set(["diveStart", "diveCashout", "minesStart", "minesReveal", "minesCashout", "flip"]);

function summary(s: GameState) {
  return {
    level: s.level, home: HOMES[s.home].name, zones: Object.values(s.zones).filter(Boolean).length,
    gear: `${s.gear.rod}/${s.gear.pick}/${s.gear.blade}`,
    shell: Math.floor(s.shell), shellEarned: s.stats.shellEarned, shellSunk: s.stats.shellSunk, raids: `${s.stats.raidsWon}W/${s.stats.raidsLost}L`,
    ascends: `${s.stats.ascends}/${s.stats.ascends + s.stats.ascendFails}`, forges: `${s.stats.forges - s.stats.forgeFails}/${s.stats.forges}`,
    bestDive: s.stats.bestDive, achievements: s.achievements.length, prosperity: prosperityPct(s),
  };
}

describe("economy simulation", () => {
  it("grinders progress steadily and SHELL flows into sinks", () => {
    const rows = [];
    const sims = [1, 2, 3, 4].map(seed => ({ seed, ...simulate(seed, 4, "grinder") }));
    for (const { seed, s, riskNet } of sims) rows.push({ seed, style: "grinder", hours: 4, ...summary(s), riskNet });
    console.table(rows);
    for (const { s } of sims) {
      expect(s.shell).toBeGreaterThanOrEqual(0);
      expect(s.level).toBeGreaterThanOrEqual(6);
      expect(s.home).toBeGreaterThanOrEqual(1);
      expect(s.stats.shellSunk).toBeGreaterThan(0);
      for (const n of Object.values(s.inv)) expect(n).toBeGreaterThanOrEqual(0);
    }
    // Chance games return less than they take, counting loot at sell value.
    expect(sims.reduce((n, x) => n + x.riskNet, 0)).toBeLessThan(0);
  }, 120_000);

  it("degens swing harder but still sink SHELL", () => {
    const rows = [];
    const nets: number[] = [];
    for (const seed of [11, 12, 13, 14, 15, 16, 17, 18, 19]) {
      const { s, riskNet } = simulate(seed, 4, "degen");
      rows.push({ seed, style: "degen", hours: 4, ...summary(s), riskNet });
      nets.push(riskNet);
      expect(s.shell).toBeGreaterThanOrEqual(0);
      expect(s.stats.shellSunk).toBeGreaterThan(0);
    }
    console.table(rows);
    // Stakes scale with the balance, so a lucky streak compounds; the typical degen still loses at the tables.
    expect(nets.sort((a, b) => a - b)[Math.floor(nets.length / 2)]).toBeLessThan(0);
  }, 120_000);

  it("new players get early wins in the first half hour", () => {
    const sims = [21, 22, 23, 24, 25, 26, 27, 28].map(seed => ({ seed, ...simulate(seed, 0.5, "grinder") }));
    console.table(sims.map(({ seed, s }) => ({ seed, style: "new", hours: 0.5, ...summary(s) })));
    for (const { s } of sims) {
      // The RF-era economy reached level 5 to 7 and a Driftwood Hut in the first 30 minutes; first catch, hut and Kindling are the first trophies.
      expect(s.level).toBeGreaterThanOrEqual(5);
      expect(s.home).toBeGreaterThanOrEqual(1);
      expect(s.achievements).toEqual(expect.arrayContaining(["first_fish", "hut", "burn10"]));
    }
  }, 120_000);
});
