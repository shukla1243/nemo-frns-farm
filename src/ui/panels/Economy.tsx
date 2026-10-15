import { useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { ITEMS, SHOP, WHEEL, ZONES, type ItemId, type ZoneId } from "../../engine/config";
import { STOCKS, STOCK_IDS, STOCK_SELL_FEE, stockPrice, type StockId } from "../../engine/voyages";
import { sellPrice } from "../../engine/actions";
import { discounted, missing, prosperityPct } from "../../engine/state";
import { eventActive } from "../../engine/systems";
import { CostList, Panel, SimTag, Tabs, mmss, n0, useG } from "../common";
import { Icon } from "../Icon";

export function MarketPanel({ onClose }: { onClose: () => void }) {
  const { s, act, now } = useG();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const sellable = (Object.keys(ITEMS) as ItemId[]).filter(id => ITEMS[id].sell && s.inv[id] > 0);
  const boom = eventActive(s, "boom", now);
  return (
    <Panel title="Market" icon="coin" onClose={onClose}>
      <p className="muted">Market tide: <b className={s.marketTide >= 1 ? "good" : "bad"}>x{s.marketTide.toFixed(2)}</b>{boom && <b className="good"> · BOOM x1.5!</b>} · changes in {mmss(s.nextTideAt - now)} · Prosperity bonus +{prosperityPct(s)}%</p>
      <Tabs tabs={[["buy", "Buy"], ["sell", `Sell (${sellable.length})`]]} value={tab} onChange={setTab} />
      {tab === "buy" ? (
        <div className="list">
          {SHOP.map(o => (
            <div key={o.id} className="list-row">
              <span className="big-icon"><Icon id={o.id} size={32} /></span>
              <span className="grow"><b>{ITEMS[o.id].name}</b><small>have {s.inv[o.id]}</small><CostList cost={o.price} s={s} /></span>
              <button type="button" className="btn" disabled={!!missing(s, o.price)} onClick={() => act({ type: "buy", item: o.id })}>Buy</button>
              <button type="button" className="btn ghost" onClick={() => act({ type: "buy", item: o.id, qty: 5 })}>×5</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="list">
          {sellable.length === 0 && <p className="muted">Nothing to sell yet. Gather, farm, fish and mine!</p>}
          {sellable.map(id => {
            const price = Math.floor(sellPrice(s, id, now) * (1 + prosperityPct(s) / 100));
            return (
              <div key={id} className="list-row">
                <span className="big-icon"><Icon id={id} size={32} /></span>
                <span className="grow"><b>{ITEMS[id].name}</b><small>have {s.inv[id]} · {price} SHELL each</small></span>
                <button type="button" className="btn" onClick={() => act({ type: "sell", item: id, qty: 1 })}>Sell 1</button>
                <button type="button" className="btn ghost" onClick={() => act({ type: "sell", item: id, qty: s.inv[id] })}>All</button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function Spark({ data, label }: { data: number[]; label: string }) {
  const w = 300, h = 80;
  if (data.length < 2) return <svg viewBox={`0 0 ${w} ${h}`} className="spark" />;
  const lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 6 - ((v - lo) / span) * (h - 12)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" role="img" aria-label={`${label} price chart, from ${data[0]} to ${data[data.length - 1]} SHELL`}>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={up ? "rgba(124,242,154,.18)" : "rgba(255,93,143,.18)"} stroke="none" />
      <polyline points={pts} fill="none" stroke={up ? "#2ec27e" : "#ff5d8f"} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

const HOUR = 3_600_000;

/** The Tide Pool trades the simulated island company shares that voyages bring home, for SHELL only. */
export function PoolPanel({ onClose }: { onClose: () => void }) {
  const { s, act, now } = useG();
  const [pick, setPick] = useState<StockId>(STOCK_IDS[0]);
  const price = stockPrice(pick, now);
  const prev = stockPrice(pick, now - HOUR);
  const hour = Math.floor(now / HOUR);
  const history = useMemo(() => Array.from({ length: 48 }, (_, i) => stockPrice(pick, (hour - 47 + i) * HOUR)), [pick, hour]);
  return (
    <Panel title="Tide Pool · island shares" icon="wave" onClose={onClose} wide>
      <div className="seg wrap">
        {STOCK_IDS.map(id => <button key={id} type="button" className={pick === id ? "on" : ""} onClick={() => setPick(id)}>{id}</button>)}
      </div>
      <div className="pool-head">
        <div><span className="muted">{STOCKS[pick].name}</span><b className="big-num">{n0(price)}</b><span className="muted">SHELL per share</span></div>
        <div><span className="muted">Last hour</span><b className={price >= prev ? "good" : "bad"}>{price >= prev ? "Up" : "Down"} {Math.abs(((price - prev) / prev) * 100).toFixed(1)}%</b></div>
        <div><span className="muted">You hold</span><b>{s.stocks[pick] ?? 0}</b></div>
      </div>
      <Spark data={history} label={STOCKS[pick].name} />
      <p className="muted">Shares come back from the Shipwreck Salvage Run at the Voyage Pier. Prices update every hour and are the same for every player.</p>
      <div className="list">
        {STOCK_IDS.map(id => {
          const held = s.stocks[id] ?? 0;
          return (
            <div key={id} className="list-row">
              <span className="ticker">{id}</span>
              <span className="grow"><b>{STOCKS[id].name}</b><small>{n0(stockPrice(id, now))} SHELL / share · you hold {held}</small></span>
              <button type="button" className="btn" disabled={held <= 0} onClick={() => act({ type: "sellStock", id, milli: Math.round(held * 1000) })}>Sell all</button>
            </div>
          );
        })}
      </div>
      <p className="fineprint"><SimTag /> Island company shares are simulated game collectibles from fictional NEMO sea companies. They are not securities and have no real value. Selling pays SHELL minus a {STOCK_SELL_FEE * 100}% fee.</p>
    </Panel>
  );
}

const WHEEL_COLORS = ["#ee6f22", "#6cc6e6", "#f5c542", "#b48ae0", "#ff6f73", "#86c95e", "#f6a9bb", "#fff1a8"];
const WHEEL_ICONS = ["shell", "shell", "ore", "charm", "coin", "pearl", "coin", "chest"];

/** Pixel wheel: a 72px canvas pie (weighted slices) redrawn at the current angle and upscaled crisply. */
function drawWheel(c: HTMLCanvasElement, angleDeg: number, weights: number[]) {
  const ctx = c.getContext("2d")!;
  const N = 72, cx = 36, cy = 36, r = 33;
  ctx.clearRect(0, 0, N, N);
  const total = weights.reduce((a, b) => a + b, 0);
  const bounds: number[] = [];
  let acc = 0;
  for (const w of weights) { acc += w; bounds.push((acc / total) * Math.PI * 2); }
  const rot = (angleDeg * Math.PI) / 180;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > r + 1.5) continue;
    if (d > r - 0.5) { ctx.fillStyle = "#2b1d1a"; ctx.fillRect(x, y, 1, 1); continue; }
    if (d > r - 2.5) { ctx.fillStyle = (Math.floor((Math.atan2(dy, dx) + Math.PI) * 6) % 2) ? "#a0673d" : "#d19a61"; ctx.fillRect(x, y, 1, 1); continue; }
    if (d < 5) { ctx.fillStyle = d < 3 ? "#f5c542" : "#2b1d1a"; ctx.fillRect(x, y, 1, 1); continue; }
    let a = Math.atan2(dy, dx) + Math.PI / 2 - rot;
    a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const i = bounds.findIndex(b => a < b);
    const edge = bounds.some(b => Math.abs(a - b) * d < 0.7) || a * d < 0.7;
    ctx.fillStyle = edge ? "#fff8ec" : WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fillRect(x, y, 1, 1);
  }
}

export function WheelPanel({ onClose }: { onClose: () => void }) {
  const { s, act, now, reducedMotion } = useG();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ label: string; idx: number } | null>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const angle = useRef(0);
  const total = WHEEL.reduce((n, p) => n + p.weight, 0);
  const weights = WHEEL.map(p => p.weight);
  const free = s.wheelFreeAt <= now;
  useEffect(() => { if (cv.current) drawWheel(cv.current, angle.current, WHEEL.map(p => p.weight)); }, []);
  const spin = async () => {
    if (spinning) return;
    const r = await act({ type: "spin", free: true });
    if (!r.ok) return;
    const idx = r.data!.index as number;
    const before = WHEEL.slice(0, idx).reduce((n, p) => n + p.weight, 0);
    const mid = ((before + WHEEL[idx].weight / 2) / total) * 360;
    const target = angle.current - (angle.current % 360) + 360 * 5 + (360 - mid);
    setResult(null);
    const finish = () => { setSpinning(false); setResult({ label: WHEEL[idx].label, idx }); };
    if (reducedMotion) { angle.current = target; if (cv.current) drawWheel(cv.current, target, weights); finish(); return; }
    setSpinning(true);
    const obj = { a: angle.current };
    animate(obj, { a: target, duration: 3200, ease: "outCubic", onUpdate: () => { angle.current = obj.a; if (cv.current) drawWheel(cv.current, obj.a, weights); }, onComplete: finish });
  };
  return (
    <Panel title="Tide Wheel" icon="dice" onClose={onClose}>
      <div className="wheel-wrap">
        <div className="wheel-pointer" aria-hidden><Icon id="pointer" size={36} /></div>
        <canvas ref={cv} width={72} height={72} className="wheel" aria-label="Prize wheel" />
      </div>
      <div className="result-slot" aria-live="polite">{result && <p className="result-pop"><Icon id={WHEEL_ICONS[result.idx]} size={32} /> {result.label}!</p>}</div>
      <div className="btn-row">
        <button type="button" className="btn primary big" disabled={!free || spinning} onClick={spin}>{free ? "Free spin" : `Free spin in ${mmss(s.wheelFreeAt - now)}`}</button>
      </div>
      <table className="odds-table">
        <thead><tr><th>Prize</th><th>Chance</th></tr></thead>
        <tbody>{WHEEL.map((p, i) => <tr key={p.id}><td><span className="swatch" style={{ background: WHEEL_COLORS[i] }} /><Icon id={WHEEL_ICONS[i]} size={20} /> {p.label}</td><td>{(p.weight / total * 100).toFixed(1)}%</td></tr>)}</tbody>
      </table>
      <p className="fineprint"><SimTag /> One free spin every 8 hours. Every prize is SHELL or items.</p>
    </Panel>
  );
}

export function UnlockPanel({ zone, onClose }: { zone: ZoneId; onClose: () => void }) {
  const { s, act } = useG();
  const z = ZONES[zone];
  const cost = discounted(s, z.cost, "build");
  return (
    <Panel title={`Expand: ${z.name}`} icon="map" onClose={onClose}>
      <p className="lead">{z.blurb}</p>
      <p className="muted">Build a boardwalk and grow the island. The new land appears on the map forever.</p>
      <CostList cost={cost} s={s} />
      <button type="button" className="btn primary big" disabled={!!missing(s, cost)} onClick={async () => { const r = await act({ type: "unlockZone", zone }); if (r.ok) onClose(); }}>Unlock {z.name}</button>
      {missing(s, cost) && <p className="warn">{missing(s, cost)}</p>}
      <p className="fineprint">Tip: {zone === "cove" ? "Chop wood in the Palm Grove and sell it at the Market." : "Sell at the Market, gather materials, and claim bounties."}</p>
    </Panel>
  );
}

