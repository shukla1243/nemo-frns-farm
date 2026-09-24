import { describe, expect, it } from "vitest";
import { GRID, LAND, SPAWN, STATIONS, TILE, UNLOCK_SIGNS, activeStations, plotPos, tileAt, tileGrid, walkable } from "../src/world/map";
import { ZONE_ORDER, MAX_PLOTS, type ZoneId } from "../src/engine/config";

const zonesWith = (all: boolean) => Object.fromEntries(ZONE_ORDER.map(z => [z, all || z === "beach" || z === "grove"])) as Record<ZoneId, boolean>;

function reachable(zones: Record<ZoneId, boolean>) {
  const g = tileGrid(zones);
  const seen = new Set<number>();
  const start = Math.floor(SPAWN.y / TILE) * GRID.w + Math.floor(SPAWN.x / TILE);
  const queue = [start];
  seen.add(start);
  while (queue.length) {
    const i = queue.pop()!;
    const tx = i % GRID.w, ty = Math.floor(i / GRID.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx, ny = ty + dy, ni = ny * GRID.w + nx;
      if (nx < 0 || ny < 0 || nx >= GRID.w || ny >= GRID.h || seen.has(ni) || !LAND.has(tileAt(g, nx, ny))) continue;
      seen.add(ni); queue.push(ni);
    }
  }
  return (x: number, y: number) => seen.has(Math.floor(y / TILE) * GRID.w + Math.floor(x / TILE));
}

describe("world map", () => {
  it("spawn is walkable", () => {
    expect(walkable(SPAWN, zonesWith(false))).toBe(true);
  });
  for (const all of [false, true]) {
    it(`every active station and its approach point is reachable land (${all ? "all zones" : "start"})`, () => {
      const zones = zonesWith(all);
      const can = reachable(zones);
      for (const st of activeStations(zones)) {
        expect(can(st.x, st.y + 34), `${st.id} approach`).toBe(true);
      }
    });
  }
  it("all farm plots sit on beach land", () => {
    const g = tileGrid(zonesWith(false));
    for (let i = 0; i < MAX_PLOTS; i++) {
      const p = plotPos(i);
      expect(LAND.has(tileAt(g, Math.floor(p.x / TILE), Math.floor(p.y / TILE))), `plot ${i}`).toBe(true);
    }
  });
  it("locked zones are water until unlocked", () => {
    const g = tileGrid(zonesWith(false));
    const reef = STATIONS.find(s => s.id === "reef")!;
    expect(LAND.has(tileAt(g, Math.floor(reef.x / TILE), Math.floor(reef.y / TILE)))).toBe(false);
    expect(UNLOCK_SIGNS.length).toBe(7);
  });
});
