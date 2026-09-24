/** Canonical Rare Friends artwork via FriendSDK (public on-chain reads, cached). */
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";

const reader = createFriendReader();
const cache = new Map<string, Promise<GenerationSprites>>();

export function loadSprites(friendId: string): Promise<GenerationSprites> {
  let p = cache.get(friendId);
  if (!p) {
    p = reader.read(BigInt(friendId));
    p.catch(() => cache.delete(friendId));
    cache.set(friendId, p);
  }
  return p;
}

export type { GenerationSprites, SpriteFacing };

/**
 * Draw the canonical 16×16 one-bit Friend (black ink, unchanged) anchored at its feet (x, y), with a
 * 1-pixel rim so it reads on any ground. Returns the head position so cosmetics (hats) can sit on it.
 */
export function drawFriend(
  ctx: CanvasRenderingContext2D, sprites: GenerationSprites, x: number, y: number, scale: number,
  facing: SpriteFacing = "down", walking = false, frame = 0, side: "left" | "right" = "right", rim = "#ffffff",
) {
  const rows = spriteFrame(sprites, facing, walking, frame % 8, side).frame.rows;
  const px = Math.max(1, Math.round(scale));
  const left = Math.round(x - 8 * px), top = Math.round(y - 15 * px);
  ctx.fillStyle = rim;
  rows.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === "#") ctx.fillRect(left + rx * px - 1, top + ry * px - 1, px + 2, px + 2); }));
  ctx.fillStyle = "#101010";
  rows.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === "#") ctx.fillRect(left + rx * px, top + ry * px, px, px); }));
  const headRow = rows.findIndex(r => r.includes("#"));
  const cols = [...(rows[headRow] ?? "")].map((c, i) => (c === "#" ? i : -1)).filter(i => i >= 0);
  const mid = cols.length ? (cols[0] + cols[cols.length - 1] + 1) / 2 : 8;
  return { headX: left + mid * px, headY: top + Math.max(0, headRow) * px };
}

/** A static portrait canvas data URL for HUD/cards. */
export function portrait(sprites: GenerationSprites, size = 64, bg = "#ffe3c4"): string {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
  const scale = Math.floor(size / 20);
  drawFriend(ctx, sprites, size / 2, size / 2 + 8 * scale - 1, scale);
  return c.toDataURL();
}
