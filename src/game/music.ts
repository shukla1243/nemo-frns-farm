/**
 * "Tide Garden": the game's original generative soundtrack, synthesized live with Web Audio.
 * Soft marimba melody on a major pentatonic scale over I, V, vi, IV, warm bass, and a light shaker.
 * Every 4-bar phrase varies its melody, so it stays calm and playful without an obvious loop.
 */
const BPM = 92;
const BEAT = 60 / BPM;
// C major progression, as semitone offsets from C: C, G, Am, F.
const CHORDS = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const ROOT = 60; // middle C
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer = 0;
let nextTime = 0;
let step = 0;
let seed = 7;
let on = (() => { try { return localStorage.getItem("nemo-frns-farm:music") !== "0"; } catch { return true; } })();
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function pluck(t: number, freq: number, gain: number, dur: number, type: OscillatorType = "triangle") {
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t); o.stop(t + dur + 0.05);
}
function shaker(t: number, gain: number) {
  const len = Math.floor(ctx!.sampleRate * 0.05);
  const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  src.buffer = buf; f.type = "highpass"; f.frequency.value = 6000; g.gain.value = gain;
  src.connect(f).connect(g).connect(master!);
  src.start(t);
}

/** Schedules one eighth-note step: 32 steps = 4 bars = one phrase. */
function schedule(t: number) {
  const bar = Math.floor(step / 8) % 4, eighth = step % 8;
  const chord = CHORDS[bar];
  if (eighth === 0) pluck(t, hz(ROOT - 24 + chord[0]), 0.16, BEAT * 3.5, "sine");
  if (eighth === 4) pluck(t, hz(ROOT - 12 + chord[0]), 0.1, BEAT * 1.6, "sine");
  if (eighth % 2 === 0) for (const n of chord) pluck(t, hz(ROOT + n), 0.025, BEAT * 0.9, "sine");
  // melody: mostly chord tones, occasional rests, gentle stepwise motion
  if (rand() > (eighth % 2 ? 0.55 : 0.2)) {
    const pool = PENTA.filter(p => chord.some(c => (p - c + 24) % 12 === 0) || rand() > 0.6);
    const note = pool[Math.floor(rand() * pool.length)];
    pluck(t, hz(ROOT + 12 + note), 0.07, BEAT * 1.2);
    pluck(t, hz(ROOT + 24 + note), 0.012, BEAT * 0.4, "sine");
  }
  if (eighth % 2 === 1) shaker(t, 0.025);
  step++;
  if (step % 32 === 0) seed = (seed * 7 + step) % 2147483647 || 3;
}

function tickLoop() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.25) { schedule(nextTime); nextTime += BEAT / 2; }
}

export const music = {
  get on() { return on; },
  /** Call from a user gesture (browsers block audio until then). */
  start() {
    if (!on || timer) return;
    try {
      ctx = ctx ?? new AudioContext();
      master = master ?? ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      void ctx.resume();
      nextTime = ctx.currentTime + 0.1;
      timer = window.setInterval(tickLoop, 100);
    } catch { /* audio unsupported */ }
  },
  stop() {
    clearInterval(timer); timer = 0;
    master?.disconnect();
  },
  setOn(v: boolean) {
    on = v;
    try { localStorage.setItem("nemo-frns-farm:music", v ? "1" : "0"); } catch { /* ignore */ }
    if (v) this.start(); else this.stop();
  },
};
