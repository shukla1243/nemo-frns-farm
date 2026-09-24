import { useEffect, useRef, useState } from "react";
import { NPCS, giftReady, villager } from "../../world/npcs";
import { NPC_GIFTS, ITEMS, ZONES, type ItemId, type ZoneId } from "../../engine/config";
import { buildTerrain } from "../../art/tiles";
import { STATIONS, UNIT, WORLD, ZONE_SHAPES, type Pt } from "../../world/map";
import { Icon, SpriteImg } from "../Icon";
import { Panel, useG } from "../common";

/** Classic RPG dialogue box: portrait, name tag, typewriter text, tap to continue. */
export function NpcDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { s, now, act, open, reducedMotion } = useG();
  const npc = NPCS.find(n => n.id === id)!;
  // Lines are captured once when the conversation opens so text doesn't change mid-sentence.
  const [lines] = useState(() => npc.lines(s, now));
  const [i, setI] = useState(0);
  const [n, setN] = useState(reducedMotion ? Infinity : 0);
  const line = lines[i] ?? "";
  const typing = n < line.length;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  useEffect(() => {
    if (reducedMotion) { setN(Infinity); return; }
    setN(0);
    const t = setInterval(() => setN(v => { if (v >= line.length) { clearInterval(t); return v; } return v + 2; }), 22);
    return () => clearInterval(t);
  }, [i, line, reducedMotion]);
  const last = i >= lines.length - 1;
  const next = () => { if (typing) setN(Infinity); else if (!last) setI(i + 1); };
  const gift = NPC_GIFTS[npc.id];
  const canGift = !!gift && giftReady(s, npc.id, now);
  return (
    <div className="dialog-scrim" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog frame-panel" role="dialog" aria-label={`${npc.name} says`} ref={box} tabIndex={-1}
        onKeyDown={e => { if (e.key === "Escape") onClose(); if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (last && !typing) onClose(); else next(); } }}>
        <div className="dialog-portrait frame-slot"><SpriteImg sprite={villager(npc, 0)} name={`npc-${npc.id}`} height={84} /></div>
        <div className="dialog-main">
          <div className="dialog-name"><b>{npc.name}</b><small>{npc.role}</small></div>
          <p className="dialog-text" aria-live="polite" onClick={next}>{line.slice(0, n)}{typing && <span className="caret" aria-hidden>▌</span>}</p>
          <div className="dialog-actions">
            {!last && <button type="button" className="pbtn" onClick={next}>{typing ? "Skip" : "Next"}</button>}
            {last && !typing && canGift && (
              <button type="button" className="pbtn green" onClick={() => act({ type: "npcGift", npc: npc.id })}>
                <Icon id="chest" size={22} /> Accept gift ({gift!.shell ? `${gift!.shell} SHELL` : Object.entries(gift!.items ?? {}).map(([k, v]) => `${v} ${ITEMS[k as ItemId].name}`).join(", ")})
              </button>
            )}
            {last && !typing && npc.id === "mayor" && <button type="button" className="pbtn hot" onClick={() => open("story")}><Icon id="book" size={22} /> Open story</button>}
            {last && !typing && <button type="button" className="pbtn" onClick={onClose}>Bye</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Town map: the whole island at a glance, with fast travel to every unlocked region. */
export function MapPanel({ onClose, travel, pos }: { onClose: () => void; travel: (p: Pt) => void; pos: () => Pt }) {
  const { s } = useG();
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current!;
    const ctx = c.getContext("2d")!;
    const terrain = buildTerrain(s.zones);
    c.width = terrain.width; c.height = terrain.height;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrain, 0, 0);
    ctx.fillStyle = "rgba(20,14,12,.35)";
    for (const z of Object.keys(ZONE_SHAPES) as ZoneId[]) {
      if (s.zones[z]) continue;
      const e = ZONE_SHAPES[z];
      ctx.beginPath(); ctx.ellipse(e.cx / UNIT, e.cy / UNIT, e.rx / UNIT, e.ry / UNIT, 0, 0, Math.PI * 2); ctx.fill();
    }
    const me = pos();
    ctx.fillStyle = "#2b1d1a"; ctx.fillRect(me.x / UNIT - 7, me.y / UNIT - 7, 14, 14);
    ctx.fillStyle = "#ee6f22"; ctx.fillRect(me.x / UNIT - 5, me.y / UNIT - 5, 10, 10);
    for (const n of NPCS) if (s.zones[n.zone]) { ctx.fillStyle = "#fff1a8"; ctx.fillRect(n.x / UNIT - 3, n.y / UNIT - 3, 6, 6); }
  }, [s.zones, pos]);
  const dests = (Object.keys(ZONES) as ZoneId[]).map(z => ({ z, st: STATIONS.find(st => st.zone === z && st.id !== "home") ?? STATIONS[0] }));
  return (
    <Panel title="Island Map" icon="map" onClose={onClose} wide>
      <div className="map-wrap frame-sea">
        <canvas ref={cv} className="map-canvas" style={{ aspectRatio: `${WORLD.w} / ${WORLD.h}` }} aria-label="Map of the island" />
        {(Object.keys(ZONE_SHAPES) as ZoneId[]).map(z => (
          <span key={z} className={`map-label ${s.zones[z] ? "" : "locked"}`} style={{ left: `${(ZONE_SHAPES[z].cx / WORLD.w) * 100}%`, top: `${(ZONE_SHAPES[z].cy / WORLD.h) * 100}%` }}>
            {!s.zones[z] && <Icon id="lock" size={14} />}{ZONES[z].name}
          </span>
        ))}
      </div>
      <p className="muted">Orange square: you. Yellow dots: islanders to talk to. Tap a place to travel there instantly.</p>
      <div className="travel-grid">
        {dests.map(({ z, st }) => (
          <button key={z} type="button" className="pbtn" disabled={!s.zones[z]} onClick={() => { travel({ x: st.x, y: st.y + 40 }); onClose(); }}>
            <Icon id={s.zones[z] ? st.icon : "lock"} size={22} /> {ZONES[z].name}
          </button>
        ))}
      </div>
    </Panel>
  );
}
