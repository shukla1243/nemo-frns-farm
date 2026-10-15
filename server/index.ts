/** NEMO FRNS FARM server rules: the island lives in this Friend's records and the engine runs here. */
import { check, defineGame, GameError, type Json, type JsonInput } from "@rarefriends/friendsdk/server";
import type { GameEvent, GameState } from "../src/engine";
import { newGame, readGame, readPrefs, saveGame, savePrefs, step, type Prefs } from "./state";
import { parseAction } from "./validate";

/** Time away after which the client shows the welcome-back report. */
const AWAY_MS = 120_000;

type View = Readonly<{ view: GameState; now: number }>;
export type LoadResult = View & Readonly<{ prefs: Prefs; events: readonly GameEvent[]; welcome: "new" | null; since: number | null }>;
export type ActResult = View & Readonly<{ ok: boolean; events: readonly GameEvent[]; data: Readonly<Record<string, JsonInput>> | null }>;
export type SyncResult = View & Readonly<{ events: readonly GameEvent[] }>;
export type PrefsResult = Readonly<{ prefs: Prefs }>;
export type { Prefs };

const noInput = (input: Json) => { if (input !== null) check.object(input, []); };

export default defineGame({
  calls: {
    load(ctx): LoadResult {
      const prefs = readPrefs(ctx);
      const prev = readGame(ctx);
      if (!prev) {
        const game = newGame(ctx);
        saveGame(ctx, game);
        return { view: game, now: ctx.now, prefs, events: [], welcome: "new", since: null };
      }
      const r = step(ctx, prev, { type: "tick" });
      saveGame(ctx, r.state);
      return { view: r.state, now: ctx.now, prefs, events: r.events, welcome: null, since: ctx.now - prev.lastTick > AWAY_MS ? prev.lastTick : null };
    },

    act(ctx, input): ActResult {
      const { a } = check.object(input, ["a"]);
      const action = parseAction(a);
      const prev = readGame(ctx);
      if (!prev) throw new GameError("Reload the game to continue.");
      const r = step(ctx, prev, action);
      saveGame(ctx, r.state);
      return { ok: r.ok, view: r.state, now: ctx.now, events: r.events, data: (r.data ?? null) as ActResult["data"] };
    },

    sync(ctx, input): SyncResult {
      noInput(input);
      const prev = readGame(ctx);
      if (!prev) throw new GameError("Reload the game to continue.");
      const r = step(ctx, prev, { type: "tick" });
      saveGame(ctx, r.state);
      return { view: r.state, now: ctx.now, events: r.events };
    },

    prefs(ctx, input): PrefsResult {
      const fields = check.object(input, [], ["muted", "music", "reducedMotion", "inboxSeen"]);
      let prefs = readPrefs(ctx);
      if (fields.muted !== undefined) prefs = { ...prefs, muted: check.boolean(fields.muted, "muted") };
      if (fields.music !== undefined) prefs = { ...prefs, music: check.boolean(fields.music, "music") };
      if (fields.reducedMotion !== undefined) prefs = { ...prefs, reducedMotion: fields.reducedMotion === null ? null : check.boolean(fields.reducedMotion, "reducedMotion") };
      if (fields.inboxSeen !== undefined) {
        if (fields.inboxSeen !== true) throw new GameError("Invalid inboxSeen.");
        prefs = { ...prefs, inboxSeenAt: ctx.now };
      }
      savePrefs(ctx, prefs);
      return { prefs };
    },
  },
});
