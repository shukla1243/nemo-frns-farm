import { useEffect, useRef, useState } from "react";
import { DIVE, FISH_ENERGY, FISH_TABLE, FLIP, ITEMS, MINES, diveMultiplierAt, type FishId } from "../../engine/config";
import { diveEdge, minesMultiplier } from "../../engine/actions";
import type { DiveRun, MinesRun } from "../../engine/types";
import { Panel, SimTag, StakePicker, n0, rf, useG } from "../common";
import { Icon } from "../Icon";

function FlipOffer() {
  const { s, act, brag } = useG();
  const w = s.lastWin;
  if (!w || w.amount <= 0) return null;
  const amt = w.currency === "rf" ? `${rf(w.amount)} RF` : `${n0(w.amount)} SHELL`;
  const chance = (FLIP.winChance + (s.trait === "chaos" ? 0.02 : 0)) * 100;
  return (
    <div className="flip">
      <p><b>Double or nothing?</b> Risk your {amt} win · {chance.toFixed(0)}% to double · flip {w.flips + 1}/{FLIP.maxFlips}</p>
      <div className="btn-row">
        <button type="button" className="btn hot" disabled={w.flips >= FLIP.maxFlips} onClick={() => { const r = act({ type: "flip" }); if (r.ok && r.data?.won && w.flips + 1 >= 3) brag(`flipped ${w.flips + 1}x in a row for ${w.currency === "rf" ? rf(w.amount * 2) + " RF" : n0(w.amount * 2) + " SHELL"} `); }}>FLIP → {w.currency === "rf" ? rf(w.amount * 2) : n0(w.amount * 2)}</button>
        <button type="button" className="btn" onClick={() => act({ type: "keepWin" })}>Bank it</button>
      </div>
    </div>
  );
}

// ---------------- Fishing ----------------
type FishPhase = { k: "idle" } | { k: "wait"; until: number } | { k: "reel"; zoneStart: number; zone: number; speed: number; started: number } | { k: "done"; text: string; fish?: FishId };

export function DockPanel({ onClose }: { onClose: () => void }) {
  const { s, act, reducedMotion } = useG();
  const [phase, setPhase] = useState<FishPhase>({ k: "idle" });
  const [marker, setMarker] = useState(0);
  const raf = useRef(0);
  const markerRef = useRef(0);
  const runRef = useRef(s.run);
  runRef.current = s.run;

  useEffect(() => {
    if (phase.k === "wait") {
      const t = setTimeout(() => {
        const cur = runRef.current;
        const run = cur && cur.kind === "fish" ? cur : null;
        const zone = run?.zone ?? 0.25;
        const diff = FISH_TABLE.find(f => f.id === run?.fish)?.difficulty ?? 0;
        setPhase({ k: "reel", zone, zoneStart: Math.random() * (1 - zone), speed: (0.9 + diff * 2.2) * (reducedMotion ? 0.6 : 1), started: performance.now() });
      }, phase.until - Date.now());
      return () => clearTimeout(t);
    }
    if (phase.k === "reel") {
      const loop = (t: number) => {
        const e = (t - phase.started) / 1000;
        const m = (Math.sin(e * phase.speed * Math.PI) + 1) / 2; // ping-pong 0..1
        markerRef.current = m; setMarker(m);
        if (e > 4.5) { act({ type: "fishReel", hit: false }); setPhase({ k: "done", text: "Too slow. It got away!" }); return; }
        raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf.current);
    }
  }, [phase, act, reducedMotion]);

  const cast = () => {
    const r = act({ type: "fishCast" });
    if (r.ok) setPhase({ k: "wait", until: Date.now() + 900 + Math.random() * 1600 });
  };
  const reel = () => {
    if (phase.k !== "reel") return;
    cancelAnimationFrame(raf.current);
    const m = markerRef.current;
    const hit = m >= phase.zoneStart && m <= phase.zoneStart + phase.zone;
    const r = act({ type: "fishReel", hit });
    const fish = r.data?.fish as FishId | undefined;
    setPhase({ k: "done", text: hit && fish ? `${ITEMS[fish].name}!` : "It slipped off the hook…", fish: hit ? fish : undefined });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { if (phase.k === "reel") { e.preventDefault(); reel(); } } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <Panel title="Fishing Dock" icon="rod" onClose={() => { if (phase.k === "reel" || phase.k === "wait") act({ type: "fishReel", hit: false }); onClose(); }}>
      <p className="muted">Bait: <b>{s.inv.bait}</b> · Energy per cast: {FISH_ENERGY} · Rod +{s.gear.rod}</p>
      <div className={`fishing ${phase.k}`}>
        {phase.k === "idle" && <p className="lead">Cast your line into the reef.</p>}
        {phase.k === "wait" && <p className="lead bob">… waiting for a bite …</p>}
        {phase.k === "reel" && (
          <>
            <p className="lead">BITE! Tap REEL when the hook is in the green!</p>
            <div className="reel-bar">
              <div className="reel-zone" style={{ left: `${phase.zoneStart * 100}%`, width: `${phase.zone * 100}%` }} />
              <div className="reel-marker" style={{ left: `${marker * 100}%` }} />
            </div>
            <button type="button" className="btn hot big" onClick={reel}>REEL!</button>
          </>
        )}
        {phase.k === "done" && <p className="lead catch">{phase.fish && <Icon id={phase.fish} size={48} />}{phase.text}</p>}
      </div>
      {(phase.k === "idle" || phase.k === "done") && (
        <div className="btn-row">
          <button type="button" className="btn primary big" disabled={s.inv.bait < 1} onClick={cast}>Cast</button>
          <button type="button" className="btn" onClick={() => act({ type: "buy", item: "bait", qty: 5 })}>Buy 5 bait · 30 SHELL</button>
        </div>
      )}
      <table className="odds-table">
        <thead><tr><th>Fish</th><th>Base chance</th><th>Sells</th></tr></thead>
        <tbody>{FISH_TABLE.map(f => <tr key={f.id}><td><Icon id={f.id} size={18} /> {ITEMS[f.id].name}</td><td>{f.weight}%</td><td>{ITEMS[f.id].sell} SHELL</td></tr>)}</tbody>
      </table>
      <p className="fineprint">Rod level and luck shift odds toward rare fish. Golden Tide event doubles rare odds.</p>
    </Panel>
  );
}

// ---------------- Tide Mines ----------------
export function MinesPanel({ onClose }: { onClose: () => void }) {
  const { s, act, brag } = useG();
  const [currency, setCurrency] = useState<"shell" | "rf">("shell");
  const [stake, setStake] = useState(50);
  const [traps, setTraps] = useState(3);
  const [boom, setBoom] = useState<number[] | null>(null);
  const run = s.run?.kind === "mines" ? (s.run as MinesRun) : null;
  const safe = run ? run.revealed.length : 0;
  const mult = run ? minesMultiplier(run.trapCount, safe) : 1;
  const nextMult = run ? minesMultiplier(run.trapCount, safe + 1) : minesMultiplier(traps, 1);
  const start = () => { setBoom(null); act({ type: "minesStart", stake, currency, traps }); };
  const reveal = (i: number) => {
    const r = act({ type: "minesReveal", index: i });
    if (r.data?.trap) setBoom(r.data.traps as number[]);
    else if (r.data?.win && (r.data.mult as number) >= 10) brag(`cleared Tide Mines at ${(r.data.mult as number).toFixed(2)}x `);
  };
  const cashout = () => {
    const r = act({ type: "minesCashout" });
    if (r.ok) { setBoom(r.data!.traps as number[]); if ((r.data!.mult as number) >= 10) brag(`cashed out Tide Mines at ${(r.data!.mult as number).toFixed(2)}x `); }
  };
  const loot = run ? Object.entries(run.loot).filter(([, v]) => v) : [];
  return (
    <Panel title="Tide Mines" icon="pick" onClose={onClose}>
      {!run && (
        <>
          <StakePicker currency={currency} setCurrency={setCurrency} stake={stake} setStake={setStake} s={s} minShell={MINES.minShell} minRf={MINES.minRf} />
          <div className="seg">{MINES.trapOptions.map(t => <button key={t} type="button" className={traps === t ? "on" : ""} onClick={() => setTraps(t)}><Icon id="skull" size={16} /> {t}</button>)}</div>
          <p className="muted">First safe tile pays {minesMultiplier(traps, 1).toFixed(2)}x · 5 tiles {minesMultiplier(traps, Math.min(5, 25 - traps)).toFixed(2)}x · Energy {MINES.energy}</p>
          <button type="button" className="btn primary big" onClick={start}>Start digging</button>
        </>
      )}
      {run && (
        <div className="mines-hud">
          <span>Current <b>{mult.toFixed(2)}x</b> → {n0(Math.floor(run.stake * mult))} {run.currency === "rf" ? "cRF" : "SHELL"}</span>
          <span>Next tile <b>{nextMult.toFixed(2)}x</b></span>
          <span className="loot">Loot {loot.length ? loot.map(([k, v]) => <span key={k}><Icon id={k} size={18} />{v}</span>) : "none yet"}</span>
        </div>
      )}
      <div className="mines-grid" aria-label="Mine field">
        {Array.from({ length: MINES.size }, (_, i) => {
          const open = run?.revealed.includes(i);
          const isTrap = boom?.includes(i);
          const hint = run?.safeHint === i && !open;
          return (
            <button key={i} type="button" className={`tile ${open ? "open" : ""} ${isTrap ? "trap" : ""} ${hint ? "hint" : ""}`} disabled={!run || open}
              onClick={() => reveal(i)} aria-label={open ? "Safe tile" : `Tile ${i + 1}`}>
              {open ? <Icon id="glass" size={26} /> : isTrap ? <Icon id="skull" size={26} /> : hint ? <Icon id="spark" size={22} /> : null}
            </button>
          );
        })}
      </div>
      {run && <button type="button" className="btn hot big" disabled={safe === 0} onClick={cashout}>Cash out {mult.toFixed(2)}x</button>}
      <FlipOffer />
      <p className="fineprint"><SimTag /> Fair odds minus a {MINES.edge * 100}% edge: multiplier = 0.97 × C(25,k)/C(25−traps,k). A trap loses the stake and dug loot. RF lost flows to the Season Pool.</p>
    </Panel>
  );
}

// ---------------- Abyss Dive (crash) ----------------
export function AbyssPanel({ onClose }: { onClose: () => void }) {
  const { s, act, reducedMotion, brag } = useG();
  const [currency, setCurrency] = useState<"shell" | "rf">("shell");
  const [stake, setStake] = useState(50);
  const [auto, setAuto] = useState(0);
  const [mult, setMult] = useState(1);
  const [last, setLast] = useState<{ crashed: boolean; at: number } | null>(null);
  const run = s.run?.kind === "dive" ? (s.run as DiveRun) : null;
  const runRef = useRef(run); runRef.current = run;
  const done = useRef(false);

  useEffect(() => {
    if (!run) return;
    done.current = false;
    let raf = 0;
    const loop = () => {
      const r = runRef.current;
      if (!r || done.current) return;
      const m = diveMultiplierAt(Date.now() - r.startedAt);
      setMult(m);
      if (m >= r.crashAt) {
        done.current = true;
        act({ type: "diveCrash" });
        setLast({ crashed: true, at: r.crashAt });
        return;
      }
      if (auto >= 1.01 && m >= auto) {
        done.current = true;
        const res = act({ type: "diveCashout" });
        if (res.ok) setLast({ crashed: !!res.data?.crashed, at: (res.data?.mult as number) ?? m });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [run?.startedAt]);

  const start = () => { setLast(null); setMult(1); act({ type: "diveStart", stake, currency }); };
  const cashout = () => {
    if (done.current) return;
    done.current = true;
    const r = act({ type: "diveCashout" });
    if (r.ok) {
      const m = (r.data?.mult as number) ?? mult;
      setLast({ crashed: !!r.data?.crashed, at: r.data?.crashed ? (r.data.crashAt as number) : m });
      if (!r.data?.crashed && m >= 10) brag(`dove to ${m.toFixed(2)}x in the Abyss `);
    }
  };
  const depth = Math.min(1, Math.log(mult) / Math.log(20));
  const edge = diveEdge(s) * 100;
  return (
    <Panel title="Abyss Dive" icon="spark" onClose={onClose}>
      <div className={`abyss ${run ? "diving" : ""} ${last?.crashed ? "crashed" : ""}`} style={{ ["--depth" as string]: depth }}>
        <div className="abyss-mult">{run ? `${mult.toFixed(2)}x` : last ? (last.crashed ? `${last.at.toFixed(2)}x` : `${last.at.toFixed(2)}x`) : "1.00x"}</div>
        <div className="diver" style={{ top: `${10 + depth * 70}%`, transition: reducedMotion ? "none" : undefined }}><Icon id="sub" size={48} /></div>
        {run && <div className="abyss-stake">{run.currency === "rf" ? `${rf(run.stake)} RF` : `${n0(run.stake)} SHELL`} → {run.currency === "rf" ? `${rf(Math.floor(run.stake * mult))} RF` : `${n0(Math.floor(run.stake * mult))} SHELL`}</div>}
      </div>
      {run ? (
        <button type="button" className="btn hot big" onClick={cashout}>CASH OUT {mult.toFixed(2)}x</button>
      ) : (
        <>
          <StakePicker currency={currency} setCurrency={setCurrency} stake={stake} setStake={setStake} s={s} minShell={DIVE.minShell} minRf={DIVE.minRf} />
          <label className="stake-input"><span>Auto cash-out</span><input type="number" min={0} step={0.1} value={auto || ""} placeholder="off" onChange={e => setAuto(Number(e.target.value))} /><span>x</span></label>
          <button type="button" className="btn primary big" onClick={start}>DIVE ({DIVE.energy} energy)</button>
        </>
      )}
      <FlipOffer />
      <p className="fineprint"><SimTag /> Crash point = (1 − edge)/U, edge {edge.toFixed(1)}% (Coral Blade lowers it to 2%). Every full 1x of depth you survive adds a loot roll (coral, sea glass, pearl), and Bone Divers find more. RF lost flows to the Season Pool.</p>
    </Panel>
  );
}
