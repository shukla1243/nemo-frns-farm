/**
 * Tradable SHELL feeds the Pearl Market (plan 2.7), where earned SHELL trades for real RF. It grows only with net
 * results of real play: never with returned stakes, refunds, fishing or Crab Dash (both client-reported), and never
 * faster than the risk taken with tradable SHELL.
 */
import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, VOYAGE_CHAPTER, createState, dayNumber, diveTimeFor, dispatch, type GameState } from "../src/engine";

const T0 = Date.UTC(2026, 9, 13, 12);
const fresh = (): GameState => {
  const s = createState({ friendId: "7", name: "Friend #7", family: 0, guest: false, now: T0, seed: 99 });
  s.streak = { day: dayNumber(T0), count: 1 };
  s.hunger = 100; s.energy = 100; s.zones.abyss = true; s.zones.mines = true; s.zones.cove = true;
  s.stats.shellEarned = 10_000_000; s.achievements = ACHIEVEMENTS.map(a => a.id);
  return dispatch(s, { type: "tick" }, T0).state;
};

describe("tradable SHELL", () => {
  it("starts at zero and never exceeds the balance", () => {
    const s = createState({ friendId: "1", name: "a", family: 0, guest: false, now: T0, seed: 1 });
    expect(s.tradable).toBe(0);
    const t = { ...fresh(), shell: 1000, tradable: 1000 };
    const r = dispatch(t, { type: "buy", item: "bait", qty: 10 }, T0 + 10);
    expect(r.state.tradable).toBeLessThanOrEqual(r.state.shell);
  });
  it("grows with sales of gathered goods and bounties, not with fish or Crab Dash", () => {
    const s = { ...fresh(), shell: 0, tradable: 0 };
    s.inv.wood = 10; s.inv.sardine = 10; s.inv.sushi = 3;
    const wood = dispatch(s, { type: "sell", item: "wood", qty: 10 }, T0 + 10);
    expect(wood.state.tradable).toBe(wood.state.shell);
    expect(wood.state.tradable).toBeGreaterThan(0);
    const fish = dispatch(s, { type: "sell", item: "sardine", qty: 10 }, T0 + 10);
    expect(fish.state.shell).toBeGreaterThan(0);
    expect(fish.state.tradable).toBe(0);
    expect(dispatch(s, { type: "sell", item: "sushi", qty: 3 }, T0 + 10).state.tradable).toBe(0);
    const crab = dispatch(dispatch(s, { type: "crabStart" }, T0 + 10).state, { type: "crabFinish", score: 100 }, T0 + 40_000);
    expect(crab.state.shell).toBeGreaterThan(0);
    expect(crab.state.tradable).toBe(0);
    expect(crab.state.stats.earnedBy.crab).toBe(crab.state.shell);
  });
  it("a dive funded by untracked SHELL adds no tradable SHELL, win or lose", () => {
    const s = { ...fresh(), shell: 10_000, tradable: 0 };
    const started = dispatch(s, { type: "diveStart", stake: 1000 }, T0 + 10).state;
    for (let seed = 1; seed < 80; seed++) {
      const r = dispatch({ ...started, seed }, { type: "diveCashout" }, T0 + 10 + Math.ceil(diveTimeFor(2)));
      expect(r.state.tradable).toBe(0);
    }
  });
  it("a dive funded by tradable SHELL pays tradable SHELL and loses it on a crash", () => {
    const s = { ...fresh(), shell: 1000, tradable: 1000 };
    const started = dispatch(s, { type: "diveStart", stake: 1000 }, T0 + 10).state;
    expect(started.tradable).toBe(0);
    let wins = 0, losses = 0;
    for (let seed = 1; seed < 80; seed++) {
      const r = dispatch({ ...started, seed }, { type: "diveCashout" }, T0 + 10 + Math.ceil(diveTimeFor(2)));
      if (r.data!.crashed) { losses++; expect(r.state.tradable).toBe(0); } else { wins++; expect(r.state.tradable).toBe(r.state.shell); }
    }
    expect(wins * losses).toBeGreaterThan(0);
  });
  it("gambling untracked SHELL never launders it into tradable SHELL", () => {
    let s: GameState = { ...fresh(), shell: 200_000, tradable: 0 };
    const rewards = s.stats.earnedBy.reward;
    let now = T0 + 10;
    for (let i = 0; i < 300; i++) {
      s.energy = 100;
      s = dispatch(s, { type: "diveStart", stake: 500 }, now).state;
      now += Math.ceil(diveTimeFor(2)) + 10;
      const r = dispatch(s, { type: "diveCashout" }, now);
      s = r.state;
      if (s.lastWin) s = dispatch(s, { type: "flip" }, now + 1).state;
      s.lastWin = null;
      now += 3000;
    }
    // Only rewards (milestones, streaks) may add tradable SHELL; the tables add none.
    expect(s.tradable).toBeLessThanOrEqual(s.stats.earnedBy.reward - rewards);
  });
  it("a flip stakes only the tradable part of the win", () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = { ...fresh(), seed, shell: 1000, tradable: 400, lastWin: { amount: 400, flips: 0, source: "dive", tradableShare: 0.5 } };
      const r = dispatch(s, { type: "flip" }, T0 + 10);
      expect(r.state.tradable).toBe(r.data!.won ? 600 : 200);
    }
  });
  it("voyage hoards and shares count only the tradable part of the voyage cost", () => {
    const s = { ...fresh(), shell: 50_000, tradable: 0, level: 20, story: VOYAGE_CHAPTER };
    s.inv.bread = 20;
    const sailing = dispatch(s, { type: "voyageStart", id: "trench" }, T0 + 10).state;
    for (let seed = 1; seed < 80; seed++) {
      const back = dispatch({ ...sailing, seed }, { type: "voyageClaim" }, sailing.voyage!.endsAt + 1).state;
      expect(back.tradable).toBe(back.stats.earnedBy.reward - sailing.stats.earnedBy.reward); // the next day's streak only
    }
    const held = { ...fresh(), shell: 0, tradable: 0 };
    held.stocks.FINX = 2;
    expect(dispatch(held, { type: "sellStock", id: "FINX", milli: 2000 }, T0 + 10).state.tradable).toBe(0);
    held.tradableStocks.FINX = 2;
    const sold = dispatch(held, { type: "sellStock", id: "FINX", milli: 2000 }, T0 + 10).state;
    expect(sold.tradable).toBe(sold.shell);
  });
});
