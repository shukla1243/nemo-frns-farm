import { PASS, passClaimable } from "../../engine/pass";
import { useMemo, useState } from "react";
import { BOSS, HOMES, ITEMS, RAID, SEASON, SINK, seasonNumber, seasonStartOf, titleFor, type ItemId } from "../../engine/config";
import { raidChance } from "../../engine/actions";
import { bossStatus, seasonBoard, seasonPoolTotal, type SeasonEntry } from "../../engine/systems";
import { ACHIEVEMENTS, questLabel } from "../../engine/quests";
import { TRACKS, milestoneReward, rankName, trackProgress } from "../../engine/milestones";
import { defense, power, seasonScore } from "../../engine/state";
import type { RaidTarget } from "../../engine/types";
import { Bar, Panel, SimTag, Tabs, mmss, n0, rf, useG } from "../common";
import { Icon, SpriteImg } from "../Icon";
import { kraken } from "../../art/sprites";

export function HarborPanel({ onClose }: { onClose: () => void }) {
  const { s, act, net, now, identity, brag } = useG();
  const online: RaidTarget[] = net.profiles
    .filter(p => !(p.pubkey === net.pubkey && p.friendId === s.friendId) && p.friendId !== s.friendId)
    .map(p => ({ id: `${p.pubkey}:${p.friendId}`, name: p.name, level: p.level, power: p.power, defense: p.defense, vault: p.vault, bot: false, friendId: p.friendId }));
  const bots: RaidTarget[] = s.rivals.map(r => ({ id: r.id, name: r.name, level: r.level, power: r.power, defense: r.defense, vault: Math.floor(r.vault), bot: true }));
  const cd = Math.max(0, (s.cooldowns.raid ?? 0) - now);
  const Row = ({ t }: { t: RaidTarget }) => {
    const chance = raidChance(s, t, now);
    const revenge = s.revenge?.rivalId === t.id && s.revenge.until > now;
    return (
      <div className="list-row">
        <span className="big-icon"><Icon id={t.bot ? "skull" : "person"} size={30} /></span>
        <span className="grow"><b>{t.name}{revenge && <span className="hot-chip">REVENGE +15%</span>}</b><small>Lv{t.level} · defense {t.defense} · vault {n0(t.vault)} SHELL{t.bot ? " · sim" : " · ONLINE"}</small></span>
        <span className={`chance ${chance > 0.6 ? "good" : chance < 0.35 ? "bad" : ""}`}>{Math.round(chance * 100)}%</span>
        <button type="button" className="btn hot" disabled={cd > 0 || s.energy < RAID.energy} onClick={() => { const r = act({ type: "raid", target: t }); if (r.ok && r.data?.won && !t.bot) brag(`raided ${t.name} for ${n0(r.data.stolen as number)} SHELL `); }}>Raid</button>
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
      <p className="muted">Raids cost {RAID.energy} energy. Win: steal 10 to 22% of their exposed vault (+ 15% chance of bonus RF). Lose: {RAID.hospitalFraction * 100}% clinic fee and −{RAID.moodLoss} mood. {cd > 0 ? `Cooldown ${mmss(cd)}.` : ""}</p>
      {!identity.guest && <h3>Online Friends ({online.length})</h3>}
      {identity.guest && <p className="warn">Guests can raid simulated rivals only. Connect a wallet to raid real players.</p>}
      {!identity.guest && online.length === 0 && <p className="muted">{net.status === "offline" ? "Relays unreachable. Showing simulated rivals." : "No other online islands yet. Invite a friend!"}</p>}
      <div className="list">{!identity.guest && online.slice(0, 15).map(t => <Row key={t.id} t={t} />)}</div>
      <h3>Simulated rivals</h3>
      <div className="list">{bots.map(t => <Row key={t.id} t={t} />)}</div>
      <p className="fineprint"><SimTag /> Online raids are applied by the victim's client, capped at 10% of their exposed vault, with an 8-minute shield afterwards.</p>
    </Panel>
  );
}

export function ReefPanel({ onClose }: { onClose: () => void }) {
  const { s, act, net, now, brag } = useG();
  const own = s.boss.epoch === Math.floor(now / BOSS.periodMs) ? s.boss.damage : 0;
  const b = bossStatus(now, own, net.bossOthers);
  const claimed = s.boss.epoch === b.epoch && s.boss.claimed;
  const cd = Math.max(0, (s.cooldowns.boss ?? 0) - now);
  return (
    <Panel title="Kraken Reef: World Boss" icon="angler" onClose={onClose}>
      <div className={`boss ${b.defeated ? "dead" : b.active ? "alive" : "sleep"}`}>
        <span className="boss-icon">{!b.active ? <Icon id="zz" size={64} /> : b.defeated ? <Icon id="skull" size={72} /> : <SpriteImg sprite={kraken(0)} name="kraken0" height={96} />}</span>
        <Bar value={b.remaining} max={b.hp} color="#ff4d6d" label="Kraken HP" />
        <p>{b.active ? (b.defeated ? "DEFEATED! Claim your share." : `${n0(b.remaining)} / ${n0(b.hp)} HP · ${mmss(b.endsIn)} left`) : `Rises again in ${mmss(b.nextIn)}`}</p>
        <p className="muted">Your damage: <b>{n0(own)}</b> · Online hitters: {net.bossHitters} · Share of pool: {((own / b.hp) * 100).toFixed(2)}%</p>
      </div>
      <div className="btn-row">
        <button type="button" className="btn hot big" disabled={!b.active || b.defeated || cd > 0 || s.energy < BOSS.energy} onClick={() => act({ type: "bossAttack", others: net.bossOthers })}>Attack ({BOSS.energy} energy){cd > 0 ? ` ${Math.ceil(cd / 1000)}s` : ""}</button>
        <button type="button" className="btn primary big" disabled={!b.defeated || claimed || own <= 0} onClick={() => { const r = act({ type: "bossClaim", others: net.bossOthers }); if (r.ok) brag(`helped slay the Kraken and took ${rf(r.data!.rf as number)} RF `); }}>{claimed ? "Claimed ✓" : "Claim share"}</button>
      </div>
      <p className="fineprint"><SimTag /> Every {BOSS.periodMs / 60000} min the Kraken rises for {BOSS.activeMs / 60000} min with {n0(BOSS.hp)} HP shared by every player online plus simulated rivals. Hitters split a {rf(BOSS.poolRf)} RF pool by damage share. 15% chance of a tentacle slam (−10 energy). Damage = power × 3 ± 20%, 15% crit x2.</p>
    </Panel>
  );
}

function SeasonTab() {
  const { s, act, net, now, identity } = useG();
  const online: SeasonEntry[] = identity.guest ? [] : net.profiles.filter(p => p.season === s.season.id && p.friendId !== s.friendId).map(p => ({ id: p.friendId, name: p.name, score: p.seasonScore, online: true }));
  const onlineSunk = net.profiles.filter(p => p.season === s.season.id && p.friendId !== s.friendId).reduce((n, p) => n + p.seasonSunk, 0);
  const pool = seasonPoolTotal(s, now, s.season.id, identity.guest ? 0 : onlineSunk);
  const board = seasonBoard(s, now, online);
  const myRank = board.findIndex(e => e.you) + 1;
  const endsIn = seasonStartOf(s.season.id) + SEASON.ms - now;
  const last = s.lastSeason;
  const lastBoard = useMemo(() => (last ? seasonBoard(s, now, [], last.id, last.score) : []), [last, s, now]);
  const lastRank = last ? lastBoard.findIndex(e => e.you) + 1 : 0;
  return (
    <>
      <div className="season-hero">
        <span className="muted">Season {seasonNumber(s.season.id)} Prize Pool</span>
        <b className="big-num">{rf(pool)} RF</b>
        <span className="muted">ends in {mmss(endsIn)} · top 10 split it</span>
      </div>
      <p className="muted">{SINK.pool * 100}% of every RF spent in the game (upgrades, forging, land, charms, wheel, swap fees, lost RF stakes) flows here. Score = XP earned + {SEASON.rfScore} pts per RF spent. You: <b>{n0(seasonScore(s))}</b> pts · rank <b>#{myRank}</b></p>
      <SeasonJourney />
      {last && !last.claimed && (
        <div className="callout">
          <p>Season {seasonNumber(last.id)} ended. You placed <b>#{lastRank}</b>{lastRank <= 10 ? ` → ${rf(last.pool * SEASON.payouts[lastRank - 1])} RF!` : " (top 10 get paid)"}</p>
          {lastRank <= 10 && <button type="button" className="btn primary big" onClick={() => act({ type: "seasonClaim", rank: lastRank, pool: last.pool })}>Claim season prize</button>}
        </div>
      )}
      <ol className="board">
        {board.slice(0, 15).map((e, i) => (
          <li key={e.id} className={e.you ? "you" : ""}>
            <span className="rank">{i < 3 ? <><Icon id={["crown", "trophy", "star"][i]} size={20} />{i + 1}</> : `#${i + 1}`}</span>
            <span className="grow">{e.name}{e.online && <span className="on-chip">online</span>}</span>
            <span>{n0(e.score)}</span>
            <span className="muted">{i < 10 ? `${rf(pool * SEASON.payouts[i])} RF` : ""}</span>
          </li>
        ))}
        {myRank > 15 && <li className="you"><span className="rank">#{myRank}</span><span className="grow">{s.name}</span><span>{n0(seasonScore(s))}</span><span /></li>}
      </ol>
      <p className="fineprint"><SimTag /> Payouts: {SEASON.payouts.map(p => `${p * 100}%`).join(" / ")}. {SEASON.rollover * 100}% of the island pool seeds the next season. Weekly seasons roll over Monday 00:00 UTC.</p>
    </>
  );
}

function LeaderTab() {
  const { s, net, identity } = useG();
  const [sort, setSort] = useState<"level" | "burned" | "netWorth" | "bestDive">("burned");
  const me = { friendId: s.friendId, name: s.name, level: s.level, burned: s.stats.burned, netWorth: 0, bestDive: s.stats.bestDive, title: titleFor(s.level), you: true };
  const rows = [
    ...net.profiles.filter(p => p.friendId !== s.friendId).map(p => ({ ...p, you: false })),
    ...(identity.guest ? [] : [me]),
    ...s.rivals.map(r => ({ friendId: r.id, name: `${r.name} (sim)`, level: r.level, burned: r.burned * 100, netWorth: 0, bestDive: 0, title: titleFor(r.level), you: false })),
  ].sort((a, b) => (b[sort] as number) - (a[sort] as number));
  return (
    <>
      <div className="seg wrap">
        {([["burned", "RF spent"], ["level", "Level"], ["bestDive", "Best dive"], ["netWorth", "Net worth"]] as const).map(([k, l]) => <button key={k} type="button" className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}
      </div>
      <ol className="board">
        {rows.slice(0, 25).map((r, i) => (
          <li key={`${r.friendId}-${i}`} className={r.you ? "you" : ""}>
            <span className="rank">#{i + 1}</span>
            <span className="grow">{r.name} <small className="muted">{r.title}</small></span>
            <span>{sort === "burned" ? `${rf(r.burned)} RF` : sort === "level" ? `Lv${r.level}` : sort === "bestDive" ? `${(r.bestDive || 0).toFixed(2)}x` : n0(r.netWorth)}</span>
          </li>
        ))}
      </ol>
      <p className="fineprint">{net.profiles.length} online islands found on Nostr relays ({net.status}). {identity.guest ? "Guests are not listed." : ""}</p>
    </>
  );
}

function StatsTab() {
  const { s } = useG();
  const st = s.stats;
  const rows: [string, string][] = [
    ["RF spent (all sinks)", `${rf(st.burned)} RF`], ["→ Season Pool (70%)", `${rf(st.toPool)} RF`], ["→ Creator (25%)", `${rf(st.creatorFees)} RF`], ["→ Burned forever (5%)", `${rf(st.trueBurn)} RF`],
    ["RF won", `${rf(st.rfWon)} RF`], ["Season prizes", `${st.seasonWins} (${rf(st.seasonRf)} RF)`], ["SHELL earned", n0(st.shellEarned)],
    ["Fish caught", n0(st.fish)], ["Harvests", n0(st.harvests)], ["Dives / best", `${st.dives} / ${st.bestDive.toFixed(2)}x`],
    ["Mines cashouts / best", `${st.minesCashouts} / ${st.bestMinesTiles} tiles`], ["Raids W/L", `${st.raidsWon}/${st.raidsLost}`], ["Defended / raided", `${st.defended}/${st.raidedBy}`],
    ["Ascensions", `${st.ascends} (${st.ascendFails} fails)`], ["Forges", `${st.forges - st.forgeFails}/${st.forges}`], ["Kraken kills", n0(st.bossKills)],
    ["Wheel spins / jackpots", `${st.spins}/${st.jackpots}`], ["Flips W/L", `${st.flipsWon}/${st.flipsLost}`], ["Swaps", n0(st.swaps)],
    ["Island RF burned (all)", `${rf(s.world.burned)} RF`], ["Island creator fees", `${rf(s.world.creatorFees)} RF`],
  ];
  return <table className="stats-table"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>;
}

export function BoardPanel({ onClose }: { onClose: () => void }) {
  const { s, act, net } = useG();
  const [tab, setTab] = useState<"quests" | "season" | "milestones" | "leaders" | "trophies" | "feed" | "stats">("quests");
  return (
    <Panel title="Bounty Board" icon="board" onClose={onClose} wide>
      <Tabs tabs={[["quests", "Bounties"], ["season", "Season"], ["milestones", "Milestones"], ["leaders", "Leaders"], ["trophies", `Trophies ${s.achievements.length}/${ACHIEVEMENTS.length}`], ["feed", "Feed"], ["stats", "Stats"]]} value={tab} onChange={setTab} />
      {tab === "quests" && (
        <div className="list">
          {s.quests.map(q => (
            <div key={q.id} className="list-row">
              <span className="big-icon"><Icon id={q.progress >= q.target ? "check" : "board"} size={30} /></span>
              <span className="grow"><b>{questLabel(q)}</b><Bar value={q.progress} max={q.target} color="#ffd166" /><small>{q.kind === "burn" ? `${rf(q.progress)}/${rf(q.target)} RF` : `${q.progress}/${q.target}`} · reward {q.reward.shell} SHELL +{q.reward.xp}XP{q.reward.items?.charm ? " +" : q.reward.items?.pearl ? " +" : ""}</small></span>
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
            return <div key={a.id} className={`item static ${got ? "got" : "locked"}`}><span className="big-icon"><Icon id={got ? "trophy" : "lock"} size={32} /></span><b>{a.name}</b><small>{a.blurb}</small><small className="muted">{a.reward.rf ? `${rf(a.reward.rf)} RF` : `${a.reward.shell}`}</small></div>;
          })}
        </div>
      )}
      {tab === "feed" && (
        <div className="feed">
          <h3>Island feed (live)</h3>
          {net.brags.length === 0 && <p className="muted">Nothing yet. Big wins, level-ups and jackpots show up here for everyone.</p>}
          {net.brags.map(b => <p key={b.id}><b>{b.name}</b> {b.text} <small className="muted">{new Date(b.ts * 1000).toLocaleTimeString()}</small></p>)}
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
      <p className="muted">Milestones never end. Cross a line and the reward lands automatically: SHELL every tier, RF every third tier.</p>
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
                <small>{p.fmt(p.value)} / {p.fmt(p.next)} {t.unit} · next: +{r.shell} SHELL{r.rf ? ` +${rf(r.rf)} RF` : ""}</small>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Free weekly reward track: every player earns tiers from season points, not just the top 10. */
function SeasonJourney() {
  const { s, act } = useG();
  const score = seasonScore(s);
  const ready = passClaimable(s);
  const next = PASS.find(t => t.score > score);
  const prize = (t: (typeof PASS)[number]) => [t.shell ? `${t.shell} SHELL` : "", t.rf ? `${rf(t.rf)} RF` : "", ...Object.entries(t.items ?? {}).map(([id, n]) => `${n} ${ITEMS[id as ItemId].name}`)].filter(Boolean).join(", ");
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
