/**
 * Renders sound for the video offline, in Chrome, with the game's own audio
 * code (src/audio) and the film's score (video/audio/score.ts). Nothing is
 * recorded from a speaker and nothing comes from outside the project.
 *
 *   npx tsx video/tools/render-audio.ts music [scene:seconds ...]   the game's music beds
 *   npx tsx video/tools/render-audio.ts sfx [clip ...]               one clip's logged sounds
 *   npx tsx video/tools/render-audio.ts film [name]                  the film's score and effects
 *
 * "film" reads video/film/plan.json and writes video/audio/build/score.wav
 * (the music) and video/audio/build/fx.wav (every game sound the captured
 * clips asked for, on the frame where it happened, plus the film's paper,
 * tape, stamp and whoosh sounds on its cards). The dev server must be
 * running (npm run dev).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const CUT = process.env["CUT"] ?? "demo";
const OUT = join(VIDEO, CUT === "demo" ? "audio/build" : `audio/build-${CUT}`);
mkdirSync(OUT, { recursive: true });
const base = (process.argv.find((a) => a.startsWith("--base=")) ?? "--base=http://localhost:5173").slice(7);
const [mode, ...rest] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

interface Ev {
  t: number;
  kind: string;
  name: string;
  options: unknown[];
  gain: number;
}
interface ClipLog {
  fps: number;
  frames: number;
  events: { frame: number; kind: string; name: string; options: unknown[] }[];
}

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.text().startsWith("render:")) console.log("page:", m.text());
});
// tsx keeps function names with a __name helper inside evaluated callbacks; give the page one.
await page.addInitScript("globalThis.__name = globalThis.__name || ((f) => f);");
await page.goto(`${base}/audio-lab/`);
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const w = window as unknown as Record<string, unknown>;
  /** An offline mixer with the game's instruments and foley loaded. */
  w["__offline"] = async (seconds: number) => {
    const { Mixer } = await import("/src/audio/mixer.ts" as string);
    const { SampleBank } = await import("/src/audio/samples.ts" as string);
    const ctx = new OfflineAudioContext(2, Math.ceil(48000 * seconds), 48000);
    const mx = new Mixer(ctx as unknown as AudioContext, "high");
    const bank = new SampleBank(ctx);
    await bank.load("inst");
    await bank.load("sfx");
    (mx as unknown as { samples: unknown }).samples = bank;
    let fake = 0;
    // Code that schedules from the mixer's clock gets a clock it can be told about.
    Object.defineProperty(mx, "now", { get: () => fake, configurable: true });
    return { ctx, mx, bank, setNow: (v: number) => (fake = v) };
  };
  /** Plays a list of events (game cues, voice chirps, film cues) into an offline mixer. */
  w["__events"] = async (events: { t: number; kind: string; name: string; options: unknown[]; gain: number }[], seconds: number) => {
    const { ctx, mx, bank, setNow } = await (w["__offline"] as (s: number) => Promise<{ ctx: OfflineAudioContext; mx: { input(b: string): AudioNode }; bank: { take(id: string): AudioBuffer | null }; setNow(v: number): void }>)(seconds);
    const { CUES } = await import("/src/audio/cues.ts" as string);
    const { RECIPES } = await import("/src/audio/sfx.ts" as string);
    const { speak } = await import("/src/audio/voices.ts" as string);
    const { whoosh } = await import("/video/audio/score.ts" as string);
    const last = new Map<string, number>();
    let played = 0;
    for (const e of events) {
      setNow(e.t);
      if (e.kind === "speak") {
        const [text] = e.options as [string];
        const g = ctx.createGain();
        g.gain.value = e.gain;
        g.connect(mx.input("voices"));
        if (typeof text === "string") speak(mx, g, e.name, text, e.t);
        played += 1;
        continue;
      }
      if (e.kind === "cue" && e.name === "whoosh") {
        whoosh(mx, mx.input("effects"), e.t, 0.5 * e.gain);
        played += 1;
        continue;
      }
      if (e.kind !== "play" && e.kind !== "cue") continue;
      const spec = CUES[e.name];
      if (!spec) continue;
      const opts = (e.options[0] ?? {}) as { level?: number; rate?: number; param?: number; delay?: number };
      const at = e.t + 0.005 + (opts.delay ?? 0);
      // The same anti-spam gap the game uses.
      if (at - (last.get(e.name) ?? -Infinity) < (spec.minGap ?? 0.03)) continue;
      last.set(e.name, at);
      const level = spec.volume * (opts.level ?? 1) * e.gain;
      const rate = opts.rate ?? 1;
      const out = mx.input(spec.bus);
      const take = spec.sample ? bank.take(spec.sample) : null;
      if (take) {
        const src = ctx.createBufferSource();
        src.buffer = take;
        src.playbackRate.value = rate * (spec.sampleRate ?? 1);
        const g = ctx.createGain();
        g.gain.value = level * (spec.sampleGain ?? 0.15);
        let node: AudioNode = src;
        if (spec.sampleTone) {
          const lp = ctx.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = spec.sampleTone;
          node = node.connect(lp);
        }
        node.connect(g).connect(out);
        src.start(at);
        played += 1;
        if (!spec.layer) continue;
      }
      RECIPES[spec.recipe]?.({ mx, out, at, level: take ? level * 0.6 : level, rate, param: opts.param ?? 0 });
      played += 1;
    }
    console.log(`render: ${played} sounds`);
    return ctx.startRendering();
  };
  w["__wav"] = (buffer: AudioBuffer): string => {
    const ch = buffer.numberOfChannels;
    const n = buffer.length;
    const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const str = (o: number, s: string) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF");
    data.setUint32(4, 36 + n * ch * 2, true);
    str(8, "WAVE");
    str(12, "fmt ");
    data.setUint32(16, 16, true);
    data.setUint16(20, 1, true);
    data.setUint16(22, ch, true);
    data.setUint32(24, buffer.sampleRate, true);
    data.setUint32(28, buffer.sampleRate * ch * 2, true);
    data.setUint16(32, ch * 2, true);
    data.setUint16(34, 16, true);
    str(36, "data");
    data.setUint32(40, n * ch * 2, true);
    const chans = [...Array(ch)].map((_, c) => buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i += 1)
      for (let c = 0; c < ch; c += 1) {
        const v = Math.max(-1, Math.min(1, chans[c]![i]!));
        data.setInt16(o, Math.round(v * 32767), true);
        o += 2;
      }
    const bytes = new Uint8Array(data.buffer);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
});

async function renderEvents(events: Ev[], seconds: number, file: string): Promise<void> {
  const b64 = await page.evaluate(
    async ([ev, s]) => {
      const w = window as unknown as { __events(e: unknown, s: number): Promise<AudioBuffer>; __wav(b: AudioBuffer): string };
      return w.__wav(await w.__events(ev, s as number));
    },
    [events, seconds] as const,
  );
  writeFileSync(file, Buffer.from(b64, "base64"));
}

const clipLog = (clip: string): ClipLog | null => {
  const file = join(VIDEO, "capture", `${clip}.events.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ClipLog) : null;
};

if (mode === "music") {
  const wants = rest.length ? rest : ["title:70", "home:120", "moon:60", "mars:60", "finale:110"];
  for (const want of wants) {
    const [scene, secs] = want.split(":");
    const seconds = Number(secs ?? 60);
    const b64 = await page.evaluate(
      async ([sc, s]) => {
        const w = window as unknown as { __offline(s: number): Promise<{ ctx: OfflineAudioContext; mx: unknown; setNow(v: number): void }>; __wav(b: AudioBuffer): string };
        const { ctx, mx, setNow } = await w.__offline(s as number);
        const { Score } = await import("/src/audio/music.ts" as string);
        const score = new Score(mx);
        score.setScene(sc);
        window.clearInterval((score as unknown as { timer: number }).timer);
        (score as unknown as { timer: number }).timer = 1;
        const tick = (score as unknown as { tick: () => void }).tick;
        for (let t = 0; t < (s as number) - 0.5; t += 0.05) {
          setNow(t);
          tick();
        }
        return w.__wav(await ctx.startRendering());
      },
      [scene, seconds] as const,
    );
    writeFileSync(join(OUT, `music-${scene}.wav`), Buffer.from(b64, "base64"));
    console.log(`music-${scene}.wav: ${seconds} s`);
  }
} else if (mode === "sfx") {
  const capture = join(VIDEO, "capture");
  const clips = rest.length ? rest : readdirSync(capture).filter((f) => f.endsWith(".events.json")).map((f) => f.replace(/\.events\.json$/, ""));
  for (const clip of clips) {
    const log = clipLog(clip);
    if (!log) continue;
    const events = log.events.map((e) => ({ t: e.frame / log.fps, kind: e.kind, name: e.name, options: e.options, gain: 1 }));
    await renderEvents(events, log.frames / log.fps + 3, join(OUT, `sfx-${clip}.wav`));
    console.log(`sfx-${clip}.wav: ${events.length} events`);
  }
} else if (mode === "film") {
  const plan = JSON.parse(readFileSync(join(VIDEO, CUT === "demo" ? "film" : `film-${CUT}`, "plan.json"), "utf8")) as {
    duration: number;
    sections: { id: string; start: number; end: number }[];
    clips: { clip: string; from: number; dur: number; rate: number; at: number }[];
    fx: { cue: string; at: number }[];
  };
  const seconds = plan.duration + 1;
  // The score.
  const score = await page.evaluate(
    async ([p, s]) => {
      const w = window as unknown as { __offline(s: number): Promise<{ ctx: OfflineAudioContext; mx: unknown; setNow(v: number): void }>; __wav(b: AudioBuffer): string };
      const { ctx, mx } = await w.__offline(s as number);
      const { renderScore } = await import("/video/audio/score.ts" as string);
      renderScore(mx, p);
      return w.__wav(await ctx.startRendering());
    },
    [plan, seconds] as const,
  );
  writeFileSync(join(OUT, "score.wav"), Buffer.from(score, "base64"));
  console.log(`score.wav: ${seconds.toFixed(1)} s`);
  // The game's own sounds from every clip segment that plays at normal speed, plus the cards' sounds.
  const events: Ev[] = [];
  for (const seg of plan.clips) {
    if (Math.abs(seg.rate - 1) > 1e-3) continue;
    const log = clipLog(seg.clip);
    if (!log) continue;
    for (const e of log.events) {
      const ts = e.frame / log.fps;
      if (ts < seg.from || ts >= seg.from + seg.dur - 0.05) continue;
      // Characters' voice chirps sit lower under the narration.
      events.push({ t: seg.at + (ts - seg.from), kind: e.kind, name: e.name, options: e.options, gain: e.kind === "speak" ? 0.55 : 1 });
    }
  }
  for (const f of plan.fx as { at: number; cue: string; gain?: number }[]) events.push({ t: f.at, kind: "cue", name: f.cue, options: [], gain: f.gain ?? (f.cue === "whoosh" ? 1 : 0.9) });
  events.sort((a, b) => a.t - b.t);
  await renderEvents(events, seconds, join(OUT, "fx.wav"));
  console.log(`fx.wav: ${events.length} events`);
}
await browser.close();
