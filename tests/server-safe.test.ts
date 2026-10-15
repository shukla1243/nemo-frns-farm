import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, dispatch, type GameState } from "../src/engine";

// Game rules run in Nakama's ES2020 runtime: no DOM, Node, timers, client clock or ambient randomness.
const ENGINE = import.meta.glob<string>("../src/engine/*.ts", { query: "?raw", import: "default", eager: true });
const FORBIDDEN = ["structuredClone", "Date.now", "Math.random", "crypto", "localStorage"];
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const T0 = Date.UTC(2026, 9, 13, 12);
const fresh = (): GameState => {
  const s = createState({ friendId: "7", name: "Friend #7", family: 2, guest: false, now: T0, seed: 99 });
  s.shell = 5000; s.hunger = 100; s.energy = 100;
  return s;
};

describe("server-safe engine", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("engine files use no forbidden globals", () => {
    const hits: string[] = [];
    expect(Object.keys(ENGINE).length).toBeGreaterThan(10);
    for (const [file, source] of Object.entries(ENGINE)) {
      const code = stripComments(source);
      for (const word of FORBIDDEN) if (code.includes(word)) hits.push(`${file}: ${word}`);
    }
    expect(hits).toEqual([]);
  });

  it("dispatch runs without structuredClone", () => {
    vi.stubGlobal("structuredClone", undefined);
    const s = fresh();
    const r = dispatch(s, { type: "flip" }, T0);
    expect(r.state).not.toBe(s);
    expect(dispatch(s, { type: "buy", item: "nope" as never, qty: 1 }, T0).ok).toBe(false);
  });

  it("the next seed depends on the server time, not only the stored seed", () => {
    const s = fresh();
    const a = dispatch(s, { type: "fishCast" }, T0);
    const b = dispatch(s, { type: "fishCast" }, T0 + 1);
    expect(a.state.seed).not.toBe(b.state.seed);
  });

  it("the same state, time and action give the same result", () => {
    const s = fresh();
    expect(dispatch(s, { type: "fishCast" }, T0).state.seed).toBe(dispatch(s, { type: "fishCast" }, T0).state.seed);
  });

  it("the seed changes on every accepted action even when the action draws no randomness", () => {
    const s = fresh(); s.energy = 10;
    const r = dispatch(s, { type: "sleep" }, T0);
    expect(r.ok).toBe(true);
    expect(r.state.seed).not.toBe(s.seed);
  });
});
