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

const KIND = 30078;
const APP = "nemo-frns-farm-v1";

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
