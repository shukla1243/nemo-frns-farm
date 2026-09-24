import { ITEM_IDS, ZONE_ORDER, type ItemId } from "./config";
import { hashSeed } from "./rng";
import { createState, emptyStats, emptyStocks } from "./state";
import type { GameState } from "./types";

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

/** Fill any fields missing from older saves so the engine never sees undefined. */
export function migrate(raw: GameState): GameState {
  const base = createState({ friendId: raw.friendId, name: raw.name, family: raw.family, guest: raw.guest, now: raw.lastTick ?? Date.now(), seed: raw.seed ?? 1 });
  const s: GameState = { ...base, ...raw };
  s.inv = { ...base.inv, ...raw.inv };
  for (const id of ITEM_IDS) if (!Number.isFinite(s.inv[id as ItemId])) s.inv[id as ItemId] = 0;
  s.zones = { ...base.zones, ...raw.zones };
  for (const z of ZONE_ORDER) s.zones[z] = !!s.zones[z];
  s.stats = { ...emptyStats(), ...raw.stats };
  s.gear = { ...base.gear, ...raw.gear };
  s.forgePity = { ...base.forgePity, ...raw.forgePity };
  s.buffs = raw.buffs ?? {};
  s.npcGifts = raw.npcGifts ?? {};
  s.rebirths = raw.rebirths ?? 0;
  s.milestones = raw.milestones ?? {};
  s.streak = raw.streak ?? { day: 0, count: 0 };
  s.voyage = raw.voyage ?? null;
  s.stocks = { ...emptyStocks(), ...raw.stocks };
  s.relics = raw.relics ?? 0;
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
