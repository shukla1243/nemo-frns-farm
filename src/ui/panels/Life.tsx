import { useState } from "react";
import {
  REBIRTH, rebirthCost, ASCEND, CROPS, HOMES, ITEMS, MAX_LEVEL, MAX_PLOTS, RECIPES, SLEEP_MS, TITLES, TRAITS, ascendCost, plotCost, titleFor, xpToNext,
  type CropId, type ItemId, type MealId,
} from "../../engine/config";
import { ascendChance } from "../../engine/actions";
import { cropReady, growMs } from "../../engine/systems";
import { defense, discounted, maxEnergy, missing, power, prosperityPct } from "../../engine/state";
import { Bar, CostList, Panel, mmss, n0, rf, useG } from "../common";
import { Icon, SpriteImg } from "../Icon";
import { crop as cropSprite } from "../../art/sprites";

export function HomePanel({ onClose }: { onClose: () => void }) {
  const { s, act, now } = useG();
  const next = HOMES[s.home + 1];
  const cost = next ? discounted(s, next.cost, "build") : null;
  const sleepLeft = s.sleeping ? s.sleeping.until - now : 0;
  return (
    <Panel title={HOMES[s.home].name} icon="home" onClose={onClose}>
      <div className="row-cards">
        <div className="mini-card"><b>Sleep</b><span>Restores {Math.round(HOMES[s.home].sleep * 100)}% energy{s.home >= 3 ? " + mood" : ""}</span></div>
        <div className="mini-card"><b>Defense</b><span>{defense(s)} (vault protects {Math.round(HOMES[s.home].vault * 100)}%)</span></div>
        <div className="mini-card"><b>Traps</b><span>{s.inv.trap} (+12 def each)</span></div>
      </div>
      {s.sleeping ? (
        <div className="callout">
          <p>Sleeping… {mmss(sleepLeft)} left</p>
          <Bar value={SLEEP_MS - sleepLeft} max={SLEEP_MS} color="#7c83fd" label="Sleep progress" />
          <button type="button" className="btn" onClick={() => act({ type: "wake" })}>Wake up early (partial rest)</button>
        </div>
      ) : (
        <button type="button" className="btn primary big" disabled={s.energy >= maxEnergy(s) - 1} onClick={() => { act({ type: "sleep" }); onClose(); }}>
          Sleep ({Math.round(SLEEP_MS / 1000)}s) · {Math.round(s.energy)}/{maxEnergy(s)} 
        </button>
      )}
      {s.home === 0 && <p className="warn">Tent life: 20% chance crabs steal 10% of your SHELL while you sleep. Build a hut!</p>}
      {next ? (
        <section className="section">
          <h3>Upgrade → {next.name}</h3>
          <p className="muted">{next.perk}</p>
          <CostList cost={cost!} s={s} />
          <button type="button" className="btn primary" disabled={!!missing(s, cost!)} onClick={() => act({ type: "buildHome" })}>Build {next.name}</button>
        </section>
      ) : <p className="good">Your Sea Castle is maxed. Legend.</p>}
      {s.home >= 1 && <Kitchen />}
    </Panel>
  );
}

function Kitchen() {
  const { s, act } = useG();
  return (
    <section className="section">
      <h3>Kitchen</h3>
      <div className="list">
        {(Object.keys(RECIPES) as MealId[]).map(m => {
          const food = ITEMS[m].food!;
          return (
            <div key={m} className="list-row">
              <span className="big-icon"><Icon id={m} size={32} /></span>
              <span className="grow"><b>{ITEMS[m].name}</b><small>+{food.hunger} hunger +{food.mood} mood{food.energy ? ` +${food.energy} ` : ""}{m === "feast" ? " · Well Fed +15% yields" : ""}</small><CostList cost={{ items: RECIPES[m] }} s={s} /></span>
              <button type="button" className="btn" disabled={!!missing(s, { items: RECIPES[m] })} onClick={() => act({ type: "cook", meal: m })}>Cook</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function FarmPanel({ onClose }: { onClose: () => void }) {
  const { s, act, now } = useG();
  const [crop, setCrop] = useState<CropId>("kelp");
  const readyCount = s.plots.filter((_, i) => cropReady(s, i, now)).length;
  const emptyCount = s.plots.filter(p => !p.crop).length;
  const harvestAll = () => s.plots.forEach((_, i) => { if (cropReady(s, i, now)) act({ type: "harvest", plot: i }); });
  const plantAll = () => s.plots.forEach((p, i) => { if (!p.crop) act({ type: "plant", plot: i, crop }); });
  const seed = CROPS[crop].seed;
  return (
    <Panel title="Farm" icon="carrot" onClose={onClose}>
      <div className="seg wrap">
        {(Object.keys(CROPS) as CropId[]).map(c => (
          <button key={c} type="button" className={crop === c ? "on" : ""} onClick={() => setCrop(c)}>
            <Icon id={c} size={18} /> {ITEMS[c].name} <small>({s.inv[CROPS[c].seed]} seeds · {Math.round(growMs(s, c) / 1000)}s)</small>
          </button>
        ))}
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={!readyCount} onClick={harvestAll}>Harvest all ({readyCount})</button>
        <button type="button" className="btn" disabled={!emptyCount || s.inv[seed] < 1} onClick={plantAll}>Plant {ITEMS[crop].name} in empty ({emptyCount})</button>
        <button type="button" className="btn" onClick={() => act({ type: "buy", item: seed, qty: 5 })}>Buy 5 seeds · {CROPS[crop].seedPrice * 5} SHELL</button>
      </div>
      <div className="plots">
        {s.plots.map((p, i) => {
          const ready = cropReady(s, i, now);
          const prog = p.crop ? Math.min(1, (now - p.plantedAt) / Math.max(1, p.readyAt - p.plantedAt)) : 0;
          return (
            <div key={i} className={`plot ${ready ? "ready" : ""} ${p.withered ? "dead" : ""}`}>
              <span className="plot-icon">{p.crop && <SpriteImg sprite={cropSprite(p.crop, p.withered ? 3 : ready ? 2 : prog < 0.45 ? 0 : 1)} name={`crop-${p.crop}-${p.withered ? 3 : ready ? 2 : prog < 0.45 ? 0 : 1}`} height={30} />}</span>
              {p.crop && !p.withered && !ready && <><Bar value={prog} max={1} color="#7cf29a" /><small>{mmss(p.readyAt - now)}</small></>}
              {!p.crop && <button type="button" className="btn tiny" disabled={s.inv[seed] < 1} onClick={() => act({ type: "plant", plot: i, crop })}>Plant</button>}
              {ready && <button type="button" className="btn tiny primary" onClick={() => act({ type: "harvest", plot: i })}>Harvest</button>}
              {p.withered && <button type="button" className="btn tiny" onClick={() => act({ type: "clearPlot", plot: i })}>Clear</button>}
            </div>
          );
        })}
      </div>
      {s.plots.length < MAX_PLOTS && (
        <section className="section">
          <h3>Expand farm → plot #{s.plots.length + 1}</h3>
          <CostList cost={plotCost(s.plots.length)} s={s} />
          <button type="button" className="btn" disabled={!!missing(s, plotCost(s.plots.length))} onClick={() => act({ type: "buyPlot" })}>Buy plot</button>
        </section>
      )}
      <p className="muted">6% golden harvest chance (x3). Storms can wither crops unless you live in a Coral Cottage or better.</p>
    </Panel>
  );
}

export function BagPanel({ onClose }: { onClose: () => void }) {
  const { s, act } = useG();
  const edible = (Object.keys(ITEMS) as ItemId[]).filter(id => ITEMS[id].food && s.inv[id] > 0);
  const rest = (Object.keys(ITEMS) as ItemId[]).filter(id => !ITEMS[id].food && s.inv[id] > 0);
  return (
    <Panel title="Backpack" icon="bag" onClose={onClose}>
      <h3>Eat</h3>
      {edible.length === 0 && <p className="muted">No food! Buy Sea Bread at the Market, fish at the Dock, or harvest crops.</p>}
      <div className="item-grid">
        {edible.map(id => (
          <button key={id} type="button" className="item" onClick={() => act({ type: "eat", item: id })} disabled={s.hunger >= 99}>
            <span className="big-icon"><Icon id={id} size={32} /></span><b>{s.inv[id]}</b><small>{ITEMS[id].name} +{ITEMS[id].food!.hunger} hunger</small>
          </button>
        ))}
        {s.inv.energyDrink > 0 && <button type="button" className="item" onClick={() => act({ type: "drink" })}><span className="big-icon"><Icon id="energyDrink" size={32} /></span><b>{s.inv.energyDrink}</b><small>Kelp Brew +40 energy</small></button>}
      </div>
      <h3>Items</h3>
      <div className="item-grid">
        {rest.filter(id => id !== "energyDrink").map(id => <div key={id} className="item static"><span className="big-icon"><Icon id={id} size={32} /></span><b>{s.inv[id]}</b><small>{ITEMS[id].name}</small></div>)}
      </div>
    </Panel>
  );
}

export function ShrinePanel({ onClose }: { onClose: () => void }) {
  const { s, act } = useG();
  const [blessing, setBlessing] = useState(false);
  const [charm, setCharm] = useState(false);
  const cost = ascendCost(s.level);
  const need = xpToNext(s.level);
  const chance = ascendChance(s, blessing);
  const trait = TRAITS.find(t => t.id === s.trait)!;
  const tierNext = Math.floor((s.level + 1) / 10) > Math.floor(s.level / 10);
  return (
    <Panel title="Coral Shrine: Ascension" icon="star" onClose={onClose}>
      <div className="hero-stat">
        <span className="lvl">Lv {s.level}</span>
        <span className="title-chip">{titleFor(s.level)}</span>
        <span className="trait-chip">{trait.family} · {trait.name}</span>
      </div>
      <p className="muted">{trait.blurb}</p>
      <Bar value={s.xp} max={need} color="#ffd166" label="XP" />
      <p>{n0(s.xp)} / {n0(need)} XP · Power {power(s)} · Max energy {maxEnergy(s)} · Prosperity +{prosperityPct(s)}%</p>
      {s.level >= MAX_LEVEL ? <p className="good">Max level. Ocean Legend.</p> : (
        <section className="section">
          <h3>Ascend to Lv {s.level + 1}{tierNext ? ` → ${TITLES[Math.min(TITLES.length - 1, Math.floor((s.level + 1) / 10))]}!` : ""}</h3>
          <CostList cost={cost} s={s} />
          <div className="odds">
            <span className="odds-big">{chance.toFixed(0)}%</span>
            <span>success chance{s.ascendPity ? ` (incl. +${s.ascendPity * ASCEND.pityStep}% pity)` : ""}</span>
          </div>
          <label className="check"><input type="checkbox" checked={blessing} disabled={s.inv.blessing < 1} onChange={e => setBlessing(e.target.checked)} /> Use Luck Scroll (+{ASCEND.blessing}%) · have {s.inv.blessing}</label>
          <label className="check"><input type="checkbox" checked={charm} disabled={s.inv.charm < 1} onChange={e => setCharm(e.target.checked)} /> Protection Charm (on fail refund ½ SHELL & materials) · have {s.inv.charm}</label>
          <button type="button" className="btn primary big" disabled={s.xp < need || !!missing(s, cost)} onClick={() => act({ type: "ascend", blessing, charm })}>
            Ascend: spend {rf(cost.rf ?? 0)} RF
          </button>
          {s.xp < need && <p className="muted">Earn {n0(need - s.xp)} more XP by working, fishing, farming and taking risks.</p>}
          <p className="fineprint">Failure spends the cost (70% to the Season Pool) but never lowers your level. Each failure adds +{ASCEND.pityStep}% pity.</p>
        </section>
      )}
      <RebirthSection />
    </Panel>
  );
}

/** Rebirth: restart at level 1 for permanent bonuses. The endless progression loop. */
function RebirthSection() {
  const { s, act } = useG();
  const [sure, setSure] = useState(false);
  const cost = rebirthCost(s.rebirths);
  const next = s.rebirths + 1;
  const ready = s.level >= REBIRTH.minLevel;
  return (
    <section className="section rebirth-box">
      <h3><Icon id="star" size={22} /> Rebirth {s.rebirths > 0 ? `(you are Rebirth ${s.rebirths})` : ""}</h3>
      <p>Start again at level 1 and keep your home, gear, items and island. Each rebirth adds <b>+{Math.round(REBIRTH.xpBonus * 100)}% XP</b> and <b>+{Math.round(REBIRTH.shellBonus * 100)}% SHELL</b> forever and a star next to your name.</p>
      <p className="muted">Rebirth {next} total bonus: +{Math.round(next * REBIRTH.xpBonus * 100)}% XP, +{Math.round(next * REBIRTH.shellBonus * 100)}% SHELL. Cost: {rf(cost)} RF (a sink: 70% to the Season Pool).</p>
      {!ready ? <p className="warn">Unlocks at level {REBIRTH.minLevel}. You are level {s.level}.</p>
        : !sure ? <button type="button" className="btn big" onClick={() => setSure(true)}>Rebirth for {rf(cost)} RF</button>
          : <div className="btn-row"><button type="button" className="btn hot big" disabled={s.rf < cost} onClick={() => { act({ type: "rebirth" }); setSure(false); }}>Yes, rebirth now</button><button type="button" className="btn" onClick={() => setSure(false)}>Not yet</button></div>}
    </section>
  );
}
