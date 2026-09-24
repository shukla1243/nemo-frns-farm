import { useEffect, useRef, useState, type PointerEvent } from "react";
import { CRAB } from "../../engine/config";
import { icon } from "../../art/icons";
import { Painter, cached, col, prng, type Sprite } from "../../art/pixel";
import { sound } from "../../game/sound";
import { Bar, Panel, SimTag, n0, useG } from "../common";
import { Icon } from "../Icon";

// ---------------- Crab Dash (skill arcade) ----------------
// Presentation only: the engine clamps the score and pays SHELL, never RF.
const COLS = 4, ROWS = 3, CELL = 64, PX = 2;
const W = COLS * CELL, H = ROWS * CELL;
const GOLD_CHANCE = 0.08, TRAP_CHANCE = 0.14;
const MAX_MULT = 3, HITS_PER_STEP = 5;
const KEYS = ["1", "2", "3", "4", "q", "w", "e", "r", "a", "s", "d", "f"];

type Kind = "crab" | "gold" | "trap";
type Hole = { kind: Kind; born: number; until: number } | null;
type Floater = { x: number; y: number; text: string; color: string; born: number };
type Round = {
  endAt: number; nextPop: number; holes: Hole[]; score: number; mult: number; streak: number;
  floaters: Floater[]; shakeUntil: number; over: boolean;
};
type Phase = { k: "idle" } | { k: "play" } | { k: "done"; score: number; shell: number; best: boolean; text: string };
type Hud = { left: number; score: number; mult: number; streak: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const spriteOf = (k: Kind) => icon(k === "gold" ? "crabGold" : k === "trap" ? "clamTrap" : "crab");
const hole = () => cached("crabHole", () => new Painter(26, 9).ellipse(13, 4, 12, 4, "S").ellipse(13, 4, 10, 3, "K").ellipse(13, 5, 8, 2, "k").done());
const holePos = (i: number) => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + 46 });
const SPECKS = (() => { const r = prng(11); return Array.from({ length: 70 }, () => ({ x: Math.floor(r() * W / PX) * PX, y: Math.floor(r() * H / PX) * PX, c: r() < 0.7 ? "S" : "Y" })); })();

function blit(ctx: CanvasRenderingContext2D, spr: Sprite, x: number, y: number) {
  ctx.drawImage(spr, Math.round(x), Math.round(y), spr.width * PX, spr.height * PX);
}

/** Advance the round: expire holes, pop new crabs faster as time runs out. */
function step(g: Round, t: number, now: number) {
  for (let i = 0; i < g.holes.length; i++) if (g.holes[i] && t >= g.holes[i]!.until) g.holes[i] = null;
  g.floaters = g.floaters.filter(f => t - f.born < 700);
  if (t < g.nextPop) return;
  const p = Math.min(1, 1 - (g.endAt - now) / CRAB.roundMs);
  const free = g.holes.map((h, i) => (h ? -1 : i)).filter(i => i >= 0);
  if (free.length) {
    const i = free[Math.floor(Math.random() * free.length)];
    const roll = Math.random();
    const kind: Kind = roll < GOLD_CHANCE ? "gold" : roll < GOLD_CHANCE + TRAP_CHANCE ? "trap" : "crab";
    g.holes[i] = { kind, born: t, until: t + lerp(1300, 620, p) * (kind === "gold" ? 0.8 : 1) };
  }
  g.nextPop = t + lerp(850, 340, p);
}

function draw(ctx: CanvasRenderingContext2D, g: Round | null, t: number, rm: boolean) {
  ctx.save();
  if (g && !rm && t < g.shakeUntil) ctx.translate(Math.round((Math.random() - 0.5) * 6), Math.round((Math.random() - 0.5) * 4));
  ctx.fillStyle = col("s"); ctx.fillRect(-4, -4, W + 8, H + 8);
  for (const s of SPECKS) { ctx.fillStyle = col(s.c); ctx.fillRect(s.x, s.y, PX, PX); }
  for (let i = 0; i < COLS * ROWS; i++) {
    const { x, y } = holePos(i);
    blit(ctx, hole(), x - 26, y - 9);
    const h = g?.holes[i];
    if (!h) continue;
    // Rise out of the hole and duck back in; reduced motion pops instantly.
    const rise = rm ? 1 : Math.max(0, Math.min(1, (t - h.born) / 110, (h.until - t) / 110));
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 40, y - 60, 80, 62); ctx.clip();
    blit(ctx, spriteOf(h.kind), x - 18, y - 30 + (1 - rise) * 26);
    ctx.restore();
  }
  if (g) {
    ctx.font = "bold 13px Nunito, system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const f of g.floaters) {
      const a = (t - f.born) / 700;
      ctx.globalAlpha = 1 - a;
      ctx.fillStyle = col("k"); ctx.fillText(f.text, f.x + 1, f.y - (rm ? 0 : a * 18) + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - (rm ? 0 : a * 18));
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function CrabPanel({ onClose }: { onClose: () => void }) {
  const { s, act, reducedMotion } = useG();
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [hud, setHud] = useState<Hud>({ left: CRAB.roundMs, score: 0, mult: 1, streak: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roundRef = useRef<Round | null>(null);
  // Latest callbacks and flags live in refs so the mount-only effects never re-run.
  const actRef = useRef(act); actRef.current = act;
  const rmRef = useRef(reducedMotion); rmRef.current = reducedMotion;
  const hudRef = useRef(hud);

  const finish = (g: Round) => {
    g.over = true;
    const r = actRef.current({ type: "crabFinish", score: g.score });
    if (r.ok) setPhase({ k: "done", score: r.data!.score as number, shell: r.data!.shell as number, best: !!r.data!.best, text: "" });
    else setPhase({ k: "done", score: g.score, shell: 0, best: false, text: r.events[r.events.length - 1]?.text ?? "Round not counted." });
  };
  const finishRef = useRef(finish); finishRef.current = finish;

  const tap = (i: number) => {
    const g = roundRef.current;
    if (!g || g.over || i < 0 || i >= COLS * ROWS) return;
    const t = performance.now();
    const h = g.holes[i];
    const { x, y } = holePos(i);
    if (h && h.kind !== "trap") {
      const pts = (h.kind === "gold" ? 3 : 1) * g.mult;
      g.score += pts;
      g.streak++;
      if (g.streak >= HITS_PER_STEP && g.mult < MAX_MULT) { g.mult++; g.streak = 0; }
      g.holes[i] = null;
      g.floaters.push({ x, y: y - 24, text: `+${pts}`, color: col(h.kind === "gold" ? "u" : "e"), born: t });
      sound.play(h.kind === "gold" ? "reveal-rare" : "select");
      return;
    }
    if (h) { g.holes[i] = null; g.shakeUntil = t + 260; sound.play("impact"); }
    g.mult = Math.max(1, g.mult - 1);
    g.streak = 0;
    g.floaters.push({ x, y: y - 24, text: h ? "Snap!" : "Miss", color: col("R"), born: t });
  };
  const tapRef = useRef(tap); tapRef.current = tap;

  useEffect(() => {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    const frame = () => {
      const t = performance.now(), now = Date.now();
      const g = roundRef.current;
      if (g && !g.over) {
        if (now >= g.endAt) finishRef.current(g);
        else step(g, t, now);
        const next: Hud = { left: Math.max(0, g.endAt - now), score: g.score, mult: g.mult, streak: g.streak };
        const cur = hudRef.current;
        if (Math.ceil(next.left / 1000) !== Math.ceil(cur.left / 1000) || next.score !== cur.score || next.mult !== cur.mult || next.streak !== cur.streak) {
          hudRef.current = next; setHud(next);
        }
      }
      draw(ctx, g, t, rmRef.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const key = (e: KeyboardEvent) => {
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && roundRef.current && !roundRef.current.over) { e.preventDefault(); tapRef.current(i); }
    };
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key);
      // Leaving mid-round forfeits it so no other game stays blocked.
      if (roundRef.current && !roundRef.current.over) { roundRef.current.over = true; actRef.current({ type: "crabQuit" }); }
    };
  }, []);

  const start = () => {
    const r = act({ type: "crabStart" });
    if (!r.ok) return;
    const startedAt = r.data!.startedAt as number;
    roundRef.current = {
      endAt: startedAt + CRAB.roundMs, nextPop: performance.now() + 400, holes: Array.from({ length: COLS * ROWS }, () => null),
      score: 0, mult: 1, streak: 0, floaters: [], shakeUntil: 0, over: false,
    };
    const fresh: Hud = { left: CRAB.roundMs, score: 0, mult: 1, streak: 0 };
    hudRef.current = fresh; setHud(fresh);
    setPhase({ k: "play" });
  };
  const onPointer = (e: PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const c = Math.floor(((e.clientX - box.left) / box.width) * COLS), r = Math.floor(((e.clientY - box.top) / box.height) * ROWS);
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) tap(r * COLS + c);
  };

  const playing = phase.k === "play";
  return (
    <Panel title="Crab Beach" icon="crab" onClose={onClose}>
      <p className="muted">Crab Dash · {CRAB.roundMs / 1000} second rounds · Energy per round: {CRAB.energy} · Best: <b>{n0(s.stats.crabBest)}</b></p>
      <div className="crab-hud frame-paper" aria-live="off">
        <span>Score <b>{n0(hud.score)}</b></span>
        <span>Combo <b>x{hud.mult}</b>{hud.mult < MAX_MULT && <small> {hud.streak}/{HITS_PER_STEP}</small>}</span>
        <span>Time <b>{Math.ceil(hud.left / 1000)}s</b></span>
      </div>
      <Bar value={hud.left} max={CRAB.roundMs} color="#f5c542" label="Time left" />
      <canvas ref={canvasRef} className={`crab-field ${playing ? "live" : ""}`} width={W} height={H} onPointerDown={onPointer}
        aria-label="Crab Dash field. Tap crabs as they pop out. Keys 1 to 4, Q to R and A to F match the holes." />
      {phase.k === "idle" && <p className="lead">Tap crabs as they pop out of the sand. Leave the clams alone.</p>}
      {phase.k === "done" && (
        <p className="lead catch">
          <Icon id="crab" size={40} />
          {phase.text || `${phase.score} points, +${n0(phase.shell)} SHELL.${phase.best ? " New personal best!" : ""}`}
        </p>
      )}
      {!playing && (
        <div className="btn-row">
          <button type="button" className="btn primary big" onClick={start}>{phase.k === "done" ? "Play again" : "Start round"} · {CRAB.energy} energy</button>
        </div>
      )}
      <table className="odds-table">
        <thead><tr><th>Target</th><th>Points</th></tr></thead>
        <tbody>
          <tr><td><Icon id="crab" size={18} /> Crab</td><td>+1 × combo</td></tr>
          <tr><td><Icon id="crabGold" size={18} /> Golden crab</td><td>+3 × combo</td></tr>
          <tr><td><Icon id="clamTrap" size={18} /> Snap clam or empty sand</td><td>Combo drops one step</td></tr>
        </tbody>
      </table>
      <p className="fineprint"><SimTag /> Pure skill, no stake. Every {HITS_PER_STEP} catches in a row raise the combo, up to x{MAX_MULT}. Each point pays {CRAB.shellPerPoint} SHELL (score capped at {CRAB.maxScore}). {CRAB.baitAt}+ points adds 1 bait, {CRAB.pearlAt}+ adds 1 pearl. Crab Dash never pays RF.</p>
    </Panel>
  );
}
