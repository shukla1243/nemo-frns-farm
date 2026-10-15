/**
 * Input checks for server calls. The client sends intents only: an engine action by name with its own
 * fields. Every action has an allowlist of fields; the engine then checks each value (`checkPayload`).
 */
import { check, GameError, type Json } from "@rarefriends/friendsdk/server";
import type { Action } from "../src/engine";

type Fields = Readonly<{ required?: readonly string[]; optional?: readonly string[] }>;

/** Every action a player may send, with its fields. `tick` is internal: time moves only on the server. */
const ACTIONS: Readonly<Record<Exclude<Action["type"], "tick">, Fields>> = {
  eat: { required: ["item"] }, drink: {}, sleep: {}, wake: {}, buildHome: {},
  buy: { required: ["item"], optional: ["qty"] }, sell: { required: ["item"], optional: ["qty"] },
  plant: { required: ["plot", "crop"] }, harvest: { required: ["plot"] }, clearPlot: { required: ["plot"] }, buyPlot: {},
  gather: { required: ["kind"] }, cook: { required: ["meal"] }, unlockZone: { required: ["zone"] },
  ascend: { optional: ["blessing", "charm"] }, forge: { required: ["gear"], optional: ["blessing", "charm"] },
  diveStart: { required: ["stake"] }, diveCashout: {},
  minesStart: { required: ["stake", "traps"] }, minesReveal: { required: ["index"] }, minesCashout: {},
  fishCast: {}, fishReel: { required: ["hit"] },
  crabStart: {}, crabFinish: { required: ["score"] }, crabQuit: {},
  flip: {}, keepWin: {}, raid: { required: ["rivalId"] }, bossAttack: {}, bossClaim: {},
  spin: { required: ["free"] }, claimQuest: { required: ["id"] }, passClaim: {}, forage: {}, storyClaim: {},
  npcGift: { required: ["npc"] }, rebirth: {},
  voyageStart: { required: ["id"] }, voyageClaim: {}, voyageRecall: {},
  sellStock: { required: ["id", "shares"] },
};

/** The `a` field of an `act` call as an engine action with only its own fields. */
export function parseAction(input: Json | undefined): Action {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new GameError("Invalid request.");
  const type = input.type;
  if (typeof type !== "string" || !Object.prototype.hasOwnProperty.call(ACTIONS, type)) throw new GameError("Invalid request.");
  const fields = ACTIONS[type as keyof typeof ACTIONS];
  check.object(input, ["type", ...(fields.required ?? [])], fields.optional ?? [], "Invalid request.");
  if (type === "spin" && input.free !== true) throw new GameError("Invalid request.");
  return input as unknown as Action;
}
