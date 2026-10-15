import { describe, expect, it } from "vitest";
import {
  BOSS, FISH_FIRST_CATCH_ZONE, HOMES, MINES, NEEDS, SLEEP_MS, START, WHEEL, ZONES, ascendCost, bossStatus, createState, diveMultiplierAt,
  dayNumber, dispatch, forgeCost, maxEnergy, minesMultiplier, xpToNext, type Action, type GameState,
} from "../src/engine";
import { exportSave, importSave } from "../src/game/save";

const T0 = 1_800_000_000_000;
// Today's streak is pre-claimed so each test measures only its own mechanic.
const fresh = (over: Partial<GameState> = {}, family = 0): GameState => ({ ...createState({ friendId: "42", name: "Friend #42", family, guest: false, now: T0, seed: 7 }), streak: { day: dayNumber(T0), count: 1 }, ...over });
const rich = (s: GameState) => {
  s.shell = 100_000;
  for (const k of Object.keys(s.inv)) s.inv[k as keyof typeof s.inv] = 500;
  for (const z of Object.keys(s.zones)) s.zones[z as keyof typeof s.zones] = true;
  s.achievements.push("island"); // its SHELL reward would blur balance checks
  return s;
};
function run(s: GameState, a: Action, now = s.lastTick) { return dispatch(s, a, now); }

describe("state", () => {
  it("starts with simulated grant, two plots, beach+grove unlocked, three quests", () => {
    const s = fresh();
    expect(s.shell).toBe(START.shell);
    expect(s.plots).toHaveLength(2);
    expect(s.zones.beach && s.zones.grove).toBe(true);
    expect(s.zones.abyss).toBe(false);
    expect(s.quests).toHaveLength(3);
    expect(s.trait).toBe("bonediver");
  });
  it("maps each of the 9 Friend families to a unique trait", () => {
    const traits = new Set(Array.from({ length: 9 }, (_, f) => fresh({}, f).trait));
    expect(traits.size).toBe(9);
  });
});

describe("needs", () => {
  it("hunger and mood decay over time and hungry halts energy regen", () => {
    const s = fresh({ hunger: 30, energy: 50 });
    const r = run(s, { type: "tick" }, T0 + 60_000);
    expect(r.state.hunger).toBeLessThan(30);
    expect(r.state.hunger).toBeGreaterThan(20);
    expect(r.events.some(e => e.text.includes("hungry"))).toBe(true);
    const r2 = run(r.state, { type: "tick" }, T0 + 90_000);
    expect(r2.state.energy).toBe(r.state.energy); // no regen while hungry
  });
  it("offline decay is capped at half", () => {
    const s = fresh({ hunger: 80, mood: 80 });
    const r = run(s, { type: "tick" }, T0 + 24 * 3600_000);
    expect(r.state.hunger).toBeGreaterThanOrEqual(40);
    expect(r.state.mood).toBeGreaterThanOrEqual(40);
  });
  it("eating restores hunger and consumes food", () => {
    const s = fresh({ hunger: 20 });
    const r = run(s, { type: "eat", item: "bread" });
    expect(r.ok).toBe(true);
    expect(r.state.inv.bread).toBe(1);
    expect(r.state.hunger).toBeCloseTo(35, 0);
  });
  it("starving Friends cannot work", () => {
    const s = fresh({ hunger: 0 });
    const r = run(s, { type: "gather", kind: "chop" });
    expect(r.ok).toBe(false);
    expect(r.events.at(-1)!.text).toMatch(/starving/);
  });
  it("sleep restores energy according to home tier", () => {
    for (const home of [0, 2, 4]) {
      const s = fresh({ energy: 0, home, hunger: 100 });
      const slept = run(s, { type: "sleep" }).state;
      expect(run(slept, { type: "gather", kind: "chop" }, T0 + 10).ok).toBe(false); // asleep
      const woke = run(slept, { type: "tick" }, T0 + SLEEP_MS + 1).state;
      expect(woke.sleeping).toBeNull();
      expect(woke.energy).toBeGreaterThanOrEqual(Math.floor(maxEnergy(woke) * HOMES[home].sleep) - 1);
    }
  });
});

describe("building & island growth", () => {
  it("home upgrade needs materials and sinks SHELL", () => {
    const s = fresh();
    expect(run(s, { type: "buildHome" }).ok).toBe(false);
    const r = run(rich(fresh()), { type: "buildHome" });
    expect(r.ok).toBe(true);
    expect(r.state.home).toBe(1);
    expect(r.state.stats.shellSunk).toBe(HOMES[1].cost.shell);
  });
  it("unlocking a zone sinks SHELL and opens it", () => {
    const s = fresh({ shell: 1000 });
    s.inv.wood = 50;
    const r = run(s, { type: "unlockZone", zone: "cove" });
    expect(r.ok).toBe(true);
    expect(r.state.zones.cove).toBe(true);
    expect(r.state.stats.shellSunk).toBe(ZONES.cove.cost.shell);
  });
  it("locked zones block their activities", () => {
    expect(run(fresh(), { type: "gather", kind: "quarry" }).ok).toBe(false);
    expect(run(fresh(), { type: "diveStart", stake: 10 }).ok).toBe(false);
  });
});

describe("farming", () => {
  it("plants and harvests after the grow time", () => {
    const s = fresh();
    const planted = run(s, { type: "plant", plot: 0, crop: "kelp" }).state;
    expect(run(planted, { type: "harvest", plot: 0 }, T0 + 1000).ok).toBe(false);
    const r = run(planted, { type: "harvest", plot: 0 }, T0 + 41_000);
    expect(r.ok).toBe(true);
    expect(r.state.inv.kelp).toBeGreaterThanOrEqual(1);
    expect(r.state.stats.harvests).toBe(1);
  });
  it("tent crabs steal at most 75 SHELL a night", () => {
    let thefts = 0;
    for (let seed = 1; seed < 200; seed++) {
      const s = fresh({ shell: 5000, energy: 10, seed });
      const slept = run(s, { type: "sleep" }).state;
      const woke = run(slept, { type: "tick" }, T0 + SLEEP_MS + 10).state;
      const lost = 5000 - woke.shell;
      if (lost > 0) { thefts++; expect(lost).toBeLessThanOrEqual(75); }
    }
    expect(thefts).toBeGreaterThan(0);
  });
  it("storms can wither crops of tent owners, not cottage owners", () => {
    let withered = 0, cottageWithered = 0;
    for (let seed = 1; seed < 80; seed++) {
      for (const home of [0, 2]) {
        const s = { ...createState({ friendId: "1", name: "x", family: 0, guest: false, now: T0, seed }), home };
        s.plots.forEach(p => Object.assign(p, { crop: "kelp", plantedAt: T0, readyAt: T0 + 99_999_999 }));
        s.event = { id: "storm", startsAt: T0 + 10, endsAt: T0 + 50_000 };
        const r = run(s, { type: "tick" }, T0 + 20);
        const n = r.state.plots.filter(p => p.withered).length;
        if (home === 0) withered += n; else cottageWithered += n;
      }
    }
    expect(withered).toBeGreaterThan(0);
    expect(cottageWithered).toBe(0);
  });
});

describe("gathering", () => {
  it("chop gives wood, costs energy, respects cooldown", () => {
    const s = fresh();
    const r = run(s, { type: "gather", kind: "chop" });
    expect(r.ok).toBe(true);
    expect(r.state.inv.wood).toBeGreaterThan(0);
    expect(r.state.energy).toBeLessThan(100);
    expect(run(r.state, { type: "gather", kind: "chop" }, T0 + 100).ok).toBe(false);
    expect(run(r.state, { type: "gather", kind: "chop" }, T0 + 1300).ok).toBe(true);
  });
});

describe("Abyss Dive (crash)", () => {
  it("cashing out before the crash pays stake x multiplier", () => {
    const s = rich(fresh());
    s.shell = 1000;
    const started = run(s, { type: "diveStart", stake: 100 });
    expect(started.state.shell).toBe(900);
    const r = run(started.state, { type: "diveCashout" }, T0 + 1500);
    const mult = diveMultiplierAt(1500);
    if (!r.data!.crashed) expect(r.state.shell).toBe(900 + Math.floor(100 * mult));
    else expect(r.state.shell).toBe(900);
  });
  it("a crash keeps the stake that left the wallet at dive start", () => {
    const s = rich(fresh());
    const started = run(s, { type: "diveStart", stake: 100 });
    for (let seed = 1; seed < 60; seed++) {
      const r = run({ ...started.state, seed }, { type: "diveCashout" }, T0 + 20_000);
      if (!r.data!.crashed) continue;
      expect(r.state.shell).toBe(started.state.shell);
      expect(r.state.shell).toBe(s.shell - 100);
      return;
    }
    throw new Error("no crash at 9x in 60 seeds");
  });
});

describe("Tide Mines", () => {
  it("multiplier is fair minus edge", () => {
    // P(survive k picks) * multiplier = 1 - edge
    for (const traps of MINES.trapOptions) for (let k = 1; k <= Math.min(5, 25 - traps); k++) {
      let p = 1; for (let i = 0; i < k; i++) p *= (25 - traps - i) / (25 - i);
      expect(p * minesMultiplier(traps, k)).toBeLessThanOrEqual(0.9701);
      expect(p * minesMultiplier(traps, k)).toBeGreaterThan(0.9);
    }
  });
  it("revealing a trap loses the stake; cashout pays", () => {
    const s = rich(fresh());
    const started = run(s, { type: "minesStart", stake: 100, traps: 3 });
    expect(started.ok).toBe(true);
    const reveals = Array.from({ length: 60 }, (_, seed) => run({ ...started.state, seed: seed + 1 }, { type: "minesReveal", index: 0 }));
    const trapHit = reveals.find(r => r.data!.trap)!;
    expect(trapHit.state.run).toBeNull();
    expect(trapHit.state.shell).toBe(started.state.shell);
    const dug = reveals.find(r => !r.data!.trap)!;
    const cashed = run(dug.state, { type: "minesCashout" });
    expect(cashed.state.shell).toBe(started.state.shell + Math.floor(100 * minesMultiplier(3, 1)));
  });
});

describe("double or nothing", () => {
  it("flip has ~48% win rate and loses the whole amount", () => {
    let wins = 0; const N = 2000;
    for (let i = 0; i < N; i++) {
      const s = { ...fresh(), seed: i + 1, lastWin: { amount: 100, flips: 0, source: "test" }, shell: 500 };
      const r = run(s, { type: "flip" });
      if (r.data!.won) { wins++; expect(r.state.shell).toBe(600); } else expect(r.state.shell).toBe(400);
    }
    expect(wins / N).toBeGreaterThan(0.44);
    expect(wins / N).toBeLessThan(0.52);
  });
});

describe("fishing", () => {
  it("needs bait; a hit lands a fish", () => {
    const s = fresh(); s.inv.bait = 0;
    expect(run(s, { type: "fishCast" }).ok).toBe(false);
    const cast = run(fresh(), { type: "fishCast" });
    expect(cast.ok).toBe(true);
    expect(cast.state.inv.bait).toBe(4);
    const reel = run(cast.state, { type: "fishReel", hit: true });
    expect(reel.data!.caught).toBe(true);
    expect(reel.state.stats.fish).toBe(1);
    // The Dock panel shows the catch inline, so the event stays in the log without a toast behind the panel.
    expect(reel.events.find(e => /Caught/.test(e.text))?.quiet).toBe(true);
    const miss = run(cast.state, { type: "fishReel", hit: false });
    expect(miss.data!.caught).toBe(false);
  });
  it("a new Friend starts with 5 bait and an easier first catch", () => {
    expect(fresh().inv.bait).toBe(5);
    const zone = (s: GameState) => (run(s, { type: "fishCast" }).state.run as { zone: number }).zone;
    const first = zone(fresh());
    const later = zone(fresh({ stats: { ...fresh().stats, fish: 1 } }));
    expect(first).toBeGreaterThan(later);
    expect(first).toBeGreaterThanOrEqual(FISH_FIRST_CATCH_ZONE);
  });
});

describe("raids", () => {
  it("raiding a rival by id either steals shell or charges a clinic fee", () => {
    const s = rich(fresh());
    const r = run(s, { type: "raid", rivalId: s.rivals[0].id });
    expect(r.ok).toBe(true);
    if (r.data!.won) expect(r.state.shell).toBeGreaterThan(s.shell);
    else expect(r.state.shell).toBeLessThan(s.shell);
  });
  it("the loot comes from the engine's own rival, never from the request", () => {
    const s = rich(fresh());
    const bot = s.rivals[0];
    bot.defense = 0; bot.vault = 100;
    const forged = { type: "raid", rivalId: bot.id, target: { ...bot, vault: 10_000_000 } } as unknown as Action;
    for (let seed = 1; seed < 40; seed++) {
      const r = run({ ...structuredClone(s), seed }, forged);
      if (r.data?.won) expect(r.data.stolen as number).toBeLessThanOrEqual(Math.ceil(100 * 0.22 * 1.25));
    }
  });
  it("an unknown rival cannot be raided", () => {
    expect(run(rich(fresh()), { type: "raid", rivalId: "npub-x" }).ok).toBe(false);
  });
});

describe("removed network actions", () => {
  it("unknown action types are rejected", () => {
    const s = fresh({ shell: 1000 });
    for (const a of [{ type: "raidReceived", id: "e1", attacker: "Pal", amount: 999 }, { type: "swap" }, { type: "seasonClaim", rank: 1, pool: 1 }, { type: "nope" }]) {
      const r = run(s, a as unknown as Action);
      expect(r.ok).toBe(false);
      expect(r.state.shell).toBe(1000);
    }
  });
  it("results carry no network outbox", () => {
    expect("outbox" in run(fresh(), { type: "tick" })).toBe(false);
  });
  it("reported damage from other players cannot finish the Kraken", () => {
    const epochStart = Math.ceil(T0 / BOSS.periodMs) * BOSS.periodMs;
    const s = rich(fresh()); s.lastTick = epochStart;
    const hit = run(s, { type: "bossAttack" }, epochStart + 1000);
    const claim = run(hit.state, { type: "bossClaim", others: 10_000_000 } as unknown as Action, epochStart + 2000);
    expect(claim.ok).toBe(false);
  });
});

describe("Kraken boss", () => {
  it("simulated rivals defeat the Kraken within the window; hitters can claim", () => {
    const epochStart = Math.ceil(T0 / BOSS.periodMs) * BOSS.periodMs;
    const s = rich(fresh()); s.lastTick = epochStart;
    const hit = run(s, { type: "bossAttack" }, epochStart + 1000);
    expect(hit.ok).toBe(true);
    expect(run(hit.state, { type: "bossClaim" }, epochStart + 2000).ok).toBe(false);
    const late = epochStart + BOSS.activeMs * 0.9;
    expect(bossStatus(late, 0).defeated).toBe(true);
    const claim = run(hit.state, { type: "bossClaim" }, late);
    expect(claim.ok).toBe(true);
    expect(claim.state.shell).toBeGreaterThan(hit.state.shell);
    expect(run(claim.state, { type: "bossClaim" }, late + 1).ok).toBe(false);
  });
});

describe("Tide Wheel", () => {
  it("the free spin is a modest gift: its expected value stays under 250 SHELL", () => {
    const total = WHEEL.reduce((n, p) => n + p.weight, 0);
    const itemValue: Record<string, number> = { ore: 8, coral: 12, pearl: 60, charm: 225 };
    const ev = WHEEL.reduce((sum, p) => {
      const shell = (p.shell ?? 0) + Object.entries(p.items ?? {}).reduce((v, [k, n]) => v + itemValue[k] * n!, 0);
      return sum + p.weight / total * shell;
    }, 0);
    expect(ev).toBeLessThan(250);
  });
  it("the free spin has a cooldown", () => {
    const s = fresh();
    const f = run(s, { type: "spin", free: true });
    expect(f.ok).toBe(true);
    expect(run(f.state, { type: "spin", free: true }).ok).toBe(false);
  });
});

describe("ascension & forge", () => {
  it("cannot ascend without full XP; success levels up, failure spends + pity", () => {
    const s = rich(fresh());
    expect(run(s, { type: "ascend" }).ok).toBe(false);
    s.xp = xpToNext(1);
    let successes = 0, fails = 0;
    for (let seed = 1; seed < 300; seed++) {
      const t = { ...structuredClone(s), seed, level: 20, xp: xpToNext(20) };
      const r = run(t, { type: "ascend", charm: true });
      expect(r.state.stats.shellSunk).toBe(ascendCost(20).shell);
      if (r.data!.success) { successes++; expect(r.state.level).toBe(21); }
      else { fails++; expect(r.state.ascendPity).toBe(1); expect(r.state.inv.charm).toBe(499); }
    }
    expect(successes).toBeGreaterThan(0);
    expect(fails).toBeGreaterThan(0);
  });
  it("forge success raises gear, failure never downgrades", () => {
    const s = rich(fresh());
    s.gear.blade = 9;
    for (let seed = 1; seed < 50; seed++) {
      const r = run({ ...structuredClone(s), seed }, { type: "forge", gear: "blade" });
      expect(r.state.gear.blade).toBeGreaterThanOrEqual(9);
      expect(r.state.stats.shellSunk).toBe(forgeCost(10).shell);
    }
  });
});

describe("quests", () => {
  it("claim rewards and rotate the bounty", () => {
    const s = fresh();
    s.quests[0].progress = s.quests[0].target;
    const id = s.quests[0].id;
    const r = run(s, { type: "claimQuest", id });
    expect(r.ok).toBe(true);
    expect(r.state.shell).toBeGreaterThan(s.shell);
    expect(r.state.quests.find(q => q.id === id)).toBeUndefined();
    expect(r.state.quests).toHaveLength(3);
  });
});

describe("robustness", () => {
  it("rejected actions leave balances untouched", () => {
    const s = fresh();
    const r = run(s, { type: "buildHome" });
    expect(r.ok).toBe(false);
    expect(r.state.shell).toBe(s.shell);
  });
  it("save codes round-trip and reject tampering / wrong Friend", () => {
    const s = rich(fresh());
    const code = exportSave(s);
    const back = importSave(code, "42");
    expect(back.shell).toBe(s.shell);
    expect(() => importSave(code, "43")).toThrow(/belongs/);
    const [p, sum, body] = code.split(".");
    expect(() => importSave(`${p}.${sum}.${body.slice(0, -4)}AAAA`, "42")).toThrow();
  });
  it("needs regen during awake time when fed", () => {
    const s = fresh({ energy: 10, hunger: 100 });
    const r = run(s, { type: "tick" }, T0 + 30_000);
    expect(r.state.energy).toBeCloseTo(10 + NEEDS.energyRegenPerSec * 30, 1);
  });
});
