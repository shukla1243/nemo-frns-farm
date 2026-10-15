import { describe, expect, it } from "vitest";
import { FISH_REEL, createState, dayNumber, dispatch, markerAt, type GameState } from "../src/engine";

const T0 = 1_800_000_000_000;
type Run = { kind: "fish"; zone: number; zoneStart: number; speed: number; biteAt: number };
const fresh = (seed = 7): GameState => ({ ...createState({ friendId: "42", name: "Friend #42", family: 0, guest: false, now: T0, seed }), streak: { day: dayNumber(T0), count: 1 }, hunger: 100 });
const cast = (seed = 7) => { const r = dispatch(fresh(seed), { type: "fishCast" }, T0); return { state: r.state, run: r.state.run as unknown as Run }; };
const inZone = (run: Run, t: number) => { const m = markerAt(run, t); return m >= run.zoneStart && m <= run.zoneStart + run.zone; };
/** A server time at which every moment of the judged lag window has the marker in (or out of) the zone. */
function reelTime(run: Run, wanted: boolean) {
  for (let now = run.biteAt + FISH_REEL.lagMaxMs; now < run.biteAt + FISH_REEL.windowMs; now += 5) {
    let all = true;
    for (let t = now - FISH_REEL.lagMaxMs; t <= now - FISH_REEL.lagMinMs; t += 5) if (inZone(run, t) !== wanted) { all = false; break; }
    if (all) return now;
  }
  throw new Error("no such time");
}

describe("fishing on server time", () => {
  it("the cast rolls the green zone and the bite on the server", () => {
    const { run, state } = cast();
    expect(state.inv.bait).toBe(4);
    expect(run.zoneStart).toBeGreaterThanOrEqual(0);
    expect(run.zoneStart + run.zone).toBeLessThanOrEqual(1);
    expect(run.biteAt).toBeGreaterThanOrEqual(T0 + FISH_REEL.biteMinMs);
    expect(run.biteAt).toBeLessThanOrEqual(T0 + FISH_REEL.biteMinMs + FISH_REEL.biteSpreadMs);
    expect(run.speed).toBeGreaterThan(0);
  });

  it("a reel while the hook is in the green lands the fish", () => {
    const { run, state } = cast();
    const r = dispatch(state, { type: "fishReel" }, reelTime(run, true));
    expect(r.data!.caught).toBe(true);
    expect(r.state.stats.fish).toBe(1);
    expect(r.events.find(e => /Caught/.test(e.text))?.quiet).toBe(true);
  });

  it("a reel while the hook is outside the green misses", () => {
    const { run, state } = cast();
    const r = dispatch(state, { type: "fishReel" }, reelTime(run, false));
    expect(r.data!.caught).toBe(false);
    expect(r.state.stats.fish).toBe(0);
  });

  it("too early or too late misses", () => {
    const { run, state } = cast();
    expect(dispatch(state, { type: "fishReel" }, run.biteAt - 300).data!.caught).toBe(false);
    expect(dispatch(state, { type: "fishReel" }, run.biteAt + FISH_REEL.windowMs + FISH_REEL.lagMaxMs + 1).data!.caught).toBe(false);
  });

  it("the client has no say: a hit flag is ignored and reeling at random times often misses", () => {
    let hits = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const { run, state } = cast(1000 + i);
      const at = run.biteAt + FISH_REEL.lagMaxMs + ((i * 7919) % (FISH_REEL.windowMs - FISH_REEL.lagMaxMs));
      if (dispatch(state, { type: "fishReel", hit: true } as never, at).data!.caught) hits++;
    }
    expect(hits / N).toBeLessThan(0.75);
    expect(hits / N).toBeGreaterThan(0.2);
  });
});
