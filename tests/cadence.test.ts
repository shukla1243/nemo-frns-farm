import { describe, expect, it } from "vitest";
import { createState, dayNumber, dispatch, type GameState } from "../src/engine";

const T0 = 1_800_000_000_000;
const FAR = T0 + 1e12;
const fresh = (over: Partial<GameState> = {}): GameState => ({
  ...createState({ friendId: "42", name: "Friend #42", family: 0, guest: false, now: T0, seed: 7 }),
  streak: { day: dayNumber(T0), count: 1 }, hunger: 100, mood: 100, energy: 40,
  nextEventAt: FAR, nextRivalRaidAt: FAR, nextTideAt: FAR, ...over,
});
/** Tick from T0 to `end` every `every` ms (and once at `end`). */
function ticked(s: GameState, every: number, end: number) {
  for (let t = T0 + every; t < end; t += every) s = dispatch(s, { type: "tick" }, t).state;
  return dispatch(s, { type: "tick" }, end).state;
}

describe("time does not depend on how often the server is called", () => {
  for (const minutes of [0.5, 3, 30, 240]) {
    it(`calls more than 60 s apart gain nothing over syncing every 20 s (${minutes} min)`, () => {
      const end = T0 + minutes * 60_000;
      const every20 = ticked(fresh(), 20_000, end);
      for (const spacing of [61_000, 150_000, minutes * 60_000]) {
        const sparse = ticked(fresh(), spacing, end);
        expect(sparse.hunger).toBeCloseTo(every20.hunger, 6);
        expect(sparse.mood).toBeCloseTo(every20.mood, 6);
        expect(sparse.energy).toBeCloseTo(every20.energy, 6);
        expect(sparse.shell).toBe(every20.shell);
      }
    });
  }

  it("only the time beyond a minute after the last action counts as away", () => {
    const s = fresh({ hunger: 100 });
    const away = dispatch(s, { type: "tick" }, T0 + 24 * 3_600_000).state;
    expect(away.hunger).toBeGreaterThanOrEqual(50); // away time never drains a need below half
    const busy = dispatch({ ...s, lastActive: T0 + 24 * 3_600_000 }, { type: "tick" }, T0 + 24 * 3_600_000).state;
    expect(busy.hunger).toBe(0); // an active Friend gets no away discount
  });

  it("a due world event rolls even after a long absence", () => {
    const r = dispatch(fresh({ nextEventAt: T0 + 1_000 }), { type: "tick" }, T0 + 2 * 3_600_000);
    expect(r.state.event).not.toBeNull();
    expect(r.state.nextEventAt).toBeGreaterThan(T0 + 2 * 3_600_000);
  });

  it("a due rival raid rolls even after a long absence", () => {
    const s = fresh({ nextRivalRaidAt: T0 + 1_000, shell: 5_000 });
    s.zones.harbor = true;
    const r = dispatch(s, { type: "tick" }, T0 + 2 * 3_600_000).state;
    expect(r.stats.defended + r.stats.raidedBy).toBe(1);
  });
});
