/** Scenery, buildings and stations, all painted procedurally in the cozy palette. */
import { Painter, cached, fromMap, type Sprite } from "./pixel";

const S = (key: string, make: () => Sprite) => cached(`spr:${key}`, make);

// ---------- Nature ----------
export const palm = (v = 0) => S(`palm${v}`, () => {
  const p = new Painter(26, 34);
  const lean = v % 2 ? -1 : 1;
  for (let i = 0; i < 18; i++) {
    const x = 12 + Math.round(Math.sin(i / 7) * 2 * lean);
    p.rect(x, 33 - i, 3, 1, i % 3 === 0 ? "w" : "W").px(x + 2, 33 - i, "w");
  }
  const top = { x: 13 + Math.round(Math.sin(18 / 7) * 2 * lean), y: 14 };
  const frond = (dx: number, dy: number, len: number, c: string) => { for (let i = 0; i < len; i++) p.rect(top.x + Math.round(dx * i), top.y + Math.round(dy * i + (i * i) / 9), 3, 2, c); };
  frond(-1.2, -0.4, 9, "g"); frond(1.2, -0.4, 9, "g"); frond(-1, -1, 7, "G"); frond(1, -1, 7, "G"); frond(0.2, -1.2, 5, "h"); frond(-1.4, 0.1, 7, "G"); frond(1.4, 0.1, 7, "G");
  p.ellipse(top.x + 1, top.y + 2, 2, 1, "w").px(top.x, top.y + 2, "W");
  return p.outline().done();
});
export const bush = (v = 0) => S(`bush${v}`, () => {
  const p = new Painter(18, 13);
  p.ellipse(9, 7, 8, 5, "g").ellipse(8, 6, 6, 4, "G").ellipse(6, 4, 3, 2, "h");
  if (v % 2) { p.px(4, 7, "R").px(11, 5, "R").px(13, 8, "e"); } else { p.px(5, 8, "u").px(12, 6, "u"); }
  return p.outline().done();
});
export const flower = (c: string) => S(`flower${c}`, () => fromMap([".c.c.", "ccucc", ".cGc.", "..G..", ".GG.."], { c }));
export const rock = (v = 0) => S(`rock${v}`, () => {
  const p = new Painter(16, 12);
  p.ellipse(8, 7, 7, 4, "x").ellipse(7, 6, 6, 3, "X").ellipse(6, 5, 3, 2, "z");
  if (v % 2) p.px(10, 6, "u").px(11, 7, "c");
  return p.outline().done();
});
export const crystal = () => S("crystal", () => fromMap(["...c...", "..cCc..", "..cCB.c", ".ccCBcC", ".cCcBBc", "BBcBBBB"]));
export const shellDecor = () => S("shellDecor", () => fromMap([".MMM.", "MeMeM", "MMMMM", ".mmm."]));
export const lavaCrack = () => S("lava", () => fromMap(["L.....", ".LL...", "...LuL", "..L..L", ".L...."]));
export const bone = () => S("bone", () => fromMap(["z....z", ".zzzz.", "z....z"]));
export const coralTree = (v = 0) => S(`coralTree${v}`, () => {
  const p = new Painter(16, 16);
  const c = v % 2 ? "m" : "o", c2 = v % 2 ? "M" : "O";
  p.rect(7, 8, 2, 8, c).rect(4, 5, 2, 6, c).rect(10, 3, 2, 8, c).rect(5, 10, 3, 2, c).rect(9, 9, 2, 2, c);
  p.px(4, 5, c2).px(10, 3, c2).px(7, 8, c2).px(12, 6, c).px(13, 5, c2).px(2, 7, c).px(3, 6, c);
  return p.outline().done();
});
export const cloud = (v = 0) => S(`cloud${v}`, () => {
  const p = new Painter(40, 16);
  p.ellipse(12, 10, 9, 5, "z").ellipse(24, 8, 11, 7, "z").ellipse(32, 11, 7, 4, "z");
  p.ellipse(12, 9, 8, 4, "e").ellipse(24, 7, 10, 6, "e").ellipse(31, 10, 6, 3, "e");
  if (v) p.rect(4, 14, 32, 1, "z");
  return p.done();
});

// ---------- Homes ----------
export const home = (tier: number) => S(`home${tier}`, () => {
  switch (tier) {
    case 0: { // Clownfish-striped tent
      const p = new Painter(30, 22);
      for (let i = 0; i < 18; i++) {
        const w = Math.round(i * 1.45) + 1;
        const y = 2 + i;
        for (let x = 0; x < w * 2; x++) p.px(15 - w + x, y, Math.floor((x - w) / 3 + 10) % 2 ? "o" : "e");
      }
      p.rect(13, 12, 4, 8, "K").rect(14, 13, 2, 7, "k").line(15, 0, 15, 3, "w");
      p.rect(1, 20, 28, 2, "S");
      return p.outline().done();
    }
    case 1: { // Driftwood hut, straw roof
      const p = new Painter(32, 30);
      p.rect(5, 14, 22, 15, "W");
      for (let y = 15; y < 29; y += 3) p.rect(5, y, 22, 1, "w");
      p.roof(1, 2, 30, 13, "u", "t").rect(1, 14, 30, 1, "t");
      p.rect(14, 19, 5, 10, "K").px(17, 24, "u");
      p.rect(7, 18, 5, 4, "c").rect(7, 18, 5, 1, "e").rect(9, 18, 1, 4, "W");
      return p.outline().done();
    }
    case 2: { // Coral cottage
      const p = new Painter(36, 34);
      p.rect(4, 14, 28, 19, "M").rect(4, 14, 28, 2, "m");
      p.roof(0, 0, 36, 15, "B", "b").rect(0, 14, 36, 1, "b");
      p.rect(26, 2, 4, 8, "x").rect(26, 1, 4, 1, "X");
      p.rect(15, 21, 6, 12, "w").rect(16, 22, 4, 11, "W").px(19, 27, "u");
      p.rect(7, 19, 5, 5, "c").rect(7, 19, 5, 1, "e").rect(24, 19, 5, 5, "c").rect(24, 19, 5, 1, "e");
      p.rect(6, 24, 7, 2, "G").rect(23, 24, 7, 2, "G").px(8, 24, "R").px(26, 24, "u");
      return p.outline().done();
    }
    case 3: { // Pearl villa, two storeys
      const p = new Painter(44, 42);
      p.rect(4, 16, 36, 25, "Y").rect(4, 28, 36, 1, "y");
      p.roof(0, 2, 44, 15, "r", "l").rect(0, 16, 44, 1, "l");
      for (const x of [8, 18, 28]) { p.rect(x, 19, 6, 6, "c").rect(x, 19, 6, 1, "e").rect(x + 2, 19, 1, 6, "Y"); }
      p.rect(8, 31, 6, 6, "c").rect(30, 31, 6, 6, "c");
      p.rect(18, 30, 8, 11, "w").rect(19, 31, 6, 10, "W").px(24, 36, "u");
      p.ellipse(22, 7, 3, 3, "z").ellipse(21, 6, 1, 1, "e");
      p.rect(2, 40, 40, 2, "z");
      return p.outline().done();
    }
    default: { // Sea castle
      const p = new Painter(52, 50);
      p.rect(8, 20, 36, 29, "X");
      for (let y = 22; y < 48; y += 4) for (let x = 8 + ((y / 4) % 2) * 3; x < 44; x += 6) p.rect(x, y, 5, 1, "x");
      p.rect(0, 12, 12, 37, "X").rect(40, 12, 12, 37, "X");
      for (const x of [0, 4, 8, 40, 44, 48]) p.rect(x, 9, 3, 3, "X");
      for (let x = 8; x < 44; x += 5) p.rect(x, 17, 3, 3, "X");
      p.rect(2, 20, 3, 6, "k").rect(46, 20, 3, 6, "k");
      p.rect(20, 33, 12, 16, "w").ellipse(26, 33, 6, 4, "w").rect(21, 34, 10, 15, "K");
      p.rect(24, 24, 4, 5, "c").rect(24, 24, 4, 1, "e");
      p.line(6, 9, 6, 2, "k").rect(7, 2, 5, 3, "o").px(8, 3, "e");
      p.line(46, 9, 46, 2, "k").rect(47, 2, 5, 3, "o").px(48, 3, "e");
      p.rect(4, 48, 44, 2, "x");
      return p.outline().done();
    }
  }
});

// ---------- Stations ----------
export const market = () => S("market", () => {
  const p = new Painter(36, 30);
  p.rect(3, 16, 30, 12, "W").rect(3, 16, 30, 2, "y").rect(3, 27, 30, 1, "w");
  p.rect(4, 7, 2, 10, "w").rect(30, 7, 2, 10, "w");
  for (let x = 0; x < 36; x++) { const stripe = Math.floor(x / 4) % 2 ? "e" : "o"; p.rect(x, 3, 1, 5, stripe); p.px(x, 8 + (x % 4 === 1 ? 1 : 0), stripe); }
  p.rect(0, 2, 36, 1, "l");
  // goods
  p.ellipse(9, 14, 3, 2, "o").px(8, 13, "O").ellipse(16, 14, 2, 2, "R").ellipse(22, 14, 3, 2, "G").rect(26, 11, 4, 5, "u");
  p.rect(12, 20, 12, 5, "Y").rect(14, 22, 8, 1, "W");
  return p.outline().done();
});
export const shrine = () => S("shrine", () => {
  const p = new Painter(32, 30);
  p.rect(0, 2, 32, 3, "r").rect(2, 1, 28, 1, "r").rect(0, 5, 32, 1, "l");
  p.rect(3, 9, 26, 2, "r");
  p.rect(6, 5, 3, 24, "r").rect(23, 5, 3, 24, "r").rect(8, 5, 1, 24, "l").rect(25, 5, 1, 24, "l");
  p.rect(14, 5, 4, 4, "l").rect(15, 6, 2, 2, "u");
  p.rect(4, 28, 7, 2, "x").rect(21, 28, 7, 2, "x");
  p.ellipse(16, 24, 3, 3, "M").px(15, 23, "e").ellipse(16, 27, 5, 1, "m");
  return p.outline().done();
});
export const wheel = (frame = 0) => S(`wheel${frame}`, () => {
  const p = new Painter(32, 34);
  p.line(9, 33, 16, 16, "w").line(10, 33, 17, 16, "w").line(23, 33, 16, 16, "w").line(22, 33, 15, 16, "w");
  const cols = ["o", "e", "c", "u", "R", "G", "P", "O"];
  const cx = 16, cy = 15, r = 13;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y);
    if (d > r) continue;
    const a = (Math.atan2(y, x) + Math.PI * 2 + frame * Math.PI / 16) % (Math.PI * 2);
    p.px(cx + x, cy + y, d > r - 1.2 ? "W" : cols[Math.floor(a / (Math.PI / 4)) % 8]);
  }
  p.ellipse(cx, cy, 2, 2, "u").px(cx, cy, "k");
  p.rect(14, 0, 4, 3, "r").px(15, 3, "r").px(16, 3, "r");
  return p.outline().done();
});
export const board = () => S("board", () => {
  const p = new Painter(28, 28);
  p.rect(3, 22, 2, 6, "w").rect(23, 22, 2, 6, "w");
  p.rect(0, 2, 28, 21, "W").rect(1, 3, 26, 19, "y").rect(0, 2, 28, 1, "w");
  p.rect(3, 5, 8, 9, "Y").rect(4, 7, 6, 1, "t").rect(4, 9, 5, 1, "t").rect(4, 11, 6, 1, "t").px(7, 5, "r");
  p.rect(14, 4, 10, 7, "e").rect(15, 6, 8, 1, "X").rect(15, 8, 6, 1, "X").px(19, 4, "B");
  p.rect(13, 13, 11, 7, "Y").rect(14, 15, 9, 1, "t").rect(14, 17, 7, 1, "t").px(18, 13, "G");
  return p.outline().done();
});
export const tidePool = (frame = 0) => S(`pool${frame}`, () => {
  const p = new Painter(34, 24);
  p.ellipse(17, 14, 16, 9, "x").ellipse(17, 13, 15, 8, "X").ellipse(17, 13, 13, 6, "B").ellipse(17, 12, 11, 4, "c");
  const f = frame % 3;
  p.px(9 + f * 2, 12, "C").px(22 - f, 14, "C").px(15 + f, 10, "e");
  // fountain shell with RF / SHELL scales
  p.rect(16, 2, 2, 9, "z").ellipse(17, 2, 3, 1, "u").px(16, 1, "U");
  p.ellipse(10, 6, 3, 2, "M").ellipse(24, 6, 3, 2, "u").line(12, 5, 22, 5, "z");
  return p.outline().done();
});
export const dockShack = () => S("dock", () => {
  const p = new Painter(30, 30);
  p.rect(3, 12, 20, 14, "B").rect(3, 12, 20, 1, "b");
  for (let y = 14; y < 26; y += 3) p.rect(3, y, 20, 1, "b");
  p.roof(1, 4, 24, 9, "W", "w");
  p.rect(10, 17, 6, 9, "K").rect(5, 15, 4, 4, "C");
  // rod leaning with line
  p.line(22, 27, 29, 6, "w").line(29, 6, 29, 20, "z").px(29, 21, "R");
  p.ellipse(8, 27, 5, 2, "W").rect(4, 26, 8, 1, "y");
  return p.outline().done();
});
export const mineEntrance = () => S("mine", () => {
  const p = new Painter(38, 30);
  p.ellipse(19, 18, 18, 12, "x").ellipse(19, 17, 17, 11, "X").ellipse(15, 12, 7, 4, "z");
  p.ellipse(19, 22, 9, 8, "k").rect(10, 22, 19, 8, "k");
  p.rect(9, 13, 3, 17, "W").rect(27, 13, 3, 17, "W").rect(8, 12, 23, 3, "w");
  p.line(12, 29, 27, 29, "z").rect(20, 24, 7, 4, "x").rect(21, 23, 5, 2, "u").px(21, 28, "k").px(25, 28, "k");
  return p.outline().done();
});
export const forge = (frame = 0) => S(`forge${frame}`, () => {
  const p = new Painter(40, 34);
  // volcano cone
  for (let i = 0; i < 24; i++) { const w = 6 + i; p.rect(20 - w / 1.3, 6 + i, (w / 1.3) * 2, 1, i < 3 ? "l" : i % 5 === 0 ? "x" : "K"); }
  p.rect(16, 4, 8, 3, "L").px(18 + (frame % 3), 2, "u").px(20, 1 + (frame % 2), "L");
  p.line(18, 7, 14, 15, "L").line(22, 7, 25, 13, "L");
  // anvil
  p.rect(6, 25, 14, 3, "x").rect(8, 28, 10, 2, "x").rect(11, 30, 4, 3, "x").rect(3, 25, 4, 2, "x").rect(7, 24, 12, 1, "z");
  p.rect(26, 24, 10, 9, "l").rect(28, 26, 6, 5, "L").rect(29, 27, 4, 3, frame % 2 ? "u" : "U");
  return p.outline().done();
});
export const ship = (frame = 0) => S(`ship${frame}`, () => {
  const p = new Painter(46, 38);
  p.rect(22, 3, 2, 26, "w");
  p.rect(10, 5, 24, 14, "Y").rect(10, 5, 24, 1, "y");
  p.ellipse(22, 11, 3, 3, "k").rect(20, 15, 5, 1, "k").px(21, 10, "e").px(23, 10, "e");
  p.rect(23, 0, 6, 3, "r");
  for (let x = 0; x < 46; x++) { const d = Math.abs(x - 23) / 23; const h = Math.round(8 - d * d * 6); p.rect(x, 26 - Math.round(d * 2), 1, h + 2, x % 6 === 0 ? "w" : "W"); }
  p.rect(2, 26, 42, 1, "y").rect(8, 29, 30, 1, "w");
  for (const x of [12, 20, 28]) p.rect(x, 30, 3, 2, "k");
  p.rect(0, 35 + (frame % 2), 46, 1, "C");
  return p.outline().done();
});
export const boat = (c: string) => S(`boat${c}`, () => {
  const p = new Painter(22, 20);
  p.rect(10, 1, 1, 12, "w");
  for (let i = 0; i < 10; i++) p.rect(11, 2 + i, Math.round((10 - i) * 0.8), 1, i % 2 ? "e" : c);
  p.rect(1, 13, 20, 3, "W").rect(3, 16, 16, 2, "w").rect(1, 13, 20, 1, "y");
  return p.outline().done();
});
export const portal = (frame = 0) => S(`portal${frame}`, () => {
  const p = new Painter(36, 36);
  const cx = 18, cy = 18;
  for (let y = -16; y <= 16; y++) for (let x = -16; x <= 16; x++) {
    const d = Math.hypot(x, y);
    if (d > 16) continue;
    const a = Math.atan2(y, x) + d * 0.35 - frame * 0.5;
    const band = (Math.floor((a / (Math.PI * 2)) * 6 + 60) % 3);
    p.px(cx + x, cy + y, d > 14.5 ? "v" : d < 3 ? "k" : ["V", "p", "a"][band]);
  }
  p.px(cx - 6, cy - 5, "P").px(cx + 5, cy + 7, "P").px(cx + 8, cy - 3, "e");
  return p.outline().done();
});
export const kraken = (frame = 0) => S(`kraken${frame}`, () => {
  const p = new Painter(48, 40);
  for (let t = 0; t < 6; t++) {
    const bx = 6 + t * 7;
    for (let i = 0; i < 14; i++) {
      const x = bx + Math.round(Math.sin(i / 3 + frame * 1.3 + t) * 2);
      p.rect(x, 22 + i, 3, 1, i % 4 === 3 ? "P" : "p");
    }
  }
  p.ellipse(24, 14, 14, 13, "p").ellipse(22, 11, 10, 9, "P").ellipse(20, 7, 4, 3, "M");
  p.ellipse(18, 17, 3, 3, "e").ellipse(30, 17, 3, 3, "e").rect(18, 17, 2, 2, "k").rect(30, 17, 2, 2, "k");
  p.rect(21, 23, 7, 1, "a");
  return p.outline().done();
});
export const signpost = () => S("signpost", () => {
  const p = new Painter(20, 22);
  p.rect(9, 8, 2, 14, "w");
  p.rect(0, 1, 20, 9, "W").rect(1, 2, 18, 7, "y").rect(0, 1, 20, 1, "w");
  p.rect(7, 4, 6, 4, "u").rect(8, 2, 4, 3, "X").rect(9, 3, 2, 2, "y").px(9, 5, "k").px(10, 5, "k");
  return p.outline().done();
});

// ---------- Farm ----------
export const soil = (wet = false) => S(`soil${wet}`, () => {
  const p = new Painter(16, 16);
  p.rect(0, 0, 16, 16, wet ? "K" : "w");
  for (let y = 2; y < 16; y += 4) p.rect(1, y, 14, 1, wet ? "k" : "K");
  p.px(3, 1, "W").px(11, 5, "W").px(6, 9, "W").px(13, 13, "W");
  return p.done();
});
const CROP_COLORS: Record<string, [string, string]> = { kelp: ["G", "h"], carrot: ["o", "O"], berry: ["p", "B"], pumpkin: ["o", "u"] };
export const crop = (kind: string, stage: 0 | 1 | 2 | 3) => S(`crop${kind}${stage}`, () => {
  const [c1, c2] = CROP_COLORS[kind] ?? ["G", "h"];
  if (stage === 3) return fromMap(["..k.k..", ".kRkRk.", "..kkk..", "...k...", "..kk..."], { k: "t", R: "l" });
  if (stage === 0) return fromMap(["..h.", ".hG.", "..G."]);
  if (stage === 1) return fromMap(["h..h.", ".hGh.", "..Gh.", "..G.."]);
  if (kind === "kelp") return fromMap(["h.h.h", "GhGhG", ".GGG.", "..G..", ".GgG."]);
  if (kind === "carrot") return fromMap(["h.G.h", ".hGh.", "..G..", ".aOa.", "..a.."], { a: c1, O: c2 });
  if (kind === "berry") return fromMap([".GGG.", "GaGbG", "GGaGG", ".GbG.", "..G.."], { a: c1, b: c2 });
  return fromMap(["..G..", ".GhG.", "aaOaa", "aOaaa", ".aaa."], { a: c1, O: c2 });
});

// ---------- Work spots ----------
export const scarecrow = () => S("scarecrow", () => {
  const p = new Painter(22, 30);
  p.rect(10, 8, 2, 22, "w").rect(2, 12, 18, 2, "w");
  p.rect(6, 12, 10, 10, "o").rect(6, 15, 10, 2, "e").rect(6, 19, 10, 1, "e");
  p.ellipse(11, 6, 4, 4, "Y").px(9, 5, "k").px(12, 5, "k").rect(10, 8, 3, 1, "l");
  p.rect(5, 1, 12, 2, "u").rect(7, -1, 8, 3, "u").rect(5, 3, 12, 1, "t");
  p.px(1, 12, "h").px(20, 12, "h").px(1, 13, "u").px(20, 13, "u");
  return p.outline().done();
});
export const stonePile = () => S("stonePile", () => {
  const p = new Painter(30, 22);
  p.ellipse(9, 15, 8, 6, "x").ellipse(8, 14, 7, 5, "X").ellipse(6, 12, 3, 2, "z");
  p.ellipse(20, 16, 9, 5, "x").ellipse(19, 15, 8, 4, "X").ellipse(17, 13, 3, 2, "z").px(22, 15, "u").px(12, 15, "c");
  p.line(18, 2, 25, 11, "w").line(19, 2, 26, 11, "W").rect(14, 1, 9, 2, "z").px(13, 2, "z").px(23, 2, "z");
  return p.outline().done();
});
export const woodPile = () => S("woodPile", () => {
  const p = new Painter(30, 22);
  for (const [x, y] of [[2, 14], [11, 14], [20, 14], [6, 9], [15, 9], [10, 4]]) {
    p.rect(x, y, 9, 6, "W").rect(x, y, 9, 1, "y").rect(x, y + 5, 9, 1, "w").ellipse(x + 8, y + 3, 1, 2, "y").px(x + 8, y + 3, "K");
  }
  p.line(24, 2, 27, 12, "w").rect(22, 1, 5, 4, "z").px(21, 2, "z");
  return p.outline().done();
});

/** Voyage Pier: planks on posts with a moored sailboat (the boat is gone while your Friend is at sea). */
export const voyagePier = (away: boolean) => S(`pier${away}`, () => {
  const p = new Painter(40, 30);
  p.rect(2, 20, 36, 5, "W").rect(2, 20, 36, 1, "y");
  for (let x = 4; x < 38; x += 6) p.rect(x, 25, 2, 5, "w");
  if (!away) p.draw(boat("o"), 18, 1);
  else p.rect(6, 17, 2, 3, "w").rect(6, 16, 5, 1, "u");
  return p.outline().done();
});

// ---------- Title hats (cosmetic progression worn by your Friend) ----------
const HATS: readonly (readonly string[])[] = [
  [".....uu.....", "...uUUUUu...", "..uuuuuuuu..", "uuutttttttuu"],            // Hatchling: straw hat
  ["....oooo....", "..oOeoOeoo..", "..oooooooooo"],                             // Reef Scout: clownfish bandana
  ["...bbbbbb...", "..bbeuubbbb.", ".bbbbbbbbbb.", "kkkkkkkkkkkk"],             // Tide Runner: captain's hat
  ["m...M...m...", "mm.mMm.mm...", "mmmmmmmmm...", ".MMMMMMM...."],             // Coral Knight: coral crown
  ["...VVVVVV...", "..VPPPPPPV..", ".VVPkkkkPVV.", ".VVVVVVVVVV."],             // Abyss Walker: abyss helm
  ["u..u..u..u..", "uu.uu.uu.uu.", "uuuuuuuuuuu.", "uRuuBuuRuuu."],             // Ocean Legend: gold crown
];
export const hat = (tier: number) => S(`hat${tier}`, () => {
  const rows = HATS[Math.max(0, Math.min(HATS.length - 1, tier))];
  const p = new Painter(14, rows.length + 2);
  p.draw(fromMap(rows as string[]), 1, 1);
  return p.outline().done();
});
