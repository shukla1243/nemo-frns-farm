/**
 * Season Journey: a free reward track that resets every weekly season. Every player earns tiers from their
 * season score, so everyone gets paid for playing. Rewards are SHELL and items.
 */
import type { ItemId } from "./config";
import { giveShell, log, seasonScore } from "./state";
import type { GameEvent, GameState } from "./types";

type Tier = { score: number; shell?: number; items?: Partial<Record<ItemId, number>> };
export const PASS: Tier[] = [
  { score: 200, shell: 150 },
  { score: 600, items: { bait: 10, bread: 3 } },
  { score: 1200, items: { charm: 1 } },
  { score: 2500, shell: 400 },
  { score: 4000, items: { pearl: 2, blessing: 1 } },
  { score: 6000, items: { ore: 20, coral: 10 } },
  { score: 9000, shell: 800, items: { charm: 1 } },
  { score: 13000, items: { pearl: 3, blessing: 2 } },
  { score: 18000, shell: 1350 },
  { score: 25000, shell: 300, items: { feast: 1 } },
];

/** Tiers reached but not yet claimed this season. */
export const passClaimable = (s: GameState) => PASS.slice(s.season.pass).filter(t => seasonScore(s) >= t.score).length;

export function claimPass(s: GameState, events: GameEvent[], now: number) {
  const n = passClaimable(s);
  let shell = 0;
  for (const t of PASS.slice(s.season.pass, s.season.pass + n)) {
    if (t.shell) shell += giveShell(s, t.shell, "reward");
    for (const [id, q] of Object.entries(t.items ?? {})) s.inv[id as ItemId] += q ?? 0;
  }
  s.season.pass += n;
  log(s, events, `Season Journey: ${n} tier${n > 1 ? "s" : ""} claimed (${s.season.pass} of ${PASS.length}).`, "good", { cue: "reward", icon: "trophy" }, now);
  return { tiers: n, shell };
}
