import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { BOSS, EVENTS, GATHER, HOMES, ITEMS, titleFor, xpToNext } from "../engine/config";
import { bossStatus } from "../engine/systems";
import { bestFood, maxEnergy } from "../engine/state";
import { chapterAt } from "../engine/story";
import { EMOTES } from "../net/presence";
import type { Station } from "../world/map";
import { stationSprite } from "../world/World";
import { sound } from "../game/sound";
import { music } from "../game/music";
import { Icon, SpriteImg } from "./Icon";
import { mmss, n0, rf, useG } from "./common";

export type Toast = { id: number; text: string; tone: string; icon?: string };

/** Animated number: tweens toward the new value with anime.js and flashes on change. */
function Ticker({ value, format }: { value: number; format: (v: number) => string }) {
  const { reducedMotion } = useG();
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion || shown.current === value) { shown.current = value; el.textContent = format(value); return; }
    const up = value > shown.current;
    const obj = { v: shown.current };
    const anim = animate(obj, { v: value, duration: 650, ease: "outExpo", onUpdate: () => { el.textContent = format(obj.v); } });
    const chip = el.parentElement!;
    animate(chip, { scale: [1, up ? 1.12 : 0.94, 1], duration: 380, ease: "outBack" });
    chip.dataset.flash = up ? "up" : "down";
    const t = setTimeout(() => { delete chip.dataset.flash; }, 500);
    shown.current = value;
    return () => { anim.pause(); clearTimeout(t); el.textContent = format(value); };
  }, [value, format, reducedMotion]);
  return <span ref={ref}>{format(value)}</span>;
}

/** A need bar that is also a one-tap action (eat, sleep, snack). */
function Meter({ icon, value, max, tone, label, low, action, onClick }: {
  icon: string; value: number; max: number; tone: string; label: string; low: boolean; action: string; onClick: () => void;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <button type="button" className={`meter frame-dark ${low ? "low" : ""}`} onClick={onClick} aria-label={`${label} ${Math.floor(value)} of ${max}. ${action}`} title={`${label} ${Math.floor(value)}/${max}. Tap: ${action}`}>
      <Icon id={icon} size={20} />
      <span className="segs" aria-hidden>{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.ceil(pct * 10) ? `on ${tone}` : ""} />)}</span>
    </button>
  );
}

export function Hud({ portraitUrl, near, onAction, toasts, onEmote, unread }: {
  portraitUrl: string | null; near: Station | null; onAction: () => void; toasts: Toast[]; onEmote: (e: string) => void; unread: number;
}) {
  const { s, now, act, open, net, identity, reducedMotion } = useG();
  const [muted, setMuted] = useState(sound.muted);
  const [emotes, setEmotes] = useState(false);
  const toastBox = useRef<HTMLDivElement>(null);
  const need = xpToNext(s.level);
  const ch = chapterAt(s.story);
  const chDone = ch.done(s);
  const ev = s.event;
  const boss = s.zones.reef ? bossStatus(now, s.boss.epoch === Math.floor(now / BOSS.periodMs) ? s.boss.damage : 0, net.bossOthers) : null;

  useEffect(() => {
    const el = toastBox.current?.lastElementChild as HTMLElement | null;
    if (el && !reducedMotion && !el.dataset.in) { el.dataset.in = "1"; animate(el, { translateY: [14, 0], opacity: [0, 1], scale: [0.92, 1], duration: 320, ease: "outBack" }); }
  }, [toasts, reducedMotion]);

  const eat = () => { const f = bestFood(s, "hunger"); if (f) act({ type: "eat", item: f }); else open("bag"); };
  const rest = () => { if (s.inv.energyDrink > 0 && s.energy < maxEnergy(s) - 30) act({ type: "drink" }); else if (!s.sleeping) act({ type: "sleep" }); };
  const cheer = () => { const f = bestFood(s, "mood"); if (f) act({ type: "eat", item: f }); else open("bag"); };
  const hungryFood = bestFood(s, "hunger");
  const mood = s.mood >= 75 ? "moodHappy" : s.mood < 25 ? "moodSad" : "moodOk";
  return (
    <div className="hud">
      <div className="hud-top">
        <button type="button" className="me frame-panel" onClick={() => open("shrine")} aria-label="Open Coral Shrine to level up">
          <span className="me-art frame-slot">{portraitUrl ? <img src={portraitUrl} alt="" /> : <Icon id="clownfish" size={32} />}</span>
          <span className="me-text">
            <b>{s.name}{s.rebirths > 0 && <span className="rebirth"> ★{s.rebirths}</span>}</b>
            <small>Lv {s.level} {titleFor(s.level)}{identity.guest ? " · guest" : ""}</small>
            <span className="xp" aria-label={`Experience ${s.xp} of ${need}`}><i style={{ width: `${Math.min(100, (s.xp / need) * 100)}%` }} className={s.xp >= need ? "full" : ""} /></span>
          </span>
          {s.xp >= need && <span className="ready-badge"><Icon id="star" size={18} /></span>}
        </button>
        <div className="wallets">
          <span className="coin frame-dark" title="Simulated $RAREFRIENDS"><Icon id="rf" size={22} /><Ticker value={s.rf} format={rf} /><small>RF</small></span>
          <span className="coin frame-dark" title="$SHELL, the island token"><Icon id="shell" size={22} /><Ticker value={s.shell} format={n0} /></span>
          <span className="sim-flag">SIMULATED</span>
          <span className="net-chip frame-dark" title={`Network: ${net.status}`}><i className={`dot ${net.status}`} />{net.peers + 1} online</span>
        </div>
      </div>
      <div className="needs">
        <Meter icon="hunger" value={s.hunger} max={100} tone="orange" label="Hunger" low={s.hunger < 25} action={hungryFood ? `eat ${ITEMS[hungryFood].name}` : "open backpack"} onClick={eat} />
        <Meter icon="energy" value={s.energy} max={maxEnergy(s)} tone="gold" label="Energy" low={s.energy < 15} action={s.inv.energyDrink > 0 ? "drink or sleep" : "sleep"} onClick={rest} />
        <Meter icon={mood} value={s.mood} max={100} tone="blue" label="Mood" low={s.mood < 25} action="eat a treat" onClick={cheer} />
      </div>
      {s.hunger < 40 && !s.sleeping && (
        <button type="button" className="eat-now pbtn hot" onClick={eat}>
          <Icon id={hungryFood ?? "bag"} size={22} /> {hungryFood ? `Eat ${ITEMS[hungryFood].name}` : "No food! Open backpack"}
        </button>
      )}
      <div className="banners">
        <button type="button" className={`quest-note frame-paper ${chDone ? "done" : ""}`} onClick={() => open("story")}>
          <Icon id={chDone ? "check" : "book"} size={20} />
          <span><b>{ch.title}</b><small>{chDone ? "Goal reached. Tap to claim your reward." : ch.goal}</small></span>
        </button>
        {s.voyage && <button type="button" className="event-tag frame-sea" onClick={() => open("pier")}><Icon id="anchor" size={18} />{now < s.voyage.endsAt ? `Voyage: back in ${mmss(s.voyage.endsAt - now)}` : "Voyage is back! Open the chest"}</button>}
        {ev && <span className={`event-tag frame-dark ${ev.id}`}><Icon id={ev.id === "storm" ? "zz" : ev.id === "boom" ? "coin" : ev.id === "meteor" ? "ore" : ev.id === "goldtide" ? "goldnemo" : "spark"} size={18} />{now < ev.startsAt ? `${EVENTS[ev.id].name} in ${mmss(ev.startsAt - now)}` : `${EVENTS[ev.id].name} ${mmss(ev.endsAt - now)}`}</span>}
        {boss?.active && !boss.defeated && <button type="button" className="event-tag frame-dark boss" onClick={() => open("reef")}><Icon id="angler" size={18} />Kraken {Math.round((boss.remaining / boss.hp) * 100)}% · {mmss(boss.endsIn)}</button>}
        {s.sleeping && <span className="event-tag frame-dark"><Icon id="zz" size={18} />Sleeping in your {HOMES[s.home].name} · {mmss(s.sleeping.until - now)}</span>}
      </div>
      <div className="toasts" ref={toastBox} aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`toast frame-paper ${t.tone}`}><Icon id={t.icon ?? (t.tone === "bad" ? "skull" : t.tone === "epic" ? "star" : t.tone === "good" ? "check" : "spark")} size={22} /><span>{t.text}</span></div>)}
      </div>
      <div className="hud-bottom">
        <nav className="dock-btns" aria-label="Menu">
          <button type="button" className="pbtn hot play-btn" onClick={() => open("play")}><Icon id="star" size={24} /> Play</button>
          <button type="button" className="pbtn icon-only" onClick={() => open("bag")} aria-label="Backpack"><Icon id="bag" size={26} /></button>
          <button type="button" className="pbtn icon-only" onClick={() => open("map")} aria-label="Island map and fast travel"><Icon id="map" size={26} /></button>
          <button type="button" className="pbtn icon-only bell" onClick={() => open("inbox")} aria-label={`Notifications, ${unread} unread`}><Icon id="board" size={26} />{unread > 0 && <span className="badge">{unread > 99 ? "99+" : unread}</span>}</button>
          <div className="emote-wrap">
            <button type="button" className="pbtn icon-only" onClick={() => setEmotes(v => !v)} aria-label="Emotes" aria-expanded={emotes}><Icon id="emote" size={26} /></button>
            {emotes && <div className="emote-pop frame-panel">{EMOTES.map(e => <button key={e} type="button" className="pbtn icon-only" aria-label={`Emote ${e}`} onClick={() => { onEmote(e); setEmotes(false); }}><Icon id={e} size={24} /></button>)}</div>}
          </div>
          <button type="button" className="pbtn icon-only" onClick={() => { const v = !muted; sound.setMuted(v); music.setOn(!v); setMuted(v); if (!v) sound.play("select"); }} aria-label={muted ? "Turn sound and music on" : "Mute sound and music"}><Icon id={muted ? "soundOff" : "soundOn"} size={26} /></button>
          <button type="button" className="pbtn icon-only" onClick={() => open("settings")} aria-label="Settings"><Icon id="settings" size={26} /></button>
        </nav>
        {near && (
          <button type="button" className="action-btn pbtn hot" onClick={onAction}>
            <span className="action-art"><SpriteImg sprite={stationSprite(near, s, 0, false)} name={`st-${near.id}-${near.id === "home" ? s.home : 0}-${near.id === "pier" ? !!s.voyage : ""}`} height={40} /></span>
            <span className="action-text"><b>{actionText(near)}</b><small>{actionSub(near, s.energy)}</small></span>
          </button>
        )}
      </div>
    </div>
  );
}

function actionText(st: Station) {
  if (st.id === "chop") return "Chop wood";
  if (st.id === "quarry") return "Quarry stone";
  if (st.id.startsWith("unlock:")) return "Expand island";
  if (st.id.startsWith("npc:")) return `Talk to ${st.label}`;
  return st.label;
}
function actionSub(st: Station, energy: number) {
  if (st.id === "chop" || st.id === "quarry") {
    const cost = GATHER[st.id === "chop" ? "chop" : "quarry"].energy;
    return energy < cost ? "Too tired, rest first" : `Uses ${cost} energy · E`;
  }
  return "Tap or press E";
}
