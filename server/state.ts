/** This Friend's stored records (plan 3.2) and the one place that runs the engine on the server. */
import { GameError, type CallContext, type JsonInput } from "@rarefriends/friendsdk/server";
import { createState, dispatch, traitFor, type Action, type GameState, type Result } from "../src/engine";

type Stored = Readonly<{ schema: 3; game: GameState }>;
export type Prefs = Readonly<{ muted: boolean; music: boolean; reducedMotion: boolean | null; inboxSeenAt: number }>;

const STATE = "state";
const PREFS = "prefs";
const SEED_MAX = 0x7fffffff;
const DEFAULT_PREFS: Prefs = { muted: false, music: true, reducedMotion: null, inboxSeenAt: 0 };

const SCHEMA = 3;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** `value` over `base`, object by object: fields the stored island lacks take the new-island value. */
function withDefaults(base: unknown, value: unknown): unknown {
  if (value === undefined || value === null) return base;
  if (!isObject(base) || !isObject(value)) return value;
  const out: Record<string, unknown> = { ...value };
  for (const k of Object.keys(base)) out[k] = withDefaults(base[k], value[k]);
  return out;
}

/**
 * This Friend's island, upgraded to the current schema: an older record (or an island stored before the schema
 * field) migrates, and every missing field takes its new-island default. A newer schema is refused untouched.
 */
export function readGame(ctx: CallContext): GameState | null {
  const raw = ctx.data.get<unknown>(STATE);
  if (!isObject(raw)) return null;
  const schema = typeof raw.schema === "number" ? raw.schema : 0;
  if (schema > SCHEMA) throw new GameError("This island was saved by a newer version of the game. Reload to update.");
  const game = schema === 0 && !isObject(raw.game) ? raw : raw.game;
  if (!isObject(game)) return null;
  const base = createState({ friendId: ctx.friend.id, name: `Friend #${ctx.friend.id}`, family: ctx.friend.family.id, guest: false, now: ctx.now, seed: 1 });
  return withDefaults(base, game) as GameState;
}

/** What the client sees: the island without the server's secrets (the fish on the hook). */
export function view(game: GameState): GameState {
  if (game.run?.kind !== "fish") return game;
  const { fish: _hidden, ...run } = game.run;
  return { ...game, run: run as GameState["run"] };
}

export function saveGame(ctx: CallContext, game: GameState) {
  const stored: Stored = { schema: SCHEMA, game };
  ctx.data.set(STATE, stored as unknown as JsonInput);
}

/** A new island. The family comes from the chain (`ctx.friend.family`), never from the client. */
export function newGame(ctx: CallContext): GameState {
  return createState({
    friendId: ctx.friend.id, name: `Friend #${ctx.friend.id}`, family: ctx.friend.family.id, guest: false,
    now: ctx.now, seed: ctx.randomInt(SEED_MAX),
  });
}

/** Run one engine action at server time, with a fresh server seed and the on-chain family. */
export function step(ctx: CallContext, game: GameState, action: Action): Result {
  const family = ctx.friend.family.id;
  return dispatch({ ...game, seed: ctx.randomInt(SEED_MAX), family, trait: traitFor(family) }, action, ctx.now);
}

export function readPrefs(ctx: CallContext): Prefs {
  return { ...DEFAULT_PREFS, ...ctx.data.get<Prefs>(PREFS) };
}

export function savePrefs(ctx: CallContext, prefs: Prefs) {
  ctx.data.set(PREFS, prefs);
}
