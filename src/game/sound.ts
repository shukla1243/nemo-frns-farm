/** Game sound effects: the game's own procedural cue kit (src/game/soundkit.ts). */
import { createSoundKit, type SoundKit } from "./soundkit";
import type { SoundCue } from "../engine/types";

let kit: SoundKit | null = null;
let muted = false;
let paused = false;

function get() {
  if (!kit) kit = createSoundKit({ muted, volume: 0.6 });
  return kit;
}
export const sound = {
  play(cue: SoundCue) { if (paused) return; void get().unlock(); get().play(cue); },
  unlock() { void get().unlock(); },
  setMuted(v: boolean) {
    muted = v;
    get().setMuted(v);
  },
  /** No cues while the host pauses the game or the tab is hidden. */
  setPaused(v: boolean) {
    paused = v;
    if (v) get().stop();
  },
};
