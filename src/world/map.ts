import type { ZoneId } from "../engine/config";
import { NPCS } from "./npcs";

export const WORLD = { w: 3200, h: 2560 };
type Ellipse = { cx: number; cy: number; rx: number; ry: number };
export type Pt = { x: number; y: number };

/** Home island in the middle; seven regions sit across open water, reached by boardwalks. */
export const ZONE_SHAPES: Record<ZoneId, Ellipse> = {
  beach: { cx: 1600, cy: 1320, rx: 620, ry: 440 },
  grove: { cx: 560, cy: 1180, rx: 330, ry: 290 },
  cove: { cx: 820, cy: 520, rx: 330, ry: 250 },
  mines: { cx: 1620, cy: 400, rx: 380, ry: 260 },
  forge: { cx: 2450, cy: 560, rx: 340, ry: 260 },
  harbor: { cx: 2720, cy: 1360, rx: 340, ry: 320 },
  abyss: { cx: 2400, cy: 2150, rx: 360, ry: 260 },
  reef: { cx: 820, cy: 2130, rx: 380, ry: 280 },
};

export type StationId =
  | "home" | "farm" | "market" | "pool" | "dock" | "shrine" | "wheel" | "board"
  | "chop" | "quarry" | "mines" | "forge" | "harbor" | "abyss" | "reef" | "pier"
  | `unlock:${ZoneId}`
  | `npc:${string}`;

export type Station = { id: StationId; zone: ZoneId; x: number; y: number; label: string; icon: string; quick?: boolean };

export const STATIONS: Station[] = [
  { id: "home", zone: "beach", x: 1400, y: 1060, label: "Home", icon: "home" },
  { id: "shrine", zone: "beach", x: 1600, y: 1280, label: "Coral Shrine", icon: "star" },
  { id: "wheel", zone: "beach", x: 1150, y: 1250, label: "Tide Wheel", icon: "dice" },
  { id: "market", zone: "beach", x: 1200, y: 1500, label: "Market", icon: "coin" },
  { id: "pool", zone: "beach", x: 1680, y: 1540, label: "Tide Pool", icon: "wave" },
  { id: "dock", zone: "beach", x: 1560, y: 1700, label: "Fishing Dock", icon: "rod" },
  { id: "farm", zone: "beach", x: 1990, y: 1340, label: "Farm", icon: "carrot" },
  { id: "board", zone: "beach", x: 1960, y: 1590, label: "Bounty Board", icon: "board" },
  { id: "pier", zone: "beach", x: 2090, y: 1470, label: "Voyage Pier", icon: "anchor" },
  { id: "chop", zone: "grove", x: 560, y: 1200, label: "Palm Grove", icon: "wood", quick: true },
  { id: "quarry", zone: "cove", x: 820, y: 540, label: "Rock Cove", icon: "stone", quick: true },
  { id: "mines", zone: "mines", x: 1620, y: 420, label: "Tide Mines", icon: "pick" },
  { id: "forge", zone: "forge", x: 2450, y: 580, label: "Volcano Forge", icon: "fire" },
  { id: "harbor", zone: "harbor", x: 2720, y: 1380, label: "Rival Harbor", icon: "skull" },
  { id: "abyss", zone: "abyss", x: 2400, y: 2170, label: "Abyss Gate", icon: "spark" },
  { id: "reef", zone: "reef", x: 820, y: 2150, label: "Kraken Reef", icon: "angler" },
];

const beach = ZONE_SHAPES.beach;
/** Sign posts on the beach edge pointing at each locked zone. */
export const UNLOCK_SIGNS: Station[] = (["grove", "cove", "mines", "forge", "harbor", "abyss", "reef"] as ZoneId[]).map(z => {
  const t = ZONE_SHAPES[z];
  const dx = t.cx - beach.cx, dy = t.cy - beach.cy;
  const ang = Math.atan2(dy / beach.ry, dx / beach.rx);
  return { id: `unlock:${z}` as StationId, zone: "beach" as ZoneId, x: Math.round(beach.cx + Math.cos(ang) * beach.rx * 0.84), y: Math.round(beach.cy + Math.sin(ang) * beach.ry * 0.84), label: "Expand", icon: "lock" };
});

export const SPAWN: Pt = { x: 1600, y: 1390 };
const REACH = 80;
const BRIDGE_R = 36;

const inEllipse = (p: Pt, e: Ellipse, pad = 0) => ((p.x - e.cx) / (e.rx - pad)) ** 2 + ((p.y - e.cy) / (e.ry - pad)) ** 2 <= 1;
function distToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
const bridgeOf = (z: ZoneId): [Pt, Pt] => [{ x: beach.cx, y: beach.cy }, { x: ZONE_SHAPES[z].cx, y: ZONE_SHAPES[z].cy }];

// ---------- Tile grid (single source of truth for art AND collision) ----------
/** 1 art pixel = 2.5 world units; 1 tile = 16 art px = 40 world units. */
export const UNIT = 2.5;
export const TILE = 40;
export const GRID = { w: WORLD.w / TILE, h: WORLD.h / TILE };
export type TileKind =
  | "deep" | "water" | "shallow" | "sand" | "grass" | "meadow" | "path" | "stone" | "gravel" | "dirt"
  | "basalt" | "deck" | "abyss" | "coral" | "plank";
export const LAND: ReadonlySet<TileKind> = new Set(["sand", "grass", "meadow", "path", "stone", "gravel", "dirt", "basalt", "deck", "abyss", "coral", "plank"]);

const HUB = { x: 1600, y: 1300 };
/** Tidy town roads: an L from the plaza to each beach station (horizontal first, then vertical). */
const PATHS: [Pt, Pt][] = STATIONS.filter(st => st.zone === "beach" && st.id !== "shrine").flatMap(st => [
  [HUB, { x: st.x, y: HUB.y }], [{ x: st.x, y: HUB.y }, { x: st.x, y: st.y + 30 }],
] as [Pt, Pt][]);
const ellipseR = (p: Pt, e: Ellipse) => Math.hypot((p.x - e.cx) / e.rx, (p.y - e.cy) / e.ry);

function zoneTile(z: ZoneId, p: Pt): TileKind {
  const r = ellipseR(p, ZONE_SHAPES[z]);
  switch (z) {
    case "beach":
      if (PATHS.some(([a, b]) => distToSegment(p, a, b) < 21) || Math.hypot(p.x - HUB.x, p.y - HUB.y) < 70) return "path";
      return r < 0.72 ? "grass" : "sand";
    case "grove": return r < 0.82 ? "meadow" : "sand";
    case "cove": return r < 0.8 ? "stone" : "gravel";
    case "mines": return r < 0.8 ? "dirt" : "stone";
    case "forge": return r < 0.85 ? "basalt" : "gravel";
    case "harbor": return r < 0.62 ? "deck" : "sand";
    case "abyss": return "abyss";
    case "reef": return r < 0.8 ? "coral" : "sand";
  }
}

function classify(tx: number, ty: number, zones: Record<ZoneId, boolean>): TileKind {
  const p = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  const ids = Object.keys(ZONE_SHAPES) as ZoneId[];
  for (const z of ids) if ((z === "beach" || zones[z]) && inEllipse(p, ZONE_SHAPES[z])) return zoneTile(z, p);
  for (const z of ids) {
    if (z === "beach" || !zones[z]) continue;
    const [a, b] = bridgeOf(z);
    if (distToSegment(p, a, b) < BRIDGE_R) return "plank";
  }
  // Water depth: shallow near any land or over a locked zone's sandbar.
  for (const z of ids) {
    const e = ZONE_SHAPES[z];
    if (ellipseR(p, { ...e, rx: e.rx + 70, ry: e.ry + 70 }) <= 1) return (z === "beach" || zones[z]) ? "shallow" : "water";
  }
  return "deep";
}

const gridCache = new Map<string, TileKind[]>();
export const zonesKey = (zones: Record<ZoneId, boolean>) => (Object.keys(ZONE_SHAPES) as ZoneId[]).map(z => (zones[z] ? 1 : 0)).join("");
export function tileGrid(zones: Record<ZoneId, boolean>): TileKind[] {
  const key = zonesKey(zones);
  let g = gridCache.get(key);
  if (!g) {
    g = [];
    for (let ty = 0; ty < GRID.h; ty++) for (let tx = 0; tx < GRID.w; tx++) g.push(classify(tx, ty, zones));
    gridCache.set(key, g);
  }
  return g;
}
export const tileAt = (grid: TileKind[], tx: number, ty: number): TileKind =>
  tx < 0 || ty < 0 || tx >= GRID.w || ty >= GRID.h ? "deep" : grid[ty * GRID.w + tx];

/** Collision is exactly the land tiles you can see. The feet box must stay on land. */
export function walkable(p: Pt, zones: Record<ZoneId, boolean>) {
  const g = tileGrid(zones);
  for (const [dx, dy] of [[-10, -4], [10, -4], [-10, 4], [10, 4]]) {
    if (!LAND.has(tileAt(g, Math.floor((p.x + dx) / TILE), Math.floor((p.y + dy) / TILE)))) return false;
  }
  return true;
}

export function activeStations(zones: Record<ZoneId, boolean>): Station[] {
  return [
    ...STATIONS.filter(s => zones[s.zone]),
    ...UNLOCK_SIGNS.filter(s => !zones[s.id.slice(7) as ZoneId]),
    ...NPCS.filter(n => zones[n.zone]).map(n => ({ id: `npc:${n.id}` as StationId, zone: n.zone, x: n.x, y: n.y, label: n.name, icon: "person" })),
  ];
}

export function nearestStation(p: Pt, zones: Record<ZoneId, boolean>, reach = REACH): Station | null {
  let best: Station | null = null, bestD = reach;
  for (const s of activeStations(zones)) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

/** Plot grid positions next to the farm station. */
export const plotPos = (i: number): Pt => ({ x: 1920 + (i % 3) * 52, y: 1150 + Math.floor(i / 3) * 48 });
