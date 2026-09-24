import { useState } from "react";
import { BOSS, ZONES, type ZoneId } from "../../engine/config";
import { bossStatus } from "../../engine/systems";
import { actOf, chapterAt } from "../../engine/story";
import { STATIONS, type StationId } from "../../world/map";
import { stationSprite } from "../../world/World";
import { Icon, SpriteImg } from "../Icon";
import { ReadyList } from "./Report";
import { Panel, Tabs, mmss, useG, type PanelId } from "../common";

type Card = { station: StationId; blurb: string; risk?: string };
const GAMES: Card[] = [
  { station: "dock", blurb: "Timing reel. Catch fish for food, SHELL and the 2% Golden Nemo.", risk: "Skill" },
  { station: "mines", blurb: "Minesweeper dig. Every safe tile raises the multiplier, a trap takes it all.", risk: "High" },
  { station: "abyss", blurb: "Crash dive. Cash out before the shark bites. Up to 1000x.", risk: "High" },
  { station: "wheel", blurb: "Prize wheel with a 25 RF jackpot. One free spin every 8 hours.", risk: "Luck" },
  { station: "harbor", blurb: "Raid real players and rival crews for their SHELL vaults.", risk: "PvP" },
  { station: "reef", blurb: "World boss every 20 minutes. Everyone online hits it together.", risk: "Co-op" },
  { station: "forge", blurb: "Upgrade gear +1 to +10. Odds fall as the level rises.", risk: "Gamble" },
  { station: "pier", blurb: "Timed voyages of 15 min to 12 h. Relics, RF and stock-token shares.", risk: "Idle" },
];
const LIFE: Card[] = [
  { station: "home", blurb: "Sleep to refill energy, cook meals, and upgrade from Tent to Sea Castle." },
  { station: "farm", blurb: "Plant and harvest crops. Food keeps your Friend strong." },
  { station: "chop", blurb: "Chop driftwood for building. The first job on the island." },
  { station: "quarry", blurb: "Quarry stone, sea glass, ore and coral." },
  { station: "market", blurb: "Buy seeds, bait, food and charms. Sell what you gather." },
  { station: "pool", blurb: "Swap SHELL and RF in a live two-sided pool." },
  { station: "shrine", blurb: "Level up (Ascend) and Rebirth for permanent bonuses." },
  { station: "board", blurb: "Bounties, the weekly Season prize, milestones and leaderboards." },
];

export function PlayHub({ onClose, go }: { onClose: () => void; go: (station: StationId) => void }) {
  const { s, now, open, net } = useG();
  const [tab, setTab] = useState<"play" | "island">("play");
  const ch = chapterAt(s.story);
  const boss = bossStatus(now, s.boss.epoch === Math.floor(now / BOSS.periodMs) ? s.boss.damage : 0, net.bossOthers);
  const render = (c: Card) => {
    const st = STATIONS.find(x => x.id === c.station)!;
    const locked = !s.zones[st.zone];
    const status = c.station === "reef" && !locked ? (boss.active && !boss.defeated ? `Kraken is up! ${mmss(boss.endsIn)} left` : `Rises in ${mmss(boss.nextIn)}`)
      : c.station === "pier" && s.voyage ? (now < s.voyage.endsAt ? `At sea, back in ${mmss(s.voyage.endsAt - now)}` : "Back! Claim the chest")
      : c.station === "wheel" && s.wheelFreeAt <= now ? "Free spin ready!" : null;
    return (
      <div key={c.station} className={`hub-card frame-paper ${locked ? "locked" : ""}`}>
        <span className="hub-art"><SpriteImg sprite={stationSprite(st, s, 0, false)} name={`hub-${st.id}-${st.id === "home" ? s.home : 0}`} height={52} /></span>
        <span className="hub-text">
          <b>{st.label}{c.risk && <span className="risk">{c.risk}</span>}</b>
          <small>{c.blurb}</small>
          {status && <small className="hub-status">{status}</small>}
        </span>
        {locked
          ? <button type="button" className="btn" onClick={() => open(`unlock:${st.zone}` as PanelId)} aria-label={`Unlock ${ZONES[st.zone as ZoneId].name}`}>Unlock</button>
          : <button type="button" className="btn primary" onClick={() => go(st.id)}>Go</button>}
      </div>
    );
  };
  return (
    <Panel title="Play" icon="star" onClose={onClose} wide>
      <button type="button" className="hub-story frame-gold" onClick={() => open("story")}>
        <span className="hub-story-kicker">{actOf(s.story).name}, chapter {s.story + 1}</span>
        <b>{ch.title}</b>
        <span>{ch.done(s) ? "Goal reached! Tap to claim the chapter reward." : ch.goal}</span>
      </button>
      <ReadyList go={go} limit={4} />
      <div className="btn-row hub-links">
        <button type="button" className="btn" onClick={() => open("help")}><Icon id="help" size={22} /> How to play and lore</button>
        <button type="button" className="btn" onClick={() => open("board")}><Icon id="trophy" size={22} /> Season and leaderboards</button>
      </div>
      <Tabs tabs={[["play", "Games and adventures"], ["island", "Island life"]]} value={tab} onChange={setTab} />
      <div className="hub-grid">{(tab === "play" ? GAMES : LIFE).map(render)}</div>
    </Panel>
  );
}
