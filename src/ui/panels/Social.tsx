import { PASS, passClaimable } from "../../engine/pass";
import { useState } from "react";
import { BOSS, HOMES, ITEMS, RAID, SEASON, seasonNumber, seasonStartOf, titleFor, type ItemId } from "../../engine/config";
import { raidChance } from "../../engine/actions";
import { bossStatus, seasonBoard } from "../../engine/systems";
import { ACHIEVEMENTS, questLabel } from "../../engine/quests";
import { TRACKS, milestoneReward, rankName, trackProgress } from "../../engine/milestones";
import { defense, power, seasonScore } from "../../engine/state";
import type { Rival } from "../../engine/types";
import { Bar, Panel, SimTag, Tabs, mmss, n0, useG } from "../common";
import { Icon, SpriteImg } from "../Icon";
import { kraken } from "../../art/sprites";

export function HarborPanel({ onClose }: { onClose: () => void }) {
  const { s, act, now } = useG();
  const cd = Math.max(0, (s.cooldowns.raid ?? 0) - now);
  const Row = ({ t }: { t: Rival }) => {
    const chance = raidChance(s, t, now);
    const revenge = s.revenge?.rivalId === t.id && s.revenge.until > now;
    return (
      <div className="list-row">
        <span className="big-icon"><Icon id="skull" size={30} /></span>
        <span className="grow"><b>{t.name}{revenge && <span className="hot-chip">REVENGE +15%</span>}</b><small>Lv{t.level} · defense {t.defense} · vault {n0(Math.floor(t.vault))} SHELL · sim</small></span>
        <span className={`chance ${chance > 0.6 ? "good" : chance < 0.35 ? "bad" : ""}`}>{Math.round(chance * 100)}%</span>
        <button type="button" className="btn hot" disabled={cd > 0 || s.energy < RAID.energy || s.shell < RAID.minFee} onClick={() => act({ type: "raid", rivalId: t.id })}>Raid</button>
      </div>
    );
  };
  return (
    <Panel title="Rival Harbor" icon="skull" onClose={onClose}>
      <div className="row-cards">
        <div className="mini-card"><b>Power</b><span>{power(s)}</span></div>
        <div className="mini-card"><b>Defense</b><span>{defense(s)}</span></div>
        <div className="mini-card"><b>Vault</b><span>{Math.round(HOMES[s.home].vault * 100)}% safe</span></div>
        <div className="mini-card"><b>Shield</b><span>{s.shieldUntil > now ? mmss(s.shieldUntil - now) : "none"}</span></div>
      </div>
      <p className="muted">Raids cost {RAID.energy} energy. Win: steal 10 to 22% of their exposed vault (+ 15% chance of bonus SHELL). Lose: {RAID.hospitalFraction * 100}% clinic fee (at least {RAID.minFee} SHELL) and −{RAID.moodLoss} mood. {cd > 0 ? `Cooldown ${mmss(cd)}.` : ""}</p>
      <h3>Simulated rivals</h3>
      <div className="list">{s.rivals.map(t => <Row key={t.id} t={t} />)}</div>
      <p className="fineprint"><SimTag /> Every rival is simulated.</p>
    </Panel>
  );
}

export function ReefPanel({ onClose }: { onClose: () => void }) {
  const { s, act, now } = useG();
  const own = s.boss.epoch === Math.floor(now / BOSS.periodMs) ? s.boss.damage : 0;
  const b = bossStatus(now, own);
  const claimed = s.boss.epoch === b.epoch && s.boss.claimed;
  const cd = Math.max(0, (s.cooldowns.boss ?? 0) - now);
  return (
    <Panel title="Kraken Reef: World Boss" icon="angler" onClose={onClose}>
      <div className={`boss ${b.defeated ? "dead" : b.active ? "alive" : "sleep"}`}>
        <span className="boss-icon">{!b.active ? <Icon id="zz" size={64} /> : b.defeated ? <Icon id="skull" size={72} /> : <SpriteImg sprite={kraken(0)} name="kraken0" height={96} />}</span>
        <Bar value={b.remaining} max={b.hp} color="#ff4d6d" label="Kraken HP" />
        <p>{b.active ? (b.defeated ? "DEFEATED! Claim your share." : `${n0(b.remaining)} / ${n0(b.hp)} HP · ${mmss(b.endsIn)} left`) : `Rises again in ${mmss(b.nextIn)}`}</p>
        <p className="muted">Your damage: <b>{n0(own)}</b> · Share of pool: {((own / b.hp) * 100).toFixed(2)}%</p>
      </div>
      <div className="btn-row">
        <button type="button" className="btn hot big" disabled={!b.active || b.defeated || cd > 0 || s.energy < BOSS.energy} onClick={() => act({ type: "bossAttack" })}>Attack ({BOSS.energy} energy){cd > 0 ? ` ${Math.ceil(cd / 1000)}s` : ""}</button>
        <button type="button" className="btn primary big" disabled={!b.defeated || claimed || own <= 0} onClick={() => act({ type: "bossClaim" })}>{claimed ? "Claimed" : "Claim share"}</button>
      </div>
      <p className="fineprint"><SimTag /> Every {BOSS.periodMs / 60000} min the Kraken rises for {BOSS.activeMs / 60000} min with {n0(BOSS.hp)} HP shared with simulated rivals. Hitters split a {n0(BOSS.poolShell)} SHELL pool by damage share. 15% chance of a tentacle slam (−10 energy). Damage = power × 3 ± 20%, 15% crit x2.</p>
    </Panel>
  );
}

function SeasonTab() {
  const { s, now } = useG();
  const board = seasonBoard(s, now);
  const myRank = board.findIndex(e => e.you) + 1;
  const endsIn = seasonStartOf(s.season.id) + SEASON.ms - now;
  const last = s.lastSeason;
  return (
    <>
      <div className="season-hero">
        <span className="muted">Season {seasonNumber(s.season.id)}</span>
        <b className="big-num">#{myRank}</b>
        <span className="muted">ends in {mmss(endsIn)}</span>
      </div>
      <p className="muted">Score = XP earned + 1 point per {SEASON.shellPerPoint} SHELL spent. You: <b>{n0(seasonScore(s))}</b> pts · rank <b>#{myRank}</b>{last ? ` · last season ${n0(last.score)} pts` : ""}</p>
      <SeasonJourney />
      <ol className="board">
        {board.slice(0, 15).map((e, i) => (
          <li key={e.id} className={e.you ? "you" : ""}>
            <span className="rank">{i < 3 ? <><Icon id={["crown", "trophy", "star"][i]} size={20} />{i + 1}</> : `#${i + 1}`}</span>
            <span className="grow">{e.name}</span>
            <span>{n0(e.score)}</span>
          </li>
        ))}
        {myRank > 15 && <li className="you"><span className="rank">#{myRank}</span><span className="grow">{s.name}</span><span>{n0(seasonScore(s))}</span></li>}
      </ol>
      <p className="fineprint"><SimTag /> Other names on the board are simulated residents. Weekly seasons roll over Monday 00:00 UTC.</p>
    </>
  );
}

function LeaderTab() {
  const { s } = useG();
  const [sort, setSort] = useState<"level" | "sunk" | "bestDive">("sunk");
  const me = { friendId: s.friendId, name: s.name, level: s.level, sunk: s.stats.shellSunk, bestDive: s.stats.bestDive, title: titleFor(s.level), you: true };
  const rows = [
    me,
    ...s.rivals.map(r => ({ friendId: r.id, name: `${r.name} (sim)`, level: r.level, sunk: r.sunk, bestDive: 0, title: titleFor(r.level), you: false })),
  ].sort((a, b) => (b[sort] as number) - (a[sort] as number));
  return (
    <>
      <div className="seg wrap">
        {([["sunk", "SHELL spent"], ["level", "Level"], ["bestDive", "Best dive"]] as const).map(([k, l]) => <button key={k} type="button" className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}
      </div>
      <ol className="board">
        {rows.slice(0, 25).map((r, i) => (
          <li key={`${r.friendId}-${i}`} className={r.you ? "you" : ""}>
            <span className="rank">#{i + 1}</span>
            <span className="grow">{r.name} <small className="muted">{r.title}</small></span>
            <span>{sort === "sunk" ? `${n0(r.sunk)} SHELL` : sort === "level" ? `Lv${r.level}` : `${(r.bestDive || 0).toFixed(2)}x`}</span>
          </li>
        ))}
      </ol>
      <p className="fineprint"><SimTag /> Every other island here is a simulated rival.</p>
    </>
  );
}

function StatsTab() {
  const { s } = useG();
  const st = s.stats;
  const rows: [string, string][] = [
    ["SHELL spent on the island", n0(st.shellSunk)], ["SHELL earned", n0(st.shellEarned)], ["Tradable SHELL (earned by play)", n0(s.tradable)],
    ["Fish caught", n0(st.fish)], ["Harvests", n0(st.harvests)], ["Dives / best", `${st.dives} / ${st.bestDive.toFixed(2)}x`],
    ["Mines cashouts / best", `${st.minesCashouts} / ${st.bestMinesTiles} tiles`], ["Raids W/L", `${st.raidsWon}/${st.raidsLost}`], ["Defended / raided", `${st.defended}/${st.raidedBy}`],
    ["Ascensions", `${st.ascends} (${st.ascendFails} fails)`], ["Forges", `${st.forges - st.forgeFails}/${st.forges}`], ["Kraken kills", n0(st.bossKills)],
    ["Wheel spins / jackpots", `${st.spins}/${st.jackpots}`], ["Flips W/L", `${st.flipsWon}/${st.flipsLost}`],
  ];
  return <table className="stats-table"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>;
}

export function BoardPanel({ onClose }: { onClose: () => void }) {
  const { s, act } = useG();
  const [tab, setTab] = useState<"quests" | "season" | "milestones" | "leaders" | "trophies" | "feed" | "stats">("quests");
  return (
    <Panel title="Bounty Board" icon="board" onClose={onClose} wide>
      <Tabs tabs={[["quests", "Bounties"], ["season", "Season"], ["milestones", "Milestones"], ["leaders", "Leaders"], ["trophies", `Trophies ${s.achievements.length}/${ACHIEVEMENTS.length}`], ["feed", "Feed"], ["stats", "Stats"]]} value={tab} onChange={setTab} />
      {tab === "quests" && (
        <div className="list">
          {s.quests.map(q => (
            <div key={q.id} className="list-row">
              <span className="big-icon"><Icon id={q.progress >= q.target ? "check" : "board"} size={30} /></span>
              <span className="grow"><b>{questLabel(q)}</b><Bar value={q.progress} max={q.target} color="#ffd166" /><small>{q.progress}/{q.target} · reward {q.reward.shell} SHELL +{q.reward.xp}XP{q.reward.items?.charm ? " +" : q.reward.items?.pearl ? " +" : ""}</small></span>
              <button type="button" className="btn primary" disabled={q.progress < q.target} onClick={() => act({ type: "claimQuest", id: q.id })}>Claim</button>
            </div>
          ))}
        </div>
      )}
      {tab === "season" && <SeasonTab />}
      {tab === "leaders" && <LeaderTab />}
      {tab === "trophies" && (
        <div className="item-grid">
          {ACHIEVEMENTS.map(a => {
            const got = s.achievements.includes(a.id);
            return <div key={a.id} className={`item static ${got ? "got" : "locked"}`}><span className="big-icon"><Icon id={got ? "trophy" : "lock"} size={32} /></span><b>{a.name}</b><small>{a.blurb}</small><small className="muted">{a.reward.shell} SHELL</small></div>;
          })}
        </div>
      )}
      {tab === "feed" && (
        <div className="feed">
          <h3>Your log</h3>
          {s.log.slice(0, 25).map((l, i) => <p key={i} className={`log ${l.tone}`}>{l.text} <small className="muted">{new Date(l.t).toLocaleTimeString()}</small></p>)}
        </div>
      )}
      {tab === "milestones" && <MilestonesTab />}
      {tab === "stats" && <StatsTab />}
    </Panel>
  );
}

/** Lifetime milestone tracks: infinite tiers, rewards arrive automatically when you cross a line. */
function MilestonesTab() {
  const { s } = useG();
  return (
    <>
      <p className="muted">Milestones never end. Cross a line and the reward lands automatically: SHELL every tier, a bonus every third tier.</p>
      <div className="list">
        {TRACKS.map(t => {
          const p = trackProgress(s, t);
          const r = milestoneReward(p.tier + 1);
          return (
            <div key={t.id} className="list-row milestone">
              <span className="big-icon"><Icon id="trophy" size={28} /></span>
              <span className="grow">
                <b>{t.name} <span className="rank-tag">{rankName(p.tier)}</span></b>
                <Bar value={p.value - p.prev} max={p.next - p.prev} color="#f5c542" />
                <small>{p.fmt(p.value)} / {p.fmt(p.next)} {t.unit} · next: +{r.shell} SHELL</small>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Free weekly reward track: every player earns tiers from season points. */
function SeasonJourney() {
  const { s, act } = useG();
  const score = seasonScore(s);
  const ready = passClaimable(s);
  const next = PASS.find(t => t.score > score);
  const prize = (t: (typeof PASS)[number]) => [t.shell ? `${t.shell} SHELL` : "", ...Object.entries(t.items ?? {}).map(([id, n]) => `${n} ${ITEMS[id as ItemId].name}`)].filter(Boolean).join(", ");
  return (
    <section className="section journey">
      <h3><Icon id="flag" size={22} /> Season Journey</h3>
      <p className="muted">Free rewards for everyone. Earn season points to fill the track, and it resets each week.</p>
      <ol className="journey-track">
        {PASS.map((t, i) => (
          <li key={t.score} className={i < s.season.pass ? "got" : score >= t.score ? "ready" : ""} title={`${n0(t.score)} pts: ${prize(t)}`}>
            <span>{i + 1}</span>
          </li>
        ))}
      </ol>
      {ready > 0
        ? <button type="button" className="btn primary big" onClick={() => act({ type: "passClaim" })}>Claim {ready} tier{ready > 1 ? "s" : ""}</button>
        : next ? <p>Next tier at <b>{n0(next.score)}</b> pts ({n0(next.score - score)} to go): {prize(next)}</p>
          : <p><b>Journey complete!</b> Every tier claimed this season.</p>}
    </section>
  );
}
