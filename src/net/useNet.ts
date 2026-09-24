import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NostrLink, type BragMsg, type Profile } from "./nostr";
import { Presence, type Peer } from "./presence";
import type { GameState } from "../engine/types";
import type { Action, Outbox, Result } from "../engine/actions";
import { defense, netWorth, power, seasonScore, title } from "../engine/state";
import { HOMES, BOSS } from "../engine/config";
import type { Identity } from "../identity/Gate";

export type NetState = {
  status: "connecting" | "online" | "offline";
  profiles: Profile[];
  bossOthers: number; bossHitters: number;
  brags: BragMsg[];
  peers: number;
  pubkey: string;
};

const seenKey = "nemo-frns-farm:seen-raids";
function seenRaids(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey) ?? "[]") as string[]); } catch { return new Set(); }
}
function markSeen(set: Set<string>) {
  try { localStorage.setItem(seenKey, JSON.stringify([...set].slice(-200))); } catch { /* ignore */ }
}

/** Wires the pure engine to the online world. Guests can watch but never publish. */
export function useNet(identity: Identity, stateRef: React.MutableRefObject<GameState>, act: (a: Action) => Result) {
  const link = useMemo(() => new NostrLink(), []);
  const presence = useMemo(() => new Presence(), []);
  const peersRef = useRef<Map<string, Peer>>(presence.peers);
  const [net, setNet] = useState<NetState>({ status: "connecting", profiles: [], bossOthers: 0, bossHitters: 0, brags: [], peers: 0, pubkey: link.pubkey });
  const actRef = useRef(act); actRef.current = act;
  const lastBrag = useRef(0);

  const publishProfile = useCallback(() => {
    if (identity.guest) return;
    const s = stateRef.current;
    void link.publishProfile({
      friendId: s.friendId, name: s.name, level: s.level, title: title(s), family: s.family,
      power: power(s), defense: defense(s), vault: Math.floor(s.shell * (1 - HOMES[s.home].vault)), burned: s.stats.burned,
      netWorth: Math.floor(netWorth(s)), home: s.home, bestDive: s.stats.bestDive, raidsWon: s.stats.raidsWon,
      season: s.season.id, seasonScore: seasonScore(s), seasonSunk: s.season.sunk,
    });
  }, [identity.guest, link, stateRef]);

  const refreshProfiles = useCallback(async () => {
    const profiles = await link.fetchProfiles();
    setNet(n => ({ ...n, profiles, status: link.status }));
  }, [link]);

  useEffect(() => {
    presence.onChange = () => setNet(n => ({ ...n, peers: presence.peers.size }));
    presence.join("nemo-world");
    const seen = seenRaids();
    if (!identity.guest) link.onRaids(m => {
      if (seen.has(m.id) || !m.won || m.targetFriend !== stateRef.current.friendId) return;
      seen.add(m.id); markSeen(seen);
      actRef.current({ type: "raidReceived", id: m.id, attacker: m.attacker, amount: m.amount });
    });
    link.onBrags(m => setNet(n => (n.brags.some(b => b.id === m.id) ? n : { ...n, brags: [m, ...n.brags].sort((a, b) => b.ts - a.ts).slice(0, 30) })));
    void refreshProfiles();
    publishProfile();
    const t1 = setInterval(() => { void refreshProfiles(); }, 45_000);
    const t2 = setInterval(publishProfile, 60_000);
    const t3 = setInterval(() => presence.prune(), 5000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); presence.leave(); link.close(); };
  }, [identity.guest, link, presence, publishProfile, refreshProfiles, stateRef]);

  // Kraken damage by other players for the current rising.
  const [epoch, setEpoch] = useState(() => Math.floor(Date.now() / BOSS.periodMs));
  useEffect(() => {
    const t = setInterval(() => setEpoch(Math.floor(Date.now() / BOSS.periodMs)), 10_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setNet(n => ({ ...n, bossOthers: 0, bossHitters: 0 }));
    return link.onBoss(epoch, (total, hitters) => setNet(n => ({ ...n, bossOthers: total, bossHitters: hitters })));
  }, [epoch, link]);

  const handleOutbox = useCallback((out: Outbox[]) => {
    if (identity.guest) return;
    const s = stateRef.current;
    for (const o of out) {
      if (o.kind === "raid") {
        const [pubkey, friendId] = o.targetId.split(":");
        if (pubkey && friendId) void link.publishRaid(pubkey, friendId, s.name, s.friendId, o.amount, o.won);
      } else if (o.kind === "boss") void link.publishBoss(o.epoch, o.damage, s.friendId);
    }
  }, [identity.guest, link, stateRef]);

  const brag = useCallback((text: string) => {
    if (identity.guest || Date.now() - lastBrag.current < 20_000) return;
    lastBrag.current = Date.now();
    void link.brag(stateRef.current.name, text);
    setNet(n => ({ ...n, brags: [{ id: `local-${Date.now()}`, pubkey: link.pubkey, name: stateRef.current.name, text, ts: Math.floor(Date.now() / 1000) }, ...n.brags].slice(0, 30) }));
  }, [identity.guest, link, stateRef]);

  const lastSent = useRef(0);
  const sendPos = useCallback((x: number, y: number, facing: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastSent.current < 120) return;
    lastSent.current = now;
    const s = stateRef.current;
    presence.send({ f: s.friendId, n: s.name, l: s.level, t: title(s), x: Math.round(x), y: Math.round(y), d: facing });
  }, [presence, stateRef]);

  return { net, peersRef, handleOutbox, brag, sendPos, emote: (e: string) => presence.emote(e), publishProfile, refreshProfiles, pubkey: link.pubkey };
}
