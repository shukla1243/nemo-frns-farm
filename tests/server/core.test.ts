import { beforeEach, describe, expect, it } from "vitest";
import server, { type ActResult, type LoadResult, type PrefsResult, type SyncResult } from "../../server/index";
import { ConflictExhausted, createWorld, type FakeFriend } from "./fakeCtx";
import { createState, type GameState } from "../../src/engine";

const T0 = Date.UTC(2026, 9, 16, 9);
const skeleton: FakeFriend = { id: "117713", generation: 1, familyId: 0 };
const colossus: FakeFriend = { id: "277088", generation: 2, familyId: 6 };
type Stored = { schema: number; game: GameState };

let world: ReturnType<typeof createWorld>;
const call = <T>(name: string, input?: unknown, friend = skeleton) => world.call<T>(server, friend, name, input);
const stored = (friend = skeleton) => world.record<Stored>(`friend:${friend.id}`, "state");

beforeEach(() => {
  world = createWorld({ now: T0 });
  let n = 0;
  world.setRandom(max => (n++ * 7919 + 12345) % max);
});

describe("load", () => {
  it("creates a new island with the family read on chain and a server name", () => {
    const r = call<LoadResult>("load", null, colossus);
    expect(r.welcome).toBe("new");
    expect(r.since).toBeNull();
    expect(r.now).toBe(T0);
    expect(r.view.friendId).toBe("277088");
    expect(r.view.name).toBe("Friend #277088");
    expect(r.view.family).toBe(6);
    expect(r.view.trait).toBe("titan");
    expect(r.view.createdAt).toBe(T0);
    expect(stored(colossus)).toMatchObject({ schema: 3, game: { friendId: "277088", family: 6 } });
  });

  it("returns the stored island on the next load and reports time away", () => {
    call<LoadResult>("load");
    call<ActResult>("act", { a: { type: "gather", kind: "chop" } });
    world.advance(10 * 60_000);
    const r = call<LoadResult>("load");
    expect(r.welcome).toBeNull();
    expect(r.since).toBe(T0);
    expect(r.view.inv.wood).toBeGreaterThan(0);
    expect(r.view.lastTick).toBe(T0 + 10 * 60_000);
    expect(r.prefs).toEqual({ muted: false, music: true, reducedMotion: null, inboxSeenAt: 0 });
  });

  it("does not report a short absence", () => {
    call<LoadResult>("load");
    world.advance(30_000);
    expect(call<LoadResult>("load").since).toBeNull();
  });
});

describe("act", () => {
  beforeEach(() => { call<LoadResult>("load"); });

  it("runs an engine action at server time and stores the result", () => {
    world.advance(5_000);
    const r = call<ActResult>("act", { a: { type: "gather", kind: "chop" } });
    expect(r.ok).toBe(true);
    expect(r.now).toBe(T0 + 5_000);
    expect(r.view.lastTick).toBe(T0 + 5_000);
    expect(r.view.inv.wood).toBeGreaterThan(0);
    expect(r.data).toMatchObject({ found: { wood: r.view.inv.wood } });
    expect(stored()!.game.inv.wood).toBe(r.view.inv.wood);
  });

  it("returns a refused action as ok false with the reason, leaving inventory untouched", () => {
    const r = call<ActResult>("act", { a: { type: "eat", item: "feast" } });
    expect(r.ok).toBe(false);
    expect(r.events.at(-1)?.text).toMatch(/feast|Need|have/i);
    expect(stored()!.game.inv.feast).toBe(0);
  });

  it("seeds every dispatch from ctx.randomInt", () => {
    const before = world.state.randomCalls;
    call<ActResult>("act", { a: { type: "gather", kind: "chop" } });
    expect(world.state.randomCalls).toBe(before + 1);
  });

  it("rejects unknown, internal and malformed actions before they reach the engine", () => {
    for (const input of [null, {}, { a: null }, { a: "chop" }, { a: { type: "tick" } }, { a: { type: "grantShell" } }, { a: { type: 5 } }]) {
      expect(() => call("act", input), JSON.stringify(input)).toThrow(/^Invalid request/);
    }
  });

  it("never accepts client time, balances or saves", () => {
    expect(() => call("act", { a: { type: "gather", kind: "chop" }, now: T0 + 1e9 })).toThrow(/unexpected now/);
    expect(() => call("act", { a: { type: "gather", kind: "chop", shell: 1e9 } })).toThrow("Invalid request.");
    expect(() => call("act", { a: { type: "eat", item: "__proto__" } })).not.toThrow();
    expect(stored()!.game.shell).toBeLessThan(10_000);
  });

  it("clamps out-of-range fields through the engine's payload checks", () => {
    const r = call<ActResult>("act", { a: { type: "buy", item: "bait", qty: 1e6 } });
    expect(r.ok).toBe(false);
    expect(r.events.at(-1)?.text).toBe("Invalid request.");
  });

  it("keeps the hooked fish secret and judges the reel itself", () => {
    const cast = call<ActResult>("act", { a: { type: "fishCast" } });
    expect(cast.ok).toBe(true);
    const run = cast.view.run as unknown as Record<string, unknown>;
    expect(run).toMatchObject({ kind: "fish" });
    expect(run).not.toHaveProperty("fish");
    expect(typeof run.biteAt).toBe("number");
    expect(stored()!.game.run).toHaveProperty("fish");
    expect(() => call("act", { a: { type: "fishReel", hit: true } })).toThrow(/^Invalid request/);
    const reel = call<ActResult>("act", { a: { type: "fishReel" } });
    expect(reel.data).toMatchObject({ caught: false });
    expect(reel.view.run).toBeNull();
  });

  it("needs a loaded island", () => {
    world = createWorld({ now: T0 });
    expect(() => call("act", { a: { type: "gather", kind: "chop" } })).toThrow(/Reload/);
  });
});

describe("storage conflicts", () => {
  beforeEach(() => { call<LoadResult>("load"); });

  it("reruns the handler on a concurrent write and keeps the concurrent change's successor", () => {
    const runs = world.state.runs;
    world.beforeCommits(1, write => {
      const s = stored()!;
      write(`friend:${skeleton.id}`, "state", { ...s, game: { ...s.game, inv: { ...s.game.inv, stone: 7 } } });
    });
    const r = call<ActResult>("act", { a: { type: "gather", kind: "chop" } });
    expect(world.state.runs).toBe(runs + 2);
    expect(r.view.inv.stone).toBe(7);
    expect(stored()!.game.inv.stone).toBe(7);
    expect(stored()!.game.inv.wood).toBe(r.view.inv.wood);
  });

  it("gives up after four conflicting runs without writing", () => {
    const before = stored();
    world.beforeCommits(4, write => write(`friend:${skeleton.id}`, "state", before!));
    expect(() => call("act", { a: { type: "gather", kind: "chop" } })).toThrow(ConflictExhausted);
    expect(stored()!.game.inv.wood).toBe(0);
  });
});

describe("sync", () => {
  it("advances time on the server and returns what happened", () => {
    call<LoadResult>("load");
    world.advance(24 * 3_600_000);
    const r = call<SyncResult>("sync");
    expect(r.now).toBe(T0 + 24 * 3_600_000);
    expect(r.view.lastTick).toBe(r.now);
    expect(r.events.some(e => /streak/i.test(e.text))).toBe(true);
    expect(() => call("sync", { now: 1 })).toThrow(/unexpected now/);
  });
});

describe("prefs", () => {
  beforeEach(() => { call<LoadResult>("load"); });

  it("stores the player's choices and stamps the inbox with server time", () => {
    world.advance(1_000);
    const r = call<PrefsResult>("prefs", { muted: true, music: false, reducedMotion: true, inboxSeen: true });
    expect(r.prefs).toEqual({ muted: true, music: false, reducedMotion: true, inboxSeenAt: T0 + 1_000 });
    expect(call<LoadResult>("load").prefs).toEqual(r.prefs);
    expect(call<PrefsResult>("prefs", { reducedMotion: null }).prefs.reducedMotion).toBeNull();
  });

  it("rejects anything else", () => {
    for (const input of [null, { muted: "yes" }, { inboxSeenAt: 5 }, { inboxSeen: false }, { music: 1 }]) {
      expect(() => call("prefs", input), JSON.stringify(input)).toThrow(/Invalid/);
    }
  });
});

describe("stored schema", () => {
  const island = () => JSON.parse(JSON.stringify(createState({ friendId: skeleton.id, name: "Friend #117713", family: 0, guest: false, now: T0 - 3_600_000, seed: 3 }))) as Record<string, unknown> & GameState;
  const put = (value: unknown) => world.put(`friend:${skeleton.id}`, "state", value as never);

  it("fills fields a schema 3 record is missing with new-island defaults and keeps the rest", () => {
    const g = island();
    g.shell = 1234;
    delete (g as Partial<GameState>).relics;
    delete (g.stats as Partial<GameState["stats"]>).crabBest;
    delete (g.inv as Partial<GameState["inv"]>).wood;
    put({ schema: 3, game: g });
    const r = call<LoadResult>("load");
    expect(r.view.shell).toBeGreaterThanOrEqual(1234);
    expect(r.view.relics).toBe(0);
    expect(r.view.stats.crabBest).toBe(0);
    expect(r.view.inv.wood).toBe(0);
    expect(r.view.createdAt).toBe(T0 - 3_600_000);
  });

  it("migrates an older schema and stores it as schema 3", () => {
    const g = island();
    g.level = 4;
    delete (g as Partial<GameState>).tradableStocks;
    put({ schema: 2, game: g });
    const r = call<LoadResult>("load");
    expect(r.view.level).toBe(4);
    expect(r.view.tradableStocks).toBeTypeOf("object");
    expect(stored()!.schema).toBe(3);
  });

  it("migrates an unwrapped island from before the schema field", () => {
    const g = island();
    g.home = 2;
    put(g);
    const r = call<LoadResult>("load");
    expect(r.view.home).toBe(2);
    expect(stored()).toMatchObject({ schema: 3, game: { home: 2 } });
  });

  it("refuses an island saved by a newer version without touching it", () => {
    put({ schema: 4, game: island() });
    expect(() => call("load")).toThrow(/newer version/);
    expect(() => call("act", { a: { type: "gather", kind: "chop" } })).toThrow(/newer version/);
    expect(stored()!.schema).toBe(4);
  });
});
