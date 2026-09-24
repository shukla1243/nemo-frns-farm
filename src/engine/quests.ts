import { HOMES, type ZoneId } from "./config";
import type { Rng } from "./rng";
import type { GameEvent, GameState, Quest, QuestKind } from "./types";

const QUEST_DEFS: { kind: QuestKind; zone?: ZoneId; label: (n: number) => string; base: number; perLevel: number; shell: number }[] = [
  { kind: "fish", label: n => `Catch ${n} fish`, base: 3, perLevel: 0.3, shell: 30 },
  { kind: "harvest", label: n => `Harvest ${n} crop plots`, base: 2, perLevel: 0.2, shell: 30 },
  { kind: "gather", zone: "grove", label: n => `Gather ${n} times`, base: 5, perLevel: 0.4, shell: 25 },
  { kind: "cook", label: n => `Cook ${n} meals`, base: 1, perLevel: 0.1, shell: 45 },
  { kind: "dive", zone: "abyss", label: n => `Cash out ${n} Abyss dives at 2x+`, base: 1, perLevel: 0.1, shell: 60 },
  { kind: "mines", zone: "mines", label: n => `Cash out ${n} Tide Mines runs`, base: 2, perLevel: 0.1, shell: 50 },
  { kind: "raid", zone: "harbor", label: n => `Win ${n} raids`, base: 1, perLevel: 0.1, shell: 70 },
  { kind: "burn", label: n => `Spend ${n / 100} RF`, base: 100, perLevel: 20, shell: 60 },
  { kind: "forge", zone: "forge", label: n => `Attempt ${n} forge upgrades`, base: 1, perLevel: 0.1, shell: 50 },
  { kind: "boss", zone: "reef", label: n => `Hit the Kraken ${n} times`, base: 3, perLevel: 0.2, shell: 60 },
];

export const questLabel = (q: Quest) => QUEST_DEFS.find(d => d.kind === q.kind)!.label(q.target);

export function newQuest(s: GameState, rng: Rng): Quest {
  const active = new Set(s.quests.map(q => q.kind));
  const pool = QUEST_DEFS.filter(d => !active.has(d.kind) && (!d.zone || s.zones[d.zone]) && (d.kind !== "cook" || s.home >= 1));
  const def = rng.pick(pool.length ? pool : QUEST_DEFS);
  const target = Math.max(1, Math.round(def.base + def.perLevel * (s.level - 1)));
  const quest: Quest = {
    id: ++s.questSeq, kind: def.kind, target, progress: 0,
    reward: { shell: Math.round(def.shell * (1 + s.level * 0.15)), xp: 15 + s.level * 6 },
  };
  if (rng.chance(0.2)) quest.reward.items = { charm: 1 };
  else if (rng.chance(0.25)) quest.reward.items = { pearl: 1 };
  return quest;
}

export function progress(s: GameState, events: GameEvent[], kind: QuestKind, amount = 1) {
  for (const q of s.quests) {
    if (q.kind !== kind || q.progress >= q.target) continue;
    q.progress = Math.min(q.target, q.progress + amount);
    if (q.progress >= q.target) events.push({ tone: "good", text: `Bounty complete: ${questLabel(q)}! Claim it on the Bounty Board.`, cue: "action-ready" });
  }
}

// ---------- Achievements ----------
export const ACHIEVEMENTS: { id: string; name: string; blurb: string; test: (s: GameState) => boolean; reward: { shell?: number; rf?: number } }[] = [
  { id: "first_fish", name: "First Catch", blurb: "Catch a fish.", test: s => s.stats.fish >= 1, reward: { shell: 20 } },
  { id: "golden", name: "Finding Gold", blurb: "Catch a Golden Nemo.", test: s => s.stats.goldnemo >= 1, reward: { rf: 100 } },
  { id: "hut", name: "Roof Over Fins", blurb: "Build a Driftwood Hut.", test: s => s.home >= 1, reward: { shell: 50 } },
  { id: "castle", name: "King of the Tide", blurb: "Build the Sea Castle.", test: s => s.home >= HOMES.length - 1, reward: { rf: 500 } },
  { id: "dive5", name: "Deep Diver", blurb: "Cash out a dive at 5x or more.", test: s => s.stats.bestDive >= 5, reward: { shell: 100 } },
  { id: "dive20", name: "Abyss Whisperer", blurb: "Cash out a dive at 20x or more.", test: s => s.stats.bestDive >= 20, reward: { rf: 200 } },
  { id: "mines10", name: "Sapper", blurb: "Cash out Tide Mines after 10 safe tiles.", test: s => s.stats.bestMinesTiles >= 10, reward: { shell: 150 } },
  { id: "raider", name: "Pirate Friend", blurb: "Win 5 raids.", test: s => s.stats.raidsWon >= 5, reward: { shell: 150 } },
  { id: "wall", name: "Unbreakable", blurb: "Defend your vault 3 times.", test: s => s.stats.defended >= 3, reward: { shell: 100 } },
  { id: "lvl10", name: "Rising Tide", blurb: "Reach level 10.", test: s => s.level >= 10, reward: { rf: 150 } },
  { id: "lvl25", name: "Ocean Legend", blurb: "Reach level 25.", test: s => s.level >= 25, reward: { rf: 500 } },
  { id: "burn10", name: "Kindling", blurb: "Spend 10 RF in the game.", test: s => s.stats.burned >= 1000, reward: { shell: 150 } },
  { id: "burn100", name: "Inferno", blurb: "Spend 100 RF in the game.", test: s => s.stats.burned >= 10000, reward: { rf: 300 } },
  { id: "forge7", name: "Blacksmith", blurb: "Forge any gear to +7.", test: s => Math.max(s.gear.rod, s.gear.pick, s.gear.blade) >= 7, reward: { rf: 200 } },
  { id: "forge10", name: "Mythsmith", blurb: "Forge any gear to +10.", test: s => Math.max(s.gear.rod, s.gear.pick, s.gear.blade) >= 10, reward: { rf: 1000 } },
  { id: "jackpot", name: "Tide Turner", blurb: "Hit the Tide Wheel jackpot.", test: s => s.stats.jackpots >= 1, reward: { shell: 250 } },
  { id: "kraken", name: "Kraken Slayer", blurb: "Share a Kraken kill.", test: s => s.stats.bossKills >= 1, reward: { shell: 200 } },
  { id: "island", name: "Island Tycoon", blurb: "Unlock every zone.", test: s => Object.values(s.zones).every(Boolean), reward: { rf: 300 } },
  { id: "flip5", name: "Degen Dolphin", blurb: "Win 5 double-or-nothing flips in total.", test: s => s.stats.flipsWon >= 5, reward: { shell: 120 } },
];

export function checkAchievements(s: GameState, events: GameEvent[]) {
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id) || !a.test(s)) continue;
    s.achievements.push(a.id);
    if (a.reward.shell) { s.shell += a.reward.shell; s.stats.shellEarned += a.reward.shell; }
    if (a.reward.rf) { s.rf += a.reward.rf; s.stats.rfWon += a.reward.rf; }
    const reward = [a.reward.shell ? `${a.reward.shell} SHELL` : "", a.reward.rf ? `${a.reward.rf / 100} RF` : ""].filter(Boolean).join(" + ");
    const text = `Achievement: ${a.name}! +${reward}`;
    events.push({ tone: "epic", text, cue: "reveal-rare", fx: "confetti" });
    s.log.unshift({ t: s.lastTick, text, tone: "epic" });
  }
}
