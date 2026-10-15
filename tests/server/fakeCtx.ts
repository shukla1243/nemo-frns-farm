/**
 * An in-memory stand-in for the FriendSDK runtime, so Vitest can call server handlers. It follows the
 * runtime's storage rules (README "Store"): reads return copies with their keys reordered, writes are held
 * until the handler returns and then committed with compare-and-set on every written record, and a conflict
 * runs the handler again, up to 4 times, before the caller gets "Game state changed. Retry.". Input and
 * results cross a JSON boundary, as they do through Nakama. `friendsdk dev` remains the real check.
 */
import type { CallContext, GameServer, Json, JsonInput, Store } from "@rarefriends/friendsdk/server";

type Row = { value: Json; version: number };
type Table = Map<string, Row>;

/** JSON copy with every object's keys in reverse order, as Nakama returns them in a different order. */
function reorder(value: Json): Json {
  if (Array.isArray(value)) return value.map(reorder);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).reverse().map(k => [k, reorder(value[k])]));
  return value;
}
const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

export type FakeFriend = { id: string; generation: number; familyId: number };
const FAMILIES = ["Skeleton", "Mask", "Family", "Cellular", "Asymmetry", "Hoverer", "Colossus", "Sparkling", "Hollow"];

export class ConflictExhausted extends Error {}

export function createWorld(options: { now: number }) {
  const tables = new Map<string, Table>();
  const tableOf = (owner: string) => { let t = tables.get(owner); if (!t) { t = new Map(); tables.set(owner, t); } return t; };
  const state = { now: options.now, randomCalls: 0, runs: 0 };
  let random: (max: number) => number = max => Math.floor(Math.random() * max);
  /** Runs before the next `times` commits; a test uses it to write a record concurrently. */
  let beforeCommit: { fn: (write: (owner: string, key: string, value: JsonInput) => void) => void; times: number } | null = null;

  function write(owner: string, key: string, value: JsonInput) {
    const t = tableOf(owner);
    const prev = t.get(key);
    t.set(key, { value: toJson(value), version: (prev?.version ?? 0) + 1 });
  }

  function makeStore(owner: string, reads: Map<string, number>, writes: Map<string, Json | undefined>, readOnly: boolean): Store {
    const t = tableOf(owner);
    const fail = () => { throw new TypeError("This store is read-only."); };
    const seen = (key: string) => { if (!reads.has(key)) reads.set(key, t.get(key)?.version ?? 0); };
    return {
      get<T>(key: string): T | null {
        if (writes.has(key)) { const v = writes.get(key); return v === undefined ? null : (reorder(v) as T); }
        const row = t.get(key);
        if (!reads.has(key)) reads.set(key, row?.version ?? 0);
        return row ? (reorder(row.value) as T) : null;
      },
      set(key: string, value: JsonInput) { if (readOnly) fail(); seen(key); writes.set(key, toJson(value)); },
      delete(key: string) { if (readOnly) fail(); seen(key); writes.set(key, undefined); },
      list() {
        const entries = [...t.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, row]) => ({ key, value: reorder(row.value) }));
        return { entries, cursor: null };
      },
    };
  }

  /** Run one handler with the runtime's commit and rerun rules. */
  function run<T>(friend: FakeFriend, body: (ctx: CallContext) => T): T {
    for (let attempt = 0; attempt < 4; attempt++) {
      state.runs++;
      const scopes = new Map<string, { reads: Map<string, number>; writes: Map<string, Json | undefined> }>();
      const scope = (owner: string) => { let s = scopes.get(owner); if (!s) { s = { reads: new Map(), writes: new Map() }; scopes.set(owner, s); } return s; };
      const own = scope(`friend:${friend.id}`), shared = scope("shared");
      const unsupported = (what: string) => () => { throw new Error(`fakeCtx: ${what} is not simulated.`); };
      const ctx: CallContext = {
        game: "nemo-farm",
        now: state.now,
        friend: {
          id: friend.id, generation: friend.generation, wallet: `0xf${friend.id}`, controller: "0xplayer", loaned: false,
          family: { id: friend.familyId, name: FAMILIES[friend.familyId] },
          get art(): never { throw new Error("fakeCtx: art is not simulated."); },
        },
        data: Object.assign(makeStore(`friend:${friend.id}`, own.reads, own.writes, false), { legacy: () => null, legacyVersion: () => null }),
        shared: makeStore("shared", shared.reads, shared.writes, false),
        friendData: (id: string) => makeStore(`friend:${id}`, new Map(), new Map(), true),
        legacy: unsupported("legacy"),
        leaderboard: unsupported("leaderboard"),
        items: unsupported("items"),
        randomInt: (max: number) => { state.randomCalls++; return random(max); },
        resolve: unsupported("resolve"),
        request: unsupported("request"),
        answer: unsupported("answer"),
        log: () => undefined,
      };
      const result = body(ctx);
      if (beforeCommit && beforeCommit.times > 0) { beforeCommit.times--; beforeCommit.fn(write); }
      let conflict = false;
      for (const [owner, s] of scopes) {
        const t = tableOf(owner);
        for (const key of s.writes.keys()) if ((t.get(key)?.version ?? 0) !== s.reads.get(key)) conflict = true;
      }
      if (conflict) continue;
      for (const [owner, s] of scopes) for (const [key, value] of s.writes) {
        if (value === undefined) tableOf(owner).delete(key); else write(owner, key, value);
      }
      return toJson(result) as T;
    }
    throw new ConflictExhausted("Game state changed. Retry.");
  }

  return {
    state,
    /** Answer `game.call(name, input)` for `friend`. */
    call<T = Json>(server: GameServer, friend: FakeFriend, name: string, input: unknown = null): T {
      const handler = server.calls?.[name];
      if (!handler) throw new Error(`No call ${name}.`);
      const parsed = toJson(input ?? null);
      return run(friend, ctx => handler(ctx, parsed)) as T;
    },
    record<T = Json>(owner: string, key: string): T | null { return (tableOf(owner).get(key)?.value as T) ?? null; },
    /** Write a record directly, as an earlier version of the game would have left it. */
    put(owner: string, key: string, value: JsonInput) { write(owner, key, value); },
    setRandom(fn: (max: number) => number) { random = fn; },
    beforeCommits(times: number, fn: (write: (owner: string, key: string, value: JsonInput) => void) => void) { beforeCommit = { fn, times }; },
    advance(ms: number) { state.now += ms; },
  };
}
