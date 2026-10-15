/**
 * Display-only projection of the server's island to the current server time, so needs drain, timers count
 * down and crops ripen between server calls. Nothing here is sent back: the server runs the real tick. The
 * random parts of the tick (world events, the market tide, rival raids) are held back so the screen never
 * shows an outcome the server has not decided, and the log stays the server's.
 */
import { tick } from "../engine/systems";
import type { GameState } from "../engine/types";

export function project(base: GameState, now: number): GameState {
  const s = JSON.parse(JSON.stringify(base)) as GameState;
  const { nextRivalRaidAt, nextEventAt, nextTideAt, seed } = s;
  s.nextRivalRaidAt = s.nextEventAt = s.nextTideAt = Number.POSITIVE_INFINITY;
  tick(s, now, []);
  return { ...s, nextRivalRaidAt, nextEventAt, nextTideAt, seed, log: base.log };
}
