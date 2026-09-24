import {
  BOSS, CROPS, EVENTS, EVENT_INTERVAL, HOMES, MARKET_TIDE_MS, MARKET_TIDE_RANGE, NEEDS, RAID, RIVAL_RAID_INTERVAL,
  RIVAL_RAID_LOSS, RIVAL_RAID_MIN_SHELL, SLEEP_MS, STORM_WITHER_CHANCE, TENT_THIEF_CHANCE, SEASON, SINK, RESIDENT_NAMES, dayNumber, seasonIdAt, seasonStartOf, streakReward, type EventId, type ItemId,
} from "./config";
import { createRng, hashSeed, type Rng } from "./rng";
import { botTrades } from "./amm";
import { clamp, clampNeeds, defense, hasTrait, log, maxEnergy } from "./state";
import type { GameEvent, GameState } from "./types";

/** Boss status for a given epoch. `others` = damage by other online players (from the network). */
export function bossStatus(now: number, own: number, others = 0) {
  const epoch = Math.floor(now / BOSS.periodMs);
  const elapsed = now - epoch * BOSS.periodMs;
  const active = elapsed < BOSS.activeMs;
  // Simulated rivals wear the Kraken down so a solo player can always finish it before the window closes.
  const sim = Math.floor(BOSS.hp * Math.min(1, elapsed / (BOSS.activeMs * BOSS.simShare)));
  const total = sim + own + others;
  const defeated = total >= BOSS.hp;
  return {
    epoch, active, elapsed, sim, total: Math.min(total, BOSS.hp), hp: BOSS.hp, defeated,
    remaining: Math.max(0, BOSS.hp - total),
    endsIn: active ? BOSS.activeMs - elapsed : 0, nextIn: BOSS.periodMs - elapsed,
  };
}

const rngOf = (s: GameState) => createRng(s.seed);

/**
 * Advance time. Handles needs, sleep, crops (via timestamps), world events, market tide,
 * simulated rivals and their raids. Large gaps (offline) are capped for fairness.
 */
export function tick(s: GameState, now: number, events: GameEvent[]): void {
  const dtMs = now - s.lastTick;
  if (dtMs <= 0) return;
  const rng = rngOf(s);
  const offline = dtMs > 60_000;
  const dt = dtMs / 1000;
  s.lastTick = now;

  // --- Daily streak (automatic on the first tick of each day you play) ---
  const today = dayNumber(now);
  if (s.streak.day !== today) {
    s.streak = { day: today, count: s.streak.day === today - 1 ? s.streak.count + 1 : 1 };
    const r = streakReward(s.streak.count);
    s.shell += r.shell; s.stats.shellEarned += r.shell;
    if (r.rf) { s.rf += r.rf; s.stats.rfWon += r.rf; }
    for (const [id, n] of Object.entries(r.items)) if (n) s.inv[id as ItemId] += n;
    log(s, events, `Day ${s.streak.count} streak! +${r.shell} SHELL${r.rf ? " +1 RF and a Protection Charm" : ""}. Come back tomorrow to keep it going.`, "good", { cue: "reward", icon: "star" }, now);
  }

  // --- Voyage return (automatic announcement) ---
  if (s.voyage && !s.voyage.announced && now >= s.voyage.endsAt) {
    s.voyage.announced = true;
    log(s, events, "Your Friend is back from the voyage! Visit the Voyage Pier to see what they found.", "epic", { cue: "action-ready", icon: "chest" }, now);
  }

  // --- Sleep ---
  if (s.sleeping && now >= s.sleeping.until) wakeUp(s, events, rng, now, true);

  // --- Needs ---
  const hungerRate = NEEDS.hungerDecayPerSec * (hasTrait(s, "void") ? 0.75 : 1) * (hasTrait(s, "titan") ? 1.15 : 1) * (s.sleeping ? 0.5 : 1);
  let hungerLoss = hungerRate * dt, moodLoss = NEEDS.moodDecayPerSec * dt;
  if (offline) {
    hungerLoss = Math.min(hungerLoss, s.hunger * NEEDS.offlineDecayCap);
    moodLoss = Math.min(moodLoss, s.mood * NEEDS.offlineDecayCap);
    // Offline time counts as rest at home.
    const restFraction = HOMES[s.home].sleep * Math.min(1, dt / 600);
    s.energy += maxEnergy(s) * restFraction;
  }
  const wasHungry = s.hunger < NEEDS.hungryAt;
  s.hunger -= hungerLoss;
  s.mood -= moodLoss * (s.hunger <= 0 ? 3 : 1);
  if (!s.sleeping && s.hunger >= NEEDS.hungryAt && !offline) s.energy += NEEDS.energyRegenPerSec * dt;
  clampNeeds(s);
  if (!wasHungry && s.hunger < NEEDS.hungryAt) log(s, events, "Your Friend is hungry! Yields -25% and no energy regen until you eat.", "bad", { cue: "impact" }, now);

  // --- Crops: storm damage happens at storm start (see events) ---

  // --- Market tide ---
  if (now >= s.nextTideAt) {
    s.marketTide = Math.round((MARKET_TIDE_RANGE[0] + rng.next() * (MARKET_TIDE_RANGE[1] - MARKET_TIDE_RANGE[0])) * 100) / 100;
    s.nextTideAt = now + MARKET_TIDE_MS;
  }

  // --- Tide Pool simulated traders ---
  const market = botTrades(s.pool, now, rng);
  s.world.seasonPool += Math.floor(market.fees * SINK.pool); s.world.creatorFees += Math.floor(market.fees * SINK.creator); s.world.burned += Math.floor(market.fees * SINK.burn);

  // --- Season rollover ---
  const sid = seasonIdAt(now);
  if (sid !== s.season.id) {
    const pool = seasonPoolTotal(s, seasonStartOf(s.season.id) + SEASON.ms - 1, s.season.id);
    s.lastSeason = { id: s.season.id, score: s.season.xp + Math.floor(s.season.sunk / 100 * SEASON.rfScore), sunk: s.season.sunk, pool, claimed: false };
    s.season = { id: sid, xp: 0, sunk: 0 };
    s.world.seasonPool = Math.floor(s.world.seasonPool * SEASON.rollover);
    log(s, events, "A new Season has begun! Top 10 of last season can claim their prize at the Bounty Board.", "epic", { cue: "anticipation" }, now);
  }

  // --- World events ---
  if (s.event && now >= s.event.endsAt) {
    s.event = null;
  }
  if (s.event && s.event.id === "storm" && now >= s.event.startsAt && !s.buffs.stormHit) {
    s.buffs.stormHit = s.event.endsAt;
    if (s.home < 2) {
      let lost = 0;
      for (const p of s.plots) if (p.crop && !p.withered && rng.chance(STORM_WITHER_CHANCE)) { p.withered = true; lost++; }
      if (lost) log(s, events, `The storm withered ${lost} crop plot${lost > 1 ? "s" : ""}! A Coral Cottage protects crops.`, "bad", { cue: "impact", fx: "shake" }, now);
      else log(s, events, "The storm passed. Your crops survived!", "good", {}, now);
    } else log(s, events, "Storm raging, but your Cottage shelters the crops.", "info", {}, now);
  }
  if (!s.event && now >= s.nextEventAt && !offline) {
    const id = rng.pick(Object.keys(EVENTS) as EventId[]);
    const def = EVENTS[id];
    const startsAt = now + (def.warnMs ?? 0);
    s.event = { id, startsAt, endsAt: startsAt + def.ms };
    delete s.buffs.stormHit;
    log(s, events, `${def.warnMs ? "Incoming" : "Event"}: ${def.name}. ${def.blurb}`, id === "storm" ? "bad" : "epic", { cue: "anticipation" }, now);
    s.nextEventAt = s.event.endsAt + rng.int(EVENT_INTERVAL[0], EVENT_INTERVAL[1]);
  } else if (offline && now >= s.nextEventAt) {
    s.nextEventAt = now + rng.int(EVENT_INTERVAL[0], EVENT_INTERVAL[1]);
  }

  // --- Rivals grow ---
  for (const r of s.rivals) {
    r.vault += dt * (0.25 + r.level * 0.04);
    if (rng.chance(Math.min(1, dt / 240))) {
      r.level++; r.power += 5 + rng.int(0, 4); r.defense += 3 + rng.int(0, 5); r.burned += 40 + r.level * 10;
    }
    // Keep rivals in the player's league so the harbor stays interesting.
    if (r.level < s.level - 4) { r.level = s.level - 4 + rng.int(0, 2); r.power = 10 + r.level * 5 + rng.int(0, 15); r.defense = 5 + r.level * 4 + rng.int(0, 20); }
    r.vault = Math.floor(r.vault * 100) / 100;
  }

  // --- Rival raids on you ---
  if (now >= s.nextRivalRaidAt) {
    s.nextRivalRaidAt = now + rng.int(RIVAL_RAID_INTERVAL[0], RIVAL_RAID_INTERVAL[1]);
    if (!offline && s.shieldUntil <= now && s.shell >= RIVAL_RAID_MIN_SHELL && s.zones.harbor) rivalRaid(s, events, rng, now);
  }

  s.seed = rng.state();
}

function rivalRaid(s: GameState, events: GameEvent[], rng: Rng, now: number) {
  const r = rng.pick(s.rivals);
  const def = defense(s);
  const chance = clamp(0.5 + 0.5 * (r.power - def) / (r.power + def), 0.1, 0.85);
  if (rng.next() >= chance) {
    s.stats.defended++;
    let text = `${r.name} tried to raid your vault. Defended!`;
    if (s.inv.trap > 0 && rng.chance(0.5)) { s.inv.trap--; text += " (a trap was used up)"; }
    log(s, events, text, "good", { cue: "reward" }, now);
    return;
  }
  const exposed = s.shell * (1 - HOMES[s.home].vault);
  const loss = Math.floor(exposed * RIVAL_RAID_LOSS);
  s.shell -= loss; r.vault += loss;
  s.stats.raidedBy++;
  s.shieldUntil = now + RAID.shieldMs;
  s.revenge = { rivalId: r.id, until: now + RAID.revengeMs };
  s.mood = clamp(s.mood - 8, 0, 100);
  log(s, events, `${r.name} raided you and stole ${loss} SHELL! Revenge bonus active at the Harbor for 90s.`, "bad", { cue: "impact", fx: "shake" }, now);
}

/** Crop readiness is timestamp-based so offline growth just works. */
export const cropReady = (s: GameState, i: number, now: number) => {
  const p = s.plots[i];
  return !!p.crop && !p.withered && now >= p.readyAt;
};
export const growMs = (s: GameState, crop: keyof typeof CROPS) => CROPS[crop].growMs * (hasTrait(s, "grower") ? 0.75 : 1);

export function startSleep(s: GameState, now: number) {
  s.sleeping = { startedAt: now, until: now + SLEEP_MS };
}

export function wakeUp(s: GameState, events: GameEvent[], rng: Rng, now: number, natural: boolean) {
  if (!s.sleeping) return;
  const fraction = clamp((now - s.sleeping.startedAt) / SLEEP_MS, 0, 1);
  const home = HOMES[s.home];
  const restore = maxEnergy(s) * home.sleep * fraction * (hasTrait(s, "homebody") ? 1.2 : 1);
  s.energy += restore;
  if (s.home >= 3) s.mood += 15 * fraction;
  if (s.home >= 4 && natural) s.buffs.rested = now + 5 * 60_000;
  s.sleeping = null;
  clampNeeds(s);
  let text = `Woke up${natural ? "" : " early"}: +${Math.round(restore)} energy.`;
  if (s.home === 0 && natural && rng.chance(TENT_THIEF_CHANCE) && s.shell > 0) {
    const stolen = Math.max(1, Math.floor(s.shell * 0.1));
    s.shell -= stolen;
    text += ` Crabs raided your tent and took ${stolen} SHELL! Build a hut.`;
    log(s, events, text, "bad", { cue: "impact" }, now);
    return;
  }
  log(s, events, text, "good", { cue: "action-ready" }, now);
}

export const eventActive = (s: GameState, id: EventId, now: number) => !!s.event && s.event.id === id && now >= s.event.startsAt && now < s.event.endsAt;

// ---------- Seasons ----------
/**
 * Season Prize Pool (centi-RF): simulated island residents' spending + this player's 70% share
 * of their own RF sinks + (optionally) online players' reported contributions.
 */
export function seasonPoolTotal(s: GameState, now: number, seasonId = s.season.id, onlineSunk = 0) {
  const start = seasonStartOf(seasonId);
  const days = Math.max(0, Math.min(7, (now - start) / 86_400_000));
  const sim = SEASON.simBaseRf + Math.floor(SEASON.simPerDayRf * days);
  const own = seasonId === s.season.id ? s.world.seasonPool : 0;
  return sim + own + Math.floor(onlineSunk * SINK.pool);
}

export type SeasonEntry = { id: string; name: string; score: number; you?: boolean; online?: boolean };
/** Deterministic simulated residents (same for every client in a season) whose scores grow through the week. */
function seasonResidents(seasonId: number, now: number): SeasonEntry[] {
  const start = seasonStartOf(seasonId);
  const frac = Math.max(0, Math.min(1, (now - start) / SEASON.ms));
  const rng = createRng(hashSeed(`season-${seasonId}`));
  return RESIDENT_NAMES.map((name, i) => {
    const r = rng.next();
    const final = Math.round(400 + r * r * 14_000);
    const curve = Math.pow(frac, 0.8 + rng.next() * 0.4);
    return { id: `res-${i}`, name, score: Math.round(final * curve) };
  });
}
export function seasonBoard(s: GameState, now: number, online: SeasonEntry[] = [], seasonId = s.season.id, yourScore?: number) {
  const you: SeasonEntry = { id: "you", name: s.name, score: yourScore ?? (s.season.xp + Math.floor(s.season.sunk / 100 * SEASON.rfScore)), you: true };
  const endOrNow = seasonId === s.season.id ? now : seasonStartOf(seasonId) + SEASON.ms;
  return [...seasonResidents(seasonId, endOrNow), ...online.filter(o => o.id !== s.friendId), you].sort((a, b) => b.score - a.score);
}
