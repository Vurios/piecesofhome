/**
 * The film's own score, written in code for the demo video. It borrows the
 * game's instruments (src/audio/instruments.ts, with the CC0 VCSL samples)
 * and its motif, but it is a new arrangement with an arc that follows the
 * video: a music box when Dad's lamp comes on, a quiet piano for the
 * problem, a warm groove for the answer and the demo, a lighter pulse under
 * the features, and a full statement of the theme for the impact, ending on a
 * held chord.
 *
 * Runs in the browser (Vite dev server) inside an OfflineAudioContext; see
 * video/tools/render-audio.ts ("score" mode). Also makes the film's
 * transition whooshes, which are not in the game.
 */
import { brush, feltPiano, filter, gain, glassBell, kalimba, musicBox, noise, osc, pluck, shaker, strum, toyBass } from "../../src/audio/instruments";
import type { Mixer } from "../../src/audio/mixer";
import { MOTIF, MOTIF_BEATS, midiToHz } from "../../src/audio/motif";
import { seeded } from "../../src/audio/theory";

export interface ScorePlan {
  duration: number;
  sections: { id: string; start: number; end: number }[];
}

const BPM = 104;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

type Chord = readonly [number, number, number];
const G: Chord = [55, 59, 62];
const Em: Chord = [52, 55, 59];
const C: Chord = [48, 52, 55];
const D: Chord = [50, 54, 57];
const Am: Chord = [45, 48, 52];
const Bm: Chord = [47, 50, 54];

interface Feel {
  prog: Chord[];
  piano: number; // block chords on the bar
  arp: number; // broken chords in eighths
  bass: number;
  strum: number;
  shaker: number;
  brush: number;
  kalimba: number;
  bell: number;
  pad: number;
  thump: number;
}

const FEEL: Record<string, Feel> = {
  intro: { prog: [G, Em, C, D], piano: 0.5, arp: 0, bass: 0, strum: 0, shaker: 0, brush: 0, kalimba: 0, bell: 0.35, pad: 0.5, thump: 0 },
  problem: { prog: [Em, C, G, D], piano: 0.35, arp: 0.45, bass: 0.25, strum: 0, shaker: 0, brush: 0, kalimba: 0.2, bell: 0.2, pad: 0.55, thump: 0 },
  solution: { prog: [G, D, Em, C], piano: 0.3, arp: 0.3, bass: 0.65, strum: 0.5, shaker: 0.45, brush: 0.3, kalimba: 0.4, bell: 0.25, pad: 0.4, thump: 0.45 },
  demo: { prog: [G, Em, C, D, C, G, Am, D], piano: 0.22, arp: 0.2, bass: 0.75, strum: 0.55, shaker: 0.55, brush: 0.5, kalimba: 0.55, bell: 0.2, pad: 0.3, thump: 0.55 },
  features: { prog: [C, G, D, Em], piano: 0.22, arp: 0.35, bass: 0.65, strum: 0.4, shaker: 0.5, brush: 0.35, kalimba: 0.5, bell: 0.15, pad: 0.3, thump: 0.45 },
  data: { prog: [C, G, D, Em], piano: 0.22, arp: 0.4, bass: 0.6, strum: 0.3, shaker: 0.45, brush: 0.3, kalimba: 0.45, bell: 0.2, pad: 0.35, thump: 0.4 },
  impact: { prog: [C, D, Bm, Em, C, D, G, G], piano: 0.6, arp: 0.35, bass: 0.6, strum: 0.4, shaker: 0.3, brush: 0.3, kalimba: 0.2, bell: 0.45, pad: 0.6, thump: 0.4 },
};

/** A soft triangle pad for one bar: three voices, slow in, slow out, through a gentle lowpass. */
function pad(mx: Mixer, out: AudioNode, notes: readonly number[], at: number, length: number, level: number): void {
  const ctx = mx.ctx;
  const lp = filter(ctx, "lowpass", 1500, 0.5);
  const g = gain(ctx, 0);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(level, at + 0.6);
  g.gain.setValueAtTime(level, at + length - 0.2);
  g.gain.linearRampToValueAtTime(0, at + length + 0.7);
  lp.connect(g).connect(out);
  for (const n of notes) {
    for (const cents of [-5, 5]) {
      const o = osc(ctx, "triangle", midiToHz(n + 12), at, at + length + 0.8);
      o.detune.value = cents;
      const v = gain(ctx, 0.12);
      o.connect(v).connect(lp);
    }
  }
}

/** A soft low thump on the downbeat, felt more than heard. */
function thump(mx: Mixer, out: AudioNode, at: number, level: number): void {
  const ctx = mx.ctx;
  const o = osc(ctx, "sine", 110, at, at + 0.4);
  o.frequency.setValueAtTime(110, at);
  o.frequency.exponentialRampToValueAtTime(48, at + 0.18);
  const g = gain(ctx, 0);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(level, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
  o.connect(g).connect(out);
}

/** A paper-soft whoosh for a new part of the video: filtered noise rising and falling. */
export function whoosh(mx: Mixer, out: AudioNode, at: number, level = 0.5): void {
  const ctx = mx.ctx;
  const src = noise(mx, "pink", at - 0.45, 1.1);
  const bp = filter(ctx, "bandpass", 400, 1.4);
  bp.frequency.setValueAtTime(380, at - 0.45);
  bp.frequency.exponentialRampToValueAtTime(2600, at + 0.05);
  bp.frequency.exponentialRampToValueAtTime(900, at + 0.6);
  const g = gain(ctx, 0);
  g.gain.setValueAtTime(0, at - 0.45);
  g.gain.linearRampToValueAtTime(level, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.62);
  src.connect(bp).connect(g).connect(out);
}

/** The game's motif on a music box, starting at `at`. */
function motif(mx: Mixer, out: AudioNode, at: number, level: number, octave = 0, voice: "box" | "piano" | "bell" = "box"): void {
  let t = at;
  MOTIF.forEach((note, i) => {
    const hz = midiToHz(note + 12 * octave);
    const len = (MOTIF_BEATS[i] ?? 1) * BEAT;
    if (voice === "box") musicBox(mx, out, hz, t, level, Math.max(1.2, len + 0.8));
    else if (voice === "piano") feltPiano(mx, out, hz, t, level, Math.max(1.4, len + 0.6));
    else glassBell(mx, out, hz, t, level, 3.5);
    t += len;
  });
}

export function renderScore(mx: Mixer, plan: ScorePlan): void {
  const out = mx.input("music");
  const random = seeded(2026);
  const sectionAt = (t: number) => plan.sections.find((s) => t >= s.start && t < s.end) ?? plan.sections[plan.sections.length - 1]!;
  const bars = Math.ceil(plan.duration / BAR);
  const impact = plan.sections.find((s) => s.id === "impact");
  const endBar = Math.floor((plan.duration - 3) / BAR);
  // Count bars within each section, so each part starts its progression on its first chord.
  let lastSection = "";
  let inSection = 0;

  for (let b = 0; b < bars; b += 1) {
    const t = b * BAR;
    const sec = sectionAt(t + BAR * 0.4);
    if (sec.id !== lastSection) {
      lastSection = sec.id;
      inSection = 0;
    }
    const feel = FEEL[sec.id] ?? FEEL["demo"]!;
    const chord = b >= endBar ? G : feel.prog[inSection % feel.prog.length]!;
    inSection += 1;
    // The first bar is near silent: the lamp is about to come on.
    if (b === 0) continue;
    // Fade everything in over the first bars and out at the very end.
    const fadeIn = Math.min(1, b / 3);
    const last = b >= endBar;
    const k = fadeIn;

    if (b === 1) motif(mx, out, t, 0.32, 1, "box");
    if (b > endBar) break;
    if (last) {
      // The held ending chord: piano, bells and pad ring out.
      for (const n of [43, 55, 59, 62, 67, 71]) feltPiano(mx, out, midiToHz(n), t, 0.22, 6);
      glassBell(mx, out, midiToHz(79), t + 0.02, 0.16, 7);
      pad(mx, out, G, t, BAR * 2, 0.16);
      continue;
    }

    pad(mx, out, chord, t, BAR, feel.pad * 0.16 * k);
    if (feel.piano) for (const n of chord) feltPiano(mx, out, midiToHz(n + 12), t + (n === chord[0] ? 0 : 0.012), feel.piano * 0.16 * k, BAR + 0.4);
    if (feel.bell && (b % 2 === 0)) glassBell(mx, out, midiToHz(chord[2]! + 24), t + 0.01, feel.bell * 0.1 * k, 4);

    for (let beat = 0; beat < 4; beat += 1) {
      const bt = t + beat * BEAT;
      if (feel.bass) {
        const root = chord[0]! - 12;
        toyBass(mx, out, midiToHz(beat % 2 === 0 ? root : root + 7), bt, feel.bass * 0.24 * k, 0.42);
        if (sec.id === "demo" && beat === 3) toyBass(mx, out, midiToHz(root + 12), bt + BEAT / 2, feel.bass * 0.16 * k, 0.25);
      }
      if (feel.thump && beat === 0) thump(mx, out, bt, feel.thump * 0.3 * k);
      if (feel.strum && (beat === 1 || beat === 3)) strum(mx, out, chord.map((n) => n + 12), bt, feel.strum * 0.15 * k);
      if (feel.brush && (beat === 1 || beat === 3)) brush(mx, out, bt, feel.brush * 0.22 * k, false);
      for (let e = 0; e < 2; e += 1) {
        const et = bt + e * (BEAT / 2);
        if (feel.shaker) shaker(mx, out, et + (e ? 0.02 : 0), feel.shaker * (e ? 0.12 : 0.18) * k);
        if (feel.arp) {
          const idx = (beat * 2 + e) % 4;
          const note = [chord[0]! + 12, chord[1]! + 12, chord[2]! + 12, chord[1]! + 12][idx]!;
          feltPiano(mx, out, midiToHz(note + 12), et, feel.arp * 0.08 * k, 0.9);
        }
        if (feel.kalimba && random() < feel.kalimba * 0.4) {
          const pick = [chord[0]!, chord[1]!, chord[2]!, chord[0]! + 12, chord[2]! - 5][Math.floor(random() * 5)]!;
          kalimba(mx, out, midiToHz(pick + 24), et, 0.09 * k, 0.8);
        }
      }
    }
    // Each new part of the video opens with a rising music-box sparkle.
    if (inSection === 1 && b > 2) [chord[0]!, chord[1]!, chord[2]!, chord[0]! + 12, chord[1]! + 12].forEach((n, i) => musicBox(mx, out, midiToHz(n + 24), t + i * 0.07, 0.1, 1.4));
    // The game's motif comes back as a hook every eight bars of the demo.
    if (sec.id === "demo" && inSection % 8 === 5) motif(mx, out, t, 0.15, 1, "box");
    // Syncopated bass pickups keep the groove bouncing.
    if ((sec.id === "demo" || sec.id === "features" || sec.id === "solution") && feel.bass) {
      const root = chord[0]! - 12;
      toyBass(mx, out, midiToHz(root + 7), t + BEAT * 1.5, feel.bass * 0.14 * k, 0.22);
      toyBass(mx, out, midiToHz(root + 12), t + BEAT * 3.5, feel.bass * 0.14 * k, 0.22);
    }
    // A little glockenspiel twinkle closes every fourth bar of the groove.
    if ((sec.id === "demo" || sec.id === "solution") && inSection % 4 === 0) {
      [chord[0]!, chord[1]!, chord[2]!, chord[0]! + 12].forEach((n, i) => musicBox(mx, out, midiToHz(n + 24), t + BAR - BEAT + i * 0.09, 0.09, 1.2));
    }
    // A plucked counter-line in the demo, walking the chord.
    if (sec.id === "demo" && inSection % 2 === 0) {
      [0, 1.5, 2, 3].forEach((beat, i) => pluck(mx, out, midiToHz([chord[2]!, chord[1]!, chord[0]! + 12, chord[2]!][i]! + 12), t + beat * BEAT, 0.08, 0.6));
    }
  }

  // The motif comes back: at the start of the solution on the music box, and for the impact on piano and bells.
  const sol = plan.sections.find((s) => s.id === "solution");
  if (sol) motif(mx, out, Math.ceil(sol.start / BAR) * BAR + BAR, 0.22, 1, "box");
  const demo = plan.sections.find((s) => s.id === "demo");
  if (demo) motif(mx, out, Math.ceil(demo.start / BAR) * BAR, 0.18, 1, "bell");
  if (impact) {
    const t0 = Math.ceil(impact.start / BAR) * BAR;
    motif(mx, out, t0, 0.3, 1, "piano");
    motif(mx, out, t0, 0.12, 2, "bell");
    motif(mx, out, t0 + BAR * 2, 0.28, 1, "piano");
  }
}
