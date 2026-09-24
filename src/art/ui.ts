/**
 * 9-slice pixel frames for the DOM UI, generated at startup and exposed as CSS variables
 * (used with border-image). Pre-scaled ×3 so the browser never resamples the pixels.
 */
import { Painter, scaled } from "./pixel";

const K = 3; // pixel scale for UI frames

type FrameSpec = { outline: string; rim: string; rimLight: string; rimDark: string; fill: string; inner?: string; size?: number; border?: number };

/** A (size×size) frame with a stepped (rounded-pixel) outline, a bevelled rim and a flat fill. */
function frame(f: FrameSpec) {
  const n = f.size ?? 16, b = f.border ?? 5;
  const p = new Painter(n, n);
  p.rect(1, 0, n - 2, n, f.outline).rect(0, 1, n, n - 2, f.outline);
  p.rect(1, 1, n - 2, n - 2, f.rim);
  p.rect(2, 1, n - 4, 1, f.rimLight).rect(1, 2, 1, n - 4, f.rimLight);
  p.rect(2, n - 2, n - 4, 1, f.rimDark).rect(n - 2, 2, 1, n - 4, f.rimDark);
  p.rect(b - 1, b - 1, n - (b - 1) * 2, n - (b - 1) * 2, f.inner ?? f.outline);
  p.rect(b, b, n - b * 2, n - b * 2, f.fill);
  return { url: scaled(p.done(), K).toDataURL(), slice: b * K };
}

const FRAMES = {
  panel: frame({ outline: "k", rim: "W", rimLight: "y", rimDark: "w", fill: "Y", inner: "w", border: 5 }),
  paper: frame({ outline: "w", rim: "Y", rimLight: "#fff6dc", rimDark: "y", fill: "Y", inner: "Y", border: 3 }),
  slot: frame({ outline: "w", rim: "#e7c894", rimLight: "#caa56b", rimDark: "#fbe8c2", fill: "#f0d6a4", inner: "#e7c894", border: 3 }),
  btn: frame({ outline: "k", rim: "#fff1d6", rimLight: "e", rimDark: "#d8b57d", fill: "#f7e6c4", inner: "#f7e6c4", border: 3 }),
  btnHot: frame({ outline: "k", rim: "o", rimLight: "O", rimDark: "l", fill: "o", inner: "o", border: 3 }),
  btnRed: frame({ outline: "k", rim: "r", rimLight: "R", rimDark: "#7a1b24", fill: "r", inner: "r", border: 3 }),
  btnGreen: frame({ outline: "k", rim: "G", rimLight: "h", rimDark: "g", fill: "G", inner: "G", border: 3 }),
  dark: frame({ outline: "k", rim: "K", rimLight: "w", rimDark: "k", fill: "K", inner: "K", border: 3 }),
  gold: frame({ outline: "k", rim: "u", rimLight: "U", rimDark: "l", fill: "#fbe39a", inner: "#fbe39a", border: 3 }),
  sea: frame({ outline: "k", rim: "b", rimLight: "B", rimDark: "#163653", fill: "b", inner: "b", border: 3 }),
};

/** Install the frames as CSS custom properties: --f-<name> and --f-<name>-s (slice width). */
export function installUiFrames() {
  const root = document.documentElement.style;
  for (const [name, f] of Object.entries(FRAMES)) {
    root.setProperty(`--f-${name}`, `url(${f.url})`);
    root.setProperty(`--f-${name}-s`, String(f.slice));
  }
}
