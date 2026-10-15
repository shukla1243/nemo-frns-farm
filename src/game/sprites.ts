/** The player's canonical Rare Friends artwork, supplied by the host as `game.art`. */
import { drawFrame, spriteFrame, type Facing, type FriendArt } from "@rarefriends/friendsdk";

/**
 * Draw the canonical 16x16 one-bit Friend (black ink, unchanged) anchored at its feet (x, y), with a
 * 1-pixel rim so it reads on any ground. Returns the head position so cosmetics (hats) can sit on it.
 */
export function drawFriend(
  ctx: CanvasRenderingContext2D, art: FriendArt, x: number, y: number, scale: number,
  facing: Facing = "down", walking = false, frame = 0, side: "left" | "right" = "right", rim = "#ffffff",
) {
  const rows = spriteFrame(art, facing, walking, frame % 8, side);
  const px = Math.max(1, Math.round(scale));
  const left = Math.round(x - 8 * px), top = Math.round(y - 15 * px);
  ctx.fillStyle = rim;
  rows.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === "#") ctx.fillRect(left + rx * px - 1, top + ry * px - 1, px + 2, px + 2); }));
  drawFrame(ctx, rows, left, top, px, "#101010");
  const headRow = rows.findIndex(r => r.includes("#"));
  const cols = [...(rows[headRow] ?? "")].map((c, i) => (c === "#" ? i : -1)).filter(i => i >= 0);
  const mid = cols.length ? (cols[0] + cols[cols.length - 1] + 1) / 2 : 8;
  return { headX: left + mid * px, headY: top + Math.max(0, headRow) * px };
}

/** A static portrait canvas data URL for the HUD. */
export function portrait(art: FriendArt, size = 64, bg = "#ffe3c4"): string {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
  const scale = Math.floor(size / 20);
  drawFriend(ctx, art, size / 2, size / 2 + 8 * scale - 1, scale);
  return c.toDataURL();
}
