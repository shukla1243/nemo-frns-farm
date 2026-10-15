/**
 * Procedural sound cues. No recordings, downloads or music loop.
 *
 * Adapted from the FriendSDK 0.2.3 sound kit (`src/friend-sounds.ts`, Copyright Rare Friends,
 * Apache License 2.0; see NOTICE.md). FriendSDK 1.0 ships no sound kit, so the game keeps its own
 * copy. Changes: trimmed to the parts this game uses (render, unlock, play, stop, mute).
 */
import type { SoundCue } from "../engine/types";

const SOUND_IDS: readonly SoundCue[] = ["select", "purchase", "action-start", "action-ready", "anticipation", "impact", "reveal-common", "reveal-rare", "reveal-legendary", "reward"];
const SAMPLE_RATE = 48_000;
const MAX_VOICES = 4;
const MAX_GAIN = 0.3;
const PEAK = 0.7;

type Tone = Readonly<{ kind: "tone"; at: number; midi: number; duration: number; level: number;
  endMidi?: number; chip?: number; decay?: number; attack?: number; release?: number }>;
type Tick = Readonly<{ kind: "tick"; at: number; level: number; clap?: boolean }>;
type Voice = Tone | Tick;
type CueDefinition = Readonly<{ duration: number; voices: readonly Voice[] }>;
const tone = (midi: number, duration: number, level: number, at = 0, options: Partial<Omit<Tone, "kind" | "midi" | "duration" | "level" | "at">> = {}): Tone =>
  ({ kind: "tone", at, midi, duration, level, ...options });
const tick = (at: number, level: number, clap = false): Tick => ({ kind: "tick", at, level, clap });
const sparkle = (notes: readonly number[], at = 0, level = 0.25): Tone[] => notes.map((midi, index) =>
  tone(midi, [0.09, 0.11, 0.22][index], level * [1, 0.85, 0.7][index], at + [0, 0.055, 0.12][index], { attack: 0.005, release: 0.027, chip: 0.18 }));

const definitions: Readonly<Record<SoundCue, CueDefinition>> = {
  // A short rounded chip pluck.
  select: { duration: 0.1, voices: [tone(67, 0.08, 0.22, 0, { attack: 0.003, release: 0.02 })] },
  // A C-major triplet.
  purchase: { duration: 0.36, voices: [
    tone(48, 0.18, 0.1, 0, { chip: 0.12 }),
    ...[60, 64, 67].map((midi, index) => tone(midi, [0.1, 0.11, 0.21][index], 0.26 * [1, 0.86, 0.68][index], [0, 0.065, 0.135][index], { decay: 0.65, attack: 0.005, release: 0.028, chip: 0.19 })),
  ] },
  // A rounded octave rise with a soft release tick.
  "action-start": { duration: 0.25, voices: [tone(48, 0.21, 0.23, 0, { endMidi: 60, decay: 1, chip: 0.16 }), tick(0.025, 0.09)] },
  // Two bright pickup notes.
  "action-ready": { duration: 0.27, voices: [tone(76, 0.085, 0.24, 0, { attack: 0.004, release: 0.025, chip: 0.18 }), tone(79, 0.12, 0.25, 0.115, { attack: 0.004, release: 0.03, chip: 0.18 })] },
  // Three climbing plucks and soft mechanical ticks.
  anticipation: { duration: 0.3, voices: [...sparkle([60, 64, 67]).map(voice => ({ ...voice, duration: Math.min(voice.duration, 0.14) })), tick(0, 0.08), tick(0.055, 0.07), tick(0.12, 0.06)] },
  // A rounded falling tone with filtered soft percussion.
  impact: { duration: 0.23, voices: [tone(57, 0.17, 0.14, 0, { endMidi: 40, chip: 0.12, decay: 0.55 }), tick(0, 0.25, true), tick(0.035, 0.13, true), tick(0.075, 0.08, true)] },
  // A warm landing and compact C-major sparkle.
  "reveal-common": { duration: 0.38, voices: [tone(48, 0.24, 0.17, 0, { chip: 0.12, decay: 0.65 }), ...sparkle([60, 64, 67])] },
  // A G-C-E sparkle with a held top note.
  "reveal-rare": { duration: 0.58, voices: [tone(43, 0.24, 0.15, 0, { chip: 0.12, decay: 0.65 }), ...sparkle([67, 72, 76]), tone(76, 0.37, 0.09, 0.18, { chip: 0.1, decay: 1.2, release: 0.1 })] },
  // A rise, high pickup sparkle and warm final C-major resolution.
  "reveal-legendary": { duration: 1.05, voices: [tone(48, 0.18, 0.12, 0, { endMidi: 60, chip: 0.16 }), ...sparkle([72, 76, 79], 0.13, 0.27),
    ...[36, 60, 64, 67].map((midi, index) => tone(midi, 0.65, [0.19, 0.14, 0.1, 0.08][index], 0.37, { decay: 1.4, attack: 0.016, release: 0.2, chip: 0.1 })),
  ] },
  // A C-E-G pickup sparkle.
  reward: { duration: 0.36, voices: sparkle([72, 76, 79]) },
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const triangle = (phase: number) => 4 * Math.abs(phase % 1 - 0.5) - 1;
const smooth = (amount: number) => Math.sin(Math.PI / 2 * Math.min(1, Math.max(0, amount))) ** 2;

/** Pure mono PCM. Always deterministic. */
function render(cue: SoundCue): Float32Array {
  const definition = definitions[cue];
  const output = new Float64Array(Math.round(definition.duration * SAMPLE_RATE));
  let randomState = 0x52465354 ^ (SOUND_IDS.indexOf(cue) + 1);
  const noise = () => {
    randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5;
    return (randomState >>> 0) / 0x100000000 * 2 - 1;
  };
  for (const voice of definition.voices) {
    const duration = voice.kind === "tone" ? voice.duration : voice.clap ? 0.105 : 0.037;
    const count = Math.round(duration * SAMPLE_RATE), start = Math.round(voice.at * SAMPLE_RATE);
    let phase = 0, filtered = 0;
    for (let index = 0; index < count && start + index < output.length; index++) {
      const t = index / SAMPLE_RATE, remaining = (count - 1 - index) / SAMPLE_RATE;
      let sample: number;
      if (voice.kind === "tone") {
        const frequency = hz(voice.midi), end = hz(voice.endMidi ?? voice.midi);
        phase += frequency * (end / frequency) ** (t / duration) / SAMPLE_RATE;
        const envelope = smooth(t / (voice.attack ?? 0.009)) * smooth(remaining / (voice.release ?? 0.045)) * Math.exp(-t / (duration * (voice.decay ?? 0.78)));
        const chip = voice.chip ?? 0.24;
        sample = voice.level * envelope * ((1 - chip) * Math.sin(2 * Math.PI * phase) + chip * triangle(phase + 0.75));
      } else {
        filtered += 0.17 * (noise() - filtered);
        const envelope = Math.min(1, t / 0.001) * Math.exp(-t / (voice.clap ? 0.021 : 0.007)) * Math.min(1, remaining / 0.009);
        sample = voice.level * envelope * (0.8 * filtered + 0.2 * Math.sin(2 * Math.PI * (voice.clap ? 210 : 740) * t));
      }
      output[start + index] += sample;
    }
  }
  let peak = 0;
  for (const sample of output) peak = Math.max(peak, Math.abs(sample));
  const gain = peak ? PEAK / peak : 0;
  return Float32Array.from(output, sample => sample * gain);
}

export type SoundKit = Readonly<{
  /** Call directly within a user gesture. */
  unlock(): Promise<boolean>;
  /** Returns false while locked, muted, hidden or unavailable. */
  play(cue: SoundCue): boolean;
  stop(): void;
  setMuted(muted: boolean): void;
}>;

/**
 * Lazy Web Audio controller: constructing it allocates no AudioContext. No pending unlock survives stop,
 * mute or document hiding. The oldest voice is stolen at four cues.
 */
export function createSoundKit(options: { muted: boolean; volume: number }): SoundKit {
  let muted = options.muted;
  const volume = options.volume;
  let context: AudioContext | null = null, master: GainNode | null = null;
  let unlocked = false, unsupported = false, epoch = 0, listening = false;
  let pending: Promise<boolean> | null = null;
  const buffers = new Map<SoundCue, AudioBuffer>();
  type Playing = { source: AudioBufferSourceNode; gain: GainNode; released: boolean };
  const voices = new Set<Playing>();
  const hidden = () => document.hidden;
  function release(voice: Playing) {
    if (voice.released) return;
    voice.released = true; voices.delete(voice); voice.source.onended = null;
    try { voice.source.disconnect(); } catch { /* Already detached. */ }
    try { voice.gain.disconnect(); } catch { /* Already detached. */ }
  }
  function halt(voice: Playing) {
    try { voice.source.stop(); } catch { /* A finished source can already be stopped. */ }
    release(voice);
  }
  function stop() {
    epoch++;
    if (pending) { pending = null; unlocked = false; }
    for (const voice of [...voices]) halt(voice);
  }
  const masterLevel = () => { if (master) master.gain.value = muted ? 0 : volume * MAX_GAIN; };
  function attach() {
    if (listening) return;
    document.addEventListener("visibilitychange", () => { if (hidden()) stop(); });
    window.addEventListener("pagehide", stop);
    listening = true;
  }
  function unlock(): Promise<boolean> {
    if (muted || hidden() || unsupported) return Promise.resolve(false);
    if (unlocked && context?.state === "running") return Promise.resolve(true);
    if (pending) return pending;
    if (context?.state === "closed") {
      for (const voice of [...voices]) halt(voice);
      try { master?.disconnect(); } catch { /* The browser closed this graph. */ }
      context = null; master = null; unlocked = false; buffers.clear();
    }
    const generation = epoch;
    if (!context) {
      try {
        context = new AudioContext(); master = context.createGain(); masterLevel(); master.connect(context.destination); buffers.clear(); attach();
      } catch {
        context = null; master = null; unsupported = true;
        return Promise.resolve(false);
      }
    }
    const active = context;
    let resume: Promise<void>;
    try { resume = active.state === "running" ? Promise.resolve() : active.resume(); }
    catch { unlocked = false; return Promise.resolve(false); }
    unlocked = false;
    const attempt = resume.then(() => {
      if (generation !== epoch || muted || hidden() || context !== active || active.state !== "running") return false;
      unlocked = true; return true;
    }, () => false).finally(() => { if (pending === attempt) pending = null; });
    pending = attempt;
    return attempt;
  }
  function play(cue: SoundCue): boolean {
    if (muted || hidden() || !unlocked || !context || !master || context.state !== "running") return false;
    let source: AudioBufferSourceNode | null = null, gain: GainNode | null = null, voice: Playing | null = null;
    try {
      let buffer = buffers.get(cue);
      if (!buffer) {
        const pcm = render(cue);
        buffer = context.createBuffer(1, pcm.length, SAMPLE_RATE); buffer.getChannelData(0).set(pcm); buffers.set(cue, buffer);
      }
      if (voices.size >= MAX_VOICES) halt(voices.values().next().value!);
      source = context.createBufferSource(); gain = context.createGain(); gain.gain.value = 1;
      source.buffer = buffer; source.connect(gain); gain.connect(master);
      voice = { source, gain, released: false }; voices.add(voice);
      const playing = voice; source.onended = () => release(playing);
      source.start(context.currentTime); return true;
    } catch {
      if (voice) halt(voice);
      else { try { source?.disconnect(); } catch { /* Not connected. */ } try { gain?.disconnect(); } catch { /* Not connected. */ } }
      return false;
    }
  }
  return Object.freeze({
    unlock, play, stop,
    setMuted(next: boolean) { muted = next; masterLevel(); if (muted) stop(); },
  });
}
