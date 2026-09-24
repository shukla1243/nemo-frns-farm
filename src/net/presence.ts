/**
 * Live presence: see other Friends walking in the one shared island world in real time (WebRTC via Trystero,
 * signalled over public Nostr relays, no game server). Positions and emotes only.
 */
import { joinRoom, selfId, type Room } from "trystero";

export type Peer = { id: string; friendId: string; name: string; level: number; title: string; x: number; y: number; facing: string; emote: string; emoteAt: number; seen: number };
type PosMsg = { f: string; n: string; l: number; t: string; x: number; y: number; d: string };

export const EMOTES = ["heart", "star", "fire", "trophy", "skull", "clownfish", "sword", "moodHappy"] as const;

export class Presence {
  private room: Room | null = null;
  private sendPos: ((m: PosMsg) => void) | null = null;
  private sendEmote: ((e: string) => void) | null = null;
  readonly peers = new Map<string, Peer>();
  readonly selfId = selfId;
  onChange: () => void = () => {};

  join(room: string) {
    try {
      this.room = joinRoom({ appId: "nemo-frns-farm-v1" }, room);
      const pos = this.room.makeAction<PosMsg>("pos");
      const emote = this.room.makeAction<string>("emote");
      this.sendPos = m => { void pos.send(m).catch(() => {}); };
      this.sendEmote = e => { void emote.send(e).catch(() => {}); };
      pos.onMessage = (m, { peerId: peer }) => {
        if (!m || typeof m.x !== "number" || typeof m.y !== "number") return;
        const prev = this.peers.get(peer);
        this.peers.set(peer, {
          id: peer, friendId: String(m.f ?? "").slice(0, 80), name: String(m.n ?? "Friend").slice(0, 30), level: Number(m.l) || 1,
          title: String(m.t ?? "").slice(0, 20), x: m.x, y: m.y, facing: String(m.d ?? "down"),
          emote: prev?.emote ?? "", emoteAt: prev?.emoteAt ?? 0, seen: Date.now(),
        });
        this.onChange();
      };
      emote.onMessage = (e, { peerId: peer }) => {
        const p = this.peers.get(peer);
        if (p && EMOTES.includes(e as typeof EMOTES[number])) { p.emote = e; p.emoteAt = Date.now(); this.onChange(); }
      };
      this.room.onPeerLeave = peer => { this.peers.delete(peer); this.onChange(); };
    } catch {
      this.room = null;
    }
  }

  send(m: PosMsg) { try { this.sendPos?.(m); } catch { /* peer gone */ } }
  emote(e: string) { try { this.sendEmote?.(e); } catch { /* peer gone */ } }

  prune() {
    const cutoff = Date.now() - 15_000;
    let changed = false;
    for (const [id, p] of this.peers) if (p.seen < cutoff) { this.peers.delete(id); changed = true; }
    if (changed) this.onChange();
  }

  leave() {
    try { this.room?.leave(); } catch { /* ignore */ }
    this.room = null; this.peers.clear();
  }
}
