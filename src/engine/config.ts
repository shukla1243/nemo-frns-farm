/**
 * Every tunable number in NEMO FRNS FARM lives here.
 * SHELL is the only in-game currency. Former RF prices and prizes were converted at 1 RF = 150 SHELL.
 * All balances are SIMULATED.
 */

export type GearId = "rod" | "pick" | "blade";
export type ZoneId = "beach" | "grove" | "cove" | "mines" | "abyss" | "forge" | "harbor" | "reef";
export type CropId = "kelp" | "carrot" | "berry" | "pumpkin";
export type FishId = "sardine" | "clownfish" | "tuna" | "angler" | "goldnemo";
export type MealId = "sushi" | "stew" | "pie" | "feast";
type MaterialId = "wood" | "stone" | "ore" | "coral" | "glass" | "pearl";
export type ItemId =
  | MaterialId | CropId | FishId | MealId
  | "kelpSeed" | "carrotSeed" | "berrySeed" | "pumpkinSeed"
  | "coconut" | "bread" | "bait" | "charm" | "blessing" | "energyDrink" | "trap";

export const ITEM_IDS: readonly ItemId[] = [
  "wood", "stone", "ore", "coral", "glass", "pearl",
  "kelp", "carrot", "berry", "pumpkin",
  "sardine", "clownfish", "tuna", "angler", "goldnemo",
  "sushi", "stew", "pie", "feast",
  "kelpSeed", "carrotSeed", "berrySeed", "pumpkinSeed",
  "coconut", "bread", "bait", "charm", "blessing", "energyDrink", "trap",
];

export const ITEMS: Record<ItemId, { name: string; icon: string; sell?: number; food?: { hunger: number; mood: number; energy?: number } }> = {
  wood: { name: "Driftwood", icon: "wood", sell: 2 },
  stone: { name: "Stone", icon: "stone", sell: 3 },
  ore: { name: "Tide Ore", icon: "ore", sell: 8 },
  coral: { name: "Coral", icon: "coral", sell: 12 },
  glass: { name: "Sea Glass", icon: "glass", sell: 15 },
  pearl: { name: "Pearl", icon: "pearl", sell: 60 },
  kelp: { name: "Kelp", icon: "kelp", sell: 3, food: { hunger: 6, mood: 0 } },
  carrot: { name: "Sea Carrot", icon: "carrot", sell: 6, food: { hunger: 10, mood: 1 } },
  berry: { name: "Coral Berry", icon: "berry", sell: 10, food: { hunger: 8, mood: 5 } },
  pumpkin: { name: "Golden Pumpkin", icon: "pumpkin", sell: 25, food: { hunger: 22, mood: 3 } },
  sardine: { name: "Sardine", icon: "sardine", sell: 4, food: { hunger: 8, mood: 0 } },
  clownfish: { name: "Clownfish", icon: "clownfish", sell: 10, food: { hunger: 12, mood: 2 } },
  tuna: { name: "Bluefin Tuna", icon: "tuna", sell: 22, food: { hunger: 18, mood: 2 } },
  angler: { name: "Abyss Angler", icon: "angler", sell: 45, food: { hunger: 26, mood: 3 } },
  goldnemo: { name: "Golden Nemo", icon: "goldnemo", sell: 160 },
  sushi: { name: "Reef Sushi", icon: "sushi", sell: 30, food: { hunger: 35, mood: 10 } },
  stew: { name: "Tide Stew", icon: "stew", sell: 55, food: { hunger: 50, mood: 12, energy: 10 } },
  pie: { name: "Berry Pie", icon: "pie", sell: 60, food: { hunger: 45, mood: 20 } },
  feast: { name: "Ocean Feast", icon: "feast", sell: 150, food: { hunger: 90, mood: 40, energy: 25 } },
  kelpSeed: { name: "Kelp Seed", icon: "kelpSeed" },
  carrotSeed: { name: "Carrot Seed", icon: "carrotSeed" },
  berrySeed: { name: "Berry Seed", icon: "berrySeed" },
  pumpkinSeed: { name: "Pumpkin Seed", icon: "pumpkinSeed" },
  coconut: { name: "Coconut", icon: "coconut", sell: 5, food: { hunger: 12, mood: 3 } },
  bread: { name: "Sea Bread", icon: "bread", food: { hunger: 15, mood: 0 } },
  bait: { name: "Bait", icon: "bait" },
  charm: { name: "Protection Charm", icon: "charm" },
  blessing: { name: "Luck Scroll", icon: "blessing" },
  energyDrink: { name: "Kelp Brew", icon: "energyDrink" },
  trap: { name: "Spike Trap", icon: "trap" },
};

// ---------- Needs ----------
export const NEEDS = {
  hungerDecayPerSec: 0.11, // ~15 min from full to empty
  moodDecayPerSec: 0.04,
  energyRegenPerSec: 0.05, // awake, only when not hungry
  hungryAt: 25,
  grumpyAt: 25,
  happyAt: 75,
  hungryYieldPenalty: 0.25,
  onlineWindowMs: 60_000, // time after the last action that still counts as play
  awayFloor: 50, // time away never drains hunger or mood below this
  baseMaxEnergy: 100,
  maxEnergyPerLevel: 3,
};

// ---------- Home ----------
export type Cost = { shell?: number; items?: Partial<Record<ItemId, number>> };
export const HOMES: { name: string; cost: Cost; defense: number; sleep: number; vault: number; perk: string }[] = [
  { name: "Beach Tent", cost: {}, defense: 5, sleep: 0.35, vault: 0, perk: "Crabs may raid you while you sleep." },
  { name: "Driftwood Hut", cost: { shell: 400, items: { wood: 30, stone: 10 } }, defense: 20, sleep: 0.6, vault: 0.2, perk: "Unlocks the kitchen." },
  { name: "Coral Cottage", cost: { shell: 1300, items: { wood: 60, stone: 40, coral: 20 } }, defense: 45, sleep: 0.8, vault: 0.35, perk: "Storm shelter protects your crops." },
  { name: "Pearl Villa", cost: { shell: 3450, items: { wood: 120, stone: 100, coral: 50, pearl: 5 } }, defense: 80, sleep: 1, vault: 0.5, perk: "Sleeping restores mood." },
  { name: "Sea Castle", cost: { shell: 10000, items: { wood: 200, stone: 200, coral: 120, pearl: 20, glass: 20 } }, defense: 130, sleep: 1, vault: 0.65, perk: "Well Rested: +10% yields after sleep." },
];
export const SLEEP_MS = 15_000;
export const TENT_THIEF = { chance: 0.2, fraction: 0.1, max: 75 };
export const TRAP_DEFENSE = 12;

// ---------- Farming ----------
export const CROPS: Record<CropId, { seed: ItemId; seedPrice: number; growMs: number; yield: [number, number]; xp: number }> = {
  kelp: { seed: "kelpSeed", seedPrice: 4, growMs: 40_000, yield: [2, 4], xp: 3 },
  carrot: { seed: "carrotSeed", seedPrice: 8, growMs: 80_000, yield: [2, 4], xp: 5 },
  berry: { seed: "berrySeed", seedPrice: 14, growMs: 140_000, yield: [2, 4], xp: 8 },
  pumpkin: { seed: "pumpkinSeed", seedPrice: 30, growMs: 280_000, yield: [2, 3], xp: 14 },
};
export const GOLDEN_CROP_CHANCE = 0.06;
export const START_PLOTS = 2;
export const MAX_PLOTS = 9;
export function plotCost(index: number): Cost {
  const n = index - START_PLOTS + 1; // 1 for the third plot
  return { shell: Math.round(60 * n ** 1.5) + 45 * n };
}

// ---------- Gathering ----------
export const GATHER = {
  chop: { energy: 4, zone: "grove" as ZoneId, xp: 3, cooldownMs: 1200 },
  quarry: { energy: 5, zone: "cove" as ZoneId, xp: 4, cooldownMs: 1200 },
};

/**
 * Quarry find chances. Dive and mines loot now scales with the stake, so the quarry carries the coral, glass and
 * ore that ascension and the forge need.
 */
export const QUARRY_FINDS = { glass: 0.15, coral: 0.16, ore: 0.22 };

// ---------- Kitchen ----------
export const RECIPES: Record<MealId, Partial<Record<ItemId, number>>> = {
  sushi: { sardine: 2, kelp: 1 },
  stew: { tuna: 1, carrot: 2 },
  pie: { berry: 3, pumpkin: 1 },
  feast: { angler: 1, tuna: 1, pumpkin: 1 },
};
export const WELL_FED_MS = 5 * 60_000;

// ---------- Market ----------
export const SHOP: { id: ItemId; price: Cost; qty: number }[] = [
  { id: "kelpSeed", price: { shell: 4 }, qty: 1 },
  { id: "carrotSeed", price: { shell: 8 }, qty: 1 },
  { id: "berrySeed", price: { shell: 14 }, qty: 1 },
  { id: "pumpkinSeed", price: { shell: 30 }, qty: 1 },
  { id: "bait", price: { shell: 6 }, qty: 1 },
  { id: "bread", price: { shell: 12 }, qty: 1 },
  { id: "energyDrink", price: { shell: 70 }, qty: 1 },
  { id: "trap", price: { shell: 120, items: { wood: 5, ore: 2 } }, qty: 1 },
  { id: "charm", price: { shell: 225 }, qty: 1 },
  { id: "blessing", price: { shell: 150 }, qty: 1 },
];
export const MARKET_TIDE_MS = 120_000;
export const MARKET_TIDE_RANGE: [number, number] = [0.7, 1.4];
export const ENERGY_DRINK = { energy: 40, mood: -3 };
/** Fish and meals cooked from fish. A reel is judged on server time but a timing skill game near network latency, so their sales are not tradable. */
export const FISH_GOODS: readonly ItemId[] = ["sardine", "clownfish", "tuna", "angler", "goldnemo", "sushi", "stew", "feast"];


// ---------- Zones (grow your island) ----------
export const ZONES: Record<ZoneId, { name: string; blurb: string; cost: Cost }> = {
  beach: { name: "Home Beach", blurb: "Your home, farm, market and dock.", cost: {} },
  grove: { name: "Palm Grove", blurb: "Chop driftwood palms.", cost: {} },
  cove: { name: "Rock Cove", blurb: "Quarry stone, sea glass and ore.", cost: { shell: 175 } },
  mines: { name: "Tide Mines", blurb: "Minesweeper dig for ore. Traps take everything.", cost: { shell: 400, items: { wood: 20 } } },
  harbor: { name: "Rival Harbor", blurb: "Raid rival crews. Defend your vault.", cost: { shell: 700, items: { wood: 30, stone: 20 } } },
  abyss: { name: "Abyss Gate", blurb: "Crash dive: cash out before the abyss bites.", cost: { shell: 800, items: { stone: 40 } } },
  forge: { name: "Volcano Forge", blurb: "Upgrade gear. Every hammer strike is a gamble.", cost: { shell: 1250, items: { stone: 60, ore: 20 } } },
  reef: { name: "Kraken Reef", blurb: "World boss. You and simulated hunters fight, top hitters split the pool.", cost: { shell: 1950, items: { coral: 30 } } },
};
export const ZONE_ORDER: ZoneId[] = ["beach", "grove", "cove", "mines", "harbor", "abyss", "forge", "reef"];

// ---------- Leveling / Ascension ----------
export const MAX_LEVEL = 50;
export const xpToNext = (level: number) => Math.round(30 * level ** 1.5);
export function ascendCost(level: number): Cost {
  const items: Partial<Record<ItemId, number>> = {};
  if (level >= 5) items.coral = Math.ceil(level / 2);
  if (level >= 10) items.pearl = Math.floor(level / 10);
  if (level >= 15) items.glass = Math.floor(level / 3);
  return { shell: 75 + 90 * level, items };
}
export const ASCEND = { base: 98, perLevel: 2.5, floor: 30, pityStep: 6, blessing: 12, happy: 5 };
export const TITLES = ["Hatchling", "Reef Scout", "Tide Runner", "Coral Knight", "Abyss Walker", "Ocean Legend"];
export const titleFor = (level: number) => TITLES[Math.min(TITLES.length - 1, Math.floor(level / 10))];

// ---------- Forge ----------
export const MAX_GEAR = 10;
export const FORGE_CHANCE = [100, 95, 88, 78, 66, 55, 44, 33, 22, 12]; // to reach +1 .. +10
export const FORGE_PITY_STEP = 3;
export function forgeCost(target: number): Cost {
  const items: Partial<Record<ItemId, number>> = { ore: 4 * target };
  if (target >= 7) items.pearl = target - 6;
  return { shell: Math.round(30 * target ** 1.7) + 25 * target, items };
}
export const GEAR: Record<GearId, { name: string; icon: string; effect: string }> = {
  rod: { name: "Reef Rod", icon: "rod", effect: "Wider catch zone, rarer fish." },
  pick: { name: "Tide Pickaxe", icon: "pick", effect: "More ore from mines and quarry." },
  blade: { name: "Coral Blade", icon: "blade", effect: "Raid and boss power, lower dive edge." },
};

// ---------- Fishing ----------
export const FISH_ENERGY = 5;
export const FISH_TABLE: { id: FishId; weight: number; xp: number; difficulty: number }[] = [
  { id: "sardine", weight: 50, xp: 5, difficulty: 0 },
  { id: "clownfish", weight: 26, xp: 8, difficulty: 0.1 },
  { id: "tuna", weight: 15, xp: 14, difficulty: 0.2 },
  { id: "angler", weight: 7, xp: 24, difficulty: 0.3 },
  { id: "goldnemo", weight: 2, xp: 60, difficulty: 0.42 },
];
export const FISH_ZONE_BASE = 0.26; // fraction of the reel bar that is "catch"
export const FISH_ZONE_PER_ROD = 0.018;
/** Until the first fish is landed the catch zone is at least this wide, so a new player's first cast is an easy win. */
export const FISH_FIRST_CATCH_ZONE = 0.45;
/**
 * Reel timing, decided on the server. The bite comes biteMinMs to biteMinMs + biteSpreadMs after the cast; the hook
 * then swings for windowMs. A reel counts when the hook was in the green at any moment between lagMaxMs and
 * lagMinMs before the server received it (the time the request was on its way), checked every stepMs.
 */
export const FISH_REEL = { biteMinMs: 900, biteSpreadMs: 1600, windowMs: 4500, lagMinMs: 40, lagMaxMs: 200, stepMs: 5 };

// ---------- Crab Dash (skill arcade, SHELL only) ----------
export const CRAB = {
  energy: 6, roundMs: 25_000, shellPerPoint: 3, maxScore: 120,
  /** A finish is accepted from roundMs minus this, so clock drift can't void a fair round. */
  finishGraceMs: 2_000,
  baitAt: 60, pearlAt: 100,
};

// ---------- Abyss Dive (crash) ----------
export const DIVE = {
  energy: 10, edge: 0.04, edgePerBlade: 0.002, growth: 0.11, maxMultiplier: 1000,
  minShell: 10, maxShellFraction: 1, lootEvery: 1,
  /** Each loot roll lands with chance stake / lootStake (capped at 1), so loot never beats the edge at any stake. */
  lootStake: 4000,
};
export const diveMultiplierAt = (ms: number) => Math.min(DIVE.maxMultiplier, Math.floor(100 * Math.exp(DIVE.growth * ms / 1000)) / 100);
export const diveTimeFor = (multiplier: number) => Math.log(multiplier) / DIVE.growth * 1000;

// ---------- Tide Mines ----------
/** Each dug tile drops loot with chance stake / lootStake (capped at 1), so loot never beats the edge at any stake. */
export const MINES = { size: 25, trapOptions: [1, 3, 5, 10, 20], energy: 8, edge: 0.03, minShell: 10, lootStake: 10_000 };

// ---------- Double or nothing ----------
export const FLIP = { winChance: 0.48, maxFlips: 5 };

// ---------- Raids ----------
export const RAID = { energy: 15, stealFraction: [0.1, 0.22] as [number, number], hospitalFraction: 0.05, minFee: 20, moodLoss: 15, shieldMs: 8 * 60_000, revengeMs: 90_000, revengeBonus: 0.15, cooldownMs: 20_000 };
export const RIVAL_RAID_INTERVAL: [number, number] = [120_000, 300_000];
export const RIVAL_RAID_MIN_SHELL = 80;
export const RIVAL_RAID_LOSS = 0.15;

// ---------- Kraken world boss ----------
export const BOSS = { periodMs: 20 * 60_000, activeMs: 12 * 60_000, hp: 60_000, energy: 10, poolShell: 4500, counterChance: 0.15, simShare: 0.8, cooldownMs: 3_000 };

// ---------- Tide Wheel ----------
type WheelPrize = { id: string; label: string; weight: number; shell?: number; items?: Partial<Record<ItemId, number>>; jackpot?: boolean };
export const WHEEL_FREE_MS = 8 * 60 * 60_000;
export const WHEEL: WheelPrize[] = [
  { id: "shell40", label: "40 SHELL", weight: 3300, shell: 40 },
  { id: "shell90", label: "90 SHELL", weight: 2100, shell: 90 },
  { id: "mats", label: "Ore x6 + Coral x3", weight: 1800, items: { ore: 6, coral: 3 } },
  { id: "charm", label: "Protection Charm", weight: 700, items: { charm: 1 } },
  { id: "shell150", label: "150 SHELL", weight: 1000, shell: 150 },
  { id: "pearl", label: "Pearl x2", weight: 600, items: { pearl: 2 } },
  { id: "shell450", label: "450 SHELL", weight: 400, shell: 450 },
  { id: "jackpot", label: "JACKPOT 3,750 SHELL", weight: 100, shell: 3750, jackpot: true },
];

// ---------- Rivals (simulated) ----------
export const RIVAL_NAMES: { name: string; color: string }[] = [
  { name: "Barnacle Bill", color: "#c0673a" }, { name: "Inky Octo", color: "#6b4fa1" },
  { name: "Pufferpunk", color: "#d8a21b" }, { name: "Captain Coral", color: "#e0605a" },
  { name: "Salty Sal", color: "#3d8fb0" }, { name: "Reef Rex", color: "#3a9c6b" },
  { name: "Gill Gates", color: "#8a8f99" }, { name: "Tidepool Tia", color: "#d65fa8" },
];

// ---------- Prosperity (spend to earn) ----------
// SHELL spent counts every purchase, so it runs about 2.5x the old RF sinks; these rates keep the RF-era pace.
export const PROSPERITY = { shellPerPercent: 2000, cap: 30 }; // +1% SHELL yields per 2,000 SHELL spent, max +30%

// ---------- World events ----------
export type EventId = "meteor" | "storm" | "boom" | "goldtide" | "frenzy";
export const EVENTS: Record<EventId, { name: string; blurb: string; ms: number; warnMs?: number }> = {
  meteor: { name: "Meteor Shower", blurb: "Quarry and mines drop double ore.", ms: 60_000 },
  storm: { name: "Tropical Storm", blurb: "Unharvested crops may wither unless your home is a Cottage or better!", ms: 45_000, warnMs: 20_000 },
  boom: { name: "Market Boom", blurb: "Sell prices x1.5.", ms: 60_000 },
  goldtide: { name: "Golden Tide", blurb: "Rare fish twice as likely.", ms: 60_000 },
  frenzy: { name: "Abyss Frenzy", blurb: "Dive loot doubled.", ms: 60_000 },
};
export const EVENT_INTERVAL: [number, number] = [90_000, 180_000];
export const STORM_WITHER_CHANCE = 0.35;

// ---------- Family traits (Character Spotlight) ----------
export type TraitId = "bonediver" | "trickster" | "homebody" | "grower" | "chaos" | "glider" | "titan" | "shiny" | "void";
export const TRAITS: { id: TraitId; family: string; name: string; blurb: string }[] = [
  { id: "bonediver", family: "Skeleton", name: "Bone Diver", blurb: "+30% Abyss dive loot, no fear of the deep." },
  { id: "trickster", family: "Mask", name: "Trickster", blurb: "Raids steal +25% more and win 5% more often." },
  { id: "homebody", family: "Family", name: "Homebody", blurb: "Sleep restores 20% more; buildings cost 10% less SHELL." },
  { id: "grower", family: "Cellular", name: "Green Cells", blurb: "Crops grow 25% faster; golden crops twice as likely." },
  { id: "chaos", family: "Asymmetry", name: "Chaos Engine", blurb: "Double-or-nothing flips win 2% more often; boss crits x2." },
  { id: "glider", family: "Hoverer", name: "Glider", blurb: "Moves 30% faster; wider fishing catch zone." },
  { id: "titan", family: "Colossus", name: "Titan", blurb: "+25% raid and boss power; needs 15% more food." },
  { id: "shiny", family: "Sparkling", name: "Sparkle Luck", blurb: "+4% success on every Forge and Ascension roll." },
  { id: "void", family: "Hollow", name: "Hollow Belly", blurb: "Hunger drains 25% slower; mines reveal one trap-free tile." },
];
export const traitFor = (family: number): TraitId => TRAITS[((family % TRAITS.length) + TRAITS.length) % TRAITS.length].id;

export const START = { shell: 3120, items: { kelpSeed: 4, bait: 5, bread: 2 } as Partial<Record<ItemId, number>> };

/** Islanders hand out one small gift per real day each. */
export const NPC_GIFTS: Record<string, { shell?: number; items?: Partial<Record<ItemId, number>> }> = {
  salt: { items: { bait: 4 } },
  mayor: { shell: 25 },
  coral: { items: { bread: 2 } },
  pip: { items: { kelpSeed: 3 } },
  moe: { items: { ore: 3 } },
  rook: { items: { trap: 1 } },
  ember: { items: { ore: 4 } },
  seer: { items: { pearl: 1 } },
};
export const dayNumber = (now: number) => Math.floor(now / 86_400_000);

/** Rebirth (prestige): restart at level 1 with permanent bonuses. Endless by design. */
export const REBIRTH = { minLevel: 30, xpBonus: 0.1, shellBonus: 0.05 };
export const rebirthCost = (rebirths: number) => 1500 + 1500 * rebirths;

/** Daily streak: rewards grow for 7 days, then the cycle repeats at full strength. */
export const streakReward = (count: number) => {
  const day = ((count - 1) % 7) + 1;
  return { shell: 40 * day + (day === 7 ? 150 : 0), items: day === 7 ? { charm: 1 } as Partial<Record<ItemId, number>> : day % 2 === 0 ? { bait: 5 } as Partial<Record<ItemId, number>> : {} };
};

// ---------- Seasons (weekly score and Season Journey) ----------
export const SEASON = {
  ms: 7 * 86_400_000,
  offsetMs: 4 * 86_400_000, // seasons roll over Monday 00:00 UTC
  shellPerPoint: 20, // one season point per 20 SHELL spent
};
export const seasonIdAt = (now: number) => Math.floor((now - SEASON.offsetMs) / SEASON.ms);
export const seasonStartOf = (id: number) => id * SEASON.ms + SEASON.offsetMs;
/** Season 1 = the week the Rare Friends Vibeathon launched (Mon 21 Sep 2026). */
export const seasonNumber = (id: number) => id - seasonIdAt(Date.UTC(2026, 8, 21, 12)) + 1;
export const RESIDENT_NAMES = [
  "Barnacle Bill", "Inky Octo", "Pufferpunk", "Captain Coral", "Salty Sal", "Reef Rex", "Gill Gates", "Tidepool Tia",
  "Kelp Kid", "Shelly Shock", "Moray Mo", "Urchin Ursa", "Squid Vicious", "Plankton Pete", "Wavy Dave", "Anemone Annie",
  "Sir Seahorse", "Lobster Lou", "Mantaray Max", "Bubbles",
];
