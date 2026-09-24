/** Minecraft-style block terrain: each 16px tile gets seeded texture, cliff sides and foam edges. */
import { col, prng } from "./pixel";
import { GRID, LAND, tileAt, tileGrid, type TileKind } from "../world/map";
import type { ZoneId } from "../engine/config";

const T = 16;
type Tex = { base: string; spots: [string, number][]; side?: string };
const TEX: Record<TileKind, Tex> = {
  deep: { base: "b", spots: [["#1f466d", 0.18]] },
  water: { base: "#2d6fa6", spots: [["b", 0.12], ["B", 0.08]] },
  shallow: { base: "B", spots: [["#4b98d0", 0.2], ["c", 0.05]] },
  sand: { base: "s", spots: [["S", 0.12], ["Y", 0.08]], side: "S" },
  grass: { base: "G", spots: [["g", 0.14], ["h", 0.12]], side: "w" },
  meadow: { base: "#5aa84f", spots: [["g", 0.12], ["h", 0.16], ["H", 0.03]], side: "w" },
  path: { base: "y", spots: [["W", 0.14], ["Y", 0.08]], side: "w" },
  stone: { base: "X", spots: [["x", 0.16], ["z", 0.1]], side: "x" },
  gravel: { base: "#9a9486", spots: [["x", 0.14], ["z", 0.12]], side: "x" },
  dirt: { base: "W", spots: [["w", 0.18], ["y", 0.08]], side: "K" },
  basalt: { base: "K", spots: [["k", 0.18], ["x", 0.08], ["l", 0.04]], side: "k" },
  deck: { base: "y", spots: [], side: "w" },
  abyss: { base: "V", spots: [["v", 0.16], ["a", 0.12], ["P", 0.02]], side: "v" },
  coral: { base: "M", spots: [["m", 0.14], ["e", 0.05]], side: "m" },
  plank: { base: "W", spots: [], side: "w" },
};

function paintTile(ctx: CanvasRenderingContext2D, kind: TileKind, tx: number, ty: number) {
  const x0 = tx * T, y0 = ty * T;
  const t = TEX[kind];
  const rnd = prng((tx * 73856093) ^ (ty * 19349663) ^ kind.length * 83492791);
  ctx.fillStyle = col(t.base);
  ctx.fillRect(x0, y0, T, T);
  if (kind === "deck" || kind === "plank") {
    const horizontal = kind === "deck";
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = col(i % 2 ? "W" : "y");
      if (horizontal) ctx.fillRect(x0, y0 + i * 4, T, 4); else ctx.fillRect(x0 + i * 4, y0, 4, T);
      ctx.fillStyle = col("w");
      if (horizontal) ctx.fillRect(x0, y0 + i * 4 + 3, T, 1); else ctx.fillRect(x0 + i * 4 + 3, y0, 1, T);
      ctx.fillStyle = col("K");
      if (horizontal) ctx.fillRect(x0 + ((tx + i) % 2 ? 2 : 11), y0 + i * 4 + 1, 1, 1); else ctx.fillRect(x0 + i * 4 + 1, y0 + ((ty + i) % 2 ? 3 : 12), 1, 1);
    }
    return;
  }
  if (kind === "stone") {
    // cobblestone: rounded blocks with dark mortar
    ctx.fillStyle = col("x");
    for (let i = 0; i < T; i += 5) ctx.fillRect(x0, y0 + i, T, 1);
    for (let r = 0; r < 4; r++) for (let c = (r % 2) * 3; c < T; c += 6) ctx.fillRect(x0 + c, y0 + r * 5, 1, 5);
  }
  for (const [c, density] of t.spots) {
    ctx.fillStyle = col(c);
    for (let i = 0; i < T * T * density; i++) {
      const px = Math.floor(rnd() * T), py = Math.floor(rnd() * T);
      ctx.fillRect(x0 + px, y0 + py, rnd() < 0.3 ? 2 : 1, 1);
    }
  }
}

/** Static terrain canvas (GRID.w*16 × GRID.h*16 art px). Rebuilt only when the island grows. */
export function buildTerrain(zones: Record<ZoneId, boolean>): HTMLCanvasElement {
  const g = tileGrid(zones);
  const c = document.createElement("canvas");
  c.width = GRID.w * T; c.height = GRID.h * T;
  const ctx = c.getContext("2d")!;
  for (let ty = 0; ty < GRID.h; ty++) for (let tx = 0; tx < GRID.w; tx++) paintTile(ctx, tileAt(g, tx, ty), tx, ty);
  // Edges: cliff faces under land, foam around shores, grass tufts over sand.
  for (let ty = 0; ty < GRID.h; ty++) for (let tx = 0; tx < GRID.w; tx++) {
    const k = tileAt(g, tx, ty);
    const x0 = tx * T, y0 = ty * T;
    const rnd = prng(tx * 997 + ty * 131 + 7);
    if (!LAND.has(k)) {
      // foam where water meets land
      ctx.fillStyle = col("C");
      const n = tileAt(g, tx, ty - 1), s = tileAt(g, tx, ty + 1), w = tileAt(g, tx - 1, ty), e = tileAt(g, tx + 1, ty);
      if (LAND.has(n) && n !== "plank") { // cliff face drawn into the water tile below land
        ctx.fillStyle = col(TEX[n].side ?? "w"); ctx.fillRect(x0, y0, T, 4);
        ctx.fillStyle = col("k"); ctx.fillRect(x0, y0 + 4, T, 1);
        ctx.fillStyle = col("C");
        for (let i = 0; i < T; i += 2) if (rnd() < 0.7) ctx.fillRect(x0 + i, y0 + 5 + (rnd() < 0.5 ? 1 : 0), 2, 1);
      }
      if (LAND.has(s) && s !== "plank") for (let i = 0; i < T; i += 2) if (rnd() < 0.7) ctx.fillRect(x0 + i, y0 + T - 2, 2, 1);
      if (LAND.has(w) && w !== "plank") for (let i = 0; i < T; i += 2) if (rnd() < 0.7) ctx.fillRect(x0 + 1, y0 + i, 1, 2);
      if (LAND.has(e) && e !== "plank") for (let i = 0; i < T; i += 2) if (rnd() < 0.7) ctx.fillRect(x0 + T - 2, y0 + i, 1, 2);
      if (k === "plank") continue;
      continue;
    }
    if (k === "plank") {
      // posts under the boardwalk where it crosses water
      if (!LAND.has(tileAt(g, tx, ty + 1))) { ctx.fillStyle = col("w"); ctx.fillRect(x0 + 2, y0 + T, 2, 3); ctx.fillRect(x0 + 12, y0 + T, 2, 3); }
      continue;
    }
    // soft transitions: grass tufts spilling onto sand/path neighbours
    if (k === "grass" || k === "meadow") {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nk = tileAt(g, tx + dx, ty + dy);
        if (nk !== "sand" && nk !== "path") continue;
        ctx.fillStyle = col(k === "grass" ? "G" : "h");
        for (let i = 0; i < T; i += 3) {
          const off = Math.floor(rnd() * 2) + 1;
          if (dy === 1) ctx.fillRect(x0 + i, y0 + T, 2, off);
          if (dy === -1) ctx.fillRect(x0 + i, y0 - off, 2, off);
          if (dx === 1) ctx.fillRect(x0 + T, y0 + i, off, 2);
          if (dx === -1) ctx.fillRect(x0 - off, y0 + i, off, 2);
        }
      }
    }
  }
  return c;
}

/** Animated water glints drawn per frame (cheap: only visible tiles). */
export function drawWaterGlints(ctx: CanvasRenderingContext2D, zones: Record<ZoneId, boolean>, camX: number, camY: number, vw: number, vh: number, t: number) {
  const g = tileGrid(zones);
  const tx0 = Math.max(0, Math.floor(camX / T)), ty0 = Math.max(0, Math.floor(camY / T));
  const tx1 = Math.min(GRID.w - 1, Math.floor((camX + vw) / T)), ty1 = Math.min(GRID.h - 1, Math.floor((camY + vh) / T));
  const phase = Math.floor(t * 2);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const k = tileAt(g, tx, ty);
    if (LAND.has(k)) continue;
    const h = ((tx * 31 + ty * 17 + phase) % 7);
    if (h > 1) continue;
    const x = tx * T + ((tx * 5 + phase * 3) % 12) + 2 - camX, y = ty * T + ((ty * 7 + phase) % 11) + 3 - camY;
    ctx.fillStyle = k === "deep" ? "rgba(214,243,255,.35)" : "rgba(214,243,255,.6)";
    ctx.fillRect(x, y, 3, 1);
    ctx.fillRect(x + 1, y - 1, 1, 1);
  }
}

/** A tileable pixel-water pattern (data URL) for DOM backgrounds, pre-scaled ×3. */
let waterUrl = "";
export function waterPattern() {
  if (waterUrl) return waterUrl;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  paintTile(ctx, "deep", 0, 0); paintTile(ctx, "deep", 1, 0); paintTile(ctx, "deep", 0, 1); paintTile(ctx, "deep", 1, 1);
  ctx.fillStyle = "rgba(214,243,255,.5)"; ctx.fillRect(5, 7, 3, 1); ctx.fillRect(21, 24, 3, 1); ctx.fillRect(22, 23, 1, 1); ctx.fillRect(6, 6, 1, 1);
  const big = document.createElement("canvas");
  big.width = big.height = 96;
  const b = big.getContext("2d")!;
  b.imageSmoothingEnabled = false;
  b.drawImage(c, 0, 0, 96, 96);
  waterUrl = big.toDataURL();
  return waterUrl;
}
