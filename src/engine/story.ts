/**
 * Story mode in three acts.
 *   Act I   "Washed Ashore": onboarding through every system and region.
 *   Act II  "Legends of the Deep": long-term goals for committed players.
 *   Act III "Tides Eternal": endless generated chapters with escalating goals.
 */
import { RF, type ItemId } from "./config";
import type { GameState } from "./types";

type Reward = { shell?: number; rf?: number; items?: Partial<Record<ItemId, number>> };
type Chapter = { act: 1 | 2 | 3; title: string; text: string; goal: string; hint: string; done: (s: GameState) => boolean; reward: Reward };

const maxGear = (s: GameState) => Math.max(s.gear.rod, s.gear.pick, s.gear.blade);

const ACT_ONE: Omit<Chapter, "act">[] = [
  { title: "Washed Ashore", text: "A wild storm tossed your Friend onto a tiny sandbar. No home, no food, just palms and possibility.", goal: "Gather driftwood 3 times in the Palm Grove", hint: "Walk west to the Palm Grove and tap Chop.", done: s => s.stats.gathered >= 3, reward: { shell: 40, items: { bread: 2 } } },
  { title: "First Harvest", text: "Seeds sprout fast in island soil. Food means energy, and energy means everything.", goal: "Plant and harvest a crop", hint: "Open the Farm, plant Kelp, wait about 40 seconds, then harvest.", done: s => s.stats.harvests >= 1, reward: { shell: 40, items: { carrotSeed: 3 } } },
  { title: "Gone Fishing", text: "The reef teems with fish, and legends say a Golden Nemo glitters in the deep.", goal: "Catch a fish at the Dock", hint: "Go to the Fishing Dock, cast, and tap REEL in the green zone.", done: s => s.stats.fish >= 1, reward: { shell: 30, items: { bait: 5 } } },
  { title: "Beyond the Bridge", text: "Grey cliffs loom to the north-west. A boardwalk would get you there.", goal: "Unlock Rock Cove", hint: "Tap the Expand sign on the beach (north-west). You need stone for a home!", done: s => s.zones.cove, reward: { shell: 60 } },
  { title: "A Roof Over Fins", text: "Crabs keep raiding your tent at night. Time to build something real.", goal: "Build a Driftwood Hut", hint: "Chop 30 wood, quarry 10 stone at Rock Cove, then open Home.", done: s => s.home >= 1, reward: { rf: 1 * RF } },
  { title: "Tide Pool Trader", text: "Islanders trade $SHELL for $RAREFRIENDS at the Tide Pool. Prices move with the tide.", goal: "Make a swap at the Tide Pool", hint: "Open the Tide Pool near the beach plaza.", done: s => s.stats.swaps >= 1, reward: { shell: 50 } },
  { title: "Rising Tide", text: "The Coral Shrine hums. Offer RF and materials and your Friend may ascend.", goal: "Ascend to level 3", hint: "Fill your XP bar, then visit the Coral Shrine.", done: s => s.level >= 3 || s.rebirths > 0, reward: { items: { blessing: 1 } } },
  { title: "Dig Deep", text: "Beneath the north sands: ore, gems and traps. Greed is the real danger.", goal: "Unlock Tide Mines and cash out a run", hint: "Cash out before you hit a trap.", done: s => s.stats.minesCashouts >= 1, reward: { shell: 80, items: { ore: 6 } } },
  { title: "Pirates!", text: "Rival Friends eye your vault. The best defense is a good raid.", goal: "Unlock Rival Harbor and win a raid", hint: "Pick a rival with green odds.", done: s => s.stats.raidsWon >= 1, reward: { items: { trap: 2 } } },
  { title: "Into the Abyss", text: "The swirling gate drags divers deeper, and pays them more the longer they dare.", goal: "Cash out an Abyss Dive at 2x or more", hint: "Set auto cash-out to 2x if your nerves are shaky.", done: s => s.stats.bestDive >= 2, reward: { items: { pearl: 2 } } },
  { title: "Fire and Steel", text: "The volcano's forge can make legends, or eat your ore.", goal: "Forge any gear to +3", hint: "Unlock the Volcano Forge. Charms soften failures.", done: s => maxGear(s) >= 3, reward: { items: { charm: 2 } } },
  { title: "Storm Shelter", text: "The storms are getting worse. A cottage of coral would keep your crops safe.", goal: "Build a Coral Cottage", hint: "Coral comes from the Mines, Cove, Abyss and the Wheel.", done: s => s.home >= 2, reward: { rf: 2 * RF } },
  { title: "Release the Kraken", text: "Every twenty minutes the Kraken rises. Only together can the island bring it down.", goal: "Share a Kraken kill", hint: "Unlock Kraken Reef, hit it while it's awake, then claim your share.", done: s => s.stats.bossKills >= 1, reward: { rf: 3 * RF } },
  { title: "Season Contender", text: "Word of your island spreads. The Season leaderboard is watching.", goal: "Reach level 10", hint: "The top 10 of each weekly season split the Season Prize Pool.", done: s => s.level >= 10 || s.rebirths > 0, reward: { rf: 5 * RF } },
  { title: "Ocean Legend", text: "From a sandbar to a Sea Castle. Your Friend's name echoes across the reef.", goal: "Build the Sea Castle and reach level 25", hint: "This is the long game. Good luck, legend.", done: s => s.home >= 4 && (s.level >= 25 || s.rebirths > 0), reward: { rf: 20 * RF } },
];

const ACT_TWO: Omit<Chapter, "act">[] = [
  { title: "The Golden Glimmer", text: "Old Salt swears he saw it again: a fish that shines like the sun.", goal: "Catch a Golden Nemo", hint: "Upgrade your Reef Rod and fish during a Golden Tide.", done: s => s.stats.goldnemo >= 1, reward: { rf: 5 * RF, items: { bait: 20 } } },
  { title: "Master Angler", text: "The fish know your shadow now. Some even swim toward it.", goal: "Catch 100 fish", hint: "Cooked fish feed you better than raw.", done: s => s.stats.fish >= 100, reward: { shell: 1500, items: { feast: 1 } } },
  { title: "Hammer and Heart", text: "Smith Ember says the forge only sings for the stubborn.", goal: "Forge any gear to +7", hint: "Pity stacks with every failure. Keep striking.", done: s => maxGear(s) >= 7, reward: { rf: 10 * RF, items: { charm: 3 } } },
  { title: "The Deep Dive", text: "Divers whisper of a depth where the water turns to starlight.", goal: "Cash out an Abyss Dive at 10x", hint: "Auto cash-out keeps your nerves out of it.", done: s => s.stats.bestDive >= 10, reward: { rf: 8 * RF, items: { pearl: 5 } } },
  { title: "Pearl Villa", text: "The island needs a proper home for its brightest Friend.", goal: "Build the Pearl Villa", hint: "Pearls come from dives, bounties, the Wheel and the Kraken.", done: s => s.home >= 3, reward: { rf: 8 * RF } },
  { title: "Green Thumb", text: "Your fields feed half the reef. The gulls have noticed.", goal: "Harvest 300 crop plots", hint: "Buy more plots and grow pumpkins for the best returns.", done: s => s.stats.harvests >= 300, reward: { shell: 3000, items: { pumpkinSeed: 20 } } },
  { title: "Pirate Legend", text: "Captain Rook raises a glass in your name. Rival crews fly white flags.", goal: "Win 50 raids", hint: "Raise power with levels and a sharper Coral Blade.", done: s => s.stats.raidsWon >= 50, reward: { rf: 12 * RF, items: { trap: 5 } } },
  { title: "Kraken's Bane", text: "The Kraken now surfaces with scars shaped like your Friend.", goal: "Share 10 Kraken kills", hint: "Hit it early and often; every hit raises your share.", done: s => s.stats.bossKills >= 10, reward: { rf: 15 * RF } },
  { title: "Tide Tycoon", text: "Coral says the market moves when you walk in.", goal: "Earn 100,000 SHELL in total", hint: "Sell during a Market Boom and claim every bounty.", done: s => s.stats.shellEarned >= 100_000, reward: { rf: 15 * RF } },
  { title: "Castle of the Sea", text: "Stone by stone, the Sea Castle rises over the tide line.", goal: "Build the Sea Castle", hint: "Save coral and pearls; it's worth it.", done: s => s.home >= 4, reward: { rf: 20 * RF } },
  { title: "Mythsmith", text: "A blade, a rod or a pick that shines like the volcano's heart.", goal: "Forge any gear to +10", hint: "Luck Scrolls and Charms make the last strikes bearable.", done: s => maxGear(s) >= 10, reward: { rf: 30 * RF } },
  { title: "Reborn", text: "The Coral Shrine offers a strange gift: begin again, stronger than before.", goal: "Perform your first Rebirth", hint: "Reach level 30, then choose Rebirth at the Coral Shrine.", done: s => s.rebirths >= 1, reward: { rf: 25 * RF, items: { blessing: 3 } } },
];

/** Endless Act III: goal tracks cycle while their targets escalate every loop. */
const ETERNAL: { goal: (t: number) => string; value: (s: GameState) => number; base: number; step: number }[] = [
  { goal: t => `Catch ${t} fish in total`, value: s => s.stats.fish, base: 250, step: 150 },
  { goal: t => `Harvest ${t} crop plots in total`, value: s => s.stats.harvests, base: 500, step: 250 },
  { goal: t => `Win ${t} raids in total`, value: s => s.stats.raidsWon, base: 75, step: 40 },
  { goal: t => `Share ${t} Kraken kills in total`, value: s => s.stats.bossKills, base: 15, step: 8 },
  { goal: t => `Spend ${t} RF in total`, value: s => Math.floor(s.stats.burned / RF), base: 500, step: 350 },
  { goal: t => `Ascend ${t} times in total`, value: s => s.stats.ascends, base: 60, step: 30 },
  { goal: t => `Cash out ${t} Tide Mines runs in total`, value: s => s.stats.minesCashouts, base: 100, step: 60 },
  { goal: t => `Reach Rebirth ${t}`, value: s => s.rebirths, base: 2, step: 1 },
];
const PLACES = ["Moonlit Shoals", "Sunken Bell", "Glass Lagoon", "Whale Road", "Ember Trench", "Coral Throne", "Singing Kelp", "Last Lighthouse", "Storm Crown", "Silent Reef", "Pearl Gate", "Tidebreaker Isle"];
const DEEDS = ["The Tale of the", "Echoes of the", "Secrets of the", "Guardians of the", "Song of the", "Return to the"];
const LORE = [
  "Sailors from far islands bring stories of a place no map remembers.",
  "The tide carries a bottle with your Friend's name written inside.",
  "Mayor Clam unrolls an older, stranger map than any you've seen.",
  "The Kraken's song changes key tonight. Something new stirs below.",
  "Pip found footprints on the beach that lead straight into the sea.",
  "The Coral Shrine glows in a colour no one on the island can name.",
];

export function chapterAt(i: number): Chapter {
  if (i < ACT_ONE.length) return { act: 1, ...ACT_ONE[i] };
  if (i < ACT_ONE.length + ACT_TWO.length) return { act: 2, ...ACT_TWO[i - ACT_ONE.length] };
  const n = i - ACT_ONE.length - ACT_TWO.length;
  const track = ETERNAL[n % ETERNAL.length];
  const target = track.base + track.step * Math.floor(n / ETERNAL.length);
  return {
    act: 3,
    title: `${DEEDS[n % DEEDS.length]} ${PLACES[(n * 7) % PLACES.length]}`,
    text: LORE[(n * 5) % LORE.length],
    goal: track.goal(target),
    hint: "Tides Eternal never ends. Every chapter asks a little more, and pays a little more.",
    done: s => track.value(s) >= target,
    reward: { shell: 500 + 250 * n, rf: (10 + 2 * n) * RF, items: n % 3 === 2 ? { charm: 2, blessing: 1 } : { pearl: 2 } },
  };
}

const ACTS = [
  { act: 1, name: "Act I: Washed Ashore", first: 0, count: ACT_ONE.length },
  { act: 2, name: "Act II: Legends of the Deep", first: ACT_ONE.length, count: ACT_TWO.length },
  { act: 3, name: "Act III: Tides Eternal", first: ACT_ONE.length + ACT_TWO.length, count: Infinity },
] as const;
export const actOf = (i: number) => ACTS[chapterAt(i).act - 1];
