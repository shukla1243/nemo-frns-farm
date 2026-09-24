import { useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { ITEMS, SHOP, SINK, WHEEL, WHEEL_COST, ZONES, type ItemId, type ZoneId } from "../../engine/config";
import { POOL, poolPrice, quote, type SwapDir } from "../../engine/amm";
import { sellPrice } from "../../engine/actions";
import { discounted, missing, prosperityPct } from "../../engine/state";
import { eventActive } from "../../engine/systems";
import { CostList, Panel, SimTag, Tabs, mmss, n0, rf, useG } from "../common";
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
              {!o.price.rf && <button type="button" className="btn ghost" onClick={() => act({ type: "buy", item: o.id, qty: 5 })}>×5</button>}
            </div>
          ))}
          <p className="fineprint">RF purchases (Charms, Luck Scrolls) are RF sinks: {SINK.pool * 100}% Season Pool · {SINK.creator * 100}% creator · {SINK.burn * 100}% burned.</p>
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

function Spark({ data }: { data: number[] }) {
  const w = 300, h = 80;
  if (data.length < 2) return <svg viewBox={`0 0 ${w} ${h}`} className="spark" />;
  const lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 6 - ((v - lo) / span) * (h - 12)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" role="img" aria-label={`SHELL per RF price chart, from ${data[0]} to ${data[data.length - 1]}`}>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={up ? "rgba(124,242,154,.18)" : "rgba(255,93,143,.18)"} stroke="none" />
      <polyline points={pts} fill="none" stroke={up ? "#2ec27e" : "#ff5d8f"} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function PoolPanel({ onClose }: { onClose: () => void }) {
  const { s, act } = useG();
  const [dir, setDir] = useState<SwapDir>("shellToRf");
  const [amount, setAmount] = useState(300);
  const inUnits = dir === "shellToRf" ? amount : Math.round(amount * 100);
  const q = useMemo(() => quote(s.pool, dir, inUnits), [s.pool, dir, inUnits]);
  const price = poolPrice(s.pool);
  const bal = dir === "shellToRf" ? s.shell : s.rf / 100;
  return (
    <Panel title="Tide Pool · $SHELL / $RAREFRIENDS" icon="wave" onClose={onClose} wide>
      <div className="pool-head">
        <div><span className="muted">Price</span><b className="big-num">{price.toFixed(1)}</b><span className="muted">SHELL per RF</span></div>
        <div><span className="muted">Reserves</span><b>{n0(s.pool.shell)} · {rf(s.pool.rf)} RF</b></div>
        <div><span className="muted">Island volume</span><b>{rf(s.world.volumeRf)} RF</b></div>
      </div>
      <Spark data={s.pool.history} />
      <div className="swap">
        <div className="seg">
          <button type="button" className={dir === "shellToRf" ? "on" : ""} onClick={() => { setDir("shellToRf"); setAmount(300); }}><Icon id="shell" size={18} /> Sell SHELL for RF</button>
          <button type="button" className={dir === "rfToShell" ? "on" : ""} onClick={() => { setDir("rfToShell"); setAmount(1); }}><Icon id="rf" size={18} /> Buy SHELL with RF</button>
        </div>
        <label className="stake-input">
          <span>Pay</span>
          <input type="number" inputMode="decimal" min={0} step={dir === "shellToRf" ? 10 : 0.1} value={amount} onChange={e => setAmount(Math.max(0, Number(e.target.value)))} />
          <span>{dir === "shellToRf" ? "SHELL" : "RF"}</span>
        </label>
        <div className="quick">
          {[0.1, 0.25, 0.5, 1].map(f => <button key={f} type="button" onClick={() => setAmount(dir === "shellToRf" ? Math.floor(bal * f) : Math.floor(bal * f * 100) / 100)}>{f * 100}%</button>)}
        </div>
        {q ? (
          <div className="quote">
            <p>You receive <b>{dir === "shellToRf" ? `${rf(q.out)} RF` : `${n0(q.out)} SHELL`}</b></p>
            <p className="muted">Fee {rf(q.fee)} RF (3%) → {SINK.pool * 100}% Season Pool · {SINK.creator * 100}% creator · {SINK.burn * 100}% burned · Price impact {(q.impact * 100).toFixed(2)}%</p>
          </div>
        ) : <p className="muted">Enter an amount (max {POOL.maxShareOfReserve * 100}% of the pool per swap).</p>}
        <button type="button" className="btn primary big" disabled={!q || (dir === "shellToRf" ? s.shell < inUnits : s.rf < inUnits)}
          onClick={() => q && act({ type: "swap", dir, amount: inUnits, minOut: Math.floor(q.out * 0.99) })}>Swap</button>
      </div>
      <p className="fineprint"><SimTag /> A constant-product (x·y=k) pool pairing the game's $SHELL with $RAREFRIENDS. Simulated traders move the price every ~30s. On-chain, this is the "pair it with $RAREFRIENDS to get a market" step of the Rare Friends roadmap, and fees are creator revenue as assets trade.</p>
    </Panel>
  );
}

const WHEEL_COLORS = ["#ee6f22", "#6cc6e6", "#f5c542", "#b48ae0", "#ff6f73", "#86c95e", "#f6a9bb", "#fff1a8"];
const WHEEL_ICONS = ["shell", "shell", "ore", "charm", "rf", "pearl", "rf", "chest"];

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
  const { s, act, now, reducedMotion, brag } = useG();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ label: string; idx: number } | null>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const angle = useRef(0);
  const total = WHEEL.reduce((n, p) => n + p.weight, 0);
  const weights = WHEEL.map(p => p.weight);
  const free = s.wheelFreeAt <= now;
  useEffect(() => { if (cv.current) drawWheel(cv.current, angle.current, WHEEL.map(p => p.weight)); }, []);
  const spin = (isFree: boolean) => {
    if (spinning) return;
    const r = act({ type: "spin", free: isFree });
    if (!r.ok) return;
    const idx = r.data!.index as number;
    const before = WHEEL.slice(0, idx).reduce((n, p) => n + p.weight, 0);
    const mid = ((before + WHEEL[idx].weight / 2) / total) * 360;
    const target = angle.current - (angle.current % 360) + 360 * 5 + (360 - mid);
    setResult(null);
    const finish = () => { setSpinning(false); setResult({ label: WHEEL[idx].label, idx }); if (WHEEL[idx].jackpot) brag("hit the JACKPOT on the Tide Wheel!"); };
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
        <button type="button" className="btn primary big" disabled={!free || spinning} onClick={() => spin(true)}>{free ? "Free spin" : `Free spin in ${mmss(s.wheelFreeAt - now)}`}</button>
        <button type="button" className="btn big" disabled={s.rf < WHEEL_COST || spinning} onClick={() => spin(false)}>Spin for {rf(WHEEL_COST)} RF</button>
      </div>
      <table className="odds-table">
        <thead><tr><th>Prize</th><th>Chance</th></tr></thead>
        <tbody>{WHEEL.map((p, i) => <tr key={p.id}><td><span className="swatch" style={{ background: WHEEL_COLORS[i] }} /><Icon id={WHEEL_ICONS[i]} size={20} /> {p.label}</td><td>{(p.weight / total * 100).toFixed(1)}%</td></tr>)}</tbody>
      </table>
      <p className="fineprint"><SimTag /> Paid spins are an RF sink. Expected RF-only return is 47% of the spin; total expected value is about 94% counting items at market value.</p>
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
      <button type="button" className="btn primary big" disabled={!!missing(s, cost)} onClick={() => { const r = act({ type: "unlockZone", zone }); if (r.ok) onClose(); }}>Unlock {z.name}</button>
      {missing(s, cost) && <p className="warn">{missing(s, cost)}</p>}
      <p className="fineprint">Tip: {zone === "cove" ? "Chop wood in the Palm Grove and sell it at the Market." : "Swap SHELL for RF at the Tide Pool, gather materials, and claim bounties."}</p>
    </Panel>
  );
}

