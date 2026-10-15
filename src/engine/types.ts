import type { StockId, VoyageId, VoyageResult } from "./voyages";
import type { CropId, EventId, FishId, GearId, ItemId, TraitId, ZoneId } from "./config";

type Plot = { crop: CropId | null; plantedAt: number; readyAt: number; withered: boolean };

export type Rival = {
  id: string; name: string; color: string; level: number; power: number; defense: number;
  vault: number; sunk: number; bot: true; lastRaidedAt: number;
};

export type DiveRun = { kind: "dive"; stake: number; crashAt: number; startedAt: number };
export type MinesRun = { kind: "mines"; stake: number; traps: number[]; revealed: number[]; trapCount: number; loot: Partial<Record<ItemId, number>>; safeHint: number | null };
type FishRun = { kind: "fish"; fish: FishId; zone: number; castAt: number };
type CrabRun = { kind: "crab"; startedAt: number };
type ActiveRun = DiveRun | MinesRun | FishRun | CrabRun;

type LastWin = { amount: number; flips: number; source: string } | null;

type LogEntry = { t: number; text: string; tone: Tone };
export type Tone = "good" | "bad" | "epic" | "info";

export type Quest = { id: number; kind: QuestKind; target: number; progress: number; reward: { shell: number; xp: number; items?: Partial<Record<ItemId, number>> } };
export type QuestKind = "fish" | "harvest" | "gather" | "dive" | "mines" | "raid" | "spend" | "forge" | "cook" | "boss";

export type Stats = {
  shellSunk: number; // SHELL paid for purchases and upgrades (stakes and losses excluded)
  shellEarned: number; shellSpent: number;
  fish: number; harvests: number; gathered: number; dives: number; bestDive: number;
  minesCashouts: number; bestMinesTiles: number; raidsWon: number; raidsLost: number; defended: number; raidedBy: number;
  bossDamage: number; bossKills: number; ascends: number; ascendFails: number; forges: number; forgeFails: number;
  spins: number; jackpots: number; voyages: number; voyageWins: number; flipsWon: number; flipsLost: number; cooked: number; goldnemo: number;
  crabRuns: number; crabBest: number;
};

export type GameState = {
  v: 1;
  friendId: string; name: string; family: number; trait: TraitId; guest: boolean;
  createdAt: number; lastTick: number; lastActive: number; seed: number;
  shell: number;
  inv: Record<ItemId, number>;
  hunger: number; energy: number; mood: number;
  level: number; xp: number; ascendPity: number;
  gear: Record<GearId, number>; forgePity: Record<GearId, number>;
  home: number; plots: Plot[]; zones: Record<ZoneId, boolean>;
  sleeping: { startedAt: number; until: number } | null;
  buffs: Record<string, number>; // id -> expires at
  cooldowns: Record<string, number>; // id -> ready at
  run: ActiveRun | null; lastWin: LastWin;
  quests: Quest[]; questSeq: number; achievements: string[];
  rivals: Rival[]; nextRivalRaidAt: number; shieldUntil: number; revenge: { rivalId: string; until: number } | null;
  event: { id: EventId; startsAt: number; endsAt: number } | null; nextEventAt: number;
  marketTide: number; nextTideAt: number;
  wheelFreeAt: number;
  boss: { epoch: number; damage: number; claimed: boolean };
  season: { id: number; xp: number; sunk: number; pass: number };
  lastSeason: { id: number; score: number; sunk: number } | null;
  story: number;
  /** npc id -> UTC day number of the last daily gift. */
  npcGifts: Record<string, number>;
  rebirths: number;
  /** milestone track id -> tier reached */
  milestones: Record<string, number>;
  streak: { day: number; count: number };
  voyage: { id: VoyageId; startedAt: number; endsAt: number; result: VoyageResult; announced: boolean } | null;
  stocks: Record<StockId, number>;
  /** Family relics found on voyages: +2% XP each, forever. */
  relics: number;
  stats: Stats;
  log: LogEntry[];
};

/** `quiet` events are logged and play their sound but show no toast, because the open panel already shows them. */
export type GameEvent = { tone: Tone; text: string; icon?: string; cue?: SoundCue; fx?: "confetti" | "shake" | "burn" | "levelup" | "jackpot"; quiet?: boolean };
export type SoundCue = "select" | "purchase" | "action-start" | "action-ready" | "anticipation" | "impact" | "reveal-common" | "reveal-rare" | "reveal-legendary" | "reward";
