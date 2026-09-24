/** FriendSDK sound kit (ten synthesized cues, no audio files). */
import { createFriendSoundKit, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import type { SoundCue } from "../engine/types";

let kit: FriendSoundKit | null = null;
let muted = (() => { try { return localStorage.getItem("nemo-frns-farm:muted") === "1"; } catch { return false; } })();

function get() {
  if (!kit) kit = createFriendSoundKit({ muted, volume: 0.6 });
  return kit;
}
export const sound = {
  play(cue: SoundCue) { try { void get().unlock(); get().play(cue); } catch { /* audio unsupported */ } },
  unlock() { try { void get().unlock(); } catch { /* ignore */ } },
  get muted() { return muted; },
  setMuted(v: boolean) {
    muted = v;
    try { localStorage.setItem("nemo-frns-farm:muted", v ? "1" : "0"); } catch { /* ignore */ }
    try { get().setMuted(v); } catch { /* ignore */ }
  },
};
