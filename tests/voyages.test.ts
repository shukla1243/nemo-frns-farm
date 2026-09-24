import { describe, expect, it } from "vitest";
import { RF, createRng, createState, dayNumber, dispatch, type GameState } from "../src/engine";
import { STOCK_SELL_FEE, VOYAGES, rollVoyage, stockPrice, voyageBonus, voyageOdds } from "../src/engine/voyages";

const T0 = Date.UTC(2026, 8, 24, 12);
const fresh = (): GameState => {
  const s = createState({ friendId: "7", name: "Friend #7", family: 2, guest: false, now: T0, seed: 99 });
  s.streak = { day: dayNumber(T0), count: 1 };
  s.level = 15; s.rf = 50 * RF; s.shell = 5000; s.hunger = 100; s.energy = 100;
  s.inv.bread = 20;
  return s;
};

describe("voyages", () => {
  it("start pays costs and food, blocks other activities, and pays out on claim", () => {
    const s = fresh();
    const r = dispatch(s, { type: "voyageStart", id: "scout" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.shell).toBe(s.shell - 30);
    expect(r.state.inv.bread).toBe(19);
    expect(r.state.voyage?.endsAt).toBe(T0 + 15 * 60_000);
    expect(dispatch(r.state, { type: "gather", kind: "chop" }, T0 + 1000).ok).toBe(false);
    expect(dispatch(r.state, { type: "voyageStart", id: "scout" }, T0 + 1000).ok).toBe(false);
    expect(dispatch(r.state, { type: "voyageClaim" }, T0 + 60_000).ok).toBe(false);
    const c = dispatch(r.state, { type: "voyageClaim" }, T0 + 15 * 60_000);
    expect(c.ok).toBe(true);
    expect(c.state.voyage).toBeNull();
    expect(c.state.stats.voyages).toBe(1);
  });
  it("the outcome is fixed at departure (reloading cannot reroll it)", () => {
    const s = fresh();
    const a = dispatch(s, { type: "voyageStart", id: "reef" }, T0).state;
    const b = dispatch(s, { type: "voyageStart", id: "reef" }, T0).state;
    expect(a.voyage?.result).toEqual(b.voyage?.result);
  });
  it("recall ends the voyage early with nothing and costs mood", () => {
    const s = fresh();
    const r = dispatch(s, { type: "voyageStart", id: "homeland" }, T0).state;
    const back = dispatch(r, { type: "voyageRecall" }, T0 + 60_000);
    expect(back.ok).toBe(true);
    expect(back.state.voyage).toBeNull();
    expect(back.state.mood).toBeLessThan(r.mood);
  });
  it("respects level, hunger and food requirements", () => {
    const s = fresh(); s.level = 2;
    expect(dispatch(s, { type: "voyageStart", id: "trench" }, T0).ok).toBe(false);
    const h = fresh(); h.hunger = 20;
    expect(dispatch(h, { type: "voyageStart", id: "scout" }, T0).ok).toBe(false);
    const f = fresh(); f.inv.bread = 0;
    for (const k of Object.keys(f.inv) as (keyof typeof f.inv)[]) if (["sardine", "kelp", "carrot", "coconut", "clownfish", "berry", "tuna", "sushi", "pumpkin", "angler", "stew", "pie"].includes(k)) f.inv[k] = 0;
    expect(dispatch(f, { type: "voyageStart", id: "scout" }, T0).ok).toBe(false);
  });
  it("odds always sum to the same total and the bonus is capped", () => {
    const s = fresh(); s.level = 99; s.rebirths = 20; s.mood = 100;
    expect(voyageBonus(s)).toBe(10);
    for (const v of VOYAGES) {
      const base = v.outcomes.reduce((n, o) => n + o.weight, 0);
      const odds = voyageOdds(s, v).reduce((n, o) => n + o.weight, 0);
      expect(odds).toBeCloseTo(base, 6);
      expect(voyageOdds(s, v).every(o => o.weight >= 0)).toBe(true);
    }
  });
  it("RF voyages lose RF on average even at the maximum bonus (a real sink)", () => {
    const s = fresh(); s.level = 99; s.rebirths = 20; s.mood = 100;
    for (const v of VOYAGES.filter(x => x.costRf > 0)) {
      const rng = createRng(1234);
      let rf = 0;
      const n = 20_000;
      for (let i = 0; i < n; i++) rf += rollVoyage(s, v, rng).rf;
      expect(rf / n).toBeLessThan(v.costRf);
    }
  });
  it("stock prices are deterministic per hour and selling charges the fee", () => {
    expect(stockPrice("NVDA", T0)).toBe(stockPrice("NVDA", T0 + 60_000));
    const s = fresh(); s.stocks.NVDA = 1.5;
    const r = dispatch(s, { type: "sellStock", id: "NVDA", shares: 1 }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.stocks.NVDA).toBe(0.5);
    expect(r.state.shell - s.shell).toBeLessThanOrEqual(Math.ceil(stockPrice("NVDA", T0) * (1 - STOCK_SELL_FEE) * 1.5));
    expect(dispatch(s, { type: "sellStock", id: "TSLA", shares: 1 }, T0).ok).toBe(false);
  });
});
