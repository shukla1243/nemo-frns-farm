import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { Icon } from "./Icon";

export type FxKind = "confetti" | "shake" | "burn" | "levelup" | "jackpot";

const SETS: Record<Exclude<FxKind, "shake">, string[]> = {
  confetti: ["star", "shell", "spark", "clownfish", "pearl", "coin"],
  burn: ["fire", "fire", "spark", "rf"],
  levelup: ["star", "spark", "star", "trophy"],
  jackpot: ["rf", "coin", "rf", "pearl", "star", "chest"],
};

/** Pixel-icon particle bursts + banners, choreographed with anime.js. Skipped under reduced motion. */
export function Fx({ kind, onDone }: { kind: FxKind; onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const set = kind === "shake" ? [] : SETS[kind];
  const n = kind === "jackpot" ? 36 : kind === "burn" ? 14 : kind === "levelup" ? 24 : 22;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const bits = el.querySelectorAll<HTMLElement>(".fx-bit");
    const rise = kind === "burn";
    const anim = animate(bits, {
      translateX: () => (Math.random() - 0.5) * Math.min(window.innerWidth, 700),
      translateY: () => (rise ? -1 : 1) * (window.innerHeight * (0.35 + Math.random() * 0.4)) - (rise ? 0 : 120),
      rotate: () => (Math.random() - 0.5) * 540,
      scale: [{ to: 1.2, duration: 180 }, { to: 0.6, duration: 900 }],
      opacity: [{ to: 1, duration: 60 }, { to: 0, duration: 400, delay: 800 }],
      delay: stagger(18),
      duration: 1300,
      ease: "outQuad",
    });
    const banner = el.querySelector<HTMLElement>(".fx-banner");
    if (banner) animate(banner, { scale: [{ from: 0.2, to: 1.15, duration: 380, ease: "outBack" }, { to: 1, duration: 200 }], opacity: [{ from: 0, to: 1, duration: 200 }, { to: 0, delay: 1500, duration: 400 }] });
    const t = setTimeout(() => doneRef.current(), kind === "jackpot" || kind === "levelup" ? 2600 : 1700);
    return () => { anim.pause(); clearTimeout(t); };
  }, [kind]);
  return (
    <div className={`fx fx-${kind}`} ref={box} aria-hidden>
      {(kind === "levelup" || kind === "jackpot") && <div className="fx-banner frame-gold">{kind === "levelup" ? "Level up!" : "Big win!"}</div>}
      {Array.from({ length: n }, (_, i) => <span key={i} className={`fx-bit ${kind === "burn" ? "from-bottom" : ""}`}><Icon id={set[i % set.length]} size={30} /></span>)}
    </div>
  );
}
