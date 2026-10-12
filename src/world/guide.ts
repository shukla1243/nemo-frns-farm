import { ACT_ONE_LEN, ACT_TWO_LEN, chapterAt } from "../engine/story";
import { HOMES, type ZoneId } from "../engine/config";
import type { GameState } from "../engine/types";
import { STATIONS, UNLOCK_SIGNS, type Station, type StationId } from "./map";

/** Where each story chapter happens, so the world can point new players at their next goal. */
const ACT_ONE_AT: StationId[] = ["chop", "farm", "dock", "unlock:cove", "home", "pool", "shrine", "mines", "harbor", "abyss", "forge", "home", "reef", "shrine", "home"];
const ACT_TWO_AT: StationId[] = ["dock", "dock", "forge", "abyss", "home", "farm", "harbor", "reef", "market", "home", "forge", "shrine"];
const ETERNAL_AT: StationId[] = ["dock", "farm", "harbor", "reef", "shrine", "shrine", "mines", "shrine"];

function chapterStation(i: number): StationId {
  if (i < ACT_ONE_LEN) return ACT_ONE_AT[i];
  if (i < ACT_ONE_LEN + ACT_TWO_LEN) return ACT_TWO_AT[i - ACT_ONE_LEN];
  return ETERNAL_AT[(i - ACT_ONE_LEN - ACT_TWO_LEN) % ETERNAL_AT.length];
}

/** A home chapter sends the player to gather the wood and stone the next home still needs, then to Home. */
function buildStep(s: GameState, id: StationId): StationId {
  const next = HOMES[s.home + 1];
  if (id !== "home" || !next) return id;
  const items = next.cost.items ?? {};
  if (s.inv.wood < (items.wood ?? 0)) return "chop";
  if (s.inv.stone < (items.stone ?? 0)) return "quarry";
  return id;
}

/** A station, or its region's unlock sign while that region is locked. */
function reachable(s: GameState, id: StationId): Station | null {
  const st = STATIONS.find(x => x.id === id);
  if (!st) return UNLOCK_SIGNS.find(x => x.id === id && !s.zones[x.id.slice(7) as ZoneId]) ?? null;
  if (s.zones[st.zone]) return st;
  return UNLOCK_SIGNS.find(x => x.id === `unlock:${st.zone}`) ?? null;
}

export type Guide =
  | { kind: "goal"; station: Station }
  | { kind: "claim" }
  | { kind: "voyage"; station: Station; endsAt: number };

/**
 * What the guide shows right now: claim a finished chapter, wait for (or collect) a voyage, or walk to
 * the next goal. It never goes blank, so a new player always has a next step.
 */
export function guide(s: GameState): Guide {
  if (chapterAt(s.story).done(s)) return { kind: "claim" };
  if (s.voyage) return { kind: "voyage", station: STATIONS.find(x => x.id === "pier")!, endsAt: s.voyage.endsAt };
  const st = reachable(s, buildStep(s, chapterStation(s.story)));
  return { kind: "goal", station: st ?? STATIONS[0] }; // STATIONS[0] is Home
}
