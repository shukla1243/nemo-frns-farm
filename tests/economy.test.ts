import { describe, expect, it } from "vitest";
import {
  SEASON, chapterAt, createState, dispatch, seasonBoard, seasonIdAt, seasonScore,
  seasonStartOf, dayNumber, rebirthCost, threshold, rankName, TRACKS, REBIRTH, type GameState,
} from "../src/engine";

const T0 = Date.UTC(2026, 8, 24, 12);
const fresh = (): GameState => ({ ...createState({ friendId: "7", name: "Friend #7", family: 2, guest: false, now: T0, seed: 99 }), streak: { day: dayNumber(T0), count: 1 } });

describe("seasons", () => {
  it("season rolls over on Monday and records last season's score", () => {
    const s = fresh();
    s.season.xp = 50_000; // guarantee a top rank
    const next = seasonStartOf(s.season.id) + SEASON.ms + 1000;
    const rolled = dispatch(s, { type: "tick" }, next).state;
    expect(rolled.season.id).toBe(seasonIdAt(next));
    expect(rolled.season.pass).toBe(0);
    expect(rolled.lastSeason?.score).toBeGreaterThan(0);
    const board = seasonBoard(rolled, next, rolled.lastSeason!.id, rolled.lastSeason!.score);
    expect(board.findIndex(e => e.you) + 1).toBe(1);
  });
  it("season score counts SHELL spent at 7.5 SHELL per point", () => {
    const s = fresh(); s.shell = 10_000;
    const r = dispatch(s, { type: "buy", item: "charm" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.season.sunk).toBe(225);
    expect(seasonScore(r.state) - seasonScore(s)).toBe(30);
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
  it("rebirth resets level, keeps progress, costs SHELL and grants permanent bonuses", () => {
    const s = fresh();
    s.level = 29; s.shell = 20_000; s.home = 3; s.gear.blade = 5;
    expect(dispatch(s, { type: "rebirth" }, T0).ok).toBe(false);
    s.level = REBIRTH.minLevel;
    const r = dispatch(s, { type: "rebirth" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.level).toBe(1);
    expect(r.state.rebirths).toBe(1);
    expect(r.state.home).toBe(3);
    expect(r.state.gear.blade).toBe(5);
    expect(r.state.stats.shellSunk).toBe(rebirthCost(0));
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
