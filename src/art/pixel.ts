/**
 * Tiny pixel-art engine. Every sprite in NEMO FRNS FARM is authored here in code:
 * string pixel maps for icons, and a painter for larger scenery. No emoji, no external art.
 */

/** Cozy 32-colour palette built around the clownfish orange. One char per colour for pixel maps. */
const PAL: Record<string, string> = {
  k: "#2b1d1a", // outline
  K: "#4a3226", // dark brown
  w: "#6e4630", // wood dark
  W: "#a0673d", // wood
  y: "#d19a61", // wood light
  Y: "#f4dcae", // parchment
  s: "#e8c88a", // sand
  S: "#c49a5c", // sand dark
  g: "#2f6b3a", // grass dark
  G: "#4f9a48", // grass
  h: "#86c95e", // grass light
  H: "#c3e88a", // leaf highlight
  b: "#24507a", // deep blue
  B: "#3a86c2", // blue
  c: "#6cc6e6", // cyan
  C: "#d6f3ff", // foam
  o: "#ee6f22", // clownfish orange
  O: "#ffa54f", // orange light
  r: "#c0303a", // red
  R: "#ff6f73", // pink red
  p: "#6b4396", // purple
  P: "#b48ae0", // lilac
  x: "#4e5361", // stone dark
  X: "#838a99", // stone
  z: "#c2c7d1", // stone light
  e: "#ffffff", // white
  n: "#1a1a26", // ink
  u: "#f5c542", // gold
  U: "#fff1a8", // gold light
  m: "#d8627e", // coral
  M: "#f6a9bb", // coral light
  v: "#261f45", // abyss dark
  V: "#473b75", // abyss
  l: "#8e3a1e", // rust
  L: "#ff8a3d", // lava
  t: "#8a6a3a", // khaki
  a: "#5a3a8a", // violet shadow
};
export const col = (c: string) => (c.length === 1 ? PAL[c] ?? c : c);

export type Sprite = HTMLCanvasElement;
const cache = new Map<string, Sprite>();
export function cached(key: string, make: () => Sprite): Sprite {
  let s = cache.get(key);
  if (!s) { s = make(); cache.set(key, s); }
  return s;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

/** Build a sprite from rows of palette chars ('.' = transparent). `swap` recolours chars. */
export function fromMap(rows: readonly string[], swap: Record<string, string> = {}): Sprite {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = canvas(w, h);
  const ctx = c.getContext("2d")!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = swap[row[x]] ?? row[x];
      if (ch === "." || ch === " ") continue;
      ctx.fillStyle = col(ch);
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

/** Procedural painter for larger sprites. All coordinates are integer art pixels. */
export class Painter {
  readonly c: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  constructor(readonly w: number, readonly h: number) {
    this.c = canvas(w, h);
    this.ctx = this.c.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
  }
  px(x: number, y: number, c: string) { this.ctx.fillStyle = col(c); this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1); return this; }
  rect(x: number, y: number, w: number, h: number, c: string) { this.ctx.fillStyle = col(c); this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); return this; }
  /** Filled pixel ellipse (midpoint style, crisp edges). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    this.ctx.fillStyle = col(c);
    for (let y = -ry; y <= ry; y++) {
      const span = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.25))));
      this.ctx.fillRect(Math.round(cx - span), Math.round(cy + y), span * 2 + 1, 1);
    }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return this;
  }
  /** Stepped gable roof: a triangle-ish trapezoid built from rows. */
  roof(x: number, y: number, w: number, h: number, c: string, shade?: string) {
    for (let i = 0; i < h; i++) {
      const inset = Math.round(((h - 1 - i) / Math.max(1, h - 1)) * (w / 2 - 2));
      this.rect(x + inset, y + i, w - inset * 2, 1, c);
      if (shade && i % 3 === 2) this.rect(x + inset + 1, y + i, w - inset * 2 - 2, 1, shade);
    }
    return this;
  }
  draw(s: Sprite, x: number, y: number) { this.ctx.drawImage(s, Math.round(x), Math.round(y)); return this; }
  /** Add a 1px outline around all opaque pixels (outside only). */
  outline(c = "k") {
    const { w, h } = this;
    const img = this.ctx.getImageData(0, 0, w, h), d = img.data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const marks: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push(x, y);
    }
    this.ctx.fillStyle = col(c);
    for (let i = 0; i < marks.length; i += 2) this.ctx.fillRect(marks[i], marks[i + 1], 1, 1);
    return this;
  }
  done(): Sprite { return this.c; }
}

/** Scale a sprite up by an integer factor (for crisp DOM icons). */
export function scaled(s: Sprite, k: number): Sprite {
  const c = canvas(s.width * k, s.height * k);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s, 0, 0, c.width, c.height);
  return c;
}

const urlCache = new Map<string, string>();
export function dataUrl(key: string, s: Sprite, k = 4) {
  let u = urlCache.get(key);
  if (!u) { u = scaled(s, k).toDataURL(); urlCache.set(key, u); }
  return u;
}

/** Deterministic tiny RNG for textures. */
export function prng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
