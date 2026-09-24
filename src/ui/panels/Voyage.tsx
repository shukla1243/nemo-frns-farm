import { useState } from "react";
import { STOCKS, STOCK_IDS, STOCK_SELL_FEE, VOYAGES, foodCount, homeIsle, stockPrice, voyageBonus, voyageOdds } from "../../engine/voyages";
import { Icon } from "../Icon";
import { Bar, Panel, SimTag, Tabs, mmss, n0, rf, useG } from "../common";

const duration = (min: number) => (min >= 60 ? `${min / 60} h` : `${min} min`);

export function VoyagePanel({ onClose }: { onClose: () => void }) {
  const { s, act, now } = useG();
  const [tab, setTab] = useState<"sail" | "stocks">("sail");
  const v = s.voyage;
  const def = v ? VOYAGES.find(x => x.id === v.id)! : null;
  return (
    <Panel title="Voyage Pier" icon="anchor" onClose={onClose} wide>
      <Tabs tabs={[["sail", "Voyages"], ["stocks", "Stock tokens"]]} value={tab} onChange={setTab} />
      {tab === "sail" && (v && def ? (
        <div className="voyage-live frame-sea">
          {now < v.endsAt ? (
            <>
              <p className="lead"><Icon id="anchor" size={24} /> Your Friend is sailing: <b>{def.id === "homeland" ? homeIsle(s.family) : def.name}</b></p>
              <Bar value={now - v.startedAt} max={v.endsAt - v.startedAt} color="#f5c542" label="Voyage progress" />
              <p>Back in <b>{mmss(v.endsAt - now)}</b>. The outcome was decided when they left. You can close the game; they keep sailing.</p>
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
          <p className="muted">Send your Friend away for a while. Every voyage costs supplies and has clear odds. Bonus from level, gear, rebirths and mood: <b>+{voyageBonus(s).toFixed(1)}%</b> to good outcomes. Food packed: {foodCount(s)} items.</p>
          <div className="voyage-list">
            {VOYAGES.map(vy => {
              const odds = voyageOdds(s, vy);
              const total = odds.reduce((n, o) => n + o.weight, 0);
              const locked = s.level < vy.minLevel && s.rebirths === 0;
              return (
                <div key={vy.id} className="voyage-card frame-paper">
                  <div className="voyage-head">
                    <b>{vy.id === "homeland" ? `${vy.name}: ${homeIsle(s.family)}` : vy.name}</b>
                    <span className="tag-time"><Icon id="clock" size={16} /> {duration(vy.minutes)}</span>
                  </div>
                  <p className="muted">{vy.blurb}</p>
                  <div className="costs">
                    {vy.costRf > 0 && <span className="cost"><Icon id="rf" size={16} /> {rf(vy.costRf)} RF</span>}
                    <span className="cost"><Icon id="shell" size={16} /> {vy.costShell} SHELL</span>
                    <span className={`cost ${foodCount(s) < vy.food ? "short" : ""}`}><Icon id="bread" size={16} /> {vy.food} food</span>
                  </div>
                  <table className="odds-table compact"><tbody>
                    {odds.map(o => <tr key={o.id}><td>{o.label}</td><td>{((o.weight / total) * 100).toFixed(1)}%</td></tr>)}
                  </tbody></table>
                  <button type="button" className="btn primary" disabled={locked || s.hunger < 40} onClick={() => act({ type: "voyageStart", id: vy.id })}>
                    {locked ? `Needs level ${vy.minLevel}` : s.hunger < 40 ? "Eat before sailing" : `Set sail (${duration(vy.minutes)})`}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ))}
      {tab === "stocks" && (
        <>
          <p className="muted">Stock-token shares come back from the Robinhood Reef Run. Prices update every hour and are the same for every player.</p>
          <div className="list">
            {STOCK_IDS.map(id => {
              const price = stockPrice(id, now);
              const prev = stockPrice(id, now - 3_600_000);
              const held = s.stocks[id] ?? 0;
              return (
                <div key={id} className="list-row">
                  <span className="ticker">{id}</span>
                  <span className="grow"><b>{STOCKS[id].name}</b><small>{n0(price)} SHELL / share <span className={price >= prev ? "good" : "bad"}>{price >= prev ? "▲" : "▼"} {Math.abs(((price - prev) / prev) * 100).toFixed(1)}%</span> · you hold {held}</small></span>
                  <button type="button" className="btn" disabled={held <= 0} onClick={() => act({ type: "sellStock", id, shares: held })}>Sell all</button>
                </div>
              );
            })}
          </div>
          <p className="fineprint"><SimTag /> Stock tokens here are simulated game collectibles themed on tokenized stocks trending on Robinhood Chain. They are not securities and have no real value. Selling pays SHELL minus a {STOCK_SELL_FEE * 100}% fee.</p>
        </>
      )}
      {tab === "sail" && <p className="fineprint"><SimTag /> Family Relics give +2% XP each, forever. You have {s.relics}.</p>}
    </Panel>
  );
}
