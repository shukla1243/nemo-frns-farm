/**
 * Cloud save that follows your wallet across devices, with no game server.
 *
 * 1. The player signs one free message (personal_sign, no gas, no transaction).
 * 2. sha256(signature) becomes a private Nostr key only that wallet can re-derive.
 * 3. The save code is NIP-44 encrypted to that key and published as a replaceable
 *    event (kind 30078, one per Friend) on public relays.
 * Any device with the same wallet re-derives the key and pulls the newest save.
 */
import { finalizeEvent, getPublicKey, nip44, SimplePool, type Filter } from "nostr-tools";
import { RELAYS } from "./nostr";

const MESSAGE = "NEMO FRNS FARM cloud save v1\n\nSign to unlock your encrypted cross-device save.\nThis is free: it is not a transaction and costs no gas.";
const KIND = 30078;
const APP = "nemo-frns-farm-v1";

type Provider = { request(args: { method: string; params?: unknown[] | object }): Promise<unknown> };

const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => Uint8Array.from(h.match(/.{2}/g)!.map(x => parseInt(x, 16)));
const cacheKey = (account: string) => `nemo-frns-farm:cloud:${account.toLowerCase()}`;

export function cachedCloudKey(account: string): Uint8Array | null {
  try {
    const v = localStorage.getItem(cacheKey(account));
    return v && /^[0-9a-f]{64}$/.test(v) ? unhex(v) : null;
  } catch { return null; }
}

export async function deriveCloudKey(provider: Provider, account: string): Promise<Uint8Array> {
  const cached = cachedCloudKey(account);
  if (cached) return cached;
  const msgHex = "0x" + hex(new TextEncoder().encode(MESSAGE));
  const sig = await provider.request({ method: "personal_sign", params: [msgHex, account] });
  if (typeof sig !== "string" || !/^0x([0-9a-fA-F]{2})+$/.test(sig)) throw new Error("The wallet did not return a signature.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", unhex(sig.slice(2).toLowerCase())));
  try { localStorage.setItem(cacheKey(account), hex(digest)); } catch { /* storage unavailable */ }
  return digest;
}

export class CloudSave {
  private pool = new SimplePool();
  private pub: string;
  private conv: Uint8Array;
  constructor(private sk: Uint8Array) {
    this.pub = getPublicKey(sk);
    this.conv = nip44.v2.utils.getConversationKey(sk, this.pub);
  }

  async push(friendId: string, saveCode: string, lastTick: number) {
    const content = nip44.v2.encrypt(JSON.stringify({ code: saveCode, lastTick }), this.conv);
    const ev = finalizeEvent({ kind: KIND, created_at: Math.floor(Date.now() / 1000), tags: [["d", `${APP}:save:${friendId}`]], content }, this.sk);
    const res = await Promise.allSettled(this.pool.publish(RELAYS, ev));
    return res.some(r => r.status === "fulfilled");
  }

  async pull(friendId: string): Promise<{ code: string; lastTick: number } | null> {
    const events = await this.pool.querySync(RELAYS, { kinds: [KIND], authors: [this.pub], "#d": [`${APP}:save:${friendId}`] } as Filter, { maxWait: 5000 });
    let best: { code: string; lastTick: number } | null = null;
    for (const ev of events) {
      try {
        const data = JSON.parse(nip44.v2.decrypt(ev.content, this.conv)) as { code: string; lastTick: number };
        if (typeof data.code === "string" && (!best || data.lastTick > best.lastTick)) best = data;
      } catch { /* not ours / corrupted */ }
    }
    return best;
  }

  close() { try { this.pool.close(RELAYS); } catch { /* ignore */ } }
}
