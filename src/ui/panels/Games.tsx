import { useEffect, useRef, useState } from "react";
import { DIVE, FISH_ENERGY, FISH_REEL, FISH_TABLE, FLIP, ITEMS, MINES, diveMultiplierAt, type FishId } from "../../engine/config";
import { markerAt } from "../../engine/fishing";
import { diveEdge, minesMultiplier, minesRunMultiplier } from "../../engine/actions";
import type { DiveRun, MinesRun } from "../../engine/types";
import { Panel, SimTag, StakePicker, n0, useG } from "../common";
import { Icon } from "../Icon";

function FlipOffer() {
  const { s, act } = useG();
  const w = s.lastWin;
  if (!w || w.amount <= 0) return null;
  const amt = `${n0(w.amount)} SHELL`;
  const chance = (FLIP.winChance + (s.trait === "chaos" ? 0.02 : 0)) * 100;
  return (
    <div className="flip">
      <p><b>Double or nothing?</b> Risk your {amt} win · {chance.toFixed(0)}% to double · flip {w.flips + 1}/{FLIP.maxFlips}</p>
      <div className="btn-row">
        <button type="button" className="btn hot" disabled={w.flips >= FLIP.maxFlips} onClick={() => act({ type: "flip" })}>FLIP for {n0(w.amount * 2)}</button>
        <button type="button" className="btn" onClick={() => act({ type: "keepWin" })}>Bank it</button>
      </div>
    </div>
  );
}

// ---------------- Fishing ----------------
type Hook = { zone: number; zoneStart: number; speed: number; biteAt: number };
type FishPhase = { k: "idle" } | { k: "wait" | "reel"; hook: Hook } | { k: "busy" } | { k: "done"; text: string; fish?: FishId; xp?: number };

/**
 * The server rolls the bite time, the green zone and the hook speed at the cast, and judges the reel against server
 * time, so this panel only draws what the server already decided.
 */
export function DockPanel({ onClose }: { onClose: () => void }) {
  const { s, act, clock, paused } = useG();
  const [result, setResult] = useState<FishPhase | null>(null);
  const [marker, setMarker] = useState(0);
  const [, setFrame] = useState(0);
  const hook = s.run?.kind === "fish" ? (s.run as unknown as Hook) : null;
  const phase: FishPhase = result ?? (hook ? { k: clock() < hook.biteAt ? "wait" : "reel", hook } : { k: "idle" });
  const live = phase.k === "wait" || phase.k === "reel";

  // Draw the hook from server time. Frozen while the host pauses: nothing is drawn and nothing is sent.
  useEffect(() => {
    if (!hook || result || paused) return;
    let raf = 0;
    const loop = () => {
      const t = clock();
      if (t >= hook.biteAt) setMarker(markerAt(hook, t));
      setFrame(f => f + 1);
      if (t > hook.biteAt + FISH_REEL.windowMs) { void reel(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  const cast = async () => {
    setResult({ k: "busy" });
    const r = await act({ type: "fishCast" });
    setResult(r.ok ? null : { k: "idle" });
  };
  const reel = async () => {
    if (!hook || result || paused) return;
    setResult({ k: "busy" });
    const r = await act({ type: "fishReel" });
    const fish = r.data?.caught ? (r.data.fish as FishId) : undefined;
    setResult({ k: "done", text: fish ? `Caught a ${ITEMS[fish].name}!` : (r.data?.text as string | undefined) ?? "It slipped off the hook...", fish, xp: r.data?.xp as number | undefined });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.key === " " || e.key === "Enter") && phase.k === "reel") { e.preventDefault(); void reel(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <Panel title="Fishing Dock" icon="rod" onClose={() => { if (live) void act({ type: "fishReel" }); onClose(); }}>
      <p className="muted">Bait: <b>{s.inv.bait}</b> · Energy per cast: {FISH_ENERGY} · Rod +{s.gear.rod}</p>
      <div className={`fishing ${phase.k}`}>
        {phase.k === "idle" && <p className="lead">Cast your line into the reef.</p>}
        {(phase.k === "wait" || phase.k === "busy") && <p className="lead bob">... waiting for a bite ...</p>}
        {phase.k === "reel" && (
          <>
            <p className="lead">BITE! Tap REEL when the hook is in the green!</p>
            <div className="reel-bar">
              <div className="reel-zone" style={{ left: `${phase.hook.zoneStart * 100}%`, width: `${phase.hook.zone * 100}%` }} />
              <div className="reel-marker" style={{ left: `${marker * 100}%` }} />
            </div>
            <button type="button" className="btn hot big" onClick={reel}>REEL!</button>
          </>
        )}
        {phase.k === "done" && (
          <div className="lead catch" role="status">
            {phase.fish && <Icon id={phase.fish} size={56} />}
            <b>{phase.text}</b>
            {phase.fish
              ? <small>+{phase.xp ?? 0} XP · sells for {ITEMS[phase.fish].sell} SHELL · you have {s.inv[phase.fish]}</small>
              : <small>{s.inv.bait > 0 ? "Cast again, the green zone is waiting." : "Out of bait. Buy more below."}</small>}
          </div>
        )}
      </div>
      {(phase.k === "idle" || phase.k === "done") && !hook && (
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
  const { s, act } = useG();
  const [stake, setStake] = useState(50);
  const [traps, setTraps] = useState(3);
  const [boom, setBoom] = useState<number[] | null>(null);
  const run = s.run?.kind === "mines" ? (s.run as MinesRun) : null;
  const safe = run ? run.revealed.length : 0;
  const mult = run ? minesRunMultiplier(run) : 1;
  const nextMult = run ? minesRunMultiplier(run, 1) : minesMultiplier(traps, 1);
  const start = () => { setBoom(null); void act({ type: "minesStart", stake, traps }); };
  const reveal = async (i: number) => {
    const r = await act({ type: "minesReveal", index: i });
    if (r.data?.trap) setBoom(r.data.traps as number[]);
  };
  const cashout = async () => {
    const r = await act({ type: "minesCashout" });
    if (r.ok) setBoom(r.data!.traps as number[]);
  };
  const loot = run ? Object.entries(run.loot).filter(([, v]) => v) : [];
  return (
    <Panel title="Tide Mines" icon="pick" onClose={onClose}>
      {!run && (
        <>
          <StakePicker stake={stake} setStake={setStake} s={s} min={MINES.minShell} />
          <div className="seg">{MINES.trapOptions.map(t => <button key={t} type="button" className={traps === t ? "on" : ""} onClick={() => setTraps(t)}><Icon id="skull" size={16} /> {t}</button>)}</div>
          <p className="muted">First safe tile pays {minesMultiplier(traps, 1).toFixed(2)}x · 5 tiles {minesMultiplier(traps, Math.min(5, 25 - traps)).toFixed(2)}x · Energy {MINES.energy}</p>
          <button type="button" className="btn primary big" onClick={start}>Start digging</button>
        </>
      )}
      {run && (
        <div className="mines-hud">
          <span>Current <b>{mult.toFixed(2)}x</b> = {n0(Math.floor(run.stake * mult))} SHELL</span>
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
      <p className="fineprint"><SimTag /> Fair odds minus a {MINES.edge * 100}% edge: multiplier = 0.97 × C(25,k)/C(25−traps,k). A trap loses the stake and dug loot.</p>
    </Panel>
  );
}

// ---------------- Abyss Dive (crash) ----------------
export function AbyssPanel({ onClose }: { onClose: () => void }) {
  const { s, act, clock, paused, reducedMotion } = useG();
  const [stake, setStake] = useState(50);
  const [auto, setAuto] = useState(0);
  const [mult, setMult] = useState(1);
  const [last, setLast] = useState<{ crashed: boolean; at: number } | null>(null);
  const run = s.run?.kind === "dive" ? (s.run as DiveRun) : null;
  const runRef = useRef(run); runRef.current = run;
  const done = useRef(false);

  // The depth meter and auto cash-out run on server time; while the host pauses they freeze and send nothing.
  useEffect(() => {
    if (!run || paused) return;
    done.current = false;
    let raf = 0;
    const loop = () => {
      const r = runRef.current;
      if (!r || done.current) return;
      const m = diveMultiplierAt(clock() - r.startedAt);
      setMult(m);
      if (auto >= 1.01 && m >= auto) {
        done.current = true;
        void act({ type: "diveCashout" }).then(res => {
          if (res.ok) setLast({ crashed: !!res.data?.crashed, at: res.data?.crashed ? (res.data.crashAt as number) : ((res.data?.mult as number) ?? m) });
        });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [run?.startedAt, paused]);

  const start = () => { setLast(null); setMult(1); void act({ type: "diveStart", stake }); };
  const cashout = async () => {
    if (done.current || paused) return;
    done.current = true;
    const r = await act({ type: "diveCashout" });
    if (r.ok) {
      const m = (r.data?.mult as number) ?? mult;
      setLast({ crashed: !!r.data?.crashed, at: r.data?.crashed ? (r.data.crashAt as number) : m });
    }
  };
  const depth = Math.min(1, Math.log(mult) / Math.log(20));
  const edge = diveEdge(s) * 100;
  return (
    <Panel title="Abyss Dive" icon="spark" onClose={onClose}>
      <div className={`abyss ${run ? "diving" : ""} ${last?.crashed ? "crashed" : ""}`} style={{ ["--depth" as string]: depth }}>
        <div className="abyss-mult">{run ? `${mult.toFixed(2)}x` : last ? (last.crashed ? `${last.at.toFixed(2)}x` : `${last.at.toFixed(2)}x`) : "1.00x"}</div>
        <div className="diver" style={{ top: `${10 + depth * 70}%`, transition: reducedMotion ? "none" : undefined }}><Icon id="sub" size={48} /></div>
        {run && <div className="abyss-stake">{n0(run.stake)} SHELL to {n0(Math.floor(run.stake * mult))} SHELL</div>}
      </div>
      {run ? (
        <button type="button" className="btn hot big" onClick={cashout}>CASH OUT {mult.toFixed(2)}x</button>
      ) : (
        <>
          <StakePicker stake={stake} setStake={setStake} s={s} min={DIVE.minShell} />
          <label className="stake-input"><span>Auto cash-out</span><input type="number" min={0} step={0.1} value={auto || ""} placeholder="off" onChange={e => setAuto(Number(e.target.value))} /><span>x</span></label>
          <button type="button" className="btn primary big" onClick={start}>DIVE ({DIVE.energy} energy)</button>
        </>
      )}
      <FlipOffer />
      <p className="fineprint"><SimTag /> The abyss decides when you cash out: at multiplier m you survive with chance (1 − edge)/m, edge {edge.toFixed(1)}% (Coral Blade lowers it to 2%). Every full 1x of depth you survive adds a loot roll (coral, sea glass, pearl) that lands with chance stake / {n0(DIVE.lootStake)}, and Bone Divers find more.</p>
    </Panel>
  );
}
