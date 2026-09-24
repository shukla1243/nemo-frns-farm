/**
 * Automatic lifetime milestones. Every track has infinite tiers; the moment a stat passes the next
 * threshold the reward is granted automatically (checked after every action and tick).
 */
import { RF } from "./config";
import type { GameEvent, GameState } from "./types";

type Track = { id: string; name: string; unit: string; base: number; value: (s: GameState) => number };

export const TRACKS: Track[] = [
  { id: "fish", name: "Angler", unit: "fish caught", base: 10, value: s => s.stats.fish },
  { id: "harvests", name: "Farmer", unit: "harvests", base: 10, value: s => s.stats.harvests },
  { id: "gathered", name: "Forager", unit: "gathering trips", base: 25, value: s => s.stats.gathered },
  { id: "cooked", name: "Chef", unit: "meals cooked", base: 5, value: s => s.stats.cooked },
  { id: "dives", name: "Diver", unit: "Abyss dives", base: 10, value: s => s.stats.dives },
  { id: "mines", name: "Sapper", unit: "Mines cashouts", base: 10, value: s => s.stats.minesCashouts },
  { id: "raids", name: "Raider", unit: "raids won", base: 5, value: s => s.stats.raidsWon },
  { id: "defended", name: "Guardian", unit: "raids defended", base: 3, value: s => s.stats.defended },
  { id: "kraken", name: "Kraken Hunter", unit: "Kraken kills", base: 1, value: s => s.stats.bossKills },
  { id: "ascends", name: "Ascendant", unit: "ascensions", base: 5, value: s => s.stats.ascends },
  { id: "forges", name: "Smith", unit: "forge strikes", base: 5, value: s => s.stats.forges },
  { id: "spins", name: "Gambler", unit: "wheel spins", base: 5, value: s => s.stats.spins },
  { id: "voyages", name: "Voyager", unit: "voyages sailed", base: 3, value: s => s.stats.voyages },
  { id: "spent", name: "Patron", unit: "RF spent", base: 10 * RF, value: s => s.stats.burned },
  { id: "earned", name: "Tycoon", unit: "SHELL earned", base: 1000, value: s => s.stats.shellEarned },
];

const STEPS = [1, 2.5, 5];
/** Nice thresholds that grow forever: base × 1, 2.5, 5, 10, 25, 50, 100, … */
export function threshold(base: number, tier: number) {
  return Math.round(base * STEPS[tier % 3] * 10 ** Math.floor(tier / 3));
}

const RANKS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];
export function rankName(tier: number) {
  if (tier <= 0) return "Unranked";
  const r = Math.min(RANKS.length - 1, Math.floor((tier - 1) / 3));
  const step = tier - r * 3;
  return r === RANKS.length - 1 ? `${RANKS[r]} ${tier - 15}` : `${RANKS[r]} ${"I".repeat(Math.min(3, step))}`;
}

/** Reward for reaching `tier` (1-based). Grows with tier; every third tier also pays RF. */
export function milestoneReward(tier: number) {
  return { shell: Math.round(25 * tier ** 1.6), xp: 10 * tier, rf: tier % 3 === 0 ? 25 * tier : 0 };
}

export function checkMilestones(s: GameState, events: GameEvent[], now: number) {
  for (const t of TRACKS) {
    let tier = s.milestones[t.id] ?? 0;
    const v = t.value(s);
    while (v >= threshold(t.base, tier)) {
      tier++;
      const r = milestoneReward(tier);
      s.shell += r.shell; s.stats.shellEarned += r.shell;
      if (r.rf) { s.rf += r.rf; s.stats.rfWon += r.rf; }
      s.season.xp += r.xp;
      const text = `Milestone: ${t.name} ${rankName(tier)} (${fmt(t, threshold(t.base, tier - 1))} ${t.unit}). +${r.shell} SHELL${r.rf ? ` +${(r.rf / RF).toFixed(2)} RF` : ""}`;
      events.push({ tone: "epic", text, cue: "reveal-rare", fx: "confetti", icon: "trophy" });
      s.log.unshift({ t: now, text, tone: "epic" });
    }
    s.milestones[t.id] = tier;
  }
}

const fmt = (t: Track, v: number) => (t.id === "spent" ? (v / RF).toLocaleString() : v.toLocaleString());
export const trackProgress = (s: GameState, t: Track) => {
  const tier = s.milestones[t.id] ?? 0;
  return { tier, value: t.value(s), next: threshold(t.base, tier), prev: tier ? threshold(t.base, tier - 1) : 0, fmt: (v: number) => fmt(t, v) };
};
