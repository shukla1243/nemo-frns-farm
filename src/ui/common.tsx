import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { GameEvent, GameState } from "../engine/types";
import type { Action } from "../engine/actions";
import type { Prefs } from "../../server/index";
import type { Cost, ItemId } from "../engine/config";
import { Icon } from "./Icon";
import { animate } from "animejs";

export const n0 = (v: number) => Math.floor(v).toLocaleString();
export const mmss = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (d) return `${d}d ${h}h`;
  return h ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, "0")}`;
};

/** The system reduced motion setting, used until the player chooses in Settings. */
export const systemReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type PanelId =
  | "home" | "farm" | "market" | "pool" | "dock" | "crabs" | "shrine" | "wheel" | "board" | "mines" | "forge" | "harbor" | "abyss" | "reef"
  | "bag" | "settings" | "help" | "story" | "map" | "pier" | "play" | "inbox" | "report" | `unlock:${string}` | `npc:${string}`;

/** The answer to one action: `data` as the engine returned it, and the events it raised. */
export type ActOutcome = { ok: boolean; data: Record<string, unknown> | undefined; events: readonly GameEvent[] };
export type PrefsPatch = Partial<Pick<Prefs, "muted" | "music" | "reducedMotion">> & { inboxSeen?: true };

export type Ctx = {
  /** The island projected to the server's current time. */
  s: GameState;
  /** Server time at the last projection (updated every second). */
  now: number;
  /** Server time now, for animations that compare with server timestamps. */
  clock: () => number;
  act: (a: Action) => Promise<ActOutcome>;
  open: (p: PanelId | null) => void;
  /** True while the host pauses the game. */
  paused: boolean;
  prefs: Prefs;
  setPrefs: (patch: PrefsPatch) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
};
export const GameContext = createContext<Ctx | null>(null);
export const useG = () => useContext(GameContext)!;

export function CostList({ cost, s }: { cost: Cost; s: GameState }) {
  const parts: ReactNode[] = [];
  if (cost.shell) parts.push(<span key="sh" className={`cost ${s.shell < cost.shell ? "short" : ""}`}><Icon id="shell" size={16} /> {n0(cost.shell)} SHELL</span>);
  for (const [id, n] of Object.entries(cost.items ?? {})) if (n) parts.push(<span key={id} className={`cost ${s.inv[id as ItemId] < n ? "short" : ""}`} title={`Have ${s.inv[id as ItemId]}, need ${n}`}><Icon id={id} size={16} /> {s.inv[id as ItemId]}<small> / {n}</small></span>);
  return <span className="costs">{parts.length ? parts : <span className="cost">Free</span>}</span>;
}

export function Panel({ title, icon, onClose, children, wide }: { title: string; icon?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // The latest onClose lives in a ref so the mount-only effect (focus + open animation) never re-runs.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const anim = ref.current && document.documentElement.dataset.rm !== "1"
      ? animate(ref.current, { opacity: [0, 1], translateY: [18, 0], scale: [0.96, 1], duration: 260, ease: "outBack" })
      : null;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", esc);
    return () => { anim?.revert(); window.removeEventListener("keydown", esc); prev?.focus?.(); };
  }, []);
  return (
    <div className="scrim" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`panel ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <header className="panel-head">
          <h2>{icon && <Icon id={icon} size={28} />}<span>{title}</span></h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}

/** Tab strip. When the tabs overflow (phones), the hidden side fades out and shows an arrow that scrolls it. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 2, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setMore(m => (m.left === left && m.right === right ? m : { left, right }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [tabs.length]);
  useEffect(() => { ref.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [value]);
  const nudge = (dir: 1 | -1) => { const el = ref.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: document.documentElement.dataset.rm === "1" ? "auto" : "smooth" }); };
  return (
    <div className={`tabs-wrap ${more.left ? "more-left" : ""} ${more.right ? "more-right" : ""}`}>
      {more.left && <button type="button" className="tabs-more left" aria-label="Scroll tabs left" onClick={() => nudge(-1)}>‹</button>}
      <div className="tabs" role="tablist" ref={ref}>
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={value === id} className={value === id ? "on" : ""} onClick={() => onChange(id)}>{label}</button>)}
      </div>
      {more.right && <button type="button" className="tabs-more right" aria-label="Scroll tabs right" onClick={() => nudge(1)}>›</button>}
    </div>
  );
}

export function Bar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export const SimTag = () => <span className="sim-tag" title="All balances and rewards are simulated for the vibeathon MVP">SIMULATED</span>;

/** SHELL stake input with quick buttons. */
export function StakePicker({ stake, setStake, s, min, disabled }: {
  stake: number; setStake: (n: number) => void; s: GameState; min: number; disabled?: boolean;
}) {
  const bal = s.shell;
  const set = (v: number) => setStake(Math.max(0, Math.floor(v)));
  return (
    <div className="stake">
      <label className="stake-input">
        <span>Stake</span>
        <input type="number" inputMode="numeric" min={min} step={1} value={stake} disabled={disabled}
          onChange={e => set(Number(e.target.value))} />
        <span>SHELL</span>
      </label>
      <div className="quick">
        <button type="button" disabled={disabled} onClick={() => set(Math.max(min, stake / 2))}>½</button>
        <button type="button" disabled={disabled} onClick={() => set(Math.min(bal, stake * 2))}>2×</button>
        <button type="button" disabled={disabled} onClick={() => set(min)}>Min</button>
        <button type="button" disabled={disabled} onClick={() => set(bal)}>Max</button>
      </div>
      <small className="muted">Balance: {n0(s.shell)} SHELL</small>
    </div>
  );
}
