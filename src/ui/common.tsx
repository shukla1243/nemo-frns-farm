import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import type { GameState } from "../engine/types";
import type { Action, Result } from "../engine/actions";
import type { Cost, ItemId } from "../engine/config";
import { Icon } from "./Icon";
import { animate } from "animejs";
import type { NetState } from "../net/useNet";
import type { Identity } from "../identity/Gate";

export const rf = (c: number) => (c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const n0 = (v: number) => Math.floor(v).toLocaleString();
export const mmss = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (d) return `${d}d ${h}h`;
  return h ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, "0")}`;
};

export type PanelId =
  | "home" | "farm" | "market" | "pool" | "dock" | "shrine" | "wheel" | "board" | "mines" | "forge" | "harbor" | "abyss" | "reef"
  | "bag" | "settings" | "help" | "story" | "map" | "pier" | "play" | "inbox" | "report" | `unlock:${string}` | `npc:${string}`;

export type Ctx = {
  s: GameState;
  now: number;
  act: (a: Action) => Result;
  open: (p: PanelId | null) => void;
  net: NetState;
  identity: Identity;
  brag: (text: string) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  cloud: { status: "off" | "on" | "syncing" | "error"; message: string; enable: () => Promise<void>; pull: () => Promise<void> };
};
export const GameContext = createContext<Ctx | null>(null);
export const useG = () => useContext(GameContext)!;

export function CostList({ cost, s }: { cost: Cost; s: GameState }) {
  const parts: ReactNode[] = [];
  if (cost.rf) parts.push(<span key="rf" className={`cost ${s.rf < cost.rf ? "short" : ""}`}><Icon id="rf" size={16} /> {rf(cost.rf)} RF</span>);
  if (cost.shell) parts.push(<span key="sh" className={`cost ${s.shell < cost.shell ? "short" : ""}`}><Icon id="shell" size={16} /> {n0(cost.shell)} SHELL</span>);
  for (const [id, n] of Object.entries(cost.items ?? {})) if (n) parts.push(<span key={id} className={`cost ${s.inv[id as ItemId] < n ? "short" : ""}`}><Icon id={id} size={16} /> {n}<small> / {s.inv[id as ItemId]}</small></span>);
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

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={value === id} className={value === id ? "on" : ""} onClick={() => onChange(id)}>{label}</button>)}
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

/** Stake input with quick buttons. */
export function StakePicker({ currency, setCurrency, stake, setStake, s, minShell, minRf, disabled }: {
  currency: "shell" | "rf"; setCurrency: (c: "shell" | "rf") => void; stake: number; setStake: (n: number) => void; s: GameState; minShell: number; minRf: number; disabled?: boolean;
}) {
  const bal = currency === "shell" ? s.shell : s.rf;
  const min = currency === "shell" ? minShell : minRf;
  const shown = currency === "shell" ? stake : stake / 100;
  const set = (v: number) => setStake(Math.max(0, Math.floor(v)));
  return (
    <div className="stake">
      <div className="seg">
        <button type="button" className={currency === "shell" ? "on" : ""} disabled={disabled} onClick={() => { setCurrency("shell"); setStake(Math.max(minShell, Math.min(s.shell, 50))); }}>SHELL</button>
        <button type="button" className={currency === "rf" ? "on" : ""} disabled={disabled} onClick={() => { setCurrency("rf"); setStake(Math.max(minRf, Math.min(s.rf, 100))); }}>RF</button>
      </div>
      <label className="stake-input">
        <span>Stake</span>
        <input type="number" inputMode="decimal" min={currency === "shell" ? min : min / 100} step={currency === "shell" ? 1 : 0.1} value={shown} disabled={disabled}
          onChange={e => set(currency === "shell" ? Number(e.target.value) : Number(e.target.value) * 100)} />
        <span>{currency === "shell" ? "SHELL" : "RF"}</span>
      </label>
      <div className="quick">
        <button type="button" disabled={disabled} onClick={() => set(Math.max(min, stake / 2))}>½</button>
        <button type="button" disabled={disabled} onClick={() => set(Math.min(bal, stake * 2))}>2×</button>
        <button type="button" disabled={disabled} onClick={() => set(min)}>Min</button>
        <button type="button" disabled={disabled} onClick={() => set(bal)}>Max</button>
      </div>
      <small className="muted">Balance: {currency === "shell" ? `${n0(s.shell)} SHELL` : `${rf(s.rf)} RF`}</small>
    </div>
  );
}
