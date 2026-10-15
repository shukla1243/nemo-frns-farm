import { ZONE_ORDER } from "../engine/config";
import { hashSeed } from "../engine/rng";
import { createState, emptyStats, emptyStocks } from "../engine/state";
import { VOYAGES, voyageOdds } from "../engine/voyages";
import type { GameState } from "../engine/types";

const PREFIX = "NFF1";

function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromBase64(b64: string) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function exportSave(s: GameState): string {
  const json = JSON.stringify(s);
  const sum = hashSeed(json).toString(36);
  return `${PREFIX}.${sum}.${toBase64(json)}`;
}

/** Parse a save code. Throws a friendly error when invalid, tampered or bound to another Friend. */
export function importSave(code: string, friendId: string): GameState {
  const [prefix, sum, body] = code.trim().split(".");
  if (prefix !== PREFIX || !sum || !body) throw new Error("That isn't a NEMO FRNS FARM save code.");
  let json: string;
  try { json = fromBase64(body); } catch { throw new Error("Save code is damaged."); }
  if (hashSeed(json).toString(36) !== sum) throw new Error("Save code checksum failed (damaged or edited).");
  const parsed = JSON.parse(json) as GameState;
  if (parsed.friendId !== friendId) throw new Error(`This save belongs to Friend #${parsed.friendId}, not #${friendId}.`);
  return migrate(parsed);
}

/** Keep a saved value only when it has the field's type; numbers must be finite. */
function pick<T>(fallback: T, value: unknown): T {
  if (typeof fallback === "number") return (Number.isFinite(value) ? value : fallback) as T;
  if (fallback === null) return (value && typeof value === "object" ? value : null) as T;
  return (typeof value === typeof fallback && value !== null ? value : fallback) as T;
}
/** Copy only the fields the current state has (an allowlist), so retired fields such as rf, pool or world never return. */
function allow<T extends object>(base: T, raw: unknown): T {
  const out = { ...base };
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const k of Object.keys(base) as (keyof T & string)[]) if (Object.hasOwn(src, k)) out[k] = pick(base[k], src[k]);
  return out;
}

/** Rebuild a saved state from an allowlist of current fields, so the engine never sees undefined or retired data. */
export function migrate(raw: GameState): GameState {
  const base = createState({ friendId: raw.friendId, name: raw.name, family: raw.family, guest: raw.guest, now: raw.lastTick ?? Date.now(), seed: raw.seed ?? 1 });
  const s: GameState = allow(base, raw);
  s.inv = allow(base.inv, raw.inv);
  s.zones = { ...base.zones };
  for (const z of ZONE_ORDER) s.zones[z] = !!raw.zones?.[z] || base.zones[z];
  s.stats = allow(emptyStats(), raw.stats);
  s.stats.earnedBy = allow(emptyStats().earnedBy, raw.stats?.earnedBy);
  if (!Number.isFinite(raw.shell)) s.shell = 0; // a broken balance never falls back to the starting grant
  s.tradable = Math.min(Math.max(0, s.tradable), Math.max(0, s.shell));
  s.gear = allow(base.gear, raw.gear);
  s.forgePity = allow(base.forgePity, raw.forgePity);
  s.buffs = raw.buffs ?? {};
  s.npcGifts = raw.npcGifts ?? {};
  s.rebirths = raw.rebirths ?? 0;
  s.milestones = raw.milestones ?? {};
  s.streak = raw.streak ?? { day: 0, count: 0 };
  // Older saves stored a pre-rolled voyage result; a pending voyage now keeps only its locked odds.
  const v = raw.voyage, def = v && VOYAGES.find(x => x.id === v.id);
  s.voyage = v && def ? { id: v.id, startedAt: v.startedAt, endsAt: v.endsAt, odds: Array.isArray(v.odds) ? v.odds : voyageOdds(s, def).map(o => o.weight), tShare: 0, announced: !!v.announced } : null;
  // Tickers outside the current list (renamed companies) are dropped.
  s.stocks = allow(emptyStocks(), raw.stocks);
  s.tradableStocks = allow(emptyStocks(), raw.tradableStocks);
  s.relics = raw.relics ?? 0;
  s.season = allow(base.season, raw.season);
  s.cooldowns = {};
  if (!Number.isFinite(s.lastActive)) s.lastActive = s.lastTick;
  s.run = null; // never resume a hidden-outcome game from a save
  s.lastWin = null;
  if (!Array.isArray(s.quests) || s.quests.length === 0) s.quests = base.quests;
  if (!Array.isArray(s.rivals) || s.rivals.length === 0) s.rivals = base.rivals;
  if (!Array.isArray(s.log)) s.log = [];
  return s;
}

const key = (friendId: string, guest = false) => `nemo-frns-farm:save:${guest ? "guest-" : ""}${friendId}`;

export function saveLocal(s: GameState) {
  try { localStorage.setItem(key(s.friendId, s.guest), exportSave(s)); return true; } catch { return false; }
}
export function loadLocal(friendId: string, guest = false): GameState | null {
  try {
    const code = localStorage.getItem(key(friendId, guest));
    return code ? importSave(code, friendId) : null;
  } catch { return null; }
}
export function clearLocal(friendId: string, guest = false) {
  try { localStorage.removeItem(key(friendId, guest)); } catch { /* storage unavailable */ }
}
