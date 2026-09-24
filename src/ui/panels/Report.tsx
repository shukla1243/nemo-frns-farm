import { BOSS, MAX_LEVEL, xpToNext } from "../../engine/config";
import { bossStatus, seasonBoard } from "../../engine/systems";
import { passClaimable } from "../../engine/pass";
import type { GameState } from "../../engine/types";
import type { StationId } from "../../world/map";
import { NPCS, giftReady } from "../../world/npcs";
import { Icon } from "../Icon";
import { Panel, useG } from "../common";

type Ready = { id: string; icon: string; text: string; station: StationId };

/** Everything waiting for the player right now, each with a place to go. */
function readyNow(s: GameState, now: number, bossOthers: number): Ready[] {
  const out: Ready[] = [];
  const ripe = s.plots.filter(p => p.crop && !p.withered && p.readyAt <= now).length;
  if (ripe) out.push({ id: "crops", icon: "carrot", text: `${ripe} crop${ripe > 1 ? "s" : ""} ready to harvest`, station: "farm" });
  if (s.voyage && now >= s.voyage.endsAt) out.push({ id: "voyage", icon: "chest", text: "Your Friend is back from its voyage. Open the chest!", station: "pier" });
  if (s.level < MAX_LEVEL && s.xp >= xpToNext(s.level)) out.push({ id: "xp", icon: "star", text: "XP bar full. Ascend at the Coral Shrine", station: "shrine" });
  const bounties = s.quests.filter(q => q.progress >= q.target).length;
  if (bounties) out.push({ id: "bounties", icon: "board", text: `${bounties} bount${bounties > 1 ? "ies" : "y"} ready to claim`, station: "board" });
  const pass = passClaimable(s);
  if (pass) out.push({ id: "pass", icon: "flag", text: `${pass} Season Journey tier${pass > 1 ? "s" : ""} to claim`, station: "board" });
  const last = s.lastSeason;
  if (last && !last.claimed && last.score > 0 && seasonBoard(s, now, [], last.id, last.score).findIndex(e => e.you) < 10) out.push({ id: "season", icon: "trophy", text: "You placed top 10 last season. Claim your prize", station: "board" });
  if (s.wheelFreeAt <= now) out.push({ id: "wheel", icon: "coin", text: "Free Tide Wheel spin", station: "wheel" });
  const boss = bossStatus(now, s.boss.epoch === Math.floor(now / BOSS.periodMs) ? s.boss.damage : 0, bossOthers);
  if (s.zones.reef && boss.active && !boss.defeated) out.push({ id: "kraken", icon: "angler", text: "The Kraken is up. Hit it for a share of 30 RF", station: "reef" });
  const gift = NPCS.find(n => s.zones[n.zone] && giftReady(s, n.id, now));
  if (gift) {
    const n = NPCS.filter(x => s.zones[x.zone] && giftReady(s, x.id, now)).length;
    out.push({ id: "gifts", icon: "heart", text: `${n} islander gift${n > 1 ? "s" : ""} waiting. ${gift.name} first`, station: `npc:${gift.id}` as StationId });
  }
  return out;
}

export function ReadyList({ go, limit }: { go: (station: StationId) => void; limit?: number }) {
  const { s, now, net } = useG();
  const items = readyNow(s, now, net.bossOthers).slice(0, limit);
  if (!items.length) return null;
  return (
    <ul className="ready-list">
      {items.map(r => (
        <li key={r.id} className="ready-row">
          <Icon id={r.icon} size={24} />
          <span className="grow">{r.text}</span>
          <button type="button" className="btn primary" onClick={() => go(r.station)}>Go</button>
        </li>
      ))}
    </ul>
  );
}

const TONE_ICON = { good: "check", bad: "skull", epic: "star", info: "spark" } as const;

/** Shown when a player returns: what happened while they were gone and what is ready now. */
export function ReportPanel({ onClose, go, since }: { onClose: () => void; go: (station: StationId) => void; since: number }) {
  const { s } = useG();
  const away = Date.now() - since;
  const h = Math.floor(away / 3_600_000), m = Math.floor((away % 3_600_000) / 60_000);
  const happened = s.log.filter(l => l.t > since).slice(0, 12);
  return (
    <Panel title="Welcome back" icon="home" onClose={onClose}>
      <p>You were away <b>{h ? `${h} h ` : ""}{m} min</b>. Your crops kept growing and your Friend rested at home.</p>
      {happened.length > 0 && (
        <section className="section">
          <h3>While you were away</h3>
          <ul className="inbox">
            {happened.map((l, i) => (
              <li key={`${l.t}-${i}`} className={`inbox-row ${l.tone}`}>
                <Icon id={TONE_ICON[l.tone]} size={20} /><span className="grow">{l.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="section">
        <h3>Ready now</h3>
        <ReadyList go={go} />
        {readyNow(s, Date.now(), 0).length === 0 && <p className="muted">Nothing is waiting. Follow the story goal or open Play to pick a game.</p>}
      </section>
      <button type="button" className="btn big primary" onClick={onClose}>Back to the island</button>
    </Panel>
  );
}
