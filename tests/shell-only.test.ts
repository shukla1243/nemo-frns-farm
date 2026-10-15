/**
 * Real RF cannot live in a game server ledger, so the engine keeps no RF balance at all.
 * Every former RF price and prize is SHELL (starting rate 1 RF = 150 SHELL).
 */
import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS, BOSS, HOMES, PASS, SHOP, START, VOYAGES, WHEEL, ZONES, ZONE_ORDER, ascendCost, chapterAt, createState, dayNumber,
  dispatch, forgeCost, milestoneReward, plotCost, rebirthCost, streakReward, type GameState,
} from "../src/engine";

const T0 = Date.UTC(2026, 9, 13, 12);
const fresh = (): GameState => {
  const s = createState({ friendId: "7", name: "Friend #7", family: 0, guest: false, now: T0, seed: 99 });
  s.streak = { day: dayNumber(T0), count: 1 };
  s.shell = 100_000; s.hunger = 100; s.energy = 100;
  s.zones.abyss = true; s.zones.mines = true;
  return s;
};
const hasRf = (o: object) => Object.keys(o).some(k => /^rf$|Rf$|^rf[A-Z]/.test(k));

describe("SHELL-only economy", () => {
  it("state has no RF balance", () => {
    const s = createState({ friendId: "1", name: "a", family: 0, guest: false, now: T0, seed: 1 });
    expect("rf" in s).toBe(false);
    expect(s.shell).toBe(START.shell);
    expect(hasRf(START)).toBe(false);
    expect(Object.keys(s.stats).filter(k => /rf|Rf/.test(k))).toEqual([]);
  });

  it("no price is set in RF", () => {
    const costs = [
      ...HOMES.map(h => h.cost), ...ZONE_ORDER.map(z => ZONES[z].cost), ...SHOP.map(o => o.price),
      ...Array.from({ length: 50 }, (_, l) => ascendCost(l + 1)), ...Array.from({ length: 10 }, (_, t) => forgeCost(t + 1)),
      ...Array.from({ length: 7 }, (_, i) => plotCost(i + 2)),
    ];
    for (const c of costs) expect(hasRf(c)).toBe(false);
    for (const v of VOYAGES) { expect(hasRf(v)).toBe(false); for (const o of v.outcomes) expect(hasRf(o)).toBe(false); }
    expect(typeof rebirthCost(0)).toBe("number");
  });

  it("no prize is paid in RF", () => {
    for (const p of WHEEL) expect(hasRf(p)).toBe(false);
    for (const t of PASS) expect(hasRf(t)).toBe(false);
    for (const a of ACHIEVEMENTS) expect(hasRf(a.reward)).toBe(false);
    for (let i = 0; i < 60; i++) expect(hasRf(chapterAt(i).reward)).toBe(false);
    for (let t = 1; t < 30; t++) expect(hasRf(milestoneReward(t))).toBe(false);
    for (let d = 1; d <= 7; d++) expect(hasRf(streakReward(d))).toBe(false);
    expect(hasRf(BOSS)).toBe(false);
  });

  it("former RF prices convert at 150 SHELL per RF", () => {
    expect(HOMES[1].cost.shell).toBe(100 + 2 * 150);
    expect(ZONES.cove.cost.shell).toBe(100 + 75);
    expect(ascendCost(10).shell).toBe(75 + 90 * 10);
    expect(SHOP.find(o => o.id === "charm")!.price.shell).toBe(225);
    expect(rebirthCost(0)).toBe(1500);
    expect(START.shell).toBe(120 + 20 * 150);
  });

  it("upgrades record SHELL sunk into the island", () => {
    const s = fresh(); s.inv.wood = 100; s.inv.stone = 100;
    const r = dispatch(s, { type: "buildHome" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.stats.shellSunk).toBe(HOMES[1].cost.shell);
    expect(r.state.season.sunk).toBe(HOMES[1].cost.shell);
  });

  it("risk games stake SHELL only", () => {
    const s = fresh();
    const dive = dispatch(s, { type: "diveStart", stake: 100 }, T0);
    expect(dive.ok).toBe(true);
    expect(dive.state.shell).toBe(s.shell - 100);
    const mines = dispatch(s, { type: "minesStart", stake: 100, traps: 3 }, T0);
    expect(mines.ok).toBe(true);
    expect(mines.state.shell).toBe(s.shell - 100);
  });

  it("the Tide Wheel only has the free spin", () => {
    const s = fresh(); s.wheelFreeAt = T0;
    const r = dispatch(s, { type: "spin", free: true }, T0);
    expect(r.ok).toBe(true);
    expect(dispatch(r.state, { type: "spin", free: true }, T0 + 1000).ok).toBe(false);
  });

  it("voyages cost SHELL only", () => {
    const s = fresh(); s.story = 99; s.level = 6; s.inv.bread = 20;
    const v = VOYAGES.find(x => x.id === "homeland")!;
    const r = dispatch(s, { type: "voyageStart", id: "homeland" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.shell).toBe(s.shell - v.costShell);
  });
});
