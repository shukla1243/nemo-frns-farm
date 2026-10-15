/** Reel timing for fishing. The hook position is a pure function of server time, so the server judges every reel. */
import { FISH_REEL } from "./config";

type Reel = { zone: number; zoneStart: number; speed: number; biteAt: number };

/** Hook speed in half swings per second for a fish's difficulty. */
export const reelSpeed = (difficulty: number) => Math.round((0.9 + difficulty * 2.2) * 1000) / 1000;

/** Hook position (0 to 1) at time `t`: it ping-pongs across the bar from the bite. */
export function markerAt(run: Reel, t: number) {
  const e = (t - run.biteAt) / 1000;
  return (Math.sin(e * run.speed * Math.PI) + 1) / 2;
}

/** True when the hook was in the green at some moment of the lag window before `now`, inside the bite window. */
export function reelHit(run: Reel, now: number) {
  const from = Math.max(run.biteAt, now - FISH_REEL.lagMaxMs), to = Math.min(run.biteAt + FISH_REEL.windowMs, now - FISH_REEL.lagMinMs);
  for (let t = from; t <= to; t += FISH_REEL.stepMs) {
    const m = markerAt(run, t);
    if (m >= run.zoneStart && m <= run.zoneStart + run.zone) return true;
  }
  return false;
}
