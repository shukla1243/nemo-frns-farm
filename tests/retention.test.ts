import { describe, expect, it } from "vitest";
import { ACT_ONE_LEN, ACT_TWO_LEN, PASS, VOYAGE_CHAPTER, chapterAt, createState, dayNumber, dispatch, passClaimable, seasonIdAt, voyagesOpen, type GameState } from "../src/engine";
import { exportSave, importSave } from "../src/game/save";
import { guide } from "../src/world/guide";
import { STATIONS, UNLOCK_SIGNS } from "../src/world/map";
import { RESIDENTS, residentAt } from "../src/world/npcs";
import { welcomeBack } from "../src/ui/report";

const T0 = Date.UTC(2026, 8, 24, 12);
const fresh = (): GameState => ({ ...createState({ friendId: "7", name: "Friend #7", family: 2, guest: false, now: T0, seed: 99 }), streak: { day: dayNumber(T0), count: 1 } });

describe("story guide", () => {
  it("points every Act I and II chapter at a real station or unlock sign", () => {
    const ids = new Set([...STATIONS, ...UNLOCK_SIGNS].map(s => s.id));
    for (let i = 0; i < ACT_ONE_LEN + ACT_TWO_LEN + 16; i++) {
      const s = fresh(); s.story = i;
      const g = guide(s);
      if (g.kind === "goal") expect(ids.has(g.station.id)).toBe(true);
      else expect(g.kind).toBe("claim");
    }
  });
  it("starts at the Palm Grove, points at the unlock sign for locked regions and asks for a claim once the goal is met", () => {
    const s = fresh();
    expect(guide(s)).toMatchObject({ kind: "goal", station: { id: "chop" } });
    s.story = 7; // Dig Deep: Tide Mines are locked at the start
    expect(guide(s)).toMatchObject({ kind: "goal", station: { id: "unlock:mines" } });
    s.story = 0; s.stats.gathered = 3;
    expect(guide(s)).toEqual({ kind: "claim" });
  });
  it("A Roof Over Fins points at the chop, then the quarry, and at Home once 30 wood and 10 stone are in the bag", () => {
    const s = fresh(); s.story = 4; s.zones.cove = true; s.inv.wood = 0; s.inv.stone = 0;
    expect(guide(s)).toMatchObject({ kind: "goal", station: { id: "chop" } });
    s.inv.wood = 29;
    expect(guide(s)).toMatchObject({ kind: "goal", station: { id: "chop" } });
    s.inv.wood = 30;
    expect(guide(s)).toMatchObject({ kind: "goal", station: { id: "quarry" } });
    s.inv.stone = 10;
    expect(guide(s)).toMatchObject({ kind: "goal", station: { id: "home" } });
    s.zones.cove = false; s.inv.stone = 0;
    expect(guide(s)).toMatchObject({ kind: "goal", station: { id: "unlock:cove" } });
  });
  it("never goes blank while the Friend is on a voyage", () => {
    const s = fresh(); s.story = VOYAGE_CHAPTER + 1; s.level = 2; s.inv.bread = 5; s.shell = 500; s.hunger = 100;
    const r = dispatch(s, { type: "voyageStart", id: "scout" }, T0);
    expect(r.ok).toBe(true);
    const g = guide(r.state);
    expect(g).toMatchObject({ kind: "voyage", station: { id: "pier" }, endsAt: T0 + 15 * 60_000 });
    // A finished chapter is still claimable while away.
    r.state.level = 3;
    expect(guide(r.state)).toEqual({ kind: "claim" });
  });
});

describe("voyage gate", () => {
  it("the Voyage Pier opens only after the chapter that introduces it", () => {
    const s = fresh(); s.inv.bread = 5; s.shell = 500; s.hunger = 100;
    for (let i = 0; i < VOYAGE_CHAPTER; i++) {
      s.story = i;
      expect(voyagesOpen(s), `chapter ${i}`).toBe(false);
      expect(dispatch(s, { type: "voyageStart", id: "scout" }, T0).ok, `chapter ${i}`).toBe(false);
    }
    s.story = VOYAGE_CHAPTER;
    expect(voyagesOpen(s)).toBe(true);
    expect(dispatch(s, { type: "voyageStart", id: "scout" }, T0).ok).toBe(true);
    expect(chapterAt(VOYAGE_CHAPTER - 1).title).toBe("A Roof Over Fins");
  });
  it("announces the pier when that chapter is claimed", () => {
    const s = fresh(); s.story = VOYAGE_CHAPTER - 1; s.home = 1;
    const r = dispatch(s, { type: "storyClaim" }, T0);
    expect(r.ok).toBe(true);
    expect(r.events.some(e => /Voyage Pier/.test(e.text))).toBe(true);
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
  it("pays SHELL and items only", () => {
    expect(PASS.every(t => Object.keys(t).every(k => ["score", "shell", "items"].includes(k)))).toBe(true);
  });
  it("old saves without the journey field load at tier 0", () => {
    const s = fresh();
    const raw = JSON.parse(JSON.stringify(s)); delete raw.season.pass;
    const loaded = importSave(exportSave(raw as GameState), s.friendId);
    expect(loaded.season.pass).toBe(0);
  });
});

describe("no dead ends", () => {
  it("a starving, broke Friend with no food can always forage, on a cooldown", () => {
    const s = fresh();
    s.hunger = 0; s.shell = 0;
    for (const id of ["bread", "kelp", "carrot", "coconut", "sardine", "berry"] as const) s.inv[id] = 0;
    expect(dispatch(s, { type: "gather", kind: "chop" }, T0).ok).toBe(false);
    const r = dispatch(s, { type: "forage" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.inv.coconut).toBe(2);
    expect(dispatch(r.state, { type: "forage" }, T0 + 1000).ok).toBe(false); // has food now
    const ate = dispatch(dispatch(r.state, { type: "eat", item: "coconut" }, T0 + 1000).state, { type: "eat", item: "coconut" }, T0 + 2000).state;
    expect(ate.hunger).toBeGreaterThan(0);
    expect(dispatch(ate, { type: "forage" }, T0 + 30_000).ok).toBe(false); // cooldown
    expect(dispatch(ate, { type: "forage" }, T0 + 61_000).ok).toBe(true);
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

describe("welcome back report", () => {
  it("says where the Friend is: on a voyage, back from one, or at home", () => {
    const s = fresh();
    expect(welcomeBack(s, T0).friend).toEqual({ kind: "home" });
    s.voyage = { id: "scout", startedAt: T0 - 1000, endsAt: T0 + 60_000, result: { outcome: "empty", label: "", shell: 0, items: {}, stock: null, relic: false, lost: false }, announced: false };
    expect(welcomeBack(s, T0).friend).toEqual({ kind: "voyage", endsAt: T0 + 60_000 });
    expect(welcomeBack(s, T0 + 60_000).friend).toEqual({ kind: "back" });
  });
  it("lists ripe crops by kind and counts the ones still growing", () => {
    const s = fresh();
    s.plots = [
      { crop: "kelp", plantedAt: T0 - 50_000, readyAt: T0 - 10_000, withered: false },
      { crop: "kelp", plantedAt: T0 - 50_000, readyAt: T0 - 5_000, withered: false },
      { crop: "carrot", plantedAt: T0 - 10_000, readyAt: T0 + 70_000, withered: false },
      { crop: "berry", plantedAt: T0 - 200_000, readyAt: T0 - 60_000, withered: true },
      { crop: null, plantedAt: 0, readyAt: 0, withered: false },
    ];
    const r = welcomeBack(s, T0);
    expect(r.ripe).toEqual([{ crop: "kelp", count: 2 }]);
    expect(r.growing).toBe(1);
    expect(r.nextReadyAt).toBe(T0 + 70_000);
  });
});
