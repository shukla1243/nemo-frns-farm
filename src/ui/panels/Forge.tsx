import { useState } from "react";
import { FORGE_PITY_STEP, GEAR, ITEMS, MAX_GEAR, forgeCost, type GearId, type ItemId } from "../../engine/config";
import { forgeChance } from "../../engine/actions";
import { missing } from "../../engine/state";
import { actOf, chapterAt } from "../../engine/story";
import { CostList, Panel, SimTag, rf, useG } from "../common";
import { Icon } from "../Icon";

export function ForgePanel({ onClose }: { onClose: () => void }) {
  const { s, act, brag } = useG();
  const [gear, setGear] = useState<GearId>("blade");
  const [blessing, setBlessing] = useState(false);
  const [charm, setCharm] = useState(false);
  const [flash, setFlash] = useState<"ok" | "fail" | null>(null);
  const lvl = s.gear[gear];
  const cost = lvl < MAX_GEAR ? forgeCost(lvl + 1) : null;
  const chance = lvl < MAX_GEAR ? forgeChance(s, gear, blessing) : 0;
  const strike = () => {
    const r = act({ type: "forge", gear, blessing, charm });
    if (!r.ok) return;
    setFlash(r.data?.success ? "ok" : "fail");
    setTimeout(() => setFlash(null), 900);
    if (r.data?.success && lvl + 1 >= 7) brag(`forged ${GEAR[gear].name} to +${lvl + 1} `);
  };
  return (
    <Panel title="Volcano Forge" icon="fire" onClose={onClose}>
      <div className="seg wrap">
        {(Object.keys(GEAR) as GearId[]).map(g => <button key={g} type="button" className={gear === g ? "on" : ""} onClick={() => setGear(g)}><Icon id={g} size={18} /> {GEAR[g].name} <b>+{s.gear[g]}</b></button>)}
      </div>
      <p className="muted">{GEAR[gear].effect}</p>
      <div className={`anvil ${flash ?? ""}`}>
        <span className="anvil-gear"><Icon id={gear} size={56} /></span>
        <span className="anvil-lvl">+{lvl}{cost ? ` → +${lvl + 1}` : " MAX"}</span>
      </div>
      {cost ? (
        <>
          <div className="odds"><span className="odds-big">{chance.toFixed(0)}%</span><span>success{s.forgePity[gear] ? ` (incl. +${s.forgePity[gear] * FORGE_PITY_STEP}% pity)` : ""}</span></div>
          <CostList cost={cost} s={s} />
          <label className="check"><input type="checkbox" checked={blessing} disabled={s.inv.blessing < 1} onChange={e => setBlessing(e.target.checked)} /> Luck Scroll +10% · have {s.inv.blessing}</label>
          <label className="check"><input type="checkbox" checked={charm} disabled={s.inv.charm < 1} onChange={e => setCharm(e.target.checked)} /> Protection Charm (save ½ materials on fail) · have {s.inv.charm}</label>
          <button type="button" className="btn hot big" disabled={!!missing(s, cost)} onClick={strike}>Strike: spend {rf(cost.rf ?? 0)} RF</button>
          {missing(s, cost) && <p className="warn">{missing(s, cost)}</p>}
        </>
      ) : <p className="good">Legendary +10. Nothing left to forge.</p>}
      <table className="odds-table"><thead><tr><th>Target</th><th>Chance</th><th>RF</th></tr></thead>
        <tbody>{Array.from({ length: MAX_GEAR }, (_, i) => <tr key={i} className={i === lvl ? "cur" : ""}><td>+{i + 1}</td><td>{[100, 95, 88, 78, 66, 55, 44, 33, 22, 12][i]}%</td><td>{rf(forgeCost(i + 1).rf ?? 0)}</td></tr>)}</tbody></table>
      <p className="fineprint"><SimTag /> Failures never downgrade gear; each failure adds +{FORGE_PITY_STEP}% pity until success. RF spent → 70% Season Pool.</p>
    </Panel>
  );
}

export function StoryPanel({ onClose }: { onClose: () => void }) {
  const { s, act } = useG();
  const ch = chapterAt(s.story);
  const a = actOf(s.story);
  const inAct = s.story - a.first + 1;
  // Show the current act's chapters; the endless act shows a sliding window around the current chapter.
  const from = a.count === Infinity ? Math.max(a.first, s.story - 3) : a.first;
  const to = a.count === Infinity ? s.story + 4 : a.first + a.count;
  const list = Array.from({ length: to - from }, (_, k) => from + k);
  return (
    <Panel title="Story Mode" icon="book" onClose={onClose}>
      <div className="story">
        <p className="chapter">{a.name} · Chapter {inAct}{a.count === Infinity ? "" : ` of ${a.count}`}</p>
        <h3>{ch.title}</h3>
        <p className="lead">{ch.text}</p>
        <p><b>Goal:</b> {ch.goal}</p>
        <p className="muted">{ch.hint}</p>
        <div className="reward-row"><span className="muted">Reward</span>{ch.reward.shell ? <span className="cost"><Icon id="shell" size={16} /> {ch.reward.shell} SHELL</span> : null}{ch.reward.rf ? <span className="cost"><Icon id="rf" size={16} /> {rf(ch.reward.rf)} RF</span> : null}{Object.entries(ch.reward.items ?? {}).map(([k, v]) => <span key={k} className="cost"><Icon id={k} size={16} /> {v} {ITEMS[k as ItemId].name}</span>)}</div>
        <button type="button" className="btn primary big" disabled={!ch.done(s)} onClick={() => act({ type: "storyClaim" })}>{ch.done(s) ? "Complete chapter" : "In progress…"}</button>
      </div>
      <ol className="chapters">{list.map(i => <li key={i} className={i < s.story ? "done" : i === s.story ? "cur" : ""}><Icon id={i < s.story ? "check" : i === s.story ? "star" : "lock"} size={18} /> {chapterAt(i).title}</li>)}</ol>
      {a.count === Infinity && <p className="fineprint">You've reached the endless act. New chapters keep coming, each with a bigger goal and a bigger reward.</p>}
    </Panel>
  );
}
