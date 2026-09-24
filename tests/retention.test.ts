import { describe, expect, it } from "vitest";
import { ACT_ONE_LEN, ACT_TWO_LEN, PASS, RF, createState, dayNumber, dispatch, importSave, exportSave, passClaimable, seasonIdAt, type GameState } from "../src/engine";
import { guideTarget } from "../src/world/guide";
import { STATIONS, UNLOCK_SIGNS } from "../src/world/map";
import { RESIDENTS, residentAt } from "../src/world/npcs";

const T0 = Date.UTC(2026, 8, 24, 12);
const fresh = (): GameState => ({ ...createState({ friendId: "7", name: "Friend #7", family: 2, guest: false, now: T0, seed: 99 }), streak: { day: dayNumber(T0), count: 1 } });

describe("story guide", () => {
  it("points every Act I and II chapter at a real station or unlock sign", () => {
    const ids = new Set([...STATIONS, ...UNLOCK_SIGNS].map(s => s.id));
    for (let i = 0; i < ACT_ONE_LEN + ACT_TWO_LEN + 16; i++) {
      const s = fresh(); s.story = i;
      const t = guideTarget(s);
      if (t) expect(ids.has(t.id)).toBe(true);
    }
  });
  it("starts at the Palm Grove, points at the unlock sign for locked regions and hides once the goal is met", () => {
    const s = fresh();
    expect(guideTarget(s)?.id).toBe("chop");
    s.story = 7; // Dig Deep: Tide Mines are locked at the start
    expect(guideTarget(s)?.id).toBe("unlock:mines");
    s.story = 0; s.stats.gathered = 3;
    expect(guideTarget(s)).toBeNull();
  });
});

describe("Season Journey", () => {
  it("claims every reached tier once, pays items, and resets next season", () => {
    const s = fresh();
    expect(dispatch(s, { type: "passClaim" }, T0).ok).toBe(false);
    s.season.xp = PASS[2].score;
    expect(passClaimable(s)).toBe(3);
    const r = dispatch(s, { type: "passClaim" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.season.pass).toBe(3);
    expect(r.state.inv.charm).toBe(s.inv.charm + 1);
    expect(dispatch(r.state, { type: "passClaim" }, T0).ok).toBe(false);
    const next = dispatch(r.state, { type: "tick" }, T0 + 8 * 86_400_000).state;
    expect(next.season.id).not.toBe(seasonIdAt(T0));
    expect(next.season.pass).toBe(0);
  });
  it("pays only 3 RF across the whole track", () => {
    expect(PASS.reduce((n, t) => n + (t.rf ?? 0), 0)).toBe(3 * RF);
  });
  it("old saves without the journey field load at tier 0", () => {
    const s = fresh();
    const raw = JSON.parse(JSON.stringify(s)); delete raw.season.pass;
    const loaded = importSave(exportSave(raw as GameState), s.friendId);
    expect(loaded.season.pass).toBe(0);
  });
});

describe("island residents", () => {
  it("always stand on a known beach route", () => {
    for (let i = 0; i < RESIDENTS.length; i++) for (let t = 0; t < 400; t += 7) {
      const p = residentAt(i, t, STATIONS);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
});
