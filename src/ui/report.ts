import type { CropId } from "../engine/config";
import type { GameState } from "../engine/types";

type Where = { kind: "home" } | { kind: "voyage"; endsAt: number } | { kind: "back" };

/** What the Welcome back panel reports: where the Friend is and the state of the farm. */
export function welcomeBack(s: GameState, now: number) {
  const friend: Where = !s.voyage ? { kind: "home" } : now < s.voyage.endsAt ? { kind: "voyage", endsAt: s.voyage.endsAt } : { kind: "back" };
  const ripe: { crop: CropId; count: number }[] = [];
  let growing = 0, nextReadyAt: number | null = null;
  for (const p of s.plots) {
    if (!p.crop || p.withered) continue;
    if (p.readyAt <= now) {
      const row = ripe.find(r => r.crop === p.crop);
      if (row) row.count++; else ripe.push({ crop: p.crop, count: 1 });
    } else {
      growing++;
      nextReadyAt = Math.min(nextReadyAt ?? Infinity, p.readyAt);
    }
  }
  return { friend, ripe, growing, nextReadyAt };
}
