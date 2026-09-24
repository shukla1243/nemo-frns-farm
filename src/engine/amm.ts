/**
 * The Tide Pool: a simulated constant-product (x*y=k) market pairing $SHELL with $RAREFRIENDS.
 * Every swap pays a 3% fee in RF, which flows through the standard RF sink split (70% Season Prize
 * Pool, 25% creator ("earn fees as your assets trade"), 5% burned). Simulated traders move the price.
 */
import type { Rng } from "./rng";

export const POOL = {
  initShell: 150_000,
  initRf: 100_000, // centi-RF (1,000 RF)
  feeBps: 300,
  anchor: 150, // SHELL per RF the simulated market drifts toward
  botEveryMs: [15_000, 40_000] as [number, number],
  historyEveryMs: 30_000,
  historyLen: 60,
  maxShareOfReserve: 0.3,
};

export type Pool = { shell: number; rf: number; history: number[]; nextBotAt: number; nextHistoryAt: number };
export type SwapDir = "shellToRf" | "rfToShell";
type Quote = { out: number; fee: number; impact: number; price: number };

export const createPool = (now: number): Pool => ({
  shell: POOL.initShell, rf: POOL.initRf, history: seedHistory(), nextBotAt: now + POOL.botEveryMs[0], nextHistoryAt: now + POOL.historyEveryMs,
});

function seedHistory() {
  const out: number[] = [];
  let v = POOL.anchor, s = 20260921;
  for (let i = 0; i < 40; i++) {
    s = (s * 48271) % 2147483647;
    v += ((s / 2147483647) - 0.5) * 6 + (POOL.anchor - v) * 0.15;
    out.push(Math.round(v * 100) / 100);
  }
  out.push(POOL.anchor);
  return out;
}

/** SHELL per 1 RF. */
export const poolPrice = (p: Pool) => p.shell / (p.rf / 100);

export function quote(p: Pool, dir: SwapDir, amountIn: number): Quote | null {
  if (!Number.isFinite(amountIn) || amountIn <= 0) return null;
  const before = poolPrice(p);
  if (dir === "shellToRf") {
    if (amountIn > p.shell * POOL.maxShareOfReserve) return null;
    const gross = Math.floor(p.rf * amountIn / (p.shell + amountIn));
    const fee = Math.floor(gross * POOL.feeBps / 10_000);
    const out = gross - fee;
    if (out <= 0) return null;
    const after = (p.shell + amountIn) / ((p.rf - gross) / 100);
    return { out, fee, impact: Math.abs(after - before) / before, price: amountIn / (out / 100) };
  }
  if (amountIn > p.rf * POOL.maxShareOfReserve) return null;
  const fee = Math.floor(amountIn * POOL.feeBps / 10_000);
  const net = amountIn - fee;
  const out = Math.floor(p.shell * net / (p.rf + net));
  if (out <= 0) return null;
  const after = (p.shell - out) / ((p.rf + net) / 100);
  return { out, fee, impact: Math.abs(after - before) / before, price: out / (amountIn / 100) };
}

/** Apply a quoted swap to the pool reserves (fees leave the pool: burned or to the creator). */
export function applySwap(p: Pool, dir: SwapDir, amountIn: number, q: Quote) {
  if (dir === "shellToRf") { p.shell += amountIn; p.rf -= q.out + q.fee; }
  else { p.rf += amountIn - q.fee; p.shell -= q.out; }
}

/** Simulated market participants: mean-reverting noise traders so the chart feels alive. */
export function botTrades(p: Pool, now: number, rng: Rng) {
  let fees = 0;
  while (now >= p.nextBotAt) {
    const drift = Math.log(poolPrice(p) / POOL.anchor); // >0 means SHELL is cheap relative to anchor
    const sellShell = rng.next() < 0.5 + Math.max(-0.35, Math.min(0.35, -drift * 2));
    const size = 0.004 + rng.next() * 0.025;
    const dir: SwapDir = sellShell ? "shellToRf" : "rfToShell";
    const amount = Math.floor((dir === "shellToRf" ? p.shell : p.rf) * size);
    const q = quote(p, dir, amount);
    if (q) { applySwap(p, dir, amount, q); fees += q.fee; }
    p.nextBotAt += POOL.botEveryMs[0] + Math.floor(rng.next() * (POOL.botEveryMs[1] - POOL.botEveryMs[0]));
    if (now - p.nextBotAt > 3600_000) p.nextBotAt = now; // don't replay days of offline trades
  }
  while (now >= p.nextHistoryAt) {
    p.history.push(Math.round(poolPrice(p) * 100) / 100);
    if (p.history.length > POOL.historyLen) p.history.shift();
    p.nextHistoryAt += POOL.historyEveryMs;
    if (now - p.nextHistoryAt > POOL.historyEveryMs * POOL.historyLen) p.nextHistoryAt = now;
  }
  return { fees };
}
