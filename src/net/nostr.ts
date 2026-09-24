/**
 * Serverless online layer over public Nostr relays.
 *  - kind 30078 (replaceable app data): public player profiles -> leaderboards, raid targets, global burn
 *  - kind 7078: raid notifications (tagged with the victim pubkey)
 *  - kind 7079: Kraken damage (tagged with the boss epoch)
 *  - kind 7081: brag feed (big wins, level-ups, jackpots)
 * All economy values are SIMULATED and client-reported; see README "Trust model".
 */
import { SimplePool, finalizeEvent, generateSecretKey, getPublicKey, type Event, type Filter } from "nostr-tools";

export const RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net", "wss://nostr.mom"];
const APP = "nemo-frns-farm-v1";
const K_PROFILE = 30078, K_RAID = 7078, K_BOSS = 7079, K_BRAG = 7081;

export type Profile = {
  pubkey: string; friendId: string; name: string; level: number; title: string; family: number;
  power: number; defense: number; vault: number; burned: number; netWorth: number; home: number;
  bestDive: number; raidsWon: number; season: number; seasonScore: number; seasonSunk: number; guest?: boolean; ts: number;
};
type RaidMsg = { id: string; attacker: string; attackerFriend: string; amount: number; won: boolean; targetFriend: string; ts: number };
export type BragMsg = { id: string; pubkey: string; name: string; text: string; ts: number };

const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => Uint8Array.from(h.match(/.{2}/g)!.map(x => parseInt(x, 16)));
const nowSec = () => Math.floor(Date.now() / 1000);

function loadKey(): Uint8Array {
  try {
    const saved = localStorage.getItem("nemo-frns-farm:nostr-sk");
    if (saved && /^[0-9a-f]{64}$/.test(saved)) return unhex(saved);
    const sk = generateSecretKey();
    localStorage.setItem("nemo-frns-farm:nostr-sk", hex(sk));
    return sk;
  } catch { return generateSecretKey(); }
}

function safeJson<T>(text: string): T | null {
  try { return JSON.parse(text) as T; } catch { return null; }
}
const num = (v: unknown, max = 1e12) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0);
const str = (v: unknown, max = 40) => (typeof v === "string" ? v.slice(0, max) : "");

export class NostrLink {
  readonly sk = loadKey();
  readonly pubkey = getPublicKey(this.sk);
  private pool = new SimplePool();
  private subs: { close(): void }[] = [];
  status: "connecting" | "online" | "offline" = "connecting";

  private sign(kind: number, tags: string[][], content: string): Event {
    return finalizeEvent({ kind, created_at: nowSec(), tags, content }, this.sk);
  }
  private async publish(ev: Event) {
    const results = await Promise.allSettled(this.pool.publish(RELAYS, ev));
    const ok = results.some(r => r.status === "fulfilled");
    this.status = ok ? "online" : "offline";
    return ok;
  }

  publishProfile(p: Omit<Profile, "pubkey" | "ts">) {
    const ev = this.sign(K_PROFILE, [["d", `${APP}:profile:${p.friendId}`], ["t", APP]], JSON.stringify(p));
    return this.publish(ev);
  }

  async fetchProfiles(): Promise<Profile[]> {
    try {
      const events = await this.pool.querySync(RELAYS, { kinds: [K_PROFILE], "#t": [APP], since: nowSec() - 7 * 86400, limit: 300 } as Filter, { maxWait: 5000 });
      this.status = "online";
      const latest = new Map<string, Profile>();
      for (const ev of events) {
        const c = safeJson<Record<string, unknown>>(ev.content);
        if (!c) continue;
        const friendId = str(c.friendId, 80);
        if (!/^\d+$/.test(friendId)) continue;
        const key = `${ev.pubkey}:${friendId}`;
        const prof: Profile = {
          pubkey: ev.pubkey, friendId, name: str(c.name) || `Friend #${friendId}`, level: num(c.level, 50), title: str(c.title, 24),
          family: num(c.family, 8), power: num(c.power, 1e5), defense: num(c.defense, 1e5), vault: num(c.vault, 1e7),
          burned: num(c.burned, 1e9), netWorth: num(c.netWorth, 1e9), home: num(c.home, 4), bestDive: num(c.bestDive, 1000),
          raidsWon: num(c.raidsWon, 1e6), season: num(c.season, 1e7), seasonScore: num(c.seasonScore, 1e7), seasonSunk: num(c.seasonSunk, 1e9), ts: ev.created_at,
        };
        const prev = latest.get(key);
        if (!prev || prev.ts < prof.ts) latest.set(key, prof);
      }
      return [...latest.values()];
    } catch {
      this.status = "offline";
      return [];
    }
  }

  publishRaid(targetPubkey: string, targetFriend: string, attacker: string, attackerFriend: string, amount: number, won: boolean) {
    const ev = this.sign(K_RAID, [["p", targetPubkey], ["t", APP]], JSON.stringify({ attacker, attackerFriend, amount, won, targetFriend }));
    return this.publish(ev);
  }

  onRaids(cb: (m: RaidMsg) => void) {
    const sub = this.pool.subscribe(RELAYS, { kinds: [K_RAID], "#p": [this.pubkey], since: nowSec() - 60 } as Filter, {
      onevent: ev => {
        const c = safeJson<Record<string, unknown>>(ev.content);
        if (!c) return;
        cb({ id: ev.id, attacker: str(c.attacker) || "A pirate", attackerFriend: str(c.attackerFriend, 80), amount: num(c.amount, 1e7), won: c.won === true, targetFriend: str(c.targetFriend, 80), ts: ev.created_at });
      },
    });
    this.subs.push(sub);
  }

  publishBoss(epoch: number, damage: number, friendId: string) {
    return this.publish(this.sign(K_BOSS, [["b", `${APP}:${epoch}`], ["t", APP]], JSON.stringify({ damage, friendId })));
  }

  /** Streams total Kraken damage by *other* players for an epoch. */
  onBoss(epoch: number, cb: (othersTotal: number, hitters: number) => void) {
    const seen = new Set<string>(); let total = 0; const players = new Set<string>();
    const sub = this.pool.subscribe(RELAYS, { kinds: [K_BOSS], "#b": [`${APP}:${epoch}`] } as Filter, {
      onevent: ev => {
        if (seen.has(ev.id) || ev.pubkey === this.pubkey) return;
        seen.add(ev.id);
        const c = safeJson<Record<string, unknown>>(ev.content);
        total += Math.min(5000, num(c?.damage)); players.add(ev.pubkey);
        cb(total, players.size);
      },
    });
    this.subs.push(sub);
    return () => sub.close();
  }

  brag(name: string, text: string) {
    return this.publish(this.sign(K_BRAG, [["t", APP]], JSON.stringify({ name, text: text.slice(0, 120) })));
  }

  onBrags(cb: (m: BragMsg) => void) {
    const sub = this.pool.subscribe(RELAYS, { kinds: [K_BRAG], "#t": [APP], since: nowSec() - 3600, limit: 30 } as Filter, {
      onevent: ev => {
        const c = safeJson<Record<string, unknown>>(ev.content);
        if (!c) return;
        cb({ id: ev.id, pubkey: ev.pubkey, name: str(c.name) || "Someone", text: str(c.text, 120), ts: ev.created_at });
      },
    });
    this.subs.push(sub);
  }

  close() {
    for (const s of this.subs) s.close();
    this.subs = [];
    try { this.pool.close(RELAYS); } catch { /* already closed */ }
  }
}
