import { describe, expect, it } from "vitest";
import { CRAB, VOYAGE_CHAPTER, createState, dayNumber, dispatch, exportSave, importSave, type GameState } from "../src/engine";
import { pauseRound, resumeRound, type Round } from "../src/ui/crabRound";

const T0 = 1_800_000_000_000;
const fresh = (over: Partial<GameState> = {}): GameState => ({ ...createState({ friendId: "42", name: "Friend #42", family: 0, guest: false, now: T0, seed: 7 }), streak: { day: dayNumber(T0), count: 1 }, ...over });
const END = T0 + CRAB.roundMs;

function started(over: Partial<GameState> = {}) {
  const r = dispatch(fresh(over), { type: "crabStart" }, T0);
  expect(r.ok).toBe(true);
  return r.state;
}

describe("crab dash", () => {
  it("costs energy, records the start and blocks other games", () => {
    const s = fresh();
    const r = dispatch(s, { type: "crabStart" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.energy).toBe(s.energy - CRAB.energy);
    expect(r.state.run).toEqual({ kind: "crab", startedAt: T0 });
    expect(dispatch(r.state, { type: "fishCast" }, T0 + 10).ok).toBe(false);
    expect(dispatch(r.state, { type: "crabStart" }, T0 + 10).ok).toBe(false);
  });
  it("needs energy, an awake Friend and no voyage", () => {
    expect(dispatch(fresh({ energy: CRAB.energy - 1 }), { type: "crabStart" }, T0).ok).toBe(false);
    expect(dispatch(fresh({ sleeping: { startedAt: T0, until: T0 + 1000 } }), { type: "crabStart" }, T0).ok).toBe(false);
    const away = dispatch(fresh({ story: VOYAGE_CHAPTER }), { type: "voyageStart", id: "scout" }, T0);
    expect(away.ok).toBe(true);
    expect(dispatch(away.state, { type: "crabStart" }, T0 + 1000).ok).toBe(false);
  });
  it("rejects a finish without a run or before the round could end", () => {
    expect(dispatch(fresh(), { type: "crabFinish", score: 10 }, END).ok).toBe(false);
    const s = started();
    const early = dispatch(s, { type: "crabFinish", score: 50 }, END - CRAB.finishGraceMs - 1);
    expect(early.ok).toBe(false);
    expect(early.state.run?.kind).toBe("crab");
    expect(early.state.shell).toBe(s.shell);
    expect(dispatch(s, { type: "crabFinish", score: 50 }, END - CRAB.finishGraceMs).ok).toBe(true);
  });
  it("pays SHELL and XP per point and never RF", () => {
    const s = started();
    const r = dispatch(s, { type: "crabFinish", score: 40 }, END);
    expect(r.ok).toBe(true);
    expect(r.state.run).toBeNull();
    expect(r.state.shell - s.shell).toBe(40 * CRAB.shellPerPoint);
    expect(r.data).toMatchObject({ score: 40, shell: 120, xp: 15, best: true });
    expect(r.state.rf).toBe(s.rf);
    expect(r.state.stats.rfWon).toBe(0);
    expect(r.state.inv.bait).toBe(s.inv.bait);
    expect(r.state.inv.pearl).toBe(s.inv.pearl);
  });
  it("clamps the score and adds bait at 60 and a pearl at 100", () => {
    const high = dispatch(started(), { type: "crabFinish", score: 9999 }, END);
    expect(high.data!.score).toBe(CRAB.maxScore);
    expect(high.data!.shell).toBe(CRAB.maxScore * CRAB.shellPerPoint);
    expect(high.state.inv.bait - fresh().inv.bait).toBe(1);
    expect(high.state.inv.pearl).toBe(1);
    const mid = dispatch(started(), { type: "crabFinish", score: 60.9 }, END);
    expect(mid.data!.score).toBe(60);
    expect(mid.state.inv.bait - fresh().inv.bait).toBe(1);
    expect(mid.state.inv.pearl).toBe(0);
    for (const score of [-5, Number.NaN]) {
      const low = dispatch(started(), { type: "crabFinish", score }, END);
      expect(low.data!.score).toBe(0);
      expect(low.data!.shell).toBe(0);
    }
  });
  it("tracks runs and the personal best", () => {
    let s = dispatch(started(), { type: "crabFinish", score: 30 }, END).state;
    s = dispatch(s, { type: "crabStart" }, END + 1000).state;
    const worse = dispatch(s, { type: "crabFinish", score: 20 }, END + 1000 + CRAB.roundMs);
    expect(worse.data!.best).toBe(false);
    expect(worse.state.stats.crabBest).toBe(30);
    expect(worse.state.stats.crabRuns).toBe(2);
  });
  it("leaving early forfeits the round without a reward", () => {
    const s = started();
    const r = dispatch(s, { type: "crabQuit" }, T0 + 1000);
    expect(r.ok).toBe(true);
    expect(r.state.run).toBeNull();
    expect(r.state.shell).toBe(s.shell);
    expect(r.state.stats.crabRuns).toBe(0);
    expect(dispatch(r.state, { type: "crabQuit" }, T0 + 2000).ok).toBe(false);
  });
  it("old saves gain crab stats and never resume a round", () => {
    const s = started();
    const old = structuredClone(s) as unknown as { stats: Record<string, number> };
    delete old.stats.crabRuns; delete old.stats.crabBest;
    const loaded = importSave(exportSave(old as unknown as GameState), "42");
    expect(loaded.stats.crabRuns).toBe(0);
    expect(loaded.stats.crabBest).toBe(0);
    expect(loaded.run).toBeNull();
  });
});

describe("crab dash pause", () => {
  it("a hidden tab freezes the round: every timer moves on by the time spent away", () => {
    const g: Round = { endAt: 10_000, nextPop: 500, holes: [{ kind: "crab", born: 100, until: 900 }, null], score: 3, mult: 2, streak: 1, floaters: [{ x: 0, y: 0, text: "+1", color: "#fff", born: 200 }], shakeUntil: 300, over: false };
    pauseRound(g, 4_000, 400);
    expect(g.pausedAt).toEqual({ wall: 4_000, perf: 400 });
    resumeRound(g, 64_000, 60_400);
    expect(g.pausedAt).toBeNull();
    expect(g.endAt).toBe(70_000);
    expect(g.nextPop).toBe(60_500);
    expect(g.holes[0]).toEqual({ kind: "crab", born: 60_100, until: 60_900 });
    expect(g.floaters[0].born).toBe(60_200);
    expect(g.shakeUntil).toBe(60_300);
    expect(g.score).toBe(3);
  });
  it("resuming a round that was never paused changes nothing", () => {
    const g: Round = { endAt: 10_000, nextPop: 500, holes: [], score: 0, mult: 1, streak: 0, floaters: [], shakeUntil: 0, over: false };
    resumeRound(g, 64_000, 60_400);
    expect(g.endAt).toBe(10_000);
  });
});
