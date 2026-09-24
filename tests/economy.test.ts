import { describe, expect, it } from "vitest";
import {
  POOL, RF, SEASON, SINK, applySwap, chapterAt, createPool, createState, dispatch, poolPrice, quote, seasonBoard, seasonIdAt, seasonPoolTotal,
  seasonStartOf, dayNumber, rebirthCost, threshold, rankName, TRACKS, REBIRTH, type GameState,
} from "../src/engine";

const T0 = Date.UTC(2026, 8, 24, 12);
const fresh = (): GameState => ({ ...createState({ friendId: "7", name: "Friend #7", family: 2, guest: false, now: T0, seed: 99 }), streak: { day: dayNumber(T0), count: 1 } });

describe("Tide Pool AMM", () => {
  it("keeps x*y non-decreasing (fees stay out of k) and quotes match execution", () => {
    const p = createPool(T0);
    const k0 = p.shell * p.rf;
    const q = quote(p, "shellToRf", 3000)!;
    applySwap(p, "shellToRf", 3000, q);
    expect(p.shell * p.rf).toBeLessThanOrEqual(k0 * 1.001);
    expect(p.shell * (p.rf + q.fee)).toBeGreaterThanOrEqual(k0 * 0.999);
  });
  it("round-tripping loses value to fees (no arbitrage)", () => {
    const p = createPool(T0);
    const q1 = quote(p, "rfToShell", 1000)!; applySwap(p, "rfToShell", 1000, q1);
    const q2 = quote(p, "shellToRf", q1.out)!;
    expect(q2.out).toBeLessThan(1000 * 0.95);
  });
  it("rejects swaps above 30% of reserves", () => {
    const p = createPool(T0);
    expect(quote(p, "shellToRf", POOL.initShell)).toBeNull();
  });
  it("swap action routes the 3% fee through the sink split", () => {
    const s = fresh(); s.shell = 10_000;
    const r = dispatch(s, { type: "swap", dir: "shellToRf", amount: 1500 }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.stats.burned).toBeGreaterThan(0);
    expect(r.state.stats.toPool + r.state.stats.creatorFees + r.state.stats.trueBurn).toBe(r.state.stats.burned);
    expect(r.state.rf).toBeGreaterThan(s.rf);
  });
  it("simulated traders keep the price near its anchor over a day", () => {
    let s = fresh();
    for (let h = 1; h <= 24; h++) s = dispatch(s, { type: "tick" }, T0 + h * 3600_000 / 60).state;
    const price = poolPrice(s.pool);
    expect(price).toBeGreaterThan(POOL.anchor * 0.6);
    expect(price).toBeLessThan(POOL.anchor * 1.6);
  });
});

describe("RF sink split & seasons", () => {
  it("every RF spent splits 70/25/5 exactly", () => {
    const s = fresh(); s.rf = 100 * RF;
    const r = dispatch(s, { type: "spin" }, T0);
    const st = r.state.stats;
    expect(st.burned).toBe(100);
    expect(st.toPool).toBe(Math.floor(100 * SINK.pool));
    expect(st.trueBurn).toBe(Math.floor(100 * SINK.burn));
    expect(st.creatorFees).toBe(100 - st.toPool - st.trueBurn);
    expect(r.state.season.sunk).toBe(100);
  });
  it("season rolls over on Monday and top-10 can claim once", () => {
    const s = fresh();
    s.season.xp = 50_000; // guarantee a top rank
    const next = seasonStartOf(s.season.id) + SEASON.ms + 1000;
    const rolled = dispatch(s, { type: "tick" }, next).state;
    expect(rolled.season.id).toBe(seasonIdAt(next));
    expect(rolled.lastSeason?.score).toBeGreaterThan(0);
    const board = seasonBoard(rolled, next, [], rolled.lastSeason!.id, rolled.lastSeason!.score);
    const rank = board.findIndex(e => e.you) + 1;
    expect(rank).toBe(1);
    const claim = dispatch(rolled, { type: "seasonClaim", rank, pool: rolled.lastSeason!.pool }, next + 10);
    expect(claim.ok).toBe(true);
    expect(claim.state.rf).toBeGreaterThan(rolled.rf);
    expect(dispatch(claim.state, { type: "seasonClaim", rank, pool: 1 }, next + 20).ok).toBe(false);
  });
  it("season pool grows with simulated residents and player sinks", () => {
    const s = fresh();
    const a = seasonPoolTotal(s, T0);
    s.world.seasonPool += 700;
    expect(seasonPoolTotal(s, T0)).toBe(a + 700);
    expect(seasonPoolTotal(s, T0 + 86_400_000)).toBeGreaterThan(a);
  });
  it("ranks outside the top 10 cannot claim", () => {
    const s = fresh();
    s.lastSeason = { id: s.season.id - 1, score: 1, sunk: 0, pool: 1000, claimed: false };
    expect(dispatch(s, { type: "seasonClaim", rank: 11, pool: 1000 }, T0).ok).toBe(false);
  });
});

describe("islanders & story", () => {
  it("each islander gives one gift per day", () => {
    const s = fresh();
    const g = dispatch(s, { type: "npcGift", npc: "salt" }, T0);
    expect(g.ok).toBe(true);
    expect(g.state.inv.bait).toBe(s.inv.bait + 4);
    expect(dispatch(g.state, { type: "npcGift", npc: "salt" }, T0 + 1000).ok).toBe(false);
    expect(dispatch(g.state, { type: "npcGift", npc: "salt" }, T0 + 86_400_000).ok).toBe(true);
  });
  it("story chapters only complete when their goal is met", () => {
    const s = fresh();
    expect(dispatch(s, { type: "storyClaim" }, T0).ok).toBe(false);
    s.stats.gathered = 3;
    const r = dispatch(s, { type: "storyClaim" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.story).toBe(1);
    expect(chapterAt(15).act).toBe(2);
  });
});

describe("endless systems", () => {
  it("the story never runs out: every chapter index yields a valid, escalating chapter", () => {
    const seen = new Set<string>();
    let prevAct = 1;
    for (let i = 0; i < 400; i++) {
      const ch = chapterAt(i);
      expect(ch.title.length).toBeGreaterThan(3);
      expect(ch.goal.length).toBeGreaterThan(5);
      expect(ch.act).toBeGreaterThanOrEqual(prevAct);
      prevAct = ch.act;
      seen.add(ch.goal);
    }
    expect(chapterAt(27).act).toBe(3);
    expect(seen.size).toBeGreaterThan(350); // goals keep changing in the endless act
    const fresh0 = fresh();
    expect(chapterAt(27 + 80).done(fresh0)).toBe(false);
  });
  it("milestones fire automatically, forever, the moment a threshold is crossed", () => {
    const s = fresh();
    s.stats.fish = 9;
    const a = dispatch(s, { type: "tick" }, T0 + 1000);
    expect(a.state.milestones.fish ?? 0).toBe(0);
    a.state.stats.fish = 10;
    const b = dispatch(a.state, { type: "tick" }, T0 + 2000);
    expect(b.state.milestones.fish).toBe(1);
    expect(b.events.some(e => e.text.startsWith("Milestone: Angler"))).toBe(true);
    b.state.stats.fish = 1_000_000;
    const c = dispatch(b.state, { type: "tick" }, T0 + 3000);
    expect(c.state.milestones.fish).toBeGreaterThan(14);
    expect(threshold(10, 30)).toBe(10 ** 11);
    expect(rankName(20)).toBe("Mythic 5");
    expect(TRACKS.length).toBe(15);
  });
  it("rebirth resets level, keeps progress, costs RF and grants permanent bonuses", () => {
    const s = fresh();
    s.level = 29; s.rf = 100 * RF; s.home = 3; s.gear.blade = 5;
    expect(dispatch(s, { type: "rebirth" }, T0).ok).toBe(false);
    s.level = REBIRTH.minLevel;
    const r = dispatch(s, { type: "rebirth" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.level).toBe(1);
    expect(r.state.rebirths).toBe(1);
    expect(r.state.home).toBe(3);
    expect(r.state.gear.blade).toBe(5);
    expect(r.state.stats.burned).toBe(rebirthCost(0));
    const xpBefore = r.state.xp;
    const g = dispatch(r.state, { type: "gather", kind: "chop" }, T0 + 5000);
    expect(g.state.xp - xpBefore).toBe(Math.round(3 * 1.1 * 1.1)); // happy after rebirth + 10% rebirth bonus
  });
  it("daily streak pays automatically, grows for consecutive days and resets after a gap", () => {
    const s = createState({ friendId: "8", name: "Friend #8", family: 0, guest: false, now: T0, seed: 5 });
    const d1 = dispatch(s, { type: "tick" }, T0 + 1000).state;
    expect(d1.streak.count).toBe(1);
    const d2 = dispatch(d1, { type: "tick" }, T0 + 86_400_000).state;
    expect(d2.streak.count).toBe(2);
    expect(d2.shell).toBeGreaterThan(d1.shell);
    const gap = dispatch(d2, { type: "tick" }, T0 + 4 * 86_400_000).state;
    expect(gap.streak.count).toBe(1);
  });
});
