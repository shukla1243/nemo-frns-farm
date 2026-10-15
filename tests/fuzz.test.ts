/**
 * The engine is the server boundary: every action payload comes from an untrusted client. Hostile payloads
 * must be rejected cleanly or applied validly; they must never throw, write NaN or poison an object's prototype.
 */
import { describe, expect, it } from "vitest";
import { ITEM_IDS, ZONE_ORDER, createState, dayNumber, dispatch, type Action, type GameState } from "../src/engine";

const T0 = Date.UTC(2026, 9, 13, 12);

const FIELDS: Record<string, Record<string, unknown>> = {
  tick: {}, eat: { item: "bread" }, drink: {}, sleep: {}, wake: {}, buildHome: {},
  buy: { item: "bait", qty: 1 }, sell: { item: "wood", qty: 1 }, plant: { plot: 0, crop: "kelp" }, harvest: { plot: 0 },
  clearPlot: { plot: 0 }, buyPlot: {}, gather: { kind: "chop" }, cook: { meal: "sushi" }, unlockZone: { zone: "cove" },
  ascend: { blessing: false, charm: false }, forge: { gear: "rod", blessing: false, charm: false },
  diveStart: { stake: 50 }, diveCashout: {}, minesStart: { stake: 50, traps: 3 }, minesReveal: { index: 0 }, minesCashout: {},
  fishCast: {}, fishReel: {}, crabStart: {}, crabFinish: { score: 10 }, crabQuit: {}, flip: {}, keepWin: {},
  raid: { rivalId: "bot-0" }, bossAttack: {}, bossClaim: {}, spin: { free: true }, claimQuest: { id: 1 }, passClaim: {},
  forage: {}, storyClaim: {}, npcGift: { npc: "salt" }, rebirth: {}, voyageStart: { id: "scout" }, voyageClaim: {},
  voyageRecall: {}, sellStock: { id: "FINX", shares: 1 },
};
const HOSTILE: unknown[] = [
  NaN, Infinity, -Infinity, -1, -0, 0, 1.5, 1e9, -1e9, Number.MAX_SAFE_INTEGER + 2,
  "constructor", "__proto__", "prototype", "toString", "hasOwnProperty", "valueOf", "", "1", "NaN",
  null, undefined, {}, [], [0], true, false,
];
const POISON = new Set(["__proto__", "constructor", "prototype", "toString", "hasOwnProperty", "valueOf"]);

function rich(): GameState {
  const s = createState({ friendId: "7", name: "Friend #7", family: 8, guest: false, now: T0, seed: 5 });
  s.streak = { day: dayNumber(T0), count: 1 };
  s.shell = 50_000; s.hunger = 60; s.energy = 100; s.level = 31; s.xp = 1_000_000; s.story = 30; s.home = 1;
  for (const z of ZONE_ORDER) s.zones[z] = true;
  for (const id of ITEM_IDS) s.inv[id] = 50;
  s.stocks.FINX = 2;
  s.plots[0] = { crop: "kelp", plantedAt: T0 - 1e7, readyAt: T0 - 1, withered: false };
  return s;
}
function bases(): GameState[] {
  const plain = rich();
  const mines = dispatch(rich(), { type: "minesStart", stake: 50, traps: 3 }, T0).state;
  const dive = dispatch(rich(), { type: "diveStart", stake: 50 }, T0).state;
  const crab = dispatch(rich(), { type: "crabStart" }, T0).state;
  const won = { ...rich(), lastWin: { amount: 100, flips: 0, source: "dive", tradableShare: 0 } };
  const sailing = dispatch(rich(), { type: "voyageStart", id: "scout" }, T0).state;
  return [plain, mines, dive, crab, won, sailing];
}

/** Every numeric leaf is finite, nothing became null where a number was, and no poisoned key exists. */
function audit(state: unknown, base: unknown, path: string, out: string[]) {
  if (typeof base === "number" && (typeof state !== "number" || !Number.isFinite(state))) out.push(`${path} = ${String(state)}`);
  if (typeof state === "number" && !Number.isFinite(state)) out.push(`${path} = ${state}`);
  if (!state || typeof state !== "object") return;
  if (Object.getPrototypeOf(state) !== Object.prototype && !Array.isArray(state)) out.push(`${path} has a foreign prototype`);
  for (const k of Object.keys(state)) {
    if (POISON.has(k)) out.push(`${path}.${k} is a poisoned key`);
    const b = base && typeof base === "object" ? (base as Record<string, unknown>)[k] : undefined;
    audit((state as Record<string, unknown>)[k], Object.hasOwn(Object(base), k) ? b : undefined, `${path}.${k}`, out);
  }
}

function payloads(): Action[] {
  const out: Action[] = [];
  for (const [type, fields] of Object.entries(FIELDS)) {
    out.push({ type, ...fields } as Action);
    for (const field of Object.keys(fields)) for (const v of HOSTILE) out.push({ type, ...fields, [field]: v } as Action);
    for (const v of HOSTILE) out.push({ type, ...Object.fromEntries(Object.keys(fields).map(f => [f, v])) } as Action);
  }
  for (const a of [null, undefined, 1, "tick", [], {}, { type: "__proto__" }, { type: "constructor" }, { type: 7 }]) out.push(a as unknown as Action);
  return out;
}

describe("hostile action payloads", () => {
  it("are rejected or applied validly, never throw, NaN or prototype poison", () => {
    const problems: string[] = [];
    const all = payloads();
    for (const base of bases()) for (const a of all) {
      let r;
      try { r = dispatch(base, a, T0 + 5000); } catch (e) { problems.push(`${JSON.stringify(a)} threw ${(e as Error).message}`); continue; }
      if (typeof r.ok !== "boolean") problems.push(`${JSON.stringify(a)} returned no ok flag`);
      if (r.state.tradable > r.state.shell) problems.push(`${JSON.stringify(a)} left tradable above the balance`);
      const found: string[] = [];
      audit(r.state, base, "state", found);
      if (found.length) problems.push(`${JSON.stringify(a)}: ${found.slice(0, 3).join("; ")}`);
      if (problems.length > 20) break;
    }
    expect(problems).toEqual([]);
  }, 120_000);
});
