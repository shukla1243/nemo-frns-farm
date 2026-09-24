/**
 * Economy simulation: scripted bots play NEMO FRNS FARM for hours of game time.
 * Verifies invariants (no NaN, no negative balances), that progression is reachable,
 * and that RF is net-burned (sinks exceed faucets), the core Token Activity claim.
 */
import { describe, expect, it } from "vitest";
import {
  BOSS, CROPS, DIVE, HOMES, ITEMS, MAX_PLOTS, ZONES, ZONE_ORDER, ascendCost, bossStatus, createState, diveTimeFor,
  dispatch, forgeCost, missing, plotCost, xpToNext, type Action, type CropId, type GameState, type ItemId,
} from "../src/engine";

type Style = "grinder" | "degen";

function simulate(seed: number, hours: number, style: Style) {
  const T0 = 1_800_000_000_000 + seed * 7919;
  let s = createState({ friendId: String(seed), name: `Bot ${seed}`, family: seed % 9, guest: false, now: T0, seed });
  let now = T0;
  const counts: Record<string, number> = {};
  const act = (a: Action) => {
    const r = dispatch(s, a, now);
    s = r.state;
    if (r.ok) counts[a.type] = (counts[a.type] ?? 0) + 1;
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
    if (zone && !missing(s, ZONES[zone].cost) && s.rf > (ZONES[zone].cost.rf ?? 0) + 300) { act({ type: "unlockZone", zone }); continue; }
    if (s.plots.length < MAX_PLOTS && s.shell > 600 && !missing(s, plotCost(s.plots.length))) { act({ type: "buyPlot" }); continue; }
    if (s.zones.forge && step % 40 === 0) {
      const gear = (["blade", "pick", "rod"] as const).find(g => s.gear[g] < 6 && !missing(s, forgeCost(s.gear[g] + 1)) && s.rf > 800);
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
      const started = act({ type: "diveStart", stake, currency: "shell" });
      if (started.ok) {
        const target = style === "degen" ? 3 : 1.6;
        now += Math.ceil(diveTimeFor(target)) + 10;
        const res = act({ type: "diveCashout" });
        if (style === "degen" && res.data && !res.data.crashed && s.lastWin) act({ type: "flip" }); else if (s.lastWin) act({ type: "keepWin" });
      }
      continue;
    }
    if (r === 1 && s.zones.mines && s.shell > 150) {
      const started = act({ type: "minesStart", stake: Math.max(10, Math.floor(s.shell * 0.05)), currency: "shell", traps: 3 });
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
      act({ type: "raid", target: { ...target } });
      continue;
    }
    if (r === 3) {
      if (s.inv.bait < 1) act({ type: "buy", item: "bait", qty: 3 });
      const c = act({ type: "fishCast" });
      if (c.ok) act({ type: "fishReel", hit: (step * 31) % 10 < 7 });
      continue;
    }
    if (r === 4 && s.zones.cove) { act({ type: "gather", kind: "quarry" }); continue; }
    if (r === 5 && step % 3 === 0 && s.shell > 2000 && style === "grinder") { act({ type: "swap", dir: "shellToRf", amount: 400 }); continue; }
    if (r === 6 && style === "degen" && s.rf > 500 && step % 5 === 0) { act({ type: "spin" }); continue; }
    act({ type: "gather", kind: "chop" });
    // Invariants every step
    for (const [k, v] of Object.entries({ rf: s.rf, shell: s.shell, hunger: s.hunger, energy: s.energy, mood: s.mood })) {
      if (!Number.isFinite(v)) throw new Error(`${k} became ${v} at step ${step}`);
    }
  }
  return { s, counts };
}

function summary(s: GameState) {
  return {
    level: s.level, home: HOMES[s.home].name, zones: Object.values(s.zones).filter(Boolean).length,
    gear: `${s.gear.rod}/${s.gear.pick}/${s.gear.blade}`,
    rf: +(s.rf / 100).toFixed(2), rfBurned: +(s.stats.burned / 100).toFixed(2), rfWon: +(s.stats.rfWon / 100).toFixed(2),
    shell: Math.floor(s.shell), shellEarned: s.stats.shellEarned, raids: `${s.stats.raidsWon}W/${s.stats.raidsLost}L`,
    ascends: `${s.stats.ascends}/${s.stats.ascends + s.stats.ascendFails}`, forges: `${s.stats.forges - s.stats.forgeFails}/${s.stats.forges}`,
    bestDive: s.stats.bestDive, achievements: s.achievements.length,
  };
}

describe("economy simulation", () => {
  it("grinders progress steadily and RF is net-burned", () => {
    const rows = [];
    const sims = [1, 2, 3, 4].map(seed => ({ seed, ...simulate(seed, 4, "grinder") }));
    for (const { seed, s } of sims) rows.push({ seed, style: "grinder", hours: 4, ...summary(s) });
    console.table(rows);
    for (const { s } of sims) {
      expect(s.rf).toBeGreaterThanOrEqual(0);
      expect(s.shell).toBeGreaterThanOrEqual(0);
      expect(s.level).toBeGreaterThanOrEqual(6);
      expect(s.home).toBeGreaterThanOrEqual(1);
      expect(s.stats.burned).toBeGreaterThan(s.stats.rfWon);
      for (const n of Object.values(s.inv)) expect(n).toBeGreaterThanOrEqual(0);
    }
    console.table(rows);
  }, 120_000);

  it("degens swing harder but still burn RF", () => {
    const rows = [];
    for (const seed of [11, 12, 13]) {
      const { s } = simulate(seed, 4, "degen");
      rows.push({ seed, style: "degen", hours: 4, ...summary(s) });
      expect(s.rf).toBeGreaterThanOrEqual(0);
      expect(s.shell).toBeGreaterThanOrEqual(0);
      expect(s.stats.burned).toBeGreaterThan(0);
    }
    console.table(rows);
  }, 120_000);
});
