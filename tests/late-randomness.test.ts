/**
 * Storage must hold no hidden outcome: the owning player can read raw state. Every chance roll happens
 * at the moment the outcome is revealed, with the same odds as a pre-rolled outcome.
 */
import { describe, expect, it } from "vitest";
import { DIVE, MINES, VOYAGE_CHAPTER, createRng, createState, dayNumber, diveEdge, diveMultiplierAt, diveTimeFor, dispatch, type GameState } from "../src/engine";
import { VOYAGES, rollVoyage, voyageOdds } from "../src/engine/voyages";

const T0 = Date.UTC(2026, 9, 13, 12);
const fresh = (seed = 99): GameState => {
  const s = createState({ friendId: "7", name: "Friend #7", family: 0, guest: false, now: T0, seed });
  s.streak = { day: dayNumber(T0), count: 1 };
  s.shell = 100_000; s.hunger = 100; s.energy = 100; s.zones.abyss = true; s.zones.mines = true;
  return s;
};

describe("Abyss Dive rolls at cash-out", () => {
  it("stores no crash point", () => {
    const r = dispatch(fresh(), { type: "diveStart", stake: 100 }, T0);
    expect(r.ok).toBe(true);
    expect(Object.keys(r.state.run!).sort()).toEqual(["kind", "stake", "startedAt", "tStake"]);
  });
  it("survival at multiplier m is (1 - edge) / m", () => {
    const N = 20_000;
    const ms = diveTimeFor(2) + 50;
    const m = diveMultiplierAt(ms);
    let wins = 0;
    const base = fresh();
    const started = dispatch(base, { type: "diveStart", stake: 100 }, T0).state;
    for (let i = 0; i < N; i++) {
      const r = dispatch({ ...started, seed: i + 1 }, { type: "diveCashout" }, T0 + ms);
      if (!r.data!.crashed) wins++;
      else expect(r.data!.crashAt as number).toBeLessThanOrEqual(m);
    }
    expect(Math.abs(wins / N - (1 - diveEdge(base)) / m)).toBeLessThan(0.015);
  });
  it("a win pays stake x multiplier", () => {
    const started = dispatch(fresh(), { type: "diveStart", stake: 100 }, T0).state;
    for (let seed = 1; seed < 30; seed++) {
      const r = dispatch({ ...started, seed }, { type: "diveCashout" }, T0 + 1500);
      const m = diveMultiplierAt(1500);
      expect(r.state.shell).toBe(r.data!.crashed ? started.shell : started.shell + Math.floor(100 * m));
    }
  });
  it("the client-timed crash action is gone", () => {
    const started = dispatch(fresh(), { type: "diveStart", stake: 100 }, T0).state;
    expect(dispatch(started, { type: "diveCrash" } as never, T0 + 10).ok).toBe(false);
    expect(DIVE.edge).toBeGreaterThan(0);
  });
});

describe("Tide Mines rolls on each reveal", () => {
  it("stores no trap layout", () => {
    const r = dispatch(fresh(), { type: "minesStart", stake: 100, traps: 5 }, T0);
    expect(r.ok).toBe(true);
    expect("traps" in r.state.run!).toBe(false);
  });
  it("each reveal is a trap with probability traps / tiles left", () => {
    const N = 20_000;
    const started = dispatch(fresh(), { type: "minesStart", stake: 100, traps: 5 }, T0).state;
    let first = 0, second = 0, secondTries = 0;
    for (let i = 0; i < N; i++) {
      const r = dispatch({ ...started, seed: i + 1 }, { type: "minesReveal", index: 0 }, T0 + 10);
      if (r.data!.trap) { first++; continue; }
      secondTries++;
      if (dispatch(r.state, { type: "minesReveal", index: 1 }, T0 + 20).data!.trap) second++;
    }
    expect(Math.abs(first / N - 5 / MINES.size)).toBeLessThan(0.01);
    expect(Math.abs(second / secondTries - 5 / (MINES.size - 1))).toBeLessThan(0.012);
  });
  it("the revealed trap layout shows the hit tile and the full trap count", () => {
    const started = dispatch(fresh(), { type: "minesStart", stake: 100, traps: 3 }, T0).state;
    for (let seed = 1; seed < 200; seed++) {
      const r = dispatch({ ...started, seed }, { type: "minesReveal", index: 7 }, T0 + 10);
      if (!r.data!.trap) continue;
      const traps = r.data!.traps as number[];
      expect(traps).toContain(7);
      expect(new Set(traps).size).toBe(3);
      return;
    }
    throw new Error("no trap in 200 seeds");
  });
  it("the Hollow Belly safe hint is never a trap", () => {
    const s = createState({ friendId: "7", name: "x", family: 8, guest: false, now: T0, seed: 3 });
    s.streak = { day: dayNumber(T0), count: 1 }; s.shell = 10_000; s.energy = 100; s.hunger = 100; s.zones.mines = true;
    const started = dispatch(s, { type: "minesStart", stake: 100, traps: 20 }, T0).state;
    const hint = (started.run as { safeHint: number | null }).safeHint!;
    expect(hint).not.toBeNull();
    for (let seed = 1; seed < 300; seed++) expect(dispatch({ ...started, seed }, { type: "minesReveal", index: hint }, T0 + 10).data!.trap).toBe(false);
  });
});

describe("voyages roll at claim", () => {
  const sailing = () => {
    const s = fresh(); s.level = 15; s.story = VOYAGE_CHAPTER; s.inv.bread = 20; s.achievements.push("lvl10");
    return dispatch(s, { type: "voyageStart", id: "trench" }, T0).state;
  };
  it("stores the odds at departure, not the outcome", () => {
    const v = sailing().voyage!;
    expect("result" in v).toBe(false);
    expect(v.odds).toHaveLength(VOYAGES.find(x => x.id === "trench")!.outcomes.length);
  });
  it("outcomes follow the stored odds within 1% over 200k rolls", () => {
    const v = VOYAGES.find(x => x.id === "trench")!;
    const odds = voyageOdds(sailing(), v).map(o => o.weight);
    const total = odds.reduce((a, b) => a + b, 0);
    const rng = createRng(42);
    const counts = new Map<string, number>();
    const N = 200_000;
    for (let i = 0; i < N; i++) { const r = rollVoyage(v, odds, rng); counts.set(r.outcome, (counts.get(r.outcome) ?? 0) + 1); }
    v.outcomes.forEach((o, i) => expect(Math.abs((counts.get(o.id) ?? 0) / N - odds[i] / total)).toBeLessThan(0.01));
  });
  it("odds are locked at departure: a later bonus does not change them", () => {
    const s = sailing();
    const before = [...s.voyage!.odds];
    s.level = 40; s.rebirths = 5;
    expect(s.voyage!.odds).toEqual(before);
    const r = dispatch(s, { type: "voyageClaim" }, s.voyage!.endsAt + 1);
    expect(r.ok).toBe(true);
    expect(r.state.voyage).toBeNull();
  });
});
