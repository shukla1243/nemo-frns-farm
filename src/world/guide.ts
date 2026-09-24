import { ACT_ONE_LEN, ACT_TWO_LEN, chapterAt } from "../engine/story";
import type { ZoneId } from "../engine/config";
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

/** The station the current chapter needs, or its region's unlock sign while that region is locked. Null once the goal is met. */
export function guideTarget(s: GameState): Station | null {
  if (chapterAt(s.story).done(s)) return null;
  const st = STATIONS.find(x => x.id === chapterStation(s.story));
  if (!st) return UNLOCK_SIGNS.find(x => x.id === chapterStation(s.story) && !s.zones[x.id.slice(7) as ZoneId]) ?? null;
  if (s.zones[st.zone]) return st;
  return UNLOCK_SIGNS.find(x => x.id === `unlock:${st.zone}`) ?? null;
}
