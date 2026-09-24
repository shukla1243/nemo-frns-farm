/**
 * Pixel-art world renderer.
 * The scene is composed on a low-resolution canvas (1 px = 1 art pixel = 2.5 world units) and scaled
 * up by an integer factor so every pixel stays crisp. Labels and floating numbers are drawn afterwards
 * in screen space with the pixel font. Collision uses the same tile grid the terrain is painted from.
 */
import { useEffect, useRef } from "react";
import type { GameState } from "../engine/types";
import { RIVAL_NAMES, ZONES, type ZoneId } from "../engine/config";
import { bossStatus } from "../engine/systems";
import { drawFriend, loadSprites, type GenerationSprites, type SpriteFacing } from "../game/sprites";
import type { Peer } from "../net/presence";
import { buildTerrain, drawWaterGlints } from "../art/tiles";
import * as A from "../art/sprites";
import { icon } from "../art/icons";
import { guideTarget } from "./guide";
import { NPCS, RESIDENTS, crab, giftReady, gull, residentAt, villager } from "./npcs";
import type { Sprite } from "../art/pixel";
import {
  LAND, SPAWN, STATIONS, TILE, UNIT, WORLD, ZONE_SHAPES, activeStations, nearestStation, plotPos, tileAt, tileGrid, walkable, zonesKey,
  type Pt, type Station,
} from "./map";

type Floater = { x: number; y: number; text: string; color: string; born: number; icon?: string };
export type WorldApi = { floaters: Floater[]; pos: Pt; teleport(p: Pt): void };

type Props = {
  stateRef: React.MutableRefObject<GameState>;
  spritesRef: React.MutableRefObject<GenerationSprites | null>;
  peersRef: React.MutableRefObject<Map<string, Peer>>;
  blocked: boolean;
  reducedMotion: boolean;
  apiRef: React.MutableRefObject<WorldApi | null>;
  onNear(station: Station | null): void;
  onInteract(station: Station): void;
  onMove(p: Pt, facing: SpriteFacing): void;
};

const FONT = '"Jersey 15", "Nunito", sans-serif';
const AURA = ["", "#6cc6e6", "#86c95e", "#f5c542", "#b48ae0", "#ff6f73"];

/** Which sprite represents a station (depends on state for home tier / boss / animation frame). */
/** Gold pixel arrow pointing along `ang` (radians), tip at (x, y). */
function guideArrow(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, sz: number) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-sz * 1.4, -sz); ctx.lineTo(-sz * 1.4, -sz * 0.4); ctx.lineTo(-sz * 2.4, -sz * 0.4);
  ctx.lineTo(-sz * 2.4, sz * 0.4); ctx.lineTo(-sz * 1.4, sz * 0.4); ctx.lineTo(-sz * 1.4, sz); ctx.closePath();
  ctx.lineJoin = "miter"; ctx.lineWidth = Math.max(3, sz * 0.35); ctx.strokeStyle = "#2b1d1a"; ctx.stroke();
  ctx.fillStyle = "#ffd23f"; ctx.fill();
  ctx.restore();
}

export function stationSprite(st: Station, s: GameState, frame: number, bossUp: boolean): Sprite {
  if (st.id.startsWith("npc:")) { const n = NPCS.find(x => `npc:${x.id}` === st.id); if (n) return villager(n, Math.floor(frame / 3)); }
  switch (st.id) {
    case "home": return A.home(s.home);
    case "farm": return A.scarecrow();
    case "market": return A.market();
    case "pool": return A.tidePool(frame % 3);
    case "dock": return A.dockShack();
    case "shrine": return A.shrine();
    case "wheel": return A.wheel(0);
    case "board": return A.board();
    case "pier": return A.voyagePier(!!s.voyage);
    case "chop": return A.woodPile();
    case "quarry": return A.stonePile();
    case "mines": return A.mineEntrance();
    case "forge": return A.forge(frame % 3);
    case "harbor": return A.ship(frame % 2);
    case "abyss": return A.portal(frame % 4);
    case "reef": return bossUp ? A.kraken(frame % 3) : A.coralTree(1);
    default: return A.signpost();
  }
}

type Decor = { x: number; y: number; spr: Sprite };
const decorCache = new Map<string, Decor[]>();
function decorations(zones: Record<ZoneId, boolean>): Decor[] {
  const key = zonesKey(zones);
  const hit = decorCache.get(key);
  if (hit) return hit;
  const grid = tileGrid(zones);
  const blockers: Pt[] = [...activeStations(zones), ...Array.from({ length: 9 }, (_, i) => plotPos(i)), SPAWN];
  const out: Decor[] = [];
  const kinds: Record<ZoneId, (i: number) => Sprite> = {
    beach: i => (i % 5 === 0 ? A.palm(i) : i % 3 === 0 ? A.bush(i) : i % 2 ? A.flower(i % 4 ? "R" : "P") : A.shellDecor()),
    grove: i => (i % 3 === 0 ? A.bush(i) : i % 4 === 1 ? A.flower("R") : A.palm(i)),
    cove: i => (i % 4 === 0 ? A.crystal() : A.rock(i)),
    mines: i => (i % 3 === 0 ? A.rock(1) : A.rock(0)),
    forge: i => (i % 2 ? A.lavaCrack() : A.rock(i)),
    harbor: i => (i % 2 ? A.shellDecor() : A.bush(i)),
    abyss: i => (i % 3 ? A.bone() : A.crystal()),
    reef: i => A.coralTree(i),
  };
  const count: Record<ZoneId, number> = { beach: 38, grove: 55, cove: 30, mines: 26, forge: 26, harbor: 14, abyss: 24, reef: 36 };
  for (const z of Object.keys(ZONE_SHAPES) as ZoneId[]) {
    if (z !== "beach" && !zones[z]) continue;
    const e = ZONE_SHAPES[z];
    let seed = z.length * 7919 + 17;
    const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
    let placed = 0;
    for (let tries = 0; tries < 1500 && placed < count[z]; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.92;
      const p = { x: e.cx + Math.cos(a) * e.rx * r, y: e.cy + Math.sin(a) * e.ry * r };
      const t = tileAt(grid, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
      if (!LAND.has(t) || t === "path" || t === "plank" || t === "deck") continue;
      if (blockers.some(b => Math.hypot(b.x - p.x, b.y - p.y) < 85)) continue;
      if (out.some(d => Math.hypot(d.x - p.x, d.y - p.y) < 34)) continue;
      out.push({ x: p.x, y: p.y, spr: kinds[z](placed) });
      placed++;
    }
  }
  decorCache.set(key, out);
  return out;
}

export function World({ stateRef, spritesRef, peersRef, blocked, reducedMotion, apiRef, onNear, onInteract, onMove }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ blocked, reducedMotion, onNear, onInteract, onMove });
  live.current = { blocked, reducedMotion, onNear, onInteract, onMove };

  useEffect(() => {
    const cv = canvas.current!, host = wrap.current!;
    const ctx = cv.getContext("2d")!;
    const low = document.createElement("canvas");
    const lctx = low.getContext("2d")!;
    const pos: Pt = { ...SPAWN };
    const keys = new Set<string>();
    let dest: Pt | null = null, pending: Station | null = null;
    let facing: SpriteFacing = "down", side: "left" | "right" = "right", walking = false;
    let S = 3, dpr = 1, cw = 0, ch = 0, vw = 0, vh = 0; // S = device px per art px
    let camX = 0, camY = 0; // art px (float, rounded when drawing)
    let terrain: HTMLCanvasElement | null = null, terrainKey = "";
    let near: Station | null = null, raf = 0, last = 0;
    const peerSprites = new Map<string, GenerationSprites | null>();
    const floaters: Floater[] = [];
    const dust: { x: number; y: number; born: number }[] = [];
    let fontReady = false;
    void document.fonts?.load(`16px ${FONT}`).then(() => { fontReady = true; }).catch(() => { fontReady = true; });

    let snap = true;
    apiRef.current = { floaters, pos, teleport(p) { pos.x = p.x; pos.y = p.y; dest = null; pending = null; keys.clear(); snap = true; } };

    const resize = () => {
      dpr = Math.min(3, window.devicePixelRatio || 1);
      cw = host.clientWidth; ch = host.clientHeight;
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      cv.style.width = `${cw}px`; cv.style.height = `${ch}px`;
      S = Math.max(2, Math.round(Math.min(cv.width, cv.height) / 260));
      vw = Math.ceil(cv.width / S); vh = Math.ceil(cv.height / S);
      low.width = vw; low.height = vh;
      lctx.imageSmoothingEnabled = false;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);

    const toWorld = (clientX: number, clientY: number): Pt => {
      const r = cv.getBoundingClientRect();
      return { x: (camX + ((clientX - r.left) * dpr) / S) * UNIT, y: (camY + ((clientY - r.top) * dpr) / S) * UNIT };
    };
    const onPointer = (ev: PointerEvent) => {
      if (live.current.blocked) return;
      ev.preventDefault();
      cv.focus({ preventScroll: true });
      const p = toWorld(ev.clientX, ev.clientY);
      const s = stateRef.current;
      const hit = activeStations(s.zones).find(st => Math.abs(st.x - p.x) < 45 && p.y > st.y - 80 && p.y < st.y + 30);
      if (hit) { dest = { x: hit.x, y: hit.y + 34 }; pending = hit; } else { dest = p; pending = null; }
      keys.clear();
    };
    const MOVE: Record<string, [number, number]> = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
    const onKey = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      const target = ev.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if (ev.type === "keydown" && live.current.blocked) return;
      if (MOVE[k]) {
        ev.preventDefault();
        if (ev.type === "keydown") { keys.add(k); dest = null; pending = null; } else keys.delete(k);
      } else if ((k === "e" || k === " " || k === "enter") && ev.type === "keydown" && near && !ev.repeat && (target === cv || target === document.body)) {
        ev.preventDefault(); live.current.onInteract(near);
      }
    };
    const stop = () => { keys.clear(); dest = null; };
    cv.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);
    window.addEventListener("blur", stop);

    const label = (text: string, ax: number, ay: number, style: "station" | "near" | "lock" | "you" | "peer") => {
      const x = Math.round((ax - camX) * S), y = Math.round((ay - camY) * S);
      const size = Math.round(Math.max(13 * dpr, S * 3.4));
      ctx.font = `${size}px ${FONT}`;
      const w = Math.ceil(ctx.measureText(text).width) + Math.round(size * 0.9), h = Math.round(size * 1.45);
      const bg = style === "near" ? "#f5c542" : style === "lock" ? "#ee6f22" : style === "you" ? "#ee6f22" : style === "peer" ? "#2f6b3a" : "#4a3226";
      const fg = style === "near" ? "#2b1d1a" : "#fff1d6";
      const b = Math.max(2, Math.round(S / 1.5));
      ctx.fillStyle = "#2b1d1a"; ctx.fillRect(x - w / 2 - b, y - h / 2, w + b * 2, h);
      ctx.fillRect(x - w / 2, y - h / 2 - b, w, h + b * 2);
      ctx.fillStyle = bg; ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(x - w / 2, y - h / 2, w, b);
      ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(text, x, y + 1);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      if (document.hidden) return;
      const s = stateRef.current;
      const rm = live.current.reducedMotion;
      const t = rm ? 0 : now / 1000;
      const anim = rm ? 0 : Math.floor(now / 180);

      // ---- movement (world units) ----
      walking = false;
      if (!live.current.blocked && !s.sleeping) {
        let dx = 0, dy = 0;
        for (const k of keys) { dx += MOVE[k][0]; dy += MOVE[k][1]; }
        const speed = 250 * (s.trait === "glider" ? 1.3 : 1) * (s.hunger <= 0 ? 0.6 : 1);
        let travel = speed * dt;
        if (!dx && !dy && dest) {
          dx = dest.x - pos.x; dy = dest.y - pos.y;
          const dist = Math.hypot(dx, dy);
          travel = Math.min(travel, dist);
          if (dist < 3) { dest = null; dx = dy = 0; if (pending) { const st = pending; pending = null; live.current.onInteract(st); } }
        }
        if (dx || dy) {
          const len = Math.hypot(dx, dy), mx = dx / len * travel, my = dy / len * travel;
          const before = { x: pos.x, y: pos.y };
          const steps = Math.max(1, Math.ceil(travel / 3));
          for (let i = 0; i < steps; i++) {
            const nx = pos.x + mx / steps, ny = pos.y + my / steps;
            if (walkable({ x: nx, y: ny }, s.zones)) { pos.x = nx; pos.y = ny; }
            else if (walkable({ x: nx, y: pos.y }, s.zones)) pos.x = nx;
            else if (walkable({ x: pos.x, y: ny }, s.zones)) pos.y = ny;
          }
          walking = Math.hypot(pos.x - before.x, pos.y - before.y) > 0.05;
          if (!walking && dest) {
            if (pending && Math.hypot(pending.x - pos.x, pending.y - pos.y) < 90) { const st = pending; pending = null; live.current.onInteract(st); }
            dest = null;
          }
          facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
          if (facing === "left" || facing === "right") side = facing;
          if (walking) live.current.onMove(pos, facing);
        }
      }
      if (s.sleeping) { const h = STATIONS.find(st => st.id === "home")!; pos.x = h.x + 34; pos.y = h.y + 30; }
      const n = nearestStation(pos, s.zones);
      if (n?.id !== near?.id) { near = n; live.current.onNear(n); }

      // ---- camera (art px) ----
      const worldW = WORLD.w / UNIT, worldH = WORLD.h / UNIT;
      const px = pos.x / UNIT, py = pos.y / UNIT;
      const tx = Math.max(Math.min(0, worldW - vw), Math.min(Math.max(0, worldW - vw), px - vw / 2));
      const ty = Math.max(Math.min(0, worldH - vh), Math.min(Math.max(0, worldH - vh), py - vh / 2));
      const k = rm ? 1 : Math.min(1, dt * 7);
      camX += (tx - camX) * k; camY += (ty - camY) * k;
      if (snap || Math.abs(tx - camX) > 400 || Math.abs(ty - camY) > 400) { camX = tx; camY = ty; snap = false; }
      const cx = Math.round(camX), cy = Math.round(camY);

      // ---- low-res composition ----
      const key = zonesKey(s.zones);
      if (key !== terrainKey) { terrain = buildTerrain(s.zones); terrainKey = key; }
      lctx.fillStyle = "#24507a"; lctx.fillRect(0, 0, vw, vh);
      lctx.drawImage(terrain!, -cx, -cy);
      if (!rm) drawWaterGlints(lctx, s.zones, cx, cy, vw, vh, t);

      const bossNow = s.zones.reef ? bossStatus(Date.now(), s.boss.damage) : null;
      const bossUp = !!bossNow && bossNow.active && !bossNow.defeated;
      type D = { y: number; draw: () => void };
      const ds: D[] = [];
      const put = (spr: Sprite, wx: number, wy: number, anchorY = 1) => {
        const ax = Math.round(wx / UNIT - spr.width / 2 - cx), ay = Math.round(wy / UNIT - spr.height * anchorY - cy);
        if (ax > vw || ay > vh || ax + spr.width < 0 || ay + spr.height < 0) return;
        lctx.drawImage(spr, ax, ay);
      };
      const shadow = (wx: number, wy: number, r: number) => {
        lctx.fillStyle = "rgba(43,29,26,.28)";
        const ax = Math.round(wx / UNIT - cx), ay = Math.round(wy / UNIT - cy);
        lctx.fillRect(ax - r, ay - 1, r * 2, 2); lctx.fillRect(ax - r + 2, ay - 2, r * 2 - 4, 4);
      };
      for (const d of decorations(s.zones)) ds.push({ y: d.y, draw: () => put(d.spr, d.x, d.y) });
      for (const st of activeStations(s.zones)) {
        const spr = stationSprite(st, s, anim, bossUp);
        ds.push({ y: st.y + 6, draw: () => { shadow(st.x, st.y + 6, Math.round(spr.width / 2.4)); put(spr, st.x, st.y + 8); } });
      }
      // farm plots (flat, drawn under everything)
      const nowMs = Date.now();
      s.plots.forEach((p, i) => {
        const pp = plotPos(i);
        put(A.soil(!!p.crop), pp.x, pp.y + 20);
        if (!p.crop) return;
        const ready = nowMs >= p.readyAt;
        const prog = Math.min(1, (nowMs - p.plantedAt) / Math.max(1, p.readyAt - p.plantedAt));
        const stage = p.withered ? 3 : ready ? 2 : prog < 0.45 ? 0 : 1;
        ds.push({ y: pp.y, draw: () => {
          put(A.crop(p.crop!, stage as 0 | 1 | 2 | 3), pp.x, pp.y + 8 + (ready && !rm ? Math.round(Math.sin(t * 4 + i)) : 0));
          if (ready && !p.withered && !rm && anim % 6 === i % 6) put(icon("spark"), pp.x + 12, pp.y - 6);
        } });
      });
      // rival boats bobbing off the harbor
      if (s.zones.harbor) RIVAL_NAMES.slice(0, 3).forEach((r, i) => {
        const hb = ZONE_SHAPES.harbor; const bx = hb.cx + hb.rx + 90 + (i % 2) * 60, by = hb.cy - 200 + i * 200 + Math.round(Math.sin(t + i) * 3);
        ds.push({ y: by, draw: () => put(A.boat(["r", "p", "B"][i]), bx, by) });
      });
      // simulated residents walking between beach stations
      const names = RIVAL_NAMES.slice(3, 3 + RESIDENTS.length);
      const residents = RESIDENTS.map((r, i) => ({ r, name: names[i]?.name ?? "Resident", ...residentAt(i, nowMs / 1000, STATIONS) }));
      for (const res of residents) {
        ds.push({ y: res.y, draw: () => { shadow(res.x, res.y, 9); put(villager(res.r, res.walking && !rm ? anim % 2 : 0), res.x, res.y + 6); } });
      }
      // peers
      for (const peer of peersRef.current.values()) {
        if (!peerSprites.has(peer.friendId) && /^\d+$/.test(peer.friendId)) {
          peerSprites.set(peer.friendId, null);
          loadSprites(peer.friendId).then(sp => peerSprites.set(peer.friendId, sp)).catch(() => {});
        }
        ds.push({ y: peer.y, draw: () => {
          shadow(peer.x, peer.y, 10);
          const sp = peerSprites.get(peer.friendId);
          const ax = peer.x / UNIT - cx, ay = peer.y / UNIT - cy;
          if (sp) drawFriend(lctx, sp, ax, ay, 2, (["down", "up", "left", "right"].includes(peer.facing) ? peer.facing : "down") as SpriteFacing, false, 0);
          else lctx.drawImage(icon("clownfish"), Math.round(ax - 9), Math.round(ay - 16));
        } });
      }
      // player
      ds.push({ y: pos.y, draw: () => {
        const tier = Math.min(5, Math.floor(s.level / 10));
        const ax = pos.x / UNIT - cx, ay = pos.y / UNIT - cy;
        if (tier > 0) {
          const c = AURA[tier];
          const rx = 13, ry = 4;
          for (let a = 0; a < 40; a++) {
            const th = (a / 40) * Math.PI * 2;
            lctx.fillStyle = a % 2 ? c : c + "99";
            lctx.fillRect(Math.round(ax + Math.cos(th) * rx), Math.round(ay + Math.sin(th) * ry), 1, 1);
          }
          if (!rm) for (let k2 = 0; k2 < tier + 1; k2++) {
            const th = t * 2 + (k2 / (tier + 1)) * Math.PI * 2;
            const sx = Math.round(ax + Math.cos(th) * 14), sy = Math.round(ay - 16 + Math.sin(th) * 10);
            lctx.fillStyle = c; lctx.fillRect(sx, sy, 2, 2); lctx.fillStyle = "#ffffff"; lctx.fillRect(sx, sy, 1, 1);
          }
        }
        shadow(pos.x, pos.y, 10);
        const sp = spritesRef.current;
        const f = rm ? 0 : Math.floor(now / 110) % 8;
        const bob = walking || rm ? 0 : Math.round(Math.sin(t * 2.5) * 0.6);
        const away = !!s.voyage;
        if (away) lctx.globalAlpha = 0.45;
        if (sp) {
          const head = drawFriend(lctx, sp, ax, ay + bob, 2, s.sleeping ? "down" : facing, walking, f, side, "#fff4dc");
          const h = A.hat(Math.min(5, Math.floor(s.level / 10)));
          lctx.drawImage(h, Math.round(head.headX - h.width), Math.round(head.headY - h.height * 2 + 5), h.width * 2, h.height * 2);
        } else lctx.drawImage(icon("clownfish"), Math.round(ax - 9), Math.round(ay - 16));
        lctx.globalAlpha = 1;
        if (away) lctx.drawImage(icon("anchor"), Math.round(ax + 10), Math.round(ay - 52));
        else if (s.sleeping) lctx.drawImage(icon("zz"), Math.round(ax + 10), Math.round(ay - 52 + Math.sin(t * 2) * 2));
        else if (s.hunger < 25) lctx.drawImage(icon("hunger"), Math.round(ax + 10), Math.round(ay - 52));
        // sand puffs behind the feet while walking
        if (walking && !rm && Math.random() < 0.35) dust.push({ x: pos.x - (facing === "left" ? -12 : facing === "right" ? 12 : 0), y: pos.y, born: nowMs });
        for (let i = dust.length - 1; i >= 0; i--) {
          const age = (nowMs - dust[i].born) / 450;
          if (age > 1) { dust.splice(i, 1); continue; }
          lctx.fillStyle = `rgba(232, 200, 138, ${1 - age})`;
          const dx2 = Math.round(dust[i].x / UNIT - cx), dy2 = Math.round(dust[i].y / UNIT - cy - age * 4);
          lctx.fillRect(dx2, dy2, 2, 2); lctx.fillRect(dx2 + 3, dy2 + 1, 1, 1);
        }
      } });
      ds.sort((a, b) => a.y - b.y).forEach(d => d.draw());

      // ambient critters: crabs scuttle on the sand, gulls glide over everything
      if (!rm) {
        const b = ZONE_SHAPES.beach;
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9 + 0.4;
          const bx = b.cx + Math.cos(a) * b.rx * 0.9, by = b.cy + Math.sin(a) * b.ry * 0.9;
          const x = bx + Math.sin(t * 0.7 + i * 2) * 40;
          put(crab(Math.floor(t * 6) + i), x, by);
        }
        for (let i = 0; i < 3; i++) {
          const gx = ((t * 70 + i * 1100) % (WORLD.w + 600)) - 300, gy = 500 + i * 700 + Math.sin(t + i) * 40;
          put(gull(Math.floor(t * 4) + i), gx, gy);
        }
      }
      // gift markers over islanders with a present waiting
      for (const n of NPCS) {
        if (!s.zones[n.zone] || !giftReady(s, n.id, nowMs)) continue;
        put(icon("chest"), n.x, n.y - 64 + (rm ? 0 : Math.round(Math.sin(t * 3 + n.x) * 2)));
      }
      // clouds drifting over locked zones (fog of the unexplored sea)
      for (const z of Object.keys(ZONE_SHAPES) as ZoneId[]) {
        if (s.zones[z]) continue;
        const e = ZONE_SHAPES[z];
        const drift = rm ? 0 : Math.sin(t * 0.3 + e.cx) * 10;
        put(A.cloud(0), e.cx - 50 + drift, e.cy - 10, 0.5);
        put(A.cloud(1), e.cx + 55 - drift, e.cy + 40, 0.5);
      }
      if (dest && !rm) {
        const ax = Math.round(dest.x / UNIT - cx), ay = Math.round(dest.y / UNIT - cy), r = 3 + (Math.floor(t * 6) % 2);
        lctx.fillStyle = "#fff1a8";
        lctx.fillRect(ax - r, ay, 2, 1); lctx.fillRect(ax + r - 1, ay, 2, 1); lctx.fillRect(ax, ay - r, 1, 2); lctx.fillRect(ax, ay + r - 1, 1, 2);
      }

      // ---- upscale ----
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(low, 0, 0, vw * S, vh * S);

      // ---- screen-space labels (crisp pixel font) ----
      const saveCam = { camX, camY }; camX = cx; camY = cy;
      if (fontReady) {
        for (const st of activeStations(s.zones)) {
          const isNear = near?.id === st.id;
          const spr = stationSprite(st, s, 0, bossUp);
          const lx = st.x / UNIT, ly = (st.y + 8) / UNIT - spr.height - 5;
          const text = st.id.startsWith("unlock:") ? `Expand: ${ZONES[st.id.slice(7) as ZoneId].name}` : st.label;
          if (lx < camX - 60 || lx > camX + vw + 60 || ly < camY - 20 || ly > camY + vh + 20) continue;
          label(isNear ? `${text}  [E]` : text, lx, ly, isNear ? "near" : st.id.startsWith("unlock:") ? "lock" : "station");
        }
        for (const res of residents) if (Math.hypot(res.x - pos.x, res.y - pos.y) < 260) label(`${res.name} (resident)`, res.x / UNIT, res.y / UNIT - 36, "station");
        for (const peer of peersRef.current.values()) label(`Lv${peer.level} ${peer.name}`, peer.x / UNIT, peer.y / UNIT - 42, "peer");
        label(`${s.voyage ? "Sailing: " : ""}Lv${s.level} ${s.name}${s.rebirths ? ` ★${s.rebirths}` : ""}`, pos.x / UNIT, pos.y / UNIT - 50, "you");
        for (const peer of peersRef.current.values()) if (peer.emote && Date.now() - peer.emoteAt < 3500) {
          ctx.drawImage(icon(peer.emote), Math.round((peer.x / UNIT - cx - 9) * S), Math.round((peer.y / UNIT - cy - 66) * S), 18 * S, 18 * S);
        }
      }
      // ---- story guide: a bouncing arrow over the next goal, or an arrow at the screen edge pointing to it ----
      const goal = s.voyage ? null : guideTarget(s);
      if (goal) {
        const W = vw * S, H = vh * S, sz = S * 6;
        const gx = (goal.x / UNIT - cx) * S, gy = ((goal.y + 8) / UNIT - cy - stationSprite(goal, s, 0, bossUp).height - 14) * S;
        const top = H * 0.45, bottom = H - 100 * dpr, side = 30 * dpr;
        if (gx > side && gx < W - side && gy > H * 0.2 && gy < bottom) {
          guideArrow(ctx, gx, gy + (rm ? 0 : Math.round(Math.sin(t * 5) * 2) * S), Math.PI / 2, sz);
        } else {
          const ox = W / 2, oy = (top + bottom) / 2, dx = gx - ox, dy = gy - oy;
          const k = Math.min(dx ? (dx > 0 ? W - side - ox : side - ox) / dx : Infinity, dy ? (dy > 0 ? bottom - oy : top - oy) / dy : Infinity);
          guideArrow(ctx, ox + dx * k, oy + dy * k, Math.atan2(dy, dx), sz * 1.2);
        }
      }
      // floaters
      for (let i = floaters.length - 1; i >= 0; i--) {
        const fl = floaters[i], age = (nowMs - fl.born) / 1000;
        if (age > 1.6) { floaters.splice(i, 1); continue; }
        if (age < 0) continue;
        const x = Math.round((fl.x / UNIT - cx) * S), y = Math.round((fl.y / UNIT - cy - (rm ? 8 : age * 20)) * S);
        ctx.globalAlpha = Math.max(0, 1 - age / 1.6);
        const size = Math.round(Math.max(18 * dpr, S * 5));
        if (fl.icon) ctx.drawImage(icon(fl.icon), x - size * 1.4, y - size * 0.6, size * 1.2, size * 1.2);
        ctx.font = `${size}px ${FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(3, S); ctx.strokeStyle = "#2b1d1a"; ctx.strokeText(fl.text, x - size * 0.1, y);
        ctx.fillStyle = fl.color; ctx.fillText(fl.text, x - size * 0.1, y);
        ctx.globalAlpha = 1;
      }
      camX = saveCam.camX; camY = saveCam.camY;
      cv.dataset.x = pos.x.toFixed(0); cv.dataset.y = pos.y.toFixed(0);
      cv.dataset.camx = String(cx); cv.dataset.camy = String(cy); cv.dataset.scale = String(S / dpr);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", stop);
      apiRef.current = null;
    };
  }, [stateRef, peersRef, apiRef, spritesRef]);

  return (
    <div ref={wrap} className="world">
      <canvas ref={canvas} tabIndex={0} aria-label="Island world. Tap or click to walk, WASD or arrow keys to move, E to use the nearest station." />
    </div>
  );
}
