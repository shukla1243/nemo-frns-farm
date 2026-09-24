/**
 * Every tunable number in NEMO FRNS FARM lives here.
 * RF amounts are integer centi-RF (1 RF = 100). All balances are SIMULATED.
 */

export const RF = 100;

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
  offlineDecayCap: 0.5, // offline can drain at most half of a need
  baseMaxEnergy: 100,
  maxEnergyPerLevel: 3,
};

// ---------- Home ----------
export type Cost = { rf?: number; shell?: number; items?: Partial<Record<ItemId, number>> };
export const HOMES: { name: string; cost: Cost; defense: number; sleep: number; vault: number; perk: string }[] = [
  { name: "Beach Tent", cost: {}, defense: 5, sleep: 0.35, vault: 0, perk: "Crabs may raid you while you sleep." },
  { name: "Driftwood Hut", cost: { rf: 2 * RF, shell: 100, items: { wood: 30, stone: 10 } }, defense: 20, sleep: 0.6, vault: 0.2, perk: "Unlocks the kitchen." },
  { name: "Coral Cottage", cost: { rf: 6 * RF, shell: 400, items: { wood: 60, stone: 40, coral: 20 } }, defense: 45, sleep: 0.8, vault: 0.35, perk: "Storm shelter protects your crops." },
  { name: "Pearl Villa", cost: { rf: 15 * RF, shell: 1200, items: { wood: 120, stone: 100, coral: 50, pearl: 5 } }, defense: 80, sleep: 1, vault: 0.5, perk: "Sleeping restores mood." },
  { name: "Sea Castle", cost: { rf: 40 * RF, shell: 4000, items: { wood: 200, stone: 200, coral: 120, pearl: 20, glass: 20 } }, defense: 130, sleep: 1, vault: 0.65, perk: "Well Rested: +10% yields after sleep." },
];
export const SLEEP_MS = 15_000;
export const TENT_THIEF_CHANCE = 0.2;
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
  return { shell: Math.round(60 * n ** 1.5), rf: 30 * n };
}

// ---------- Gathering ----------
export const GATHER = {
  chop: { energy: 4, zone: "grove" as ZoneId, xp: 3, cooldownMs: 1200 },
  quarry: { energy: 5, zone: "cove" as ZoneId, xp: 4, cooldownMs: 1200 },
};

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
  { id: "charm", price: { rf: 150 }, qty: 1 },
  { id: "blessing", price: { rf: 100 }, qty: 1 },
];
export const MARKET_TIDE_MS = 120_000;
export const MARKET_TIDE_RANGE: [number, number] = [0.7, 1.4];
export const ENERGY_DRINK = { energy: 40, mood: -3 };


// ---------- Zones (grow your island) ----------
export const ZONES: Record<ZoneId, { name: string; blurb: string; cost: Cost }> = {
  beach: { name: "Home Beach", blurb: "Your home, farm, market and dock.", cost: {} },
  grove: { name: "Palm Grove", blurb: "Chop driftwood palms.", cost: {} },
  cove: { name: "Rock Cove", blurb: "Quarry stone, sea glass and ore.", cost: { shell: 100, rf: 50 } },
  mines: { name: "Tide Mines", blurb: "Minesweeper dig for ore. Traps take everything.", cost: { shell: 250, rf: 100, items: { wood: 20 } } },
  harbor: { name: "Rival Harbor", blurb: "Raid other Friends. Defend your vault.", cost: { shell: 400, rf: 200, items: { wood: 30, stone: 20 } } },
  abyss: { name: "Abyss Gate", blurb: "Crash dive: cash out before the abyss bites.", cost: { shell: 500, rf: 200, items: { stone: 40 } } },
  forge: { name: "Volcano Forge", blurb: "Upgrade gear. Every hammer strike is a gamble.", cost: { shell: 800, rf: 300, items: { stone: 60, ore: 20 } } },
  reef: { name: "Kraken Reef", blurb: "World boss. Everyone fights, top hitters split the pool.", cost: { shell: 1200, rf: 500, items: { coral: 30 } } },
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
  return { rf: 50 + 40 * level, shell: 30 * level, items };
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
  return { rf: Math.round(20 * target ** 1.7), shell: 25 * target, items };
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

// ---------- Abyss Dive (crash) ----------
export const DIVE = {
  energy: 10, edge: 0.04, edgePerBlade: 0.002, growth: 0.11, maxMultiplier: 1000,
  minShell: 10, minRf: 10, maxShellFraction: 1, lootEvery: 1,
};
export const diveMultiplierAt = (ms: number) => Math.min(DIVE.maxMultiplier, Math.floor(100 * Math.exp(DIVE.growth * ms / 1000)) / 100);
export const diveTimeFor = (multiplier: number) => Math.log(multiplier) / DIVE.growth * 1000;

// ---------- Tide Mines ----------
export const MINES = { size: 25, trapOptions: [1, 3, 5, 10, 20], energy: 8, edge: 0.03, minShell: 10, minRf: 10 };

// ---------- Double or nothing ----------
export const FLIP = { winChance: 0.48, maxFlips: 5 };

// ---------- Raids ----------
export const RAID = { energy: 15, stealFraction: [0.1, 0.22] as [number, number], hospitalFraction: 0.05, moodLoss: 15, shieldMs: 8 * 60_000, revengeMs: 90_000, revengeBonus: 0.15, cooldownMs: 20_000 };
export const RIVAL_RAID_INTERVAL: [number, number] = [120_000, 300_000];
export const RIVAL_RAID_MIN_SHELL = 80;
export const RIVAL_RAID_LOSS = 0.15;

// ---------- Kraken world boss ----------
export const BOSS = { periodMs: 20 * 60_000, activeMs: 12 * 60_000, hp: 60_000, energy: 10, poolRf: 30 * RF, counterChance: 0.15, simShare: 0.8, cooldownMs: 3_000 };

// ---------- Tide Wheel ----------
type WheelPrize = { id: string; label: string; weight: number; shell?: number; rf?: number; items?: Partial<Record<ItemId, number>>; jackpot?: boolean };
export const WHEEL_COST = 1 * RF;
export const WHEEL_FREE_MS = 8 * 60 * 60_000;
export const WHEEL: WheelPrize[] = [
  { id: "shell40", label: "40 SHELL", weight: 3300, shell: 40 },
  { id: "shell90", label: "90 SHELL", weight: 2100, shell: 90 },
  { id: "mats", label: "Ore x6 + Coral x3", weight: 1800, items: { ore: 6, coral: 3 } },
  { id: "charm", label: "Protection Charm", weight: 700, items: { charm: 1 } },
  { id: "rf1", label: "1 RF", weight: 1000, rf: 100 },
  { id: "pearl", label: "Pearl x2", weight: 600, items: { pearl: 2 } },
  { id: "rf3", label: "3 RF", weight: 400, rf: 300 },
  { id: "jackpot", label: "JACKPOT 25 RF", weight: 100, rf: 2500, jackpot: true },
];

// ---------- Rivals (simulated) ----------
export const RIVAL_NAMES: { name: string; color: string }[] = [
  { name: "Barnacle Bill", color: "#c0673a" }, { name: "Inky Octo", color: "#6b4fa1" },
  { name: "Pufferpunk", color: "#d8a21b" }, { name: "Captain Coral", color: "#e0605a" },
  { name: "Salty Sal", color: "#3d8fb0" }, { name: "Reef Rex", color: "#3a9c6b" },
  { name: "Gill Gates", color: "#8a8f99" }, { name: "Tidepool Tia", color: "#d65fa8" },
];

// ---------- Prosperity (burn to earn) ----------
export const PROSPERITY = { rfPerPercent: 5 * RF, cap: 30 }; // +1% SHELL yields per 5 RF burned, max +30%

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

export const START = { rf: 20 * RF, shell: 120, items: { kelpSeed: 4, bait: 3, bread: 2 } as Partial<Record<ItemId, number>> };
export const AUTOSAVE_MS = 10_000;

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
export const rebirthCost = (rebirths: number) => (10 + 10 * rebirths) * RF;

/** Daily streak: rewards grow for 7 days, then the cycle repeats at full strength. */
export const streakReward = (count: number) => {
  const day = ((count - 1) % 7) + 1;
  return { shell: 40 * day, rf: day === 7 ? 1 * RF : 0, items: day === 7 ? { charm: 1 } as Partial<Record<ItemId, number>> : day % 2 === 0 ? { bait: 5 } as Partial<Record<ItemId, number>> : {} };
};

// ---------- RF sink split & Seasons (spend-to-earn loop) ----------
/** Every RF the game takes in is split: 70% Season Prize Pool, 25% creator treasury, 5% burned forever. */
export const SINK = { pool: 0.7, creator: 0.25, burn: 0.05 };
export const SEASON = {
  ms: 7 * 86_400_000,
  offsetMs: 4 * 86_400_000, // seasons roll over Monday 00:00 UTC
  payouts: [0.3, 0.2, 0.12, 0.08, 0.06, 0.05, 0.05, 0.05, 0.05, 0.04], // top-10 shares of the pool
  rollover: 0.1, // 10% of the pool seeds the next season
  simBaseRf: 300 * RF, // simulated island residents' contributions
  simPerDayRf: 60 * RF,
  rfScore: 20, // season points per 1 RF spent
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
