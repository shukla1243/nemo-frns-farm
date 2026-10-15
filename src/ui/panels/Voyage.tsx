import { VOYAGES, foodCount, homeIsle, voyageBonus, voyageGateText, voyageOdds, voyagesOpen } from "../../engine/voyages";
import { Icon } from "../Icon";
import { Bar, Panel, SimTag, mmss, useG } from "../common";

const duration = (min: number) => (min >= 60 ? `${min / 60} h` : `${min} min`);

export function VoyagePanel({ onClose }: { onClose: () => void }) {
  const { s, act, now } = useG();
  const v = s.voyage;
  const def = v ? VOYAGES.find(x => x.id === v.id)! : null;
  return (
    <Panel title="Voyage Pier" icon="anchor" onClose={onClose} wide>
      {v && def ? (
        <div className="voyage-live frame-sea">
          {now < v.endsAt ? (
            <>
              <p className="lead"><Icon id="anchor" size={24} /> Your Friend is sailing: <b>{def.id === "homeland" ? homeIsle(s.family) : def.name}</b></p>
              <Bar value={now - v.startedAt} max={v.endsAt - v.startedAt} color="#f5c542" label="Voyage progress" />
              <p>Back in <b>{mmss(v.endsAt - now)}</b>. The odds were locked when they left; the chest is opened when they return. You can close the game; they keep sailing.</p>
              <p className="muted">While your Friend is away you can still farm, trade, spin the wheel and use the market. Fishing, gathering, games, raids and the Kraken need your Friend at home.</p>
              <button type="button" className="btn hot" onClick={() => act({ type: "voyageRecall" })}>Call them home early (voyage is lost)</button>
            </>
          ) : (
            <>
              <p className="lead"><Icon id="chest" size={28} /> Your Friend is back from the {def.name}!</p>
              <button type="button" className="btn primary big" onClick={() => act({ type: "voyageClaim" })}>Open the voyage chest</button>
            </>
          )}
        </div>
      ) : (
        <>
          {!voyagesOpen(s) && <p className="callout">{voyageGateText()} Follow the story note to get there.</p>}
          <p className="muted">Send your Friend away for a while. Every voyage costs supplies and has clear odds. Bonus from level, gear, rebirths and mood: <b>+{voyageBonus(s).toFixed(1)}%</b> to good outcomes. Food packed: {foodCount(s)} items.</p>
          <div className="voyage-list">
            {VOYAGES.map(vy => {
              const odds = voyageOdds(s, vy);
              const total = odds.reduce((n, o) => n + o.weight, 0);
              const closed = !voyagesOpen(s);
              const locked = s.level < vy.minLevel && s.rebirths === 0;
              return (
                <div key={vy.id} className="voyage-card frame-paper">
                  <div className="voyage-head">
                    <b>{vy.id === "homeland" ? `${vy.name}: ${homeIsle(s.family)}` : vy.name}</b>
                    <span className="tag-time"><Icon id="clock" size={16} /> {duration(vy.minutes)}</span>
                  </div>
                  <p className="muted">{vy.blurb}</p>
                  <div className="costs">
                    <span className="cost"><Icon id="shell" size={16} /> {vy.costShell} SHELL</span>
                    <span className={`cost ${foodCount(s) < vy.food ? "short" : ""}`}><Icon id="bread" size={16} /> {vy.food} food</span>
                  </div>
                  <table className="odds-table compact"><tbody>
                    {odds.map(o => <tr key={o.id}><td>{o.label}</td><td>{((o.weight / total) * 100).toFixed(1)}%</td></tr>)}
                  </tbody></table>
                  <button type="button" className="btn primary" disabled={closed || locked || s.hunger < 40} onClick={() => act({ type: "voyageStart", id: vy.id })}>
                    {closed ? "Opens later in the story" : locked ? `Needs level ${vy.minLevel}` : s.hunger < 40 ? "Eat before sailing" : `Set sail (${duration(vy.minutes)})`}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="fineprint"><SimTag /> Family Relics give +2% XP each, forever. You have {s.relics}. Sell island company shares at the Tide Pool.</p>
    </Panel>
  );
}
