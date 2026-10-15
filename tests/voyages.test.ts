import { describe, expect, it } from "vitest";
import { VOYAGE_CHAPTER, createRng, createState, dayNumber, dispatch, type GameState } from "../src/engine";
import { STOCK_IDS, STOCK_SELL_FEE, VOYAGES, rollVoyage, stockPrice, voyageBonus, voyageOdds } from "../src/engine/voyages";

const T0 = Date.UTC(2026, 8, 24, 12);
const fresh = (): GameState => {
  const s = createState({ friendId: "7", name: "Friend #7", family: 2, guest: false, now: T0, seed: 99 });
  s.streak = { day: dayNumber(T0), count: 1 };
  s.level = 15; s.shell = 5000; s.hunger = 100; s.energy = 100;
  s.inv.bread = 20; s.story = VOYAGE_CHAPTER;
  s.achievements.push("lvl10"); // its SHELL reward would blur balance checks
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
  it("the odds are fixed at departure", () => {
    const s = fresh();
    const a = dispatch(s, { type: "voyageStart", id: "reef" }, T0).state;
    expect(a.voyage?.odds).toEqual(voyageOdds(s, VOYAGES.find(v => v.id === "reef")!).map(o => o.weight));
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
  it("long voyages return less SHELL than they cost, even at the maximum bonus (a real sink)", () => {
    const s = fresh(); s.level = 99; s.rebirths = 20; s.mood = 100;
    for (const v of VOYAGES.filter(x => x.id !== "scout")) { // the Tide Scout is the small safe trip
      const rng = createRng(1234);
      let shell = 0;
      const n = 20_000;
      const odds = voyageOdds(s, v).map(o => o.weight);
      for (let i = 0; i < n; i++) shell += rollVoyage(v, odds, rng).shell;
      expect(shell / n).toBeLessThan(v.costShell);
    }
  });
  it("stock prices are deterministic per hour and selling charges the fee", () => {
    expect(stockPrice("FINX", T0)).toBe(stockPrice("FINX", T0 + 60_000));
    const s = fresh(); s.stocks.FINX = 1.5;
    const r = dispatch(s, { type: "sellStock", id: "FINX", shares: 1 }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.stocks.FINX).toBe(0.5);
    expect(r.state.shell - s.shell).toBeLessThanOrEqual(Math.ceil(stockPrice("FINX", T0) * (1 - STOCK_SELL_FEE) * 1.5));
    expect(dispatch(s, { type: "sellStock", id: "URCH", shares: 1 }, T0).ok).toBe(false);
  });
  it("lists only fictional NEMO island companies", () => {
    expect(STOCK_IDS).toEqual(["FINX", "URCH", "CLAM", "KRLL", "KELP", "GULL", "DUBL"]);
    expect(VOYAGES.find(v => v.id === "reef")!.name).toBe("Shipwreck Salvage Run");
  });
  it("the full-share outcome always pays one FINX share", () => {
    const reef = VOYAGES.find(v => v.id === "reef")!;
    const only = { ...reef, outcomes: reef.outcomes.filter(o => o.id === "fullshare") };
    expect(only.outcomes).toHaveLength(1);
    expect(rollVoyage(only, [1], createRng(5)).stock).toEqual({ id: "FINX", shares: 1 });
  });
});
