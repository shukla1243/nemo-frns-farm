/** This Friend's stored records (plan 3.2) and the one place that runs the engine on the server. */
import type { CallContext, JsonInput } from "@rarefriends/friendsdk/server";
import { createState, dispatch, traitFor, type Action, type GameState, type Result } from "../src/engine";

type Stored = Readonly<{ schema: 3; game: GameState }>;
export type Prefs = Readonly<{ muted: boolean; music: boolean; reducedMotion: boolean | null; inboxSeenAt: number }>;

const STATE = "state";
const PREFS = "prefs";
const SEED_MAX = 0x7fffffff;
const DEFAULT_PREFS: Prefs = { muted: false, music: true, reducedMotion: null, inboxSeenAt: 0 };

export function readGame(ctx: CallContext): GameState | null {
  return ctx.data.get<Stored>(STATE)?.game ?? null;
}

export function saveGame(ctx: CallContext, game: GameState) {
  const stored: Stored = { schema: 3, game };
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
