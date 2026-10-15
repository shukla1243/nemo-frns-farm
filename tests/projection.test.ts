import { describe, expect, it } from "vitest";
import { createState, dispatch } from "../src/engine";
import { project } from "../src/game/projection";

const T0 = Date.UTC(2026, 9, 16, 9);

describe("display projection", () => {
  const base = dispatch(createState({ friendId: "1", name: "Friend #1", family: 0, guest: false, now: T0, seed: 5 }), { type: "tick" }, T0).state;

  it("advances needs and the clock without touching the stored state", () => {
    const p = project(base, T0 + 30_000);
    expect(p.lastTick).toBe(T0 + 30_000);
    expect(p.hunger).toBeLessThan(base.hunger);
    expect(base.lastTick).toBe(T0);
  });

  it("never rolls the server's random world events, tide or raids", () => {
    const p = project({ ...base, nextEventAt: T0 + 1, nextTideAt: T0 + 1, nextRivalRaidAt: T0 + 1 }, T0 + 30_000);
    expect(p.event).toBeNull();
    expect(p.marketTide).toBe(base.marketTide);
    expect(p.nextEventAt).toBe(T0 + 1);
    expect(p.log).toBe(base.log);
    expect(p.seed).toBe(base.seed);
  });
});
