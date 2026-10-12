/**
 * Crab Dash round state (presentation only: the engine clamps the score and pays SHELL).
 * `endAt` runs on the wall clock (Date.now) because the engine checks it; the pop timers run on performance.now.
 */
export type Kind = "crab" | "gold" | "trap";
type Hole = { kind: Kind; born: number; until: number } | null;
type Floater = { x: number; y: number; text: string; color: string; born: number };
export type Round = {
  endAt: number; nextPop: number; holes: Hole[]; score: number; mult: number; streak: number;
  floaters: Floater[]; shakeUntil: number; over: boolean; pausedAt?: { wall: number; perf: number } | null;
};

/** Freeze the round, for example while the tab is hidden. */
export function pauseRound(g: Round, wall: number, perf: number) {
  if (!g.pausedAt) g.pausedAt = { wall, perf };
}

/** Unfreeze: every timer moves on by the time spent paused, so no seconds are lost. */
export function resumeRound(g: Round, wall: number, perf: number) {
  if (!g.pausedAt) return;
  const dw = wall - g.pausedAt.wall, dp = perf - g.pausedAt.perf;
  g.endAt += dw;
  g.nextPop += dp;
  g.shakeUntil += dp;
  for (const h of g.holes) if (h) { h.born += dp; h.until += dp; }
  for (const f of g.floaters) f.born += dp;
  g.pausedAt = null;
}
