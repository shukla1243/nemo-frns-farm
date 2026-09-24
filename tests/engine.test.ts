import { describe, expect, it } from "vitest";
import {
  BOSS, DIVE, HOMES, MINES, NEEDS, RF, SLEEP_MS, WHEEL, ZONES, ascendCost, bossStatus, createRng, createState, diveMultiplierAt,
  dayNumber, dispatch, exportSave, forgeCost, importSave, maxEnergy, minesMultiplier, xpToNext, type Action, type GameState,
} from "../src/engine";

const T0 = 1_800_000_000_000;
// Today's streak is pre-claimed so each test measures only its own mechanic.
const fresh = (over: Partial<GameState> = {}, family = 0): GameState => ({ ...createState({ friendId: "42", name: "Friend #42", family, guest: false, now: T0, seed: 7 }), streak: { day: dayNumber(T0), count: 1 }, ...over });
const rich = (s: GameState) => {
  s.rf = 1000 * RF; s.shell = 100_000;
  for (const k of Object.keys(s.inv)) s.inv[k as keyof typeof s.inv] = 500;
  for (const z of Object.keys(s.zones)) s.zones[z as keyof typeof s.zones] = true;
  return s;
};
function run(s: GameState, a: Action, now = s.lastTick) { return dispatch(s, a, now); }

describe("state", () => {
  it("starts with simulated grant, two plots, beach+grove unlocked, three quests", () => {
    const s = fresh();
    expect(s.rf).toBe(20 * RF);
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
  it("home upgrade needs materials and burns RF", () => {
    const s = fresh();
    expect(run(s, { type: "buildHome" }).ok).toBe(false);
    const r = run(rich(fresh()), { type: "buildHome" });
    expect(r.ok).toBe(true);
    expect(r.state.home).toBe(1);
    expect(r.state.stats.burned).toBe(HOMES[1].cost.rf);
  });
  it("unlocking a zone burns RF and opens it", () => {
    const s = fresh({ shell: 1000 });
    s.inv.wood = 50;
    const r = run(s, { type: "unlockZone", zone: "cove" });
    expect(r.ok).toBe(true);
    expect(r.state.zones.cove).toBe(true);
    expect(r.state.stats.burned).toBe(ZONES.cove.cost.rf);
  });
  it("locked zones block their activities", () => {
    expect(run(fresh(), { type: "gather", kind: "quarry" }).ok).toBe(false);
    expect(run(fresh(), { type: "diveStart", stake: 10, currency: "shell" }).ok).toBe(false);
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
  it("crash point distribution returns ~ (1 - edge) for any target", () => {
    const rng = createRng(123);
    const edge = DIVE.edge;
    for (const target of [1.5, 2, 5, 10]) {
      let ret = 0; const N = 200_000;
      for (let i = 0; i < N; i++) {
        const crash = Math.max(1, Math.floor(100 * (1 - edge) / (1 - rng.next())) / 100);
        if (crash > target) ret += target;
      }
      expect(ret / N).toBeGreaterThan(0.9);
      expect(ret / N).toBeLessThan(0.985);
    }
  });
  it("cashing out before the crash pays stake x multiplier", () => {
    const s = rich(fresh());
    s.shell = 1000;
    const started = run(s, { type: "diveStart", stake: 100, currency: "shell" });
    expect(started.state.shell).toBe(900);
    const run0 = started.state.run as { crashAt: number };
    const t = run0.crashAt > 1.2 ? 1500 : 0;
    const r = run(started.state, { type: "diveCashout" }, T0 + t);
    const mult = diveMultiplierAt(t);
    if (mult < run0.crashAt) { expect(r.data!.crashed).toBe(false); expect(r.state.shell).toBe(900 + Math.floor(100 * mult)); }
    else expect(r.data!.crashed).toBe(true);
  });
  it("RF lost to the abyss is burned", () => {
    const s = rich(fresh());
    const started = run(s, { type: "diveStart", stake: 100, currency: "rf" });
    const r = run(started.state, { type: "diveCrash" }, T0 + 10);
    expect(r.state.stats.burned).toBe(100);
    expect(started.state.stats.burned).toBe(0);
    expect(r.state.rf).toBe(started.state.rf); // stake already left the wallet at dive start
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
    const started = run(s, { type: "minesStart", stake: 100, currency: "shell", traps: 3 });
    expect(started.ok).toBe(true);
    const run0 = started.state.run as { traps: number[] };
    const trapHit = run(started.state, { type: "minesReveal", index: run0.traps[0] });
    expect(trapHit.data!.trap).toBe(true);
    expect(trapHit.state.run).toBeNull();
    const safe = [...Array(25).keys()].find(i => !run0.traps.includes(i))!;
    const dug = run(started.state, { type: "minesReveal", index: safe });
    const cashed = run(dug.state, { type: "minesCashout" });
    expect(cashed.state.shell).toBe(started.state.shell + Math.floor(100 * minesMultiplier(3, 1)));
  });
});

describe("double or nothing", () => {
  it("flip has ~48% win rate and loses the whole amount", () => {
    let wins = 0; const N = 2000;
    for (let i = 0; i < N; i++) {
      const s = { ...fresh(), seed: i + 1, lastWin: { amount: 100, currency: "shell" as const, flips: 0, source: "test" }, shell: 500 };
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
    expect(cast.state.inv.bait).toBe(2);
    const reel = run(cast.state, { type: "fishReel", hit: true });
    expect(reel.data!.caught).toBe(true);
    expect(reel.state.stats.fish).toBe(1);
    const miss = run(cast.state, { type: "fishReel", hit: false });
    expect(miss.data!.caught).toBe(false);
  });
});

describe("raids", () => {
  it("raiding a bot either steals shell or charges a clinic fee", () => {
    const s = rich(fresh());
    const bot = s.rivals[0];
    const r = run(s, { type: "raid", target: { ...bot } });
    expect(r.ok).toBe(true);
    if (r.data!.won) expect(r.state.shell).toBeGreaterThan(s.shell);
    else expect(r.state.shell).toBeLessThan(s.shell);
    expect(r.outbox).toHaveLength(0); // bots are local
  });
  it("raiding an online player produces a network message", () => {
    const s = rich(fresh());
    const r = run(s, { type: "raid", target: { id: "npub-x", name: "Online Pal", level: 1, power: 10, defense: 1, vault: 500, bot: false } });
    expect(r.outbox[0]).toMatchObject({ kind: "raid", targetId: "npub-x" });
  });
  it("incoming online raids are capped and grant a shield", () => {
    const s = fresh({ shell: 1000 });
    const r = run(s, { type: "raidReceived", id: "e1", attacker: "Pal", amount: 999999 });
    expect(r.state.shell).toBe(900);
    const again = run(r.state, { type: "raidReceived", id: "e2", attacker: "Pal", amount: 50 });
    expect(again.state.shell).toBe(900);
  });
});

describe("Kraken boss", () => {
  it("simulated rivals defeat the Kraken within the window; hitters can claim", () => {
    const epochStart = Math.ceil(T0 / BOSS.periodMs) * BOSS.periodMs;
    const s = rich(fresh()); s.lastTick = epochStart;
    const hit = run(s, { type: "bossAttack" }, epochStart + 1000);
    expect(hit.ok).toBe(true);
    expect(hit.outbox[0].kind).toBe("boss");
    expect(run(hit.state, { type: "bossClaim" }, epochStart + 2000).ok).toBe(false);
    const late = epochStart + BOSS.activeMs * 0.9;
    expect(bossStatus(late, 0).defeated).toBe(true);
    const claim = run(hit.state, { type: "bossClaim" }, late);
    expect(claim.ok).toBe(true);
    expect(claim.state.rf).toBeGreaterThan(hit.state.rf);
    expect(run(claim.state, { type: "bossClaim" }, late + 1).ok).toBe(false);
  });
});

describe("Tide Wheel", () => {
  it("expected return is below the spin cost (RF-equivalent, 150 SHELL ≈ 1 RF)", () => {
    const total = WHEEL.reduce((n, p) => n + p.weight, 0);
    const itemValue: Record<string, number> = { ore: 8, coral: 12, pearl: 60, charm: 225 };
    const ev = WHEEL.reduce((sum, p) => {
      const shell = (p.shell ?? 0) + Object.entries(p.items ?? {}).reduce((v, [k, n]) => v + itemValue[k] * n!, 0);
      return sum + p.weight / total * ((p.rf ?? 0) + shell / 1.5);
    }, 0);
    expect(ev).toBeLessThan(100);
    const rfOnly = WHEEL.reduce((sum, p) => sum + p.weight / total * (p.rf ?? 0), 0);
    expect(rfOnly).toBeLessThan(60);
  });
  it("paid spins burn 1 RF; free spin has a cooldown", () => {
    const s = fresh();
    const r = run(s, { type: "spin" });
    expect(r.state.stats.burned).toBe(100);
    const f = run(s, { type: "spin", free: true });
    expect(f.ok).toBe(true);
    expect(run(f.state, { type: "spin", free: true }).ok).toBe(false);
  });
});

describe("ascension & forge", () => {
  it("cannot ascend without full XP; success levels up, failure burns + pity", () => {
    const s = rich(fresh());
    expect(run(s, { type: "ascend" }).ok).toBe(false);
    s.xp = xpToNext(1);
    let successes = 0, fails = 0;
    for (let seed = 1; seed < 300; seed++) {
      const t = { ...structuredClone(s), seed, level: 20, xp: xpToNext(20) };
      const r = run(t, { type: "ascend", charm: true });
      expect(r.state.stats.burned).toBe(ascendCost(20).rf);
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
      expect(r.state.stats.burned).toBe(forgeCost(10).rf);
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
    expect(r.state.rf).toBe(s.rf);
    expect(r.state.shell).toBe(s.shell);
  });
  it("save codes round-trip and reject tampering / wrong Friend", () => {
    const s = rich(fresh());
    const code = exportSave(s);
    const back = importSave(code, "42");
    expect(back.rf).toBe(s.rf);
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
