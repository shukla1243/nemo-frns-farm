/** Islanders: talkable NPCs that give story guidance, tips and a small daily gift. */
import type { GameState } from "../engine/types";
import { BOSS, dayNumber, type ZoneId } from "../engine/config";
import { bossStatus } from "../engine/systems";
import { chapterAt } from "../engine/story";
import { Painter, cached, type Sprite } from "../art/pixel";

type Npc = {
  id: string; name: string; role: string; zone: ZoneId; x: number; y: number;
  look: { skin: string; shirt: string; pants: string; hat?: string; hair?: string; beard?: boolean };
  lines: (s: GameState, now: number) => string[];
};

const chapterHint = (s: GameState) => {
  const ch = chapterAt(s.story);
  return `Your next step is "${ch.title}": ${ch.goal}. ${ch.hint}`;
};

export const NPCS: Npc[] = [
  {
    id: "mayor", name: "Mayor Clam", role: "Island mayor", zone: "beach", x: 2080, y: 1560,
    look: { skin: "Y", shirt: "p", pants: "k", hat: "k", beard: true },
    lines: s => [
      `Welcome to our little island, ${s.name}! Every Friend who washes ashore gets a fresh start here.`,
      chapterHint(s),
      "Seventy percent of every RF spent on the island goes into the weekly Season Prize Pool. The ten busiest islanders split it every Monday.",
    ],
  },
  {
    id: "salt", name: "Old Salt", role: "Fisherman", zone: "beach", x: 1460, y: 1700,
    look: { skin: "y", shirt: "B", pants: "b", hat: "u", beard: true },
    lines: s => [
      s.stats.fish === 0 ? "Never cast a line? Buy bait at the market, then tap REEL when the hook's in the green." : `${s.stats.fish} fish caught! You're getting the hang of it.`,
      "Legend says a Golden Nemo swims these waters. Two in a hundred casts, if the tide's kind.",
      "A better Reef Rod from the Volcano Forge widens the green zone. Trust me.",
    ],
  },
  {
    id: "coral", name: "Coral", role: "Shopkeeper", zone: "beach", x: 1080, y: 1480,
    look: { skin: "Y", shirt: "m", pants: "w", hair: "o" },
    lines: () => [
      "Sell what you gather here. Prices ride the market tide, so watch for a Market Boom!",
      "Need RF? Swap SHELL at the Tide Pool. It's a real two-sided pool, so big swaps move the price.",
      "Protection Charms cost RF, but they give back half your materials if an upgrade fails.",
    ],
  },
  {
    id: "pip", name: "Pip", role: "Island kid", zone: "beach", x: 1520, y: 1120,
    look: { skin: "y", shirt: "G", pants: "B", hair: "W" },
    lines: s => [
      s.hunger < 40 ? "Your tummy's rumbling! Eat something from your backpack before you get weak." : "Did you know? When you're hungry you gather 25% less.",
      s.energy < 30 ? "You look sleepy. A nap at home refills your energy!" : "Sleeping in a tent is risky. Crabs steal shells at night!",
      "My favourite thing is the Tide Wheel. You get one free spin every eight hours!",
    ],
  },
  {
    id: "moe", name: "Miner Moe", role: "Tunnel boss", zone: "mines", x: 1480, y: 480,
    look: { skin: "y", shirt: "o", pants: "w", hat: "u" },
    lines: () => [
      "Every safe tile raises the multiplier. Every trap takes it all. Know when to stop!",
      "More traps means bigger multipliers, and bigger heartbreak.",
    ],
  },
  {
    id: "rook", name: "Captain Rook", role: "Harbor master", zone: "harbor", x: 2600, y: 1460,
    look: { skin: "Y", shirt: "r", pants: "k", hat: "k", beard: true },
    lines: s => [
      "Raiding is simple: your power against their defense. Green odds are your friend.",
      s.inv.trap > 0 ? `You have ${s.inv.trap} spike trap${s.inv.trap > 1 ? "s" : ""}. Each adds 12 defense.` : "Buy spike traps at the market. Each one adds 12 defense to your vault.",
      "Got raided? You get a revenge bonus for 90 seconds. Strike back fast!",
    ],
  },
  {
    id: "ember", name: "Smith Ember", role: "Forge keeper", zone: "forge", x: 2570, y: 650,
    look: { skin: "Y", shirt: "l", pants: "K", hair: "r" },
    lines: () => [
      "Up to +3 is easy. Past +6 the hammer gets moody.",
      "Every failure adds pity to your next strike on that gear. The forge remembers.",
    ],
  },
  {
    id: "seer", name: "Seer Anemone", role: "Reef oracle", zone: "reef", x: 960, y: 2210,
    look: { skin: "M", shirt: "P", pants: "p", hair: "m" },
    lines: (_s, now) => {
      const b = bossStatus(now, 0);
      return [
        b.active ? `The Kraken is awake! It sleeps again in about ${Math.ceil(b.endsIn / 60000)} minutes.` : `The Kraken rises in about ${Math.ceil(b.nextIn / 60000)} minutes. Every ${BOSS.periodMs / 60000} minutes, it returns.`,
        "Every islander who strikes it shares the prize, split by damage dealt.",
      ];
    },
  },
];

export const giftReady = (s: GameState, id: string, now: number) => s.npcGifts[id] !== dayNumber(now);

/** Villager sprite (16×24), two idle frames. */
export function villager(n: Npc, frame = 0): Sprite {
  return cached(`npc:${n.id}:${frame}`, () => {
    const L = n.look;
    const p = new Painter(16, 25);
    const bob = frame % 2;
    p.rect(4, 20, 3, 4, L.pants).rect(9, 20, 3, 4, L.pants).rect(4, 24, 3, 1, "k").rect(9, 24, 3, 1, "k");
    p.rect(3, 12 + bob, 10, 9 - bob, L.shirt).rect(1, 13 + bob, 2, 6, L.shirt).rect(13, 13 + bob, 2, 6, L.shirt);
    p.rect(1, 19, 2, 2, L.skin).rect(13, 19, 2, 2, L.skin);
    p.ellipse(8, 7 + bob, 5, 5, L.skin);
    p.px(6, 7 + bob, "k").px(10, 7 + bob, "k").rect(7, 10 + bob, 3, 1, "l");
    if (L.hair) p.rect(3, 2 + bob, 10, 3, L.hair).rect(3, 5 + bob, 2, 3, L.hair).rect(11, 5 + bob, 2, 3, L.hair);
    if (L.hat) p.rect(2, 3 + bob, 12, 2, L.hat).rect(4, 0 + bob, 8, 3, L.hat);
    if (L.beard) p.rect(4, 10 + bob, 8, 3, "z").px(5, 13 + bob, "z").px(10, 13 + bob, "z");
    return p.outline().done();
  });
}

// ---------- Ambient critters ----------
export const crab = (frame: number) => cached(`crab${frame % 2}`, () => {
  const p = new Painter(12, 8);
  p.ellipse(6, 4, 4, 2, "r").px(4, 3, "e").px(8, 3, "e").px(4, 2, "k").px(8, 2, "k");
  p.rect(0, 2 + (frame % 2), 2, 2, "r").rect(10, 2 + ((frame + 1) % 2), 2, 2, "r");
  p.px(3, 7, "r").px(5, 7, "r").px(7, 7, "r").px(9, 7, "r");
  return p.outline().done();
});
export const gull = (frame: number) => cached(`gull${frame % 2}`, () => {
  const p = new Painter(14, 7);
  if (frame % 2) { p.line(0, 1, 6, 4, "e").line(13, 1, 7, 4, "e"); } else { p.line(0, 5, 6, 3, "e").line(13, 5, 7, 3, "e"); }
  p.rect(5, 3, 4, 2, "e").px(9, 3, "u");
  return p.outline("X").done();
});
