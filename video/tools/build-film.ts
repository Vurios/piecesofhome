/**
 * Builds the HyperFrames film from the script, the narration and the edit.
 *
 *   npx tsx video/tools/build-film.ts [demo]
 *
 * Reads video/script/<name>.json (lines), video/script/<name>.edit.json
 * (beats), video/audio/voice/lines.json and asr.json (real narration lengths
 * and word timings) and the captured clips. Writes:
 *
 * - video/film/index.html: the composition (clips in Dad's frame with
 *   crossfades, the overlay cards and motion graphics, burned-in captions);
 * - video/film/plan.json: where every line, clip sound and card sound sits, for
 *   the score and the mix;
 * - video/out/<file>.srt and video/script/<name>.md (the timecoded script).
 *
 * Assets the film needs (clips, NASA images, fonts, GSAP) are copied into
 * video/film/assets, which git ignores.
 */
import { copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { DRAWINGS } from "../../src/ui/drawing/machines";
import { boil } from "../../src/ui/drawing/sketch";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const ROOT = resolve(VIDEO, "..");
const NAME = process.argv[2] ?? "demo";
// Each cut has its own composition folder, so one can render while another is built.
const FILM = join(VIDEO, NAME === "demo" ? "film" : `film-${NAME}`);
const FPS = 30;

interface Line {
  id: string;
  text: string;
  caption?: string;
  facts: string[];
  visual: string;
}
interface Script {
  title: string;
  file: string;
  sections: { id: string; label: string; lines: Line[] }[];
}
interface Segment {
  clip: string;
  from: number;
  to: number;
  rate?: number;
}
interface Beat {
  id: string;
  section: string;
  lines: string[];
  lead?: number;
  tail?: number;
  min?: number;
  card?: string;
  paper?: boolean;
  /** "rate": fill a long beat by slowing the last segment, never by running into later footage. */
  fit?: "rate";
  /** An exact length for the beat (the narration must fit inside it). */
  dur?: number;
  segments?: Segment[];
}

const script = JSON.parse(readFileSync(join(VIDEO, "script", `${NAME}.json`), "utf8")) as Script;
const edit = JSON.parse(readFileSync(join(VIDEO, "script", `${NAME}.edit.json`), "utf8")) as { gap: number; xf?: number; mark?: string; beats: Beat[] };
const voice = JSON.parse(readFileSync(join(VIDEO, "audio/voice/lines.json"), "utf8")) as Record<string, { seconds: number }>;
const asrFile = join(VIDEO, "audio/voice/asr.json");
const asr = existsSync(asrFile) ? (JSON.parse(readFileSync(asrFile, "utf8")) as Record<string, { words: { text: string; start: number; end: number }[] }>) : {};
const lines = new Map(script.sections.flatMap((s) => s.lines).map((l) => [l.id, l]));
const sectionLabel = new Map(script.sections.map((s) => [s.id, s.label]));

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function clipSeconds(clip: string): number {
  const log = join(VIDEO, "capture", `${clip}.events.json`);
  if (existsSync(log)) {
    const j = JSON.parse(readFileSync(log, "utf8")) as { frames: number };
    return j.frames / FPS;
  }
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(VIDEO, "capture", `${clip}.mp4`)]).toString();
  return Number(out.trim());
}

// ---------------------------------------------------------------- timing
interface Placed {
  beat: Beat;
  start: number;
  dur: number;
  voice: { id: string; start: number; dur: number }[];
  segs: { clip: string; from: number; dur: number; rate: number; at: number }[];
}
const placed: Placed[] = [];
let t = 0;
for (const beat of edit.beats) {
  const lead = beat.lead ?? 0.5;
  const tail = beat.tail ?? 0.6;
  const v: Placed["voice"] = [];
  let k = lead;
  beat.lines.forEach((id, i) => {
    const d = voice[id]?.seconds;
    if (d === undefined) throw new Error(`no narration for ${id}`);
    if (i > 0) k += edit.gap;
    v.push({ id, start: r3(t + k), dur: d });
    k += d;
  });
  const dur = beat.dur ?? r3(Math.max(k + tail, beat.min ?? 0));
  if (beat.dur && k > beat.dur + 0.01) console.warn(`  ${beat.id}: narration runs ${(k - beat.dur).toFixed(2)} s past the beat`);
  // Fit the segments to the beat: trim from the end, or stretch the last one.
  const segs: Placed["segs"] = [];
  if (beat.segments?.length) {
    const list = beat.segments.map((s) => ({ ...s, rate: s.rate ?? 1 }));
    let total = list.reduce((a, s) => a + (s.to - s.from) / s.rate, 0);
    while (total > dur + 1e-6) {
      const last = list[list.length - 1]!;
      const over = total - dur;
      const len = (last.to - last.from) / last.rate;
      if (len - over >= 1.2 || list.length === 1) {
        last.to = last.from + Math.max(0.5, len - over) * last.rate;
        total = dur;
      } else {
        list.pop();
        total -= len;
      }
    }
    if (total < dur - 1e-6 && beat.fit === "rate") {
      const last = list[list.length - 1]!;
      const len = last.to - last.from;
      const other = total - len / last.rate;
      last.rate = Math.max(0.4, len / (dur - other));
      console.log(`  ${beat.id}: ${last.clip} at ${last.rate.toFixed(2)}x to fill the beat`);
    } else if (total < dur - 1e-6) {
      const last = list[list.length - 1]!;
      const room = clipSeconds(last.clip) - 0.1 - last.to;
      const need = (dur - total) * last.rate;
      if (room >= need) last.to += need;
      else {
        last.to += Math.max(0, room);
        const len = last.to - last.from;
        const other = total - (len - Math.max(0, room)) / last.rate;
        last.rate = Math.max(0.45, len / (dur - other));
        console.log(`  ${beat.id}: slowed ${last.clip} to ${last.rate.toFixed(2)}x to fill the beat`);
      }
    }
    let at = t;
    for (const s of list) {
      const d = (s.to - s.from) / s.rate;
      segs.push({ clip: s.clip, from: r3(s.from), dur: r3(d), rate: r3(s.rate), at: r3(at) });
      at += d;
    }
  }
  placed.push({ beat, start: r3(t), dur, voice: v, segs });
  t += dur;
}
const TOTAL = r3(t);

// ---------------------------------------------------------------- captions
interface Cue {
  start: number;
  end: number;
  text: string;
}
const cues: Cue[] = [];
function chunk(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    if (s.length <= 74) {
      out.push(s);
      continue;
    }
    // Split long sentences at a comma near the middle, else at a word.
    const words = s.split(" ");
    let cur = "";
    const parts: string[] = [];
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > 64 && cur) {
        parts.push(cur);
        cur = w;
      } else cur = next;
      if (/[,:;]$/.test(w) && cur.length > 30) {
        parts.push(cur);
        cur = "";
      }
    }
    if (cur) parts.push(cur);
    // Join a short tail back on.
    for (let i = parts.length - 1; i > 0; i -= 1)
      if (parts[i]!.length < 18 && parts[i - 1]!.length + parts[i]!.length < 78) {
        parts[i - 1] = `${parts[i - 1]} ${parts[i]}`;
        parts.splice(i, 1);
      }
    out.push(...parts);
  }
  return out;
}
// Each caption chunk is timed from the words actually spoken: the chunk's words
// are aligned to the transcription (an edit-distance alignment, so "1969" and
// "nineteen sixty-nine" still line up), and it shows from a moment before its
// first word until the next chunk takes over, so captions never lag the voice
// or blink off between sentences.
const tok = (t: string) =>
  t
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
function same(a: string, b: string): boolean {
  if (a === b) return true;
  const x = a.replace(/'/g, "");
  const y = b.replace(/'/g, "");
  return x === y || (x.length > 3 && y.length > 3 && (x.startsWith(y.slice(0, 4)) || y.startsWith(x.slice(0, 4))));
}
/** For each caption word, the index of the spoken word it matches (or -1). */
function alignWords(cap: string[], said: string[]): number[] {
  const n = cap.length;
  const m = said.length;
  const d = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) d[i]![0] = i;
  for (let j = 0; j <= m; j += 1) d[0]![j] = j;
  for (let i = 1; i <= n; i += 1)
    for (let j = 1; j <= m; j += 1) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (same(cap[i - 1]!, said[j - 1]!) ? 0 : 1));
  const out = new Array<number>(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const diag = d[i - 1]![j - 1]! + (same(cap[i - 1]!, said[j - 1]!) ? 0 : 1);
    if (d[i]![j] === diag) {
      out[i - 1] = j - 1;
      i -= 1;
      j -= 1;
    } else if (d[i]![j] === d[i - 1]![j]! + 1) i -= 1;
    else j -= 1;
  }
  return out;
}
const LEAD_IN = 0.12;
for (const p of placed)
  for (const v of p.voice) {
    const line = lines.get(v.id)!;
    const text = line.caption ?? line.text;
    const words = (asr[`${v.id}.wav`]?.words ?? []).filter((w) => tok(w.text).length);
    const parts = chunk(text);
    if (!words.length) {
      // No transcription: share the line by length (a fallback only).
      const chars = parts.reduce((a, x) => a + x.length, 0);
      let a = 0.05;
      parts.forEach((part) => {
        const d = ((v.dur - 0.1) * part.length) / chars;
        cues.push({ start: r3(v.start + a), end: r3(v.start + a + d), text: part });
        a += d;
      });
      continue;
    }
    const said = words.flatMap((w, k) => tok(w.text).map((x) => ({ x, k })));
    const capTok = parts.flatMap((part, c) => tok(part).map((x) => ({ x, c })));
    const map = alignWords(capTok.map((t) => t.x), said.map((t) => t.x));
    const spans = parts.map((_, c) => {
      const ks = capTok.flatMap((t, i) => (t.c === c && map[i]! >= 0 ? [said[map[i]!]!.k] : []));
      return ks.length ? { a: words[Math.min(...ks)]!.start, b: words[Math.max(...ks)]!.end } : null;
    });
    // A chunk with no matched word sits between its neighbours.
    spans.forEach((sp, c) => {
      if (sp) return;
      const prev = spans.slice(0, c).reverse().find(Boolean);
      const next = spans.slice(c + 1).find(Boolean);
      spans[c] = { a: prev?.b ?? 0.05, b: next?.a ?? v.dur - 0.05 };
    });
    parts.forEach((part, c) => {
      const sp = spans[c]!;
      const start = Math.max(0, sp.a - LEAD_IN);
      const next = spans[c + 1];
      const end = next ? Math.max(sp.b, next.a - LEAD_IN) : sp.b + 0.45;
      cues.push({ start: r3(v.start + start), end: r3(v.start + end), text: part });
    });
  }
// Hold a caption until the next one when the gap is short, and keep every caption up long enough to read.
cues.sort((a, b) => a.start - b.start);
cues.forEach((c, i) => {
  const next = cues[i + 1];
  const minEnd = c.start + Math.max(1.0, c.text.length / 22);
  if (next) {
    if (next.start - c.end < 0.9) c.end = next.start;
    c.end = r3(Math.min(next.start, Math.max(c.end, minEnd)));
  } else c.end = r3(Math.max(c.end, minEnd));
});

// ---------------------------------------------------------------- assets
const ASSETS = join(FILM, "assets");
for (const d of ["clips", "img", "fonts", "vendor"]) mkdirSync(join(ASSETS, d), { recursive: true });
function place(src: string, dst: string): void {
  if (existsSync(dst)) {
    const a = readFileSync(src).length;
    const b = readFileSync(dst).length;
    if (a === b) return;
  }
  try {
    if (existsSync(dst)) return copyFileSync(src, dst);
    linkSync(src, dst);
  } catch {
    copyFileSync(src, dst);
  }
}
const usedClips = new Set(placed.flatMap((p) => p.segs.map((s) => s.clip)));
for (const c of usedClips) place(join(VIDEO, "capture", `${c}.mp4`), join(ASSETS, "clips", `${c}.mp4`));
const IMAGES: Record<string, string> = {
  "apollo11-lrrr.jpg": "images/nasa/apollo11-lrrr.jpg",
  "apollo15-lrv.jpg": "images/nasa/apollo15-lrv.jpg",
  "opportunity-tracks.jpg": "images/nasa/opportunity-tracks.jpg",
  "ingenuity-valinor.jpg": "images/nasa/ingenuity-valinor.jpg",
  "voyager.jpg": "images/nasa/voyager.jpg",
  "archive-reflectors.jpg": "images/nasa/archive-reflectors.jpg",
  "workshop.webp": "loader/workshop.webp",
};
for (const [n, p] of Object.entries(IMAGES)) place(join(ROOT, "public", p), join(ASSETS, "img", n));
// A still of the game's title screen for the end card.
const STILL = join(ASSETS, "img", "title-still.jpg");
const stillSrc = existsSync(join(VIDEO, "capture", "title-still.mp4")) ? ["14.2", "title-still.mp4"] : ["14.6", "opening.mp4"];
execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", stillSrc[0]!, "-i", join(VIDEO, "capture", stillSrc[1]!), "-frames:v", "1", "-q:v", "2", STILL]);
const narrator = (Object.values(voice)[0] as { model?: string } | undefined)?.model?.startsWith("Chatterbox") ? "Chatterbox, an open text-to-speech model" : "Kokoro, an open text-to-speech model";
for (const f of ["kalam-latin-400-normal.woff2", "kalam-latin-700-normal.woff2", "atkinson-hyperlegible-next-latin-wght-normal.woff2", "zilla-slab-latin-500-normal.woff2", "zilla-slab-latin-700-normal.woff2"]) place(join(ROOT, "public/fonts", f), join(ASSETS, "fonts", f));
place(join(VIDEO, "node_modules/gsap/dist/gsap.min.js"), join(ASSETS, "vendor/gsap.min.js"));

// ---------------------------------------------------------------- credits of NASA images
const credits = JSON.parse(readFileSync(join(ROOT, "src/data/credits.json"), "utf8")) as { media: { file: string; credit: string; title: string }[] };
const creditOf = (file: string): string => credits.media.find((m) => m.file === `images/nasa/${file}`)?.credit ?? "NASA";

// ---------------------------------------------------------------- cards
const anim: string[] = [];
const A = (s: string) => anim.push(s);
const fx: { cue: string; at: number; gain?: number }[] = [];
const F = (cue: string, at: number, gain?: number) => fx.push(gain === undefined ? { cue, at: r3(at) } : { cue, at: r3(at), gain });
function voiceAt(p: Placed, i = 0): number {
  return p.voice[i]?.start ?? p.start;
}
/** When a word is said in a beat's narration (from the transcription), else a share of the line. */
function wordAt(p: Placed, i: number, re: RegExp, share: number): number {
  const v = p.voice[i]!;
  const words = asr[`${v.id}.wav`]?.words ?? [];
  const w = words.find((x) => re.test(x.text.replace(/[^\w-]/g, "")));
  return r3(v.start + (w ? w.start : v.dur * share));
}
/** When a clip moment shows on screen in a beat. */
function clipAt(p: Placed, clip: string, at: number): number {
  const s = p.segs.find((x) => x.clip === clip && at >= x.from && at <= x.from + x.dur * x.rate) ?? p.segs[0]!;
  return r3(s.at + (at - s.from) / s.rate);
}
/** A rolling number: a column of values that scrolls to the last one. */
function reel(id: string, values: (string | number)[]): string {
  return `<span class="roll"><span class="reel" id="${id}">${values.map((v) => `<i>${v}</i>`).join("")}</span></span>`;
}
function rollTo(p: Placed, id: string, n: number, at: number, dur: number): void {
  A(`tl.fromTo("#${id}", { y: 0 }, { y: ${-(n - 1)}.0 * 92, duration: ${dur}, ease: "power2.out" }, ${at});`);
  for (let k = 0; k < Math.min(n - 1, 9); k += 1) F("tick", at + (dur * 0.7 * k) / Math.min(n - 1, 9), 0.5);
}
const ICON: Record<string, string> = {
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9c-2-4-6-4-6-1.5S9 9 12 9zm0 0c2-4 6-4 6-1.5S15 9 12 9z"/></svg>',
  browser: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 15l3-3 3 3 4-4"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5l-5.3 2.9 1.2-6-4.5-4.1 6-.7z"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.4-6 5-6s5 2.5 5 6M13.5 20c0-2.8 1.4-5 3.4-5S21 17.2 21 20"/></svg>',
  letter: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5c-3-.5-6 0-8 1.5zM12 6v14.5"/></svg>',
  bot: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="8" width="14" height="11" rx="3"/><circle cx="9.5" cy="13" r="1.3"/><circle cx="14.5" cy="13" r="1.3"/><path d="M12 8V4.5M10 4.5h4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
const ic = (name: string, color: string) => `<span class="ic" style="--c:var(${color})">${ICON[name]}</span>`;

function photo(id: string, file: string, label: string, opts: { w: number; tilt: number; x: number; y: number; big?: boolean }): string {
  return `<figure class="photo${opts.big ? " big" : ""}" id="${id}" style="left:${opts.x}px;top:${opts.y}px;width:${opts.w}px;--tilt:${opts.tilt}deg">
  <span class="tape"></span>
  <div class="pic"><img src="assets/img/${file}" alt="" /></div>
  <figcaption><b>${esc(label)}</b><small>Credit: ${esc(creditOf(file))}</small></figcaption>
</figure>`;
}

/** A photo pinned to a corkboard (a red pin instead of tape), with a place-and-year chip. */
function pinned(id: string, file: string, label: string, chip: string, opts: { w: number; tilt: number; x: number; y: number }): string {
  return `<figure class="photo pinned" id="${id}" style="left:${opts.x}px;top:${opts.y}px;width:${opts.w}px;--tilt:${opts.tilt}deg">
  <span class="pin"></span>
  <div class="pic"><img src="assets/img/${file}" alt="" /></div>
  <figcaption><b>${esc(label)}</b><span class="yr">${esc(chip)}</span><small>Credit: ${esc(creditOf(file))}</small></figcaption>
</figure>`;
}

let sketchN = 0;
/**
 * One of Dad's blue-pen sketches from the game (src/ui/drawing/machines.ts),
 * drawn on with the pen, then "boiling" like hand-drawn animation: three
 * copies of the lines take turns, a few times a second.
 */
function doodle(name: keyof typeof DRAWINGS, style: string, start: number, end: number, ink = "var(--dad-ink)"): string {
  const id = `sk${sketchN++}`;
  const copies = boil(DRAWINGS[name](), 21 + sketchN * 13, { strokeWidth: 2.3, roughness: 1.2 });
  const g = (k: number) =>
    `<g class="c${k}"${k ? ' style="opacity:0"' : ""}>${copies[k]!.map((d) => `<path d="${d}"${k ? "" : ' pathLength="1"'} />`).join("")}</g>`;
  A(`tl.fromTo("#${id} .c0 path", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, stagger: 0.015, ease: "power1.inOut" }, ${r3(start)});`);
  for (let t = start + 1.5, k = 1; t < end; t += 0.25, k += 1) A(`tl.set("#${id} g", { opacity: (i) => (i === ${k % 3} ? 1 : 0) }, ${r3(t)});`);
  return `<svg class="doodle" id="${id}" viewBox="0 0 320 220" style="${style};--inkc:${ink}" aria-hidden="true">${[0, 1, 2].map(g).join("")}</svg>`;
}

/** A round ink postmark: two rings, words around the top and bottom, a word in the middle. */
function postmark(id: string, top: string, bottom: string, mid: string, style: string, size = 230): string {
  return `<svg class="postmark" id="${id}" viewBox="0 0 200 200" style="width:${size}px;height:${size}px;${style}" aria-hidden="true">
  <defs><path id="${id}-t" d="M 30 100 A 70 70 0 0 1 170 100" /><path id="${id}-b" d="M 22 100 A 78 78 0 0 0 178 100" /></defs>
  <circle cx="100" cy="100" r="92" /><circle cx="100" cy="100" r="58" />
  <text class="arc"><textPath href="#${id}-t" startOffset="50%" text-anchor="middle">${esc(top)}</textPath></text>
  <text class="arc"><textPath href="#${id}-b" startOffset="50%" text-anchor="middle">${esc(bottom)}</textPath></text>
  <text class="mid" x="100" y="108" text-anchor="middle">${esc(mid)}</text>
</svg>`;
}

/** A postage stamp with a perforated edge (an SVG mask), holding our own drawing of the Moon and Mars. */
function postage(id: string, style: string): string {
  const W = 180;
  const H = 220;
  const holes: string[] = [];
  for (let x = 0; x <= W; x += 15) holes.push(`<circle cx="${x}" cy="0" r="5.5"/><circle cx="${x}" cy="${H}" r="5.5"/>`);
  for (let y = 0; y <= H; y += 15) holes.push(`<circle cx="0" cy="${y}" r="5.5"/><circle cx="${W}" cy="${y}" r="5.5"/>`);
  return `<svg class="postage" id="${id}" viewBox="0 0 ${W} ${H}" style="${style}" aria-hidden="true">
  <defs><mask id="${id}-m"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${holes.join("")}</g></mask></defs>
  <g mask="url(#${id}-m)">
    <rect width="${W}" height="${H}" fill="#fffaf0"/>
    <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="4" fill="#1d1e3c"/>
    <g fill="#fbf6ec">${[[40, 40, 1.6], [130, 34, 1.2], [148, 120, 1.4], [32, 150, 1.1], [92, 60, 0.9], [60, 178, 1.2], [140, 170, 0.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>
    <circle cx="72" cy="86" r="34" fill="#d7d1c4" stroke="#2b2622" stroke-width="3"/>
    <circle cx="60" cy="76" r="7" fill="#bdb6a8"/><circle cx="84" cy="98" r="5" fill="#bdb6a8"/><circle cx="80" cy="70" r="3.5" fill="#bdb6a8"/>
    <circle cx="122" cy="136" r="26" fill="#d9774b" stroke="#2b2622" stroke-width="3"/>
    <path d="M104 132 C 112 128, 126 140, 140 132" stroke="#b5532c" stroke-width="3" fill="none"/>
    <path d="M60 160 C 80 150, 96 150, 104 140" stroke="#f2a541" stroke-width="2.5" fill="none" stroke-dasharray="5 6"/>
    <text x="${W / 2}" y="${H - 26}" text-anchor="middle" class="pv">MOON &amp; MARS</text>
  </g>
</svg>`;
}

function card(p: Placed): string {
  const b = p.beat;
  const id = b.id;
  const s = p.start;
  const v0 = voiceAt(p);
  switch (b.card) {
    case "title-team": {
      F("tape", s + 0.55);
      F("join-chime", v0 + 1.2, 0.6);
      A(`tl.fromTo("#${id}-card", { y: 80, opacity: 0, rotation: 1.5 }, { y: 0, opacity: 1, rotation: -0.6, duration: 0.8, ease: "back.out(1.5)" }, ${s + 0.35});`);
      A(`tl.fromTo("#${id}-card .team > *", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12, ease: "power2.out" }, ${s + 0.7});`);
      A(`tl.fromTo("#${id}-card .names li", { opacity: 0, y: 12, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.14, ease: "back.out(2)" }, ${v0 + 1.3});`);
            A(`tl.to("#${id}-card", { y: 60, opacity: 0, duration: 0.45, ease: "power2.in" }, ${s + p.dur - 0.5});`);
      return `<div class="overlay"><div class="note credits" id="${id}-card">
  <span class="tape" style="left:18%"></span><span class="tape" style="left:82%"></span>
  <div class="team"><small>made with love by team</small><b>Hackstreet Boys</b><span>NASA Space Apps Challenge 2026</span></div>
  <ul class="names">
    <li>Adrian Kim P. De Guzman</li><li>John Carl Q. Bolo</li><li>Asthan Eilexer J. Patanao</li>
    <li>Victor Ronel P. Lumayad</li><li>Allen P. Del Valle</li><li>Jeric S. Base</li>
  </ul>
</div></div>`;
    }
    case "machines": {
      // Dad's corkboard: four photos pinned along one red thread, like his journey board in the game.
      const shots = [
        ["apollo11-lrrr.jpg", "Apollo 11's experiments", "Moon · 1969", -4, 80, 215],
        ["apollo15-lrv.jpg", "The Moon buggy, Apollo 15", "Moon · 1971", 3, 455, 270],
        ["opportunity-tracks.jpg", "Opportunity rover's view", "Mars · 2004", -2.5, 830, 210],
        ["ingenuity-valinor.jpg", "Ingenuity helicopter", "Mars · 2021", 4, 1190, 260],
      ] as const;
      const W = 340;
      const pins = shots.map(([, , , , x, y]) => [x + W / 2, y + 6] as const);
      const thread = `M ${pins[0]![0]} ${pins[0]![1]} ` + pins.slice(1).map(([x, y], i) => `Q ${(x + pins[i]![0]) / 2} ${Math.max(y, pins[i]![1]) + 70} ${x} ${y}`).join(" ");
      A(`tl.fromTo("#${id} .banner", { opacity: 0, y: -30, rotation: -4 }, { opacity: 1, y: 0, rotation: -1.5, duration: 0.5, ease: "back.out(1.8)" }, ${s + 0.25});`);
      F("tape", s + 0.4);
      shots.forEach((_, i) => {
        const t0 = v0 + 0.1 + i * 0.6;
        F("pop", t0 + 0.32, 0.8);
        A(`tl.fromTo("#${id}-p${i}", { y: -70, opacity: 0, rotation: ${i % 2 ? 10 : -10} }, { y: 0, opacity: 1, rotation: ${shots[i]![3]}, duration: 0.55, ease: "back.out(1.5)" }, ${r3(t0)});`);
        A(`tl.fromTo("#${id}-p${i} .pin", { scale: 0 }, { scale: 1, duration: 0.25, ease: "back.out(3)" }, ${r3(t0 + 0.3)});`);
      });
      A(`tl.fromTo("#${id} .thread path", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: "power1.inOut" }, ${r3(v0 + 2.3)});`);
      A(`tl.fromTo("#${id} .side-tag", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, stagger: 0.3, ease: "back.out(2.4)" }, ${r3(v0 + 2.9)});`);
      A(`tl.fromTo("#${id} .sticky", { opacity: 0, y: 30, rotation: 6 }, { opacity: 1, y: 0, rotation: 2, duration: 0.45, ease: "back.out(1.8)" }, ${r3(v0 + 3.6)});`);
      A(`tl.fromTo("#${id} .index-card", { opacity: 0, y: 30, rotation: -8 }, { opacity: 1, y: 0, rotation: -3, duration: 0.45, ease: "back.out(1.8)" }, ${r3(v0 + 2.4)});`);
      return `<div class="page cork" id="${id}">
  <div class="banner"><span class="tape" style="left:8%"></span><span class="tape" style="left:92%"></span>Machines people left behind</div>
  <span class="side-tag moon">The Moon</span><span class="side-tag mars">Mars</span>
  <svg class="thread" viewBox="0 0 1600 900"><path d="${thread}" pathLength="1" /></svg>
  ${shots.map(([f, l, chip, tilt, x, y], i) => pinned(`${id}-p${i}`, f, l, chip, { w: W, tilt, x, y })).join("\n  ")}
  <div class="index-card" style="left:120px;top:655px"><span class="pin"></span>${doodle("lrv", "left:20px;top:8px;width:250px", v0 + 2.6, s + p.dur + 0.5)}<small>Dad's sketch. Not to scale.</small></div>
  <p class="sticky" style="left:1220px;top:690px">Photos: NASA.<br />Credits on each photo.</p>
</div>`;
    }

    case "mirrors": {
      // An open page of Dad's notebook: the real photo taped in, his notes, his sketch and a postmark.
      F("tape", s + 0.4);
      F("pencil", v0 + 0.7, 0.8);
      F("stamp", v0 + 4.45);
      A(`tl.fromTo("#${id}-ph", { opacity: 0, x: -40, rotation: -6 }, { opacity: 1, x: 0, rotation: -2, duration: 0.6, ease: "back.out(1.4)" }, ${s + 0.15});`);
      A(`tl.fromTo("#${id} .chiprow > *", { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.12 }, ${s + 0.4});`);
      A(`tl.fromTo("#${id} .leaf.r h3", { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.4 }, ${s + 0.55});`);
      A(`tl.fromTo("#${id} .notes li", { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.4, stagger: 1.25, ease: "power2.out" }, ${v0 + 0.6});`);
      A(`tl.fromTo("#${id}-pm", { opacity: 0, scale: 2.2, rotation: -30 }, { opacity: 0.92, scale: 1, rotation: -14, duration: 0.3, ease: "power4.in" }, ${v0 + 4.2});`);
      return `<div class="page desk" id="${id}">
  <div class="book">
    <div class="leaf l">${photo(`${id}-ph`, "archive-reflectors.jpg", "A mirror panel on the Moon: Apollo 14's, 1971", { w: 620, tilt: -2, x: 50, y: 60, big: true })}</div>
    <div class="leaf r">
      <p class="chiprow"><span class="chip">True story</span><span class="chip2">Moon · 1969</span></p>
      <h3>The little mirrors</h3>
      <ul class="notes">
        <li><span class="hand">Left on the Moon in July 1969</span></li>
        <li><span class="hand">Apollo 11's panel has 100 little corner mirrors</span></li>
        <li><span class="hand">Still working: scientists bounce lasers off it today</span></li>
      </ul>
      ${doodle("lrrr", "right:30px;bottom:24px;width:250px", v0 + 0.9, s + p.dur + 0.5)}
    </div>
  </div>
  ${postmark(`${id}-pm`, "LEFT BEHIND", "STILL ANSWERING", "1969", "position:absolute;left:840px;top:585px", 220)}
</div>`;
    }

    case "quiet": {
      const tTrue = wordAt(p, 0, /^true/i, 0.85) - 0.1;
      F("tape", s + 0.4);
      F("pencil", tTrue, 0.8);
      A(`tl.fromTo("#${id}-ph", { opacity: 0, x: 40, rotation: 6 }, { opacity: 1, x: 0, rotation: 2, duration: 0.6, ease: "back.out(1.4)" }, ${s + 0.15});`);
      A(`tl.fromTo("#${id} .chiprow > *", { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.12 }, ${s + 0.4});`);
      A(`tl.fromTo("#${id} .leaf.l h3", { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.4 }, ${s + 0.55});`);
      A(`tl.fromTo("#${id} .tag", { opacity: 0, rotation: -14, y: -20 }, { opacity: 1, rotation: -4, y: 0, duration: 0.5, ease: "back.out(2)" }, ${v0 + 0.5});`);
      A(`tl.fromTo("#${id} .ask", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45 }, ${wordAt(p, 0, /^every/i, 0.7) - 0.2});`);
      A(`tl.fromTo("#${id} .ring path", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: "power1.inOut" }, ${tTrue});`);
      return `<div class="page desk" id="${id}">
  <div class="book">
    <div class="leaf l">
      <p class="chiprow"><span class="chip">True story</span><span class="chip2">Mars · 2004</span></p>
      <h3>Opportunity rover</h3>
      <div class="tag"><i></i>Last heard from:<b>June 10, 2018</b></div>
      <p class="ask"><span class="hand red">Old junk? Or a <span class="circled">true story?<svg class="ring" viewBox="0 0 300 90" preserveAspectRatio="none"><path pathLength="1" d="M18 52 C 12 20, 120 6, 210 10 C 280 14, 296 44, 270 66 C 230 90, 70 92, 26 70 C 8 60, 20 34, 60 22" /></svg></span></span></p>
      ${doodle("opportunity", "right:30px;bottom:14px;width:260px;opacity:0.9", v0 + 0.8, s + p.dur + 0.5)}
    </div>
    <div class="leaf r">${photo(`${id}-ph`, "opportunity-tracks.jpg", "Looking back from Opportunity, Mars", { w: 620, tilt: 2, x: 50, y: 60, big: true })}</div>
  </div>
</div>`;
    }

    case "challenge": {
      // The challenge as a letter on Dad's desk: our own stamp, a postmark, the big title, the question on a sticky note.
      F("page-flip", s + 0.1, 0.7);
      F("stamp", s + 0.75, 0.7);
      F("pencil", v0 + 1.4);
      A(`tl.fromTo("#${id} .letter", { opacity: 0, y: 40, rotation: 2 }, { opacity: 1, y: 0, rotation: -0.8, duration: 0.6, ease: "back.out(1.4)" }, ${s + 0.05});`);
      A(`tl.fromTo("#${id}-st", { opacity: 0, scale: 0.5, rotation: 20 }, { opacity: 1, scale: 1, rotation: 6, duration: 0.4, ease: "back.out(2.2)" }, ${s + 0.45});`);
      A(`tl.fromTo("#${id}-pm", { opacity: 0, scale: 2.2, rotation: -40 }, { opacity: 0.85, scale: 1, rotation: -18, duration: 0.28, ease: "power4.in" }, ${s + 0.7});`);
      A(`tl.fromTo("#${id} .kick", { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4 }, ${s + 0.35});`);
      A(`tl.fromTo("#${id} .big span", { opacity: 0, y: 30, rotation: -4 }, { opacity: 1, y: 0, rotation: 0, duration: 0.5, stagger: 0.2, ease: "back.out(1.8)" }, ${v0 + 0.3});`);
      A(`tl.fromTo("#${id} .swash path", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut" }, ${v0 + 1.3});`);
      A(`tl.fromTo("#${id} .sub", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, ${v0 + 1.7});`);
      const tq = wordAt(p, 0, /^asks/i, 0.45) + 0.2;
      F("tape", tq);
      A(`tl.fromTo("#${id} .sticky", { opacity: 0, y: 40, rotation: 8 }, { opacity: 1, y: 0, rotation: 2.5, duration: 0.5, ease: "back.out(1.8)" }, ${tq});`);
      A(`tl.fromTo("#${id} .arrow path", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5 }, ${tq + 0.4});`);
      return `<div class="page desk" id="${id}">
  <div class="letter">
    <p class="kick">Our challenge · NASA Space Apps Challenge 2026</p>
    <p class="big"><span>Abandoned</span> <span>but not</span> <span>Forgotten</span></p>
    <svg class="swash" viewBox="0 0 1000 40" preserveAspectRatio="none"><path pathLength="1" d="M8 26 C 180 12, 420 34, 640 18 C 780 8, 900 22, 992 14" /></svg>
    <p class="sub">Storytelling about NASA's Discarded Equipment on the Moon and Mars</p>
  </div>
  ${postage(`${id}-st`, "position:absolute;left:1290px;top:40px;width:170px")}
  ${postmark(`${id}-pm`, "OUR CHALLENGE", "SPACE APPS 2026", "★", "position:absolute;left:1160px;top:150px", 190)}
  <p class="sticky q2" style="left:520px;top:640px">How can we tell the stories of the machines left behind?</p>
  <svg class="arrow" viewBox="0 0 160 120" style="left:370px;top:610px"><path pathLength="1" d="M10 20 C 50 10, 110 30, 140 90 M140 90 L 112 80 M140 90 L 146 60" /></svg>
</div>`;
    }

    case "answer": {
      const steps: [string, string, string][] = [["letter", "--amber-deep", "Deliver Dad's letters"], ["book", "--dad-ink", "Learn true stories"], ["bot", "--sage-deep", "Rebuild Milo"]];
      const times = [wordAt(p, 1, /^deliver/i, 0.3), wordAt(p, 1, /^uncover/i, 0.5), wordAt(p, 1, /^rebuild/i, 0.75)];
      times.forEach((t0) => F("pop", t0 + 0.05));
      steps.forEach((_, i) => A(`tl.fromTo("#${id}-s${i}", { opacity: 0, y: 40, rotation: ${i % 2 ? 6 : -6} }, { opacity: 1, y: 0, rotation: ${[-2, 1.5, -1][i]}, duration: 0.5, ease: "back.out(2)" }, ${times[i]! - 0.1});`));
      A(`tl.to("#${id} .tags4", { opacity: 0, y: 30, duration: 0.4, ease: "power2.in" }, ${s + p.dur - 0.45});`);
      return `<div class="overlay" id="${id}"><div class="tags4 three">${steps.map(([icn, col, label], i) => `<span class="tag2" id="${id}-s${i}">${ic(icn, col)}<em>${i + 1}</em>${esc(label)}</span>`).join("")}</div></div>`;
    }
    case "tags": {
      const tags: [string, string, string][] = [["gift", "--amber-deep", "Free to play"], ["browser", "--dad-ink", "Plays in your browser"], ["star", "--clay", "Ages 10 and up"], ["people", "--sage-deep", "1 to 4 players"]];
      const tTen = wordAt(p, 0, /^(ten|10)/i, 0.8);
      const times = [wordAt(p, 0, /^free/i, 0.1), wordAt(p, 0, /^browser/i, 0.35), tTen, tTen + 0.8];
      times.forEach((t0) => F("pop", t0 + 0.05));
      tags.forEach((_, i) => A(`tl.fromTo("#${id}-t${i}", { opacity: 0, y: 50, scale: 0.7, rotation: ${i % 2 ? 10 : -10} }, { opacity: 1, y: 0, scale: 1, rotation: ${[-2.5, 1.5, -1.5, 2.5][i]}, duration: 0.5, ease: "back.out(2.2)" }, ${times[i]! - 0.1});`));
      tags.forEach((_, i) => A(`tl.fromTo("#${id}-t${i} .ic", { rotation: -180 }, { rotation: 0, duration: 0.6, ease: "back.out(2)" }, ${times[i]! - 0.05});`));
      A(`tl.to("#${id} .tags4", { opacity: 0, y: 30, duration: 0.4, ease: "power2.in" }, ${s + p.dur - 0.45});`);
      return `<div class="overlay" id="${id}"><div class="tags4">${tags.map(([icn, col, label], i) => `<span class="tag2" id="${id}-t${i}">${ic(icn, col)}${esc(label)}</span>`).join("")}</div></div>`;
    }
    case "demo-label": {
      F("stamp", s + 0.25);
      A(`tl.fromTo("#${id}-big", { opacity: 0, scale: 1.6, rotation: -8 }, { opacity: 1, scale: 1, rotation: -3, duration: 0.35, ease: "power4.in" }, ${s + 0.05});`);
      A(`tl.fromTo("#${id}-big .rec", { opacity: 0.25 }, { opacity: 1, duration: 0.5, repeat: 3, yoyo: true, ease: "sine.inOut" }, ${s + 0.4});`);
      A(`tl.to("#${id}-big", { opacity: 0, y: -30, scale: 0.9, duration: 0.4, ease: "power2.in" }, ${s + 2.4});`);
      return `<div class="overlay"><div class="note demo-big" id="${id}-big"><h2><span class="rec"></span>Let's play!</h2><p>Live demo · real gameplay, recorded in Chrome</p></div></div>`;
    }
    case "domes-note": {
      const t0 = wordAt(p, 0, /^label/i, 0.6);
      const tEnd = Math.min(s + p.dur, p.segs[1]?.at ?? s + p.dur) - 0.4;
      F("pencil", t0);
      A(`tl.fromTo("#${id}-n", { opacity: 0, x: -40, rotation: -6 }, { opacity: 1, x: 0, rotation: -2, duration: 0.5, ease: "back.out(1.8)" }, ${t0 - 0.2});`);
      A(`tl.fromTo("#${id}-n .ic", { scale: 0 }, { scale: 1, duration: 0.35, ease: "back.out(3)" }, ${t0 + 0.3});`);
      A(`tl.to("#${id}-n", { opacity: 0, x: -30, duration: 0.35 }, ${Math.max(t0 + 1.8, tEnd)});`);
      return `<div class="overlay"><div class="note callout" id="${id}-n" style="left:44px;top:44px">${ic("check", "--sage-deep")}<span>Every dome says<br /><b>"Model, not to scale"</b></span></div></div>`;
    }
    case "zoom-card": {
      const seg = p.segs[0]!;
      const tIn = r3(seg.at + Math.max(0.2, (15.2 - seg.from) / seg.rate));
      const tOut = r3(Math.min(seg.at + (18.5 - seg.from) / seg.rate, s + p.dur - 0.9));
      F("whoosh", tIn, 0.45);
      A(`tl.fromTo("#cam", { scale: 1 }, { scale: 1.55, duration: 1.0, ease: "power2.inOut" }, ${tIn});`);
      A(`tl.to("#cam", { scale: 1, duration: 0.8, ease: "power2.inOut" }, ${tOut});`);
      A(`tl.set("#cam", { scale: 1 }, ${s + p.dur});`);
      A(`tl.fromTo("#${id}-tip", { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, ${tIn + 0.9});`);
      A(`tl.to("#${id}-tip", { opacity: 0, duration: 0.3 }, ${tOut - 0.1});`);
      F("pop", tIn + 0.95, 0.6);
      return `<div class="overlay"><div class="note callout" id="${id}-tip" style="left:44px;top:44px">${ic("check", "--dad-ink")}<span>A real NASA photo,<br /><b>with its source link</b></span></div></div>`;
    }
    case "stat-opp": {
      const t0 = voiceAt(p) + 0.5;
      const t1 = wordAt(p, 0, /^(fourteen|14)/i, 0.42) - 0.9;
      F("tape", t0);
      F("discovery", t1 + 1.25, 0.7);
      A(`tl.fromTo("#${id}-c", { opacity: 0, x: -60, rotation: -5 }, { opacity: 1, x: 0, rotation: -1.5, duration: 0.55, ease: "back.out(1.6)" }, ${t0});`);
      A(`tl.fromTo("#${id}-c .later", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, ${t1 - 0.2});`);
      rollTo(p, `${id}-r`, 14, t1, 1.3);
      A(`tl.fromTo("#${id}-c .plus", { scale: 0, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.3, ease: "back.out(3)" }, ${t1 + 1.25});`);
      A(`tl.to("#${id}-c", { opacity: 0, x: -40, duration: 0.4, ease: "power2.in" }, ${s + p.dur - 0.5});`);
      const years = Array.from({ length: 14 }, (_, i) => i + 1);
      return `<div class="overlay"><div class="note stat" id="${id}-c"><span class="tape"></span>
  <small>Opportunity rover</small>
  <div class="row"><span class="lab">Planned</span><span class="num">90</span><span class="unit">Martian days</span></div>
  <div class="row later"><span class="lab">Lasted</span>${reel(`${id}-r`, years)}<span class="plus">+</span><span class="unit">years!</span></div>
</div></div>`;
    }
    case "stat-ing": {
      const t0 = voiceAt(p) + 0.4;
      const t1 = wordAt(p, 0, /^(seventy|72)/i, 0.7) - 0.6;
      F("tape", t0);
      F("discovery", t1 + 1.3, 0.7);
      A(`tl.fromTo("#${id}-c", { opacity: 0, x: -60, rotation: -5 }, { opacity: 1, x: 0, rotation: -1.5, duration: 0.55, ease: "back.out(1.6)" }, ${t0});`);
      A(`tl.fromTo("#${id}-c .later", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, ${t1 - 0.2});`);
      const steps = [5, 10, 20, 30, 40, 50, 60, 70, 72];
      rollTo(p, `${id}-r`, steps.length, t1, 1.4);
      A(`tl.fromTo("#${id}-c .later .unit", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(3)" }, ${t1 + 1.3});`);
      A(`tl.to("#${id}-c", { opacity: 0, x: -40, duration: 0.4, ease: "power2.in" }, ${s + p.dur - 0.5});`);
      return `<div class="overlay"><div class="note stat" id="${id}-c"><span class="tape"></span>
  <small>Ingenuity helicopter</small>
  <div class="row"><span class="lab">Planned</span><span class="num">5</span><span class="unit">test flights</span></div>
  <div class="row later"><span class="lab">Flew</span>${reel(`${id}-r`, steps)}<span class="unit">times!</span></div>
</div></div>`;
    }
    case "coop-note": {
      const chips: [string, string, string][] = [["people", "--sage-deep", "Private room code"], ["check", "--clay", "No chat"], ["star", "--amber-deep", "Emotes and kind phrases"]];
      const times = [wordAt(p, 0, /^private/i, 0.2), wordAt(p, 0, /^chat/i, 0.45), wordAt(p, 0, /^emotes/i, 0.6)];
      times.forEach((t0) => F("emote-pop", t0, 0.7));
      chips.forEach((_, i) => A(`tl.fromTo("#${id}-c${i}", { opacity: 0, x: -50, scale: 0.8 }, { opacity: 1, x: 0, scale: 1, duration: 0.45, ease: "back.out(2)" }, ${times[i]! - 0.1});`));
      A(`tl.to("#${id} .chips", { opacity: 0, x: -30, duration: 0.4 }, ${s + p.dur - 0.5});`);
      return `<div class="overlay" id="${id}"><div class="chips">${chips.map(([icn, col, label], i) => `<span class="tag2 chip" id="${id}-c${i}">${ic(icn, col)}${esc(label)}</span>`).join("")}</div></div>`;
    }
    case "light-day": {
      const t0 = wordAt(p, 0, /^november/i, 0.55);
      F("stamp", t0 + 0.3);
      A(`tl.fromTo("#${id}-st", { opacity: 0, scale: 2.3, rotation: -22 }, { opacity: 1, scale: 1, rotation: -7, duration: 0.32, ease: "power4.in" }, ${t0});`);
      return `<div class="overlay"><div class="stamp big-stamp" id="${id}-st" style="left:70px;top:330px">NOV 18, 2026<br /><small>1 light-day from Earth</small></div></div>`;
    }
    case "features": {
      const items = ["Every number has a source link", "Every model is labeled: not to scale", "Captions for every line", "Printable Field Guide for classrooms", "A calmer motion setting", "Music made in code"];
      const v1 = voiceAt(p, 1);
      const times = [v0 + 0.5, v0 + 4.6, v1 + 0.7, v1 + 2.4, v1 + 4.4, v1 + 6.6];
      A(`tl.fromTo("#frame", { x: 0, scale: 1 }, { x: -330, scale: 0.6, duration: 0.8, ease: "power3.inOut" }, ${s + 0.1});`);
      A(`tl.to("#frame", { x: 0, scale: 1, duration: 0.7, ease: "power3.inOut" }, ${s + p.dur - 0.75});`);
      A(`tl.fromTo("#${id}-list", { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, ${s + 0.4});`);
      A(`tl.to("#${id}-list", { opacity: 0, x: 60, duration: 0.5 }, ${s + p.dur - 0.7});`);
      items.forEach((_, i) => F("tick", times[i]! + 0.1));
      items.forEach((_, i) => A(`tl.fromTo("#${id}-i${i} .tick", { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.3, ease: "back.out(3)" }, ${times[i]});`));
      return `<div class="side note checklist" id="${id}-list"><h3>Made with care</h3><ul>${items.map((it, i) => `<li id="${id}-i${i}"><span class="tick">✓</span>${esc(it)}</li>`).join("")}</ul></div>`;
    }
    case "data": {
      const rows = [
        ["NASA Image and Video Library", "Mission photos on the true story cards", "images.nasa.gov"],
        ["NASA Photojournal", "Rover and helicopter images (PIA numbers)", "photojournal.jpl.nasa.gov"],
        ["NASA Scientific Visualization Studio", "CGI Moon Kit map on Dad's Moon globe", "svs.gsfc.nasa.gov"],
        ["USGS Astrogeology and NASA Ames", "Viking color mosaic on the Mars globe", "astrogeology.usgs.gov"],
        ["NASA NSSDCA", "Landing site coordinates for the globe pins", "nssdc.gsfc.nasa.gov"],
        ["NASA JPL Horizons", "Voyager 1 distance and light time, day by day", "ssd.jpl.nasa.gov/horizons"],
        ["NASA HEASARC", "Yale Bright Star Catalog for Dad's star map", "heasarc.gsfc.nasa.gov"],
        ["NASA mission sounds", "Mars wind and Ingenuity's amplified hum (Perseverance), Voyager plasma waves, Apollo 11", "science.nasa.gov"],
      ];
      const tabs = ["--amber", "--dad-ink", "--sage-deep", "--clay"];
      const v1 = voiceAt(p, 1);
      const times = [v0 + 1.6, v0 + 3.3, v0 + 5.0, v0 + 7.6, v0 + 10.4, v0 + 12.6, v0 + 14.4, v1 + 0.6];
      A(`tl.fromTo("#${id} .banner", { opacity: 0, y: -30, rotation: -4 }, { opacity: 1, y: 0, rotation: -1.2, duration: 0.5, ease: "back.out(1.8)" }, ${s + 0.2});`);
      F("tape", s + 0.35);
      rows.forEach((_, i) => F(i % 2 ? "tape" : "pop", times[i]! + 0.15, 0.8));
      rows.forEach((_, i) => A(`tl.fromTo("#${id}-r${i}", { opacity: 0, y: 40, rotation: ${i % 2 ? 6 : -6} }, { opacity: 1, y: 0, rotation: ${[-1.4, 1, -0.6, 1.4][i % 4]}, duration: 0.45, ease: "back.out(1.7)" }, ${times[i]});`));
      A(`tl.fromTo("#${id} .sticky", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, ${times[7]! + 0.8});`);
      return `<div class="page desk" id="${id}">
  <div class="banner">NASA data inside the game<span class="tape" style="left:6%"></span><span class="tape" style="left:94%"></span></div>
  <div class="grid">${rows.map(([n, u, src], i) => `<div class="dcard" id="${id}-r${i}" style="--tab:var(${tabs[i % 4]})"><i class="tabk"></i><b>${esc(n!)}</b><span>${esc(u!)}</span><small>${esc(src!)}</small></div>`).join("")}</div>
  <p class="sticky slim" style="left:470px;top:800px">Every source, with its full link: docs/submission/local/datasets.md</p>
</div>`;
    }

    case "impact": {
      const stamps = [
        ["LEFT BEHIND.", "STILL ANSWERING."],
        ["LEFT BEHIND.", "STILL TEACHING."],
        ["NOT LEFT BEHIND.", "STILL SENDING."],
      ];
      const times = [v0 + 5.1, v0 + 6.4, v0 + 7.6];
      stamps.forEach((_, i) => F("stamp", times[i]! + 0.28));
      stamps.forEach((_, i) => A(`tl.fromTo("#${id}-s${i}", { opacity: 0, scale: 2.4, rotation: ${-20 + i * 14} }, { opacity: 1, scale: 1, rotation: ${-7 + i * 6}, duration: 0.3, ease: "power4.in" }, ${times[i]});`));
      return `<div class="overlay stamps">${stamps.map(([a, b], i) => `<div class="stamp" id="${id}-s${i}">${a}<br />${b}</div>`).join("")}</div>`;
    }
    case "end": {
      F("pop", v0 + 1.2);
      F("delivery-chime", v0 + 1.3, 0.6);
      F("corner-sparkle", v0 + 3.0, 0.5);
      A(`tl.fromTo("#${id}-ph", { opacity: 0, y: -60, rotation: -12 }, { opacity: 1, y: 0, rotation: -3.5, duration: 0.8, ease: "back.out(1.5)" }, ${s + 0.15});`);
      A(`tl.fromTo("#${id} h1", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.5)" }, ${s + 0.35});`);
      A(`tl.fromTo("#${id} .pill", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2.4)" }, ${v0 + 1.1});`);
      A(`tl.to("#${id} .pill", { scale: 1.04, duration: 0.6, repeat: 5, yoyo: true, ease: "sine.inOut" }, ${v0 + 1.8});`);
      A(`tl.fromTo("#${id} .meta > *", { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.25, ease: "power2.out" }, ${v0 + 2.2});`);
      A(`tl.fromTo("#${id} .fine", { opacity: 0 }, { opacity: 1, duration: 0.6 }, ${v0 + 3.6});`);
      A(`tl.fromTo("#${id} .spark", { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.15, ease: "back.out(3)" }, ${v0 + 2.8});`);
      A(`tl.to("#${id} .spark", { rotation: 25, scale: 0.8, duration: 0.9, repeat: 5, yoyo: true, stagger: 0.2, ease: "sine.inOut" }, ${v0 + 3.4});`);
      F("stamp", v0 + 2.0 + 0.28, 0.8);
      A(`tl.fromTo("#${id}-pm", { opacity: 0, scale: 2.2, rotation: -40 }, { opacity: 0.9, scale: 1, rotation: -16, duration: 0.28, ease: "power4.in" }, ${v0 + 2.0});`);
      const sparks = [[96, 70], [780, 640], [1480, 70], [1530, 600], [880, 96]];
      return `<div class="page desk" id="${id}">
  ${sparks.map(([x, y]) => `<span class="spark" style="left:${x}px;top:${y}px">✦</span>`).join("")}
  <figure class="photo end-photo" id="${id}-ph" style="left:110px;top:215px;width:660px;--tilt:-3.5deg">
    <span class="tape"></span>
    <div class="pic wide"><img src="assets/img/title-still.jpg" alt="" /></div>
    <figcaption><b>The real game, free in your browser</b></figcaption>
  </figure>
  ${postmark(`${id}-pm`, "PIECES OF HOME", "PLAY FREE TODAY", "DELIVERED", "position:absolute;left:640px;top:600px", 190)}
  <div class="endcol">
    <h1>Pieces of Home</h1>
    <p class="pill">Play free: <b>piecesofhome.pages.dev</b></p>
    <div class="meta">
      <p class="best">Best on a laptop or desktop computer</p>
      <p class="code">Code: github.com/Vurios/piecesofhome</p>
      <p class="team">Made by team <b>Hackstreet Boys</b></p>
      <p class="chal">NASA Space Apps Challenge 2026 · Abandoned but not Forgotten</p>
    </div>
  </div>
  <p class="fine">NASA images carry their credits. NASA did not make, sponsor or endorse this project. Music and sounds made in code, plus CC0 samples. Narration: ${narrator}. Built with AI tools; see AI_USE.md.</p>
</div>`;
    }
    case "g-hi": {
      F("pop", s + 0.15);
      A(`tl.fromTo("#${id}-c", { opacity: 0, scale: 0.6, rotation: -10 }, { opacity: 1, scale: 1, rotation: -3, duration: 0.45, ease: "back.out(2.2)" }, ${s + 0.05});`);
      A(`tl.fromTo("#${id}-c b", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: "back.out(2)" }, ${s + 0.3});`);
      A(`tl.to("#${id}-c", { opacity: 0, x: -40, duration: 0.2, ease: "power2.in" }, ${s + p.dur - 0.22});`);
      return `<div class="overlay"><div class="note hi" id="${id}-c"><span class="tape"></span><small>Hi! We're</small><b>Hackstreet Boys</b></div></div>`;
    }
    case "g-lead": {
      // One clean page, three things in turn: the NASA photo, the challenge, one stamp.
      const tStill = wordAt(p, 0, /^still/i, 0.6);
      F("tape", s + 0.1);
      F("page-flip", s + 0.25, 0.6);
      F("stamp", tStill + 0.25);
      A(`tl.fromTo("#${id}-ph", { opacity: 0, x: -60, rotation: -9 }, { opacity: 1, x: 0, rotation: -3, duration: 0.4, ease: "back.out(1.6)" }, ${s + 0.02});`);
      A(`tl.fromTo("#${id} .letter", { opacity: 0, y: 30, rotation: 2 }, { opacity: 1, y: 0, rotation: 1, duration: 0.4, ease: "back.out(1.5)" }, ${s + 0.18});`);
      A(`tl.fromTo("#${id} .big span", { opacity: 0, y: 24, rotation: -4 }, { opacity: 1, y: 0, rotation: 0, duration: 0.32, stagger: 0.12, ease: "back.out(1.8)" }, ${s + 0.3});`);
      A(`tl.fromTo("#${id} .swash path", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" }, ${s + 0.75});`);
      A(`tl.fromTo("#${id} .sub", { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${s + 0.8});`);
      A(`tl.fromTo("#${id}-st", { opacity: 0, scale: 2.2, rotation: -20 }, { opacity: 1, scale: 1, rotation: -6, duration: 0.25, ease: "power4.in" }, ${tStill});`);
      return `<div class="page desk" id="${id}">
  ${photo(`${id}-ph`, "apollo11-lrrr.jpg", "Buzz Aldrin by Apollo 11's experiments, 1969", { w: 610, tilt: -3, x: 80, y: 120 })}
  <div class="letter lead2"><p class="kick">Our challenge</p><p class="big"><span>Abandoned</span> <span>but not</span> <span>Forgotten</span></p><svg class="swash" viewBox="0 0 1000 40" preserveAspectRatio="none"><path pathLength="1" d="M8 26 C 180 12, 420 34, 640 18 C 780 8, 900 22, 992 14" /></svg><p class="sub">Storytelling about NASA's Discarded Equipment on the Moon and Mars</p></div>
  <div class="stamp" id="${id}-st" style="left:940px;top:655px">APOLLO 11'S MIRRORS:<br />STILL IN USE TODAY</div>
</div>`;
    }
    case "g-name": {
      const t1 = wordAt(p, 0, /^left/i, 0.55);
      const t2 = wordAt(p, 0, /^shining/i, 0.85);
      F("stamp", t1 + 0.2);
      F("corner-sparkle", t2, 0.7);
      A(`tl.fromTo("#${id}-a", { opacity: 0, scale: 2.2, rotation: -16 }, { opacity: 1, scale: 1, rotation: -5, duration: 0.25, ease: "power4.in" }, ${t1});`);
      A(`tl.fromTo("#${id}-b", { opacity: 0, scale: 0.4, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(2.6)" }, ${t2 - 0.15});`);
      A(`tl.fromTo("#${id} .spark", { opacity: 0, scale: 0 }, { opacity: 1, scale: 1.2, duration: 0.3, stagger: 0.06, ease: "back.out(3)" }, ${t2});`);
      A(`tl.to("#${id} .spark", { rotation: 40, scale: 0.7, duration: 0.6, repeat: 2, yoyo: true, ease: "sine.inOut" }, ${t2 + 0.35});`);
      const sp = [[560, 560], [1040, 560], [470, 690], [1130, 690], [800, 770]];
      return `<div class="overlay" id="${id}">${sp.map(([x, y]) => `<span class="spark" style="left:${x}px;top:${y}px">✦</span>`).join("")}<div class="tagline"><span class="stamp tag-a" id="${id}-a">LEFT BEHIND.</span><span class="tag-b" id="${id}-b">Still shining.</span></div></div>`;
    }
    case "g-idea": {
      const chips: [string, string, string][] = [["letter", "--amber-deep", "Deliver Dad's letters"], ["star", "--dad-ink", "Play the science"], ["bot", "--sage-deep", "Rebuild Milo"]];
      const times = [wordAt(p, 0, /^deliver/i, 0.05), wordAt(p, 0, /^play/i, 0.42), wordAt(p, 0, /^rebuild/i, 0.55)];
      const tNasa = wordAt(p, 0, /^every/i, 0.7);
      times.forEach((t0) => F("pop", t0 + 0.05));
      chips.forEach((_, i) => {
        A(`tl.fromTo("#${id}-c${i}", { opacity: 0, y: -30, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "back.out(2.2)" }, ${times[i]! - 0.08});`);
        const out = i < chips.length - 1 ? times[i + 1]! - 0.18 : tNasa - 0.3;
        A(`tl.to("#${id}-c${i}", { opacity: 0, y: -16, duration: 0.18, ease: "power2.in" }, ${out});`);
      });
      const badges: [string, string, string][] = [["check", "--clay", "Every fact and photo: straight from NASA"]];
      F("tick", tNasa, 0.7);
      A(`tl.fromTo("#${id}-n0", { opacity: 0, y: -30, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(2.2)" }, ${tNasa});`);
      // Whooshes on the quick cuts, and a punch-in on the true story card so its NASA photo and source can be read.
      p.segs.forEach((sg, i) => { if (i > 0) F("whoosh", sg.at, 0.3); });
      const card = p.segs.find((sg) => sg.clip === "moon-letter" && sg.from >= 14);
      if (card) {
        A(`tl.fromTo("#cam", { scale: 1 }, { scale: 1.4, duration: 0.45, ease: "power2.out" }, ${r3(card.at + 0.15)});`);
        A(`tl.to("#cam", { scale: 1, duration: 0.25, ease: "power2.in" }, ${r3(card.at + card.dur - 0.05)});`);
      }
      return `<div class="overlay" id="${id}">
  ${chips.map(([icn, col, label], i) => `<div class="solo"><span class="tag2" id="${id}-c${i}">${ic(icn, col)}${esc(label)}</span></div>`).join("")}
  ${badges.map(([icn, col, label], i) => `<div class="solo"><span class="tag2 nasa" id="${id}-n${i}">${ic(icn, col)}${esc(label)}</span></div>`).join("")}
</div>`;
    }
    case "g-future": {
      F("pencil", s + 0.3, 0.7);
      A(`tl.fromTo("#${id}-h", { opacity: 0, x: -30, rotation: -6 }, { opacity: 1, x: 0, rotation: -2, duration: 0.5, ease: "back.out(1.8)" }, ${s + 0.15});`);
      A(`tl.fromTo("#${id}-h .u", { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, ${s + 0.6});`);
      p.segs.forEach((sg, i) => { if (i > 0) F("whoosh", sg.at, 0.25); });
      return `<div class="overlay" id="${id}"><div class="note imagine" id="${id}-h"><b>Imagine...</b><span>every classroom meeting these machines as friends</span><i class="u"></i></div></div>`;
    }
    case "g-end": {
      F("pop", s + 0.4);
      F("delivery-chime", v0 + 0.8, 0.6);
      A(`tl.fromTo("#${id}-ph", { opacity: 0, y: -50, rotation: -12 }, { opacity: 1, y: 0, rotation: -3.5, duration: 0.5, ease: "back.out(1.5)" }, ${s + 0.05});`);
      A(`tl.fromTo("#${id} h1", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.5)" }, ${s + 0.15});`);
      A(`tl.fromTo("#${id} .tagl", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" }, ${s + 0.45});`);
      A(`tl.fromTo("#${id} .pill", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2.4)" }, ${v0 + 0.6});`);
      A(`tl.fromTo("#${id} .meta > *", { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.15 }, ${v0 + 1.0});`);
      A(`tl.fromTo("#${id} .spark", { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.1, ease: "back.out(3)" }, ${s + 0.6});`);
      F("stamp", v0 + 1.2 + 0.28, 0.8);
      A(`tl.fromTo("#${id}-pm", { opacity: 0, scale: 2.2, rotation: -40 }, { opacity: 0.9, scale: 1, rotation: -16, duration: 0.28, ease: "power4.in" }, ${v0 + 1.2});`);
      const sparks = [[96, 70], [780, 640], [1480, 70], [1530, 600], [880, 96]];
      return `<div class="page desk" id="${id}">
  ${sparks.map(([x, y]) => `<span class="spark" style="left:${x}px;top:${y}px">✦</span>`).join("")}
  <figure class="photo end-photo" id="${id}-ph" style="left:110px;top:200px;width:660px;--tilt:-3.5deg">
    <span class="tape"></span>
    <div class="pic wide"><img src="assets/img/title-still.jpg" alt="" /></div>
    <figcaption><b>The real game, free in your browser</b></figcaption>
  </figure>
  ${postmark(`${id}-pm`, "PIECES OF HOME", "PLAY FREE TODAY", "DELIVERED", "position:absolute;left:640px;top:600px", 190)}
  <div class="endcol">
    <h1>Pieces of Home</h1>
    <p class="tagl">Left behind. Still shining.</p>
    <p class="pill">Play free: <b>piecesofhome.pages.dev</b></p>
    <div class="meta">
      <p class="best">Best on a laptop or desktop computer</p>
      <p class="team">Made by team <b>Hackstreet Boys</b></p>
      <p class="chal">NASA Space Apps Challenge 2026 · Abandoned but not Forgotten</p>
    </div>
  </div>
  <p class="fine">NASA images carry their credits. NASA did not make, sponsor or endorse this project. Music and sounds made in code, with CC0 samples. Code and credits: github.com/Vurios/piecesofhome.</p>
</div>`;
    }
    default:
      return "";
  }
}

// ---------------------------------------------------------------- composition
let track = 10;
const body: string[] = [];
const frameMedia: string[] = [];
const sections: { id: string; start: number; end: number }[] = [];
for (const p of placed) {
  const last = sections[sections.length - 1];
  if (last && last.id === p.beat.section) last.end = r3(p.start + p.dur);
  else sections.push({ id: p.beat.section, start: p.start, end: r3(p.start + p.dur) });
}

const XF = edit.xf ?? 0.5;
const flat = placed.flatMap((p) => p.segs.map((sg, i) => ({ p, i, s: sg })));
flat.forEach((g, k) => {
  const vid = `v-${g.p.beat.id}-${g.i}`;
  const end = g.s.at + g.s.dur;
  const next = flat[k + 1];
  const prev = flat[k - 1];
  const nextBeat = placed[placed.indexOf(g.p) + 1];
  const isLastOfBeat = g.i === g.p.segs.length - 1;
  // Run on under what comes next (a crossfade, or a page fading in), if the footage allows.
  const runsOn = (next && Math.abs(next.s.at - end) < 0.02) || (isLastOfBeat && nextBeat?.beat.paper);
  let dur = g.s.dur;
  if (runsOn) {
    const room = (clipSeconds(g.s.clip) - 0.06 - g.s.from) / g.s.rate - g.s.dur;
    dur = r3(g.s.dur + Math.max(0, Math.min(XF, room)));
  }
  frameMedia.push(
    `<video id="${vid}" class="clip seg" src="assets/clips/${g.s.clip}.mp4" muted playsinline data-start="${g.s.at}" data-duration="${dur}" data-media-start="${g.s.from}"${g.s.rate !== 1 ? ` data-playback-rate="${g.s.rate}"` : ""} data-track-index="${1 + (k % 2)}"></video>`,
  );
  if (prev && Math.abs(g.s.at - (prev.s.at + prev.s.dur)) < 0.02) A(`tl.fromTo("#${vid}", { opacity: 0 }, { opacity: 1, duration: ${XF}, ease: "power1.inOut" }, ${g.s.at});`);
});
placed.forEach((p, bi) => {
  const html = card(p);
  const next = placed[bi + 1];
  if (html) {
    const cls = p.beat.paper ? "clip layer paper-layer" : "clip layer";
    // Pages stay a little longer and dissolve into what follows.
    const dur = p.beat.paper && next ? r3(p.dur + XF) : p.dur;
    body.push(`<section id="b-${p.beat.id}" class="${cls}" data-start="${p.start}" data-duration="${dur}" data-track-index="${track++}">${html}</section>`);
    if (p.beat.paper && next) A(`tl.to("#b-${p.beat.id} .page", { opacity: 0, duration: ${XF}, ease: "power1.inOut" }, ${r3(p.start + p.dur)});`);
  }
  if (p.beat.paper) {
    F("page-flip", p.start + 0.05);
    A(`tl.fromTo("#b-${p.beat.id} .page", { opacity: 0, y: 24, rotation: -0.6 }, { opacity: 1, y: 0, rotation: 0, duration: 0.5, ease: "power2.out" }, ${p.start});`);
  }
});
// The cold open runs straight into the title shot (one continuous camera move), so it gets no push-in:
// a push-in would have to snap back at the join and read as a second zoom-out.
// A slow, warm push-in while the impact plays.
const impact = placed.find((p) => p.beat.id === "impact");
if (impact) {
  A(`tl.fromTo("#cam", { scale: 1 }, { scale: 1.08, duration: ${impact.dur}, ease: "sine.inOut" }, ${impact.start});`);
  A(`tl.set("#cam", { scale: 1 }, ${r3(impact.start + impact.dur + XF)});`);
}

// Section tabs for the whole of each part: top left over paper pages, top
// center over gameplay (the game's own objective note sits top left).
const TAB: Record<string, string> = { intro: "", problem: "The problem", solution: "Our solution", demo: "Live demo", features: "Features", data: "NASA data", impact: "Impact" };
const tabs = sections
  .filter((s) => TAB[s.id] && (edit as { tabs?: boolean }).tabs !== false)
  .map((s) => {
    F("whoosh", s.start);
    A(`tl.fromTo("#tab-${s.id}", { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "back.out(2)" }, ${s.start + 0.1});`);
    const sub = s.id === "demo" ? `<small>real gameplay</small>` : "";
    const top = ["demo", "impact", "solution", "features"].includes(s.id);
    return `<div id="tab-${s.id}" class="clip tab${top ? " top" : ""}" data-start="${s.start}" data-duration="${r3(s.end - s.start)}" data-track-index="${track++}"><i class="dot ${s.id}"></i><b>${esc(TAB[s.id]!)}</b>${sub}</div>`;
  });

// Dust motes drifting in the lamp light around the frame (seeded, so every render matches).
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const motes: string[] = [];
for (let i = 0; i < 26; i += 1) {
  const side = i % 2 ? rnd() * 140 + 6 : 1920 - 150 + rnd() * 140;
  const x = i % 5 === 0 ? 160 + rnd() * 1600 : side;
  const y = i % 5 === 0 ? 935 + rnd() * 120 : rnd() * 1050;
  const size = 3 + rnd() * 5;
  const d = 5 + rnd() * 6;
  motes.push(`<span class="mote" id="m${i}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px"></span>`);
  A(`tl.fromTo("#m${i}", { y: 0, opacity: 0.15 }, { y: ${-(30 + rnd() * 60).toFixed(0)}, opacity: ${(0.45 + rnd() * 0.4).toFixed(2)}, duration: ${d.toFixed(2)}, repeat: ${Math.ceil(TOTAL / d)}, yoyo: true, ease: "sine.inOut" }, ${(rnd() * 3).toFixed(2)});`);
}
A(`tl.fromTo("#backdrop", { scale: 1.04, x: -24 }, { scale: 1.14, x: 24, duration: ${TOTAL}, ease: "none" }, 0);`);
A(`tl.fromTo("#progress i", { scaleX: 0 }, { scaleX: 1, duration: ${TOTAL}, ease: "none" }, 0);`);
const ticks = sections.slice(1).map((sec) => `<b style="left:${((sec.start / TOTAL) * 100).toFixed(2)}%"></b>`).join("");

// Captions.
const capHtml = cues.map((c, i) => `<div id="cap-${i}" class="clip cap" data-start="${c.start}" data-duration="${r3(c.end - c.start)}" data-track-index="90"><span>${esc(c.text)}</span></div>`);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>${esc(script.title)}</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Kalam"; src: url("assets/fonts/kalam-latin-400-normal.woff2") format("woff2"); font-weight: 400; }
      @font-face { font-family: "Kalam"; src: url("assets/fonts/kalam-latin-700-normal.woff2") format("woff2"); font-weight: 700; }
      @font-face { font-family: "Atkinson Hyperlegible Next"; src: url("assets/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2") format("woff2"); font-weight: 200 800; }
      @font-face { font-family: "Zilla Slab"; src: url("assets/fonts/zilla-slab-latin-500-normal.woff2") format("woff2"); font-weight: 500; }
      @font-face { font-family: "Zilla Slab"; src: url("assets/fonts/zilla-slab-latin-700-normal.woff2") format("woff2"); font-weight: 700; }
      :root {
        --paper: #f4ecdd; --paper-light: #fbf6ec; --paper-deep: #ebdfc9; --paper-edge: #d9c7a6;
        --ink: #2b2622; --ink-soft: #62574d; --pencil: #8c8173; --dad-ink: #233f73;
        --amber: #f2a541; --amber-deep: #b8661c; --clay: #c0573e; --sage-deep: #557358; --dusk: #1d1e3c;
        --hand: "Kalam", cursive; --body: "Atkinson Hyperlegible Next", sans-serif; --head: "Zilla Slab", serif;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: var(--dusk); }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: var(--body); color: var(--ink); }
      #backdrop { position: absolute; inset: -40px; width: calc(100% + 80px); height: calc(100% + 80px); object-fit: cover; filter: blur(16px) brightness(0.42) saturate(0.9); }
      #vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(10, 8, 20, 0.55)); }
      #frame { position: absolute; left: 160px; top: 30px; width: 1600px; height: 900px; border-radius: 14px; overflow: hidden; background: #111; box-shadow: 0 0 0 8px var(--paper-light), 0 0 0 9px var(--paper-edge), 0 24px 60px rgba(0, 0, 0, 0.55); transform-origin: 50% 50%; }
      #frame video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .layer { position: absolute; inset: 0; }
      .overlay { position: absolute; left: 160px; top: 30px; width: 1600px; height: 900px; }
      .paper-layer .page { position: absolute; left: 160px; top: 30px; width: 1600px; height: 900px; border-radius: 14px; overflow: hidden;
        background: repeating-linear-gradient(to bottom, transparent 0 47px, rgba(92, 115, 147, 0.16) 47px 48px), linear-gradient(90deg, transparent 0 118px, rgba(192, 87, 62, 0.35) 118px 120px, transparent 120px), var(--paper);
        box-shadow: 0 0 0 8px var(--paper-light), 0 0 0 9px var(--paper-edge), 0 24px 60px rgba(0, 0, 0, 0.55); }
      .page h2 { position: absolute; left: 470px; top: 34px; font-family: var(--hand); font-weight: 700; font-size: 58px; color: var(--ink); }
      .page .foot { position: absolute; left: 150px; bottom: 26px; font-size: 20px; color: var(--ink-soft); }
      .page.center { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 22px; }
      .note { background: var(--paper-light); border: 1px solid var(--paper-edge); border-radius: 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); }
      .tape { position: absolute; top: -14px; left: 50%; width: 120px; height: 30px; margin-left: -60px; background: rgba(242, 222, 170, 0.78); transform: rotate(-3deg); box-shadow: 0 1px 2px rgba(0,0,0,0.15); }
      .photo { position: absolute; padding: 14px 14px 12px; background: #fffdf8; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3); transform: rotate(var(--tilt)); }
      .photo .pic { overflow: hidden; aspect-ratio: 4 / 3; background: #222; }
      .photo.big .pic { aspect-ratio: 4 / 3; }
      .photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .photo figcaption { padding-top: 10px; display: flex; flex-direction: column; gap: 4px; }
      .photo figcaption b { font-family: var(--hand); font-weight: 700; font-size: 24px; line-height: 1.15; color: var(--ink); }
      .photo.big figcaption b { font-size: 30px; }
      .photo figcaption small { font-size: 17px; color: var(--ink-soft); }
      .notes { position: absolute; list-style: none; display: flex; flex-direction: column; gap: 34px; width: 620px; }
      .hand { font-family: var(--hand); font-size: 44px; line-height: 1.2; color: var(--ink); }
      .hand.red { color: var(--clay); }
      .stamp { position: absolute; font-family: var(--head); font-weight: 700; font-size: 40px; line-height: 1.05; letter-spacing: 0.04em; color: var(--clay); border: 5px solid var(--clay); border-radius: 10px; padding: 12px 22px; background: rgba(251, 246, 236, 0.85); }
      .small { font-family: var(--head); font-weight: 700; font-size: 34px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--amber-deep); }
      .big { font-family: var(--hand); font-weight: 700; font-size: 118px; line-height: 1.05; color: var(--ink); }
      .big span { display: inline-block; }
      .line { width: 900px; height: 8px; border-radius: 4px; background: var(--amber); transform-origin: 0 50%; }
      .q { font-size: 40px; max-width: 1150px; color: var(--ink-soft); line-height: 1.3; }
      .title-card { position: absolute; left: 44px; bottom: 40px; width: 800px; padding: 26px 34px 22px; }
      .title-card .t1 { left: 120px; }
      .title-card .kicker { font-family: var(--hand); font-size: 28px; color: var(--ink-soft); }
      .title-card h1 { font-family: var(--head); font-weight: 700; font-size: 78px; line-height: 1; margin: 6px 0 10px; color: var(--ink); }
      .title-card .team { font-size: 27px; }
      .title-card .who { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 22px; margin: 12px 0 10px; font-size: 23px; }
      .title-card .event { font-size: 21px; color: var(--ink-soft); }
      .steps { position: absolute; left: 50%; bottom: 46px; width: 1180px; margin-left: -590px; list-style: none; display: flex; justify-content: space-around; padding: 20px 26px; font-family: var(--hand); font-weight: 700; font-size: 38px; }
      .steps b { display: inline-block; width: 50px; height: 50px; margin-right: 10px; border-radius: 50%; background: var(--amber); color: var(--ink); text-align: center; font-family: var(--head); font-size: 32px; line-height: 50px; }
      .tags { display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 34px 46px; padding: 0 200px; }
      .tag { display: inline-block; padding: 18px 34px; font-family: var(--hand); font-weight: 700; font-size: 54px; background: var(--paper-light); border: 3px solid var(--amber-deep); border-radius: 14px; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4); }
      .demo-big { position: absolute; left: 50%; top: 50%; width: 760px; margin: -110px 0 0 -380px; padding: 30px; text-align: center; }
      .demo-big h2 { font-family: var(--head); font-weight: 700; font-size: 84px; color: var(--clay); text-transform: uppercase; letter-spacing: 0.05em; }
      .demo-big p { font-size: 32px; color: var(--ink-soft); }
      .side { position: absolute; left: 1230px; top: 170px; width: 610px; padding: 34px 38px; }
      .checklist h3 { font-family: var(--hand); font-weight: 700; font-size: 50px; margin-bottom: 14px; }
      .checklist ul { list-style: none; display: flex; flex-direction: column; gap: 18px; font-size: 31px; line-height: 1.2; }
      .checklist li { display: flex; gap: 16px; align-items: flex-start; }
      .tick { flex: none; display: inline-block; width: 40px; height: 40px; border-radius: 8px; background: var(--sage-deep); color: #fff; text-align: center; font-size: 30px; line-height: 40px; font-weight: 800; }
      .grid { position: absolute; left: 150px; top: 160px; right: 70px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 26px; }
      .dcard { position: relative; display: flex; flex-direction: column; gap: 10px; min-height: 300px; padding: 24px 22px; background: var(--paper-light); border: 1px solid var(--paper-edge); border-top: 10px solid var(--amber); border-radius: 10px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18); }
      .dcard b { font-family: var(--head); font-weight: 700; font-size: 30px; line-height: 1.1; }
      .dcard span { font-size: 25px; line-height: 1.25; color: var(--ink); }
      .dcard small { margin-top: auto; font-size: 20px; color: var(--dad-ink); }
      .stamps { display: flex; align-items: center; justify-content: center; gap: 36px; }
      .stamps .stamp { position: relative; font-size: 44px; }
      #end h1, .page.center h1 { font-family: var(--head); font-weight: 700; font-size: 130px; line-height: 1; }
      .play { font-size: 54px; } .play b { color: var(--amber-deep); }
      .rest { display: flex; flex-direction: column; gap: 14px; align-items: center; }
      .code, .team { font-size: 34px; color: var(--ink-soft); }
      .fine { margin-top: 18px; max-width: 1240px; font-size: 22px; line-height: 1.45; color: var(--ink-soft); }
      .tab { position: absolute; left: 196px; top: 54px; display: flex; flex-direction: column; gap: 2px; padding: 12px 22px 12px 20px; background: var(--paper-light); border-left: 10px solid var(--amber); border-radius: 8px; box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35); }
      .tab b { font-family: var(--head); font-weight: 700; font-size: 30px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink); }
      .tab small { font-size: 19px; color: var(--ink-soft); }
      .tab.top { left: 0; right: 0; top: 2px; margin: 0 auto; width: fit-content; flex-direction: row; align-items: baseline; gap: 18px; padding: 7px 22px 9px 18px; }
      .tab.top b { font-size: 25px; }
      .cap { position: absolute; left: 330px; right: 330px; bottom: 26px; height: 108px; display: flex; align-items: center; justify-content: center; text-align: center; }
      .cap span { display: inline-block; max-width: 1260px; padding: 10px 26px 12px; background: rgba(251, 246, 236, 0.96); border-radius: 10px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4); font-size: 36px; line-height: 1.25; font-weight: 600; color: var(--ink); }
      #cam { position: absolute; inset: 0; transform-origin: 50% 86%; }
      .mote { position: absolute; border-radius: 50%; background: radial-gradient(circle, rgba(255, 214, 150, 0.95), rgba(255, 190, 110, 0)); }
      #progress { position: absolute; left: 160px; right: 160px; bottom: 8px; height: 5px; border-radius: 3px; background: rgba(251, 246, 236, 0.14); }
      #progress i { position: absolute; inset: 0; border-radius: 3px; background: linear-gradient(90deg, var(--amber), var(--clay)); transform-origin: 0 50%; }
      #progress b { position: absolute; top: -3px; width: 11px; height: 11px; margin-left: -5px; border-radius: 50%; background: var(--paper-light); box-shadow: 0 0 0 2px rgba(29, 30, 60, 0.6); }
      .dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: var(--amber); align-self: center; margin-right: 2px; }
      .dot.demo { background: #e04a3a; box-shadow: 0 0 0 4px rgba(224, 74, 58, 0.25); }
      .dot.problem { background: var(--clay); } .dot.solution { background: var(--sage-deep); } .dot.features { background: var(--dad-ink); } .dot.data { background: var(--dad-ink); } .dot.impact { background: var(--amber-deep); }
      .tab { flex-direction: row !important; align-items: center !important; gap: 12px !important; }
      .tab small { font-size: 20px; font-weight: 600; color: var(--ink-soft); }
      .credits { position: absolute; left: 60px; right: 60px; bottom: 30px; display: grid; grid-template-columns: 370px 1fr; align-items: center; gap: 6px 34px; padding: 22px 36px 16px; transform: rotate(-0.6deg); }
      .credits .tape { left: 18%; }
      .credits .team { display: flex; flex-direction: column; gap: 2px; }
      .credits .team small { font-family: var(--hand); font-size: 26px; color: var(--ink-soft); }
      .credits .team b { font-family: var(--head); font-weight: 700; font-size: 52px; line-height: 1; color: var(--ink); white-space: nowrap; }
      .credits .team span { font-size: 19px; color: var(--amber-deep); font-weight: 700; white-space: nowrap; }
      .credits .names { list-style: none; display: grid; grid-template-columns: repeat(3, max-content); justify-content: space-between; gap: 12px 26px; padding-left: 30px; border-left: 3px dashed var(--paper-edge); font-size: 23px; font-weight: 600; white-space: nowrap; }
      .credits .names li::before { content: "\\2726  "; color: var(--amber); }
      .credits .event { grid-column: 1 / -1; font-size: 19px; letter-spacing: 0.05em; color: var(--ink-soft); padding-top: 4px; }
      .tags4 { position: absolute; left: 40px; right: 40px; bottom: 30px; display: flex; justify-content: space-between; gap: 18px; }
      .tags4.three { left: 150px; right: 150px; }
      .tag2 { display: flex; align-items: center; gap: 14px; padding: 12px 26px 12px 12px; background: var(--paper-light); border: 1px solid var(--paper-edge); border-radius: 18px; box-shadow: 0 14px 30px rgba(0, 0, 0, 0.42); font-family: var(--hand); font-weight: 700; font-size: 38px; color: var(--ink); white-space: nowrap; }
      .tag2 em { font-style: normal; font-family: var(--head); font-size: 30px; color: var(--amber-deep); }
      .ic { flex: none; display: grid; place-items: center; width: 62px; height: 62px; border-radius: 50%; background: var(--c); box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.18); }
      .ic svg { width: 36px; height: 36px; }
      .chips { position: absolute; left: 40px; top: 230px; display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
      .chip { font-size: 34px; }
      .callout { position: absolute; display: flex; align-items: center; gap: 16px; padding: 16px 26px 16px 16px; font-size: 28px; line-height: 1.2; }
      .callout b { font-family: var(--hand); font-weight: 700; font-size: 34px; color: var(--ink); }
      .stat { position: absolute; left: 40px; top: 200px; width: 520px; padding: 22px 28px 20px; display: flex; flex-direction: column; gap: 6px; }
      .stat small { font-family: var(--head); font-weight: 700; font-size: 21px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--amber-deep); }
      .stat .row { display: flex; align-items: center; gap: 14px; }
      .stat .lab { width: 104px; font-family: var(--head); font-weight: 700; font-size: 22px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
      .stat .num, .stat .reel i { font-family: var(--head); font-weight: 700; font-size: 84px; line-height: 92px; color: var(--ink); font-style: normal; }
      .stat .later .reel i, .stat .plus { color: var(--clay); }
      .stat .plus { font-family: var(--head); font-weight: 700; font-size: 70px; margin-left: -10px; display: inline-block; }
      .stat .unit { font-family: var(--hand); font-weight: 700; font-size: 34px; color: var(--ink); display: inline-block; white-space: nowrap; }
      .roll { display: inline-block; height: 92px; overflow: hidden; }
      .reel { display: flex; flex-direction: column; }
      .big-stamp { font-size: 54px; padding: 16px 28px; background: rgba(251, 246, 236, 0.92); }
      .big-stamp small { font-size: 32px; letter-spacing: 0.02em; }
      .demo-big h2 { display: flex; align-items: center; justify-content: center; gap: 18px; }
      .rec { display: inline-block; width: 30px; height: 30px; border-radius: 50%; background: #e04a3a; }
      .page .sub { font-family: var(--hand); font-weight: 700; font-size: 44px; line-height: 1.2; max-width: 1480px; color: var(--dad-ink); }
      .page .q { font-size: 34px; }
      .end-photo .pic.wide { aspect-ratio: 16 / 9; }
      .end-photo figcaption b { font-size: 30px; }
      .endcol { position: absolute; left: 820px; right: 60px; top: 205px; display: flex; flex-direction: column; align-items: flex-start; gap: 22px; }
      #end .endcol h1 { font-size: 100px; text-align: left; white-space: nowrap; }
      .pill { display: inline-block; padding: 20px 38px 22px; border-radius: 999px; background: var(--amber); box-shadow: 0 10px 0 var(--amber-deep), 0 18px 30px rgba(0, 0, 0, 0.25); font-size: 42px; color: var(--ink); transform-origin: 30% 50%; }
      .pill b { font-weight: 800; color: var(--ink); }
      .meta { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
      .meta p { font-size: 29px; color: var(--ink-soft); white-space: nowrap; }
      .meta .best { font-family: var(--hand); font-weight: 700; font-size: 34px; color: var(--sage-deep); }
      .meta .chal { font-size: 24px; color: var(--dad-ink); }
      #end .fine { position: absolute; left: 130px; right: 90px; bottom: 26px; max-width: none; font-size: 19px; text-align: left; }
      .spark { position: absolute; font-size: 44px; color: var(--amber); }
      #mark { position: absolute; right: 16px; bottom: 10px; padding: 4px 11px 5px; background: rgba(251, 246, 236, 0.94); border: 2px dashed var(--amber-deep); border-radius: 7px; transform: rotate(-1.5deg); font-family: var(--hand); font-weight: 700; font-size: 16px; color: var(--ink-soft); }
      .hi { position: absolute; left: 90px; top: 300px; padding: 22px 40px 26px; display: flex; flex-direction: column; }
      .hi small { font-family: var(--hand); font-size: 44px; color: var(--ink-soft); }
      .hi b { font-family: var(--head); font-weight: 700; font-size: 100px; line-height: 1; color: var(--ink); white-space: nowrap; }
      .lead { position: absolute; left: 650px; top: 150px; width: 880px; padding: 26px 34px; }
      .lead .small2 { font-family: var(--head); font-weight: 700; font-size: 24px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--amber-deep); }
      .lead .bigt { font-family: var(--hand); font-weight: 700; font-size: 74px; line-height: 1.05; color: var(--ink); }
      .lead .bigt span { display: inline-block; }
      .lead .subt { margin-top: 8px; font-family: var(--hand); font-size: 32px; line-height: 1.2; color: var(--dad-ink); }
      .tagline { position: absolute; left: 0; right: 0; top: 560px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .tagline .stamp { position: relative; font-size: 60px; padding: 10px 30px; }
      .tag-b { display: inline-block; padding: 8px 34px 12px; background: var(--paper-light); border-radius: 14px; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4); font-family: var(--hand); font-weight: 700; font-size: 64px; color: var(--amber-deep); }
      .tags4.top { top: 24px; bottom: auto; }
      .tags4.three.top { left: 30px; right: 30px; justify-content: center; gap: 16px; }
      .solo { position: absolute; left: 0; right: 0; top: 30px; display: flex; justify-content: center; pointer-events: none; }
      .solo .tag2 { font-size: 40px; padding: 14px 30px 14px 16px; }
      .tag2.nasa { font-size: 29px; padding-right: 20px; }
      .solo .tag2.nasa { font-size: 38px; }
      .endcol h1 { font-family: var(--head); font-weight: 700; color: var(--ink); line-height: 1; }
      .pill { white-space: nowrap; font-size: 36px !important; }
      .imagine { position: absolute; left: 50px; top: 50px; padding: 18px 32px 22px; display: flex; flex-direction: column; max-width: 760px; transform: rotate(-2deg); }
      .imagine b { font-family: var(--hand); font-weight: 700; font-size: 74px; line-height: 1; color: var(--clay); }
      .imagine span { font-family: var(--hand); font-size: 36px; line-height: 1.2; color: var(--ink); }
      .imagine .u { display: block; height: 6px; margin-top: 8px; border-radius: 3px; background: var(--amber); transform-origin: 0 50%; }
      .tagl { font-family: var(--hand); font-weight: 700; font-size: 48px; color: var(--clay); }
      #g-end .endcol h1 { font-size: 100px; text-align: left; white-space: nowrap; }
      #g-end .fine { position: absolute; left: 110px; right: 90px; bottom: 26px; max-width: none; font-size: 19px; text-align: left; }

      /* ---- Dad's desk, his corkboard and his notebook: the game's own paper look ---- */
      .paper-layer .page.desk { background:
          radial-gradient(ellipse 70% 60% at 28% 22%, rgba(255, 214, 150, 0.3), transparent 70%),
          repeating-linear-gradient(0deg, transparent 0 178px, rgba(50, 25, 8, 0.45) 178px 181px),
          repeating-linear-gradient(90deg, rgba(70, 35, 12, 0.07) 0 2px, transparent 2px 7px, rgba(255, 230, 190, 0.05) 7px 9px, transparent 9px 16px),
          linear-gradient(180deg, #9a6438, #85532c); }
      .paper-layer .page.cork { background:
          radial-gradient(circle, rgba(92, 52, 22, 0.35) 0 1.3px, transparent 1.8px) 0 0 / 13px 13px,
          radial-gradient(circle, rgba(255, 226, 180, 0.22) 0 1px, transparent 1.5px) 6px 7px / 11px 11px,
          radial-gradient(ellipse at 50% 30%, #d39a62, #b67a45 70%, #a56c3b);
        box-shadow: inset 0 0 0 16px #7d4f2c, inset 0 0 0 19px #5f3a1f, inset 0 0 60px rgba(0, 0, 0, 0.35), 0 0 0 8px var(--paper-light), 0 0 0 9px var(--paper-edge), 0 24px 60px rgba(0, 0, 0, 0.55); }
      .banner { position: absolute; left: 0; right: 0; top: 38px; margin: 0 auto; width: fit-content; padding: 12px 56px 16px; background: var(--paper-light); border-radius: 6px; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35); font-family: var(--hand); font-weight: 700; font-size: 56px; line-height: 1.1; color: var(--ink); white-space: nowrap; transform: rotate(-1.5deg); }
      .side-tag { position: absolute; top: 118px; padding: 6px 18px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3); font-family: var(--head); font-weight: 700; font-size: 22px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--paper-light); background: var(--dusk); }
      .side-tag.moon { left: 120px; } .side-tag.mars { right: 120px; background: #9c3f22; }
      .thread { position: absolute; left: 0; top: 0; width: 1600px; height: 900px; overflow: visible; }
      .thread path { fill: none; stroke: #b13f2c; stroke-width: 3.5; stroke-linecap: round; stroke-dasharray: 1; filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.3)); }
      .photo.pinned { padding: 12px 12px 10px; }
      .index-card { position: absolute; width: 300px; height: 215px; background: repeating-linear-gradient(transparent 0 31px, rgba(92, 115, 147, 0.2) 31px 32px) 0 40px / 100% 100% no-repeat, linear-gradient(transparent 0 38px, rgba(192, 87, 62, 0.45) 38px 40px, transparent 40px), #fffdf6; box-shadow: 0 10px 22px rgba(0, 0, 0, 0.3); transform: rotate(-3deg); }
      .index-card small { position: absolute; left: 18px; bottom: 10px; font-family: var(--hand); font-size: 20px; color: var(--dad-ink); }
      .pin { position: absolute; z-index: 2; top: -12px; left: 50%; width: 26px; height: 26px; margin-left: -13px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ff8a73, #c0392b 55%, #7d1d12); box-shadow: 0 4px 6px rgba(0, 0, 0, 0.4); }
      .photo .yr { align-self: flex-start; margin-top: 2px; padding: 2px 10px; border: 2px solid var(--clay); border-radius: 4px; font-family: var(--head); font-weight: 700; font-size: 18px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--clay); }
      .photo.pinned figcaption small { font-size: 15px; }
      .sticky { position: absolute; width: 330px; padding: 22px 24px 26px; background: linear-gradient(#fff1a8, #fbe27a); box-shadow: 0 12px 22px rgba(0, 0, 0, 0.3); font-family: var(--hand); font-weight: 700; font-size: 30px; line-height: 1.2; color: var(--ink); transform: rotate(2deg); }
      .sticky.q2 { width: 760px; padding: 24px 36px 28px; font-size: 42px; }
      .sticky.slim { width: auto; padding: 12px 26px; font-size: 26px; font-weight: 400; white-space: nowrap; }
      .arrow { position: absolute; width: 150px; height: 112px; overflow: visible; }
      .arrow path, .swash path, .ring path { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; }
      .arrow path { stroke: var(--paper-light); stroke-width: 5; }
      .book { position: absolute; left: 80px; top: 50px; width: 1440px; height: 790px; display: flex; transform: rotate(-0.6deg); filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.45)); }
      .leaf { position: relative; flex: 1; padding: 54px 60px; background: repeating-linear-gradient(transparent 0 45px, rgba(92, 115, 147, 0.18) 45px 46px), var(--paper-light); }
      .leaf.l { border-radius: 14px 4px 4px 14px; box-shadow: inset -28px 0 30px -18px rgba(80, 50, 20, 0.35); }
      .leaf.r { border-radius: 4px 14px 14px 4px; box-shadow: inset 28px 0 30px -18px rgba(80, 50, 20, 0.35); }
      .chiprow { display: flex; gap: 12px; }
      .chip { padding: 4px 12px; border: 2px solid var(--clay); border-radius: 4px; font-family: var(--head); font-weight: 700; font-size: 20px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--clay); }
      .chip2 { padding: 6px 12px; border-radius: 4px; background: var(--dusk); font-family: var(--head); font-weight: 700; font-size: 20px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--paper-light); }
      .leaf h3 { margin-top: 14px; font-family: var(--hand); font-weight: 700; font-size: 66px; line-height: 1.1; color: var(--ink); }
      .leaf .notes { position: static; width: auto; margin-top: 22px; gap: 24px; }
      .leaf .notes li { display: flex; gap: 14px; }
      .leaf .notes li::before { content: "\\2713"; flex: none; font-family: var(--head); font-weight: 700; font-size: 34px; line-height: 1.3; color: var(--sage-deep); }
      .leaf .hand { font-size: 38px; }
      .doodle { position: absolute; height: auto; overflow: visible; }
      .doodle path { fill: none; stroke: var(--inkc); stroke-width: 2.3; stroke-linecap: round; stroke-linejoin: round; }
      .doodle .c0 path { stroke-dasharray: 1; }
      .postmark { mix-blend-mode: multiply; }
      .postmark circle { fill: none; stroke: var(--clay); stroke-width: 5; }
      .postmark circle + circle { stroke-width: 3; }
      .postmark text { fill: var(--clay); font-family: var(--head); font-weight: 700; }
      .postmark .arc { font-size: 19px; letter-spacing: 3px; }
      .postmark .mid { font-size: 28px; letter-spacing: 1px; }
      .postage { position: absolute; filter: drop-shadow(0 8px 10px rgba(0, 0, 0, 0.35)); }
      .postage .pv { fill: var(--paper-light); font-family: var(--head); font-weight: 700; font-size: 15px; letter-spacing: 2px; }
      .tag { position: relative; display: inline-flex; flex-direction: column; margin-top: 28px; padding: 14px 32px 16px 58px; border-radius: 6px 22px 22px 6px; background: #e9d3a4; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25); font-family: var(--head); font-weight: 700; font-size: 22px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); }
      .tag b { font-family: var(--hand); font-size: 52px; line-height: 1.1; letter-spacing: 0; text-transform: none; color: var(--ink); }
      .tag i { position: absolute; left: 20px; top: 50%; width: 18px; height: 18px; margin-top: -9px; border-radius: 50%; background: var(--paper-light); box-shadow: inset 0 0 0 4px #c9a86a; }
      .ask { margin-top: 44px; }
      .ask .hand { font-size: 54px; }
      .circled { position: relative; display: inline-block; }
      .ring { position: absolute; left: -18px; top: -10px; width: calc(100% + 36px); height: calc(100% + 22px); overflow: visible; }
      .ring path { stroke: var(--clay); stroke-width: 4; }
      .letter { position: absolute; left: 120px; top: 60px; width: 1220px; padding: 50px 70px 56px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; background: repeating-linear-gradient(transparent 0 47px, rgba(92, 115, 147, 0.14) 47px 48px), var(--paper-light); border-radius: 8px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); }
      .letter .kick { font-family: var(--head); font-weight: 700; font-size: 26px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--amber-deep); }
      .letter .big { max-width: 1080px; font-size: 112px; line-height: 1.02; }
      .swash { width: 900px; height: 36px; overflow: visible; }
      .swash path { stroke: var(--amber); stroke-width: 9; }
      .letter .sub { max-width: 1040px; font-family: var(--hand); font-weight: 700; font-size: 44px; line-height: 1.2; color: var(--dad-ink); }
      .page.desk .grid { left: 90px; right: 90px; top: 170px; gap: 30px 26px; }
      .page.desk .dcard { border-top: none; padding-top: 30px; min-height: 255px; box-shadow: inset 0 8px 0 var(--tab), 0 12px 24px rgba(0, 0, 0, 0.3); }
      .dcard .tabk { position: absolute; top: -16px; left: 22px; width: 110px; height: 22px; border-radius: 8px 8px 0 0; background: var(--tab); }
      .page.desk .sticky.slim { color: var(--ink); }
      .page.desk .endcol { top: 150px; left: 840px; right: 70px; padding: 36px 44px 40px; background: var(--paper-light); border-radius: 10px; box-shadow: 0 18px 36px rgba(0, 0, 0, 0.4); transform: rotate(1deg); }
      #end .endcol h1, #g-end .endcol h1 { font-size: 86px; }
      .page.desk .pill { border: 3px solid var(--ink); border-radius: 16px; box-shadow: 0 7px 0 var(--ink), 0 16px 26px rgba(0, 0, 0, 0.3); }
      .page.desk .meta p { white-space: normal; }
      #end.desk .fine, #g-end.desk .fine { color: rgba(251, 246, 236, 0.86); }
      .page.desk .spark { color: #ffd27a; text-shadow: 0 0 18px rgba(255, 200, 110, 0.7); }

      .letter.lead2 { left: 760px; top: 130px; width: 770px; padding: 34px 44px 40px; transform: rotate(1deg); }
      .letter.lead2 .big { font-size: 86px; }
      .letter.lead2 .swash { width: 560px; }
      .letter.lead2 .sub { font-size: 34px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
      <img id="backdrop" src="assets/img/workshop.webp" alt="" />
      <div id="vignette"></div>
      ${motes.join("")}
      <div id="frame"><div id="cam">
        ${frameMedia.join("\n        ")}
      </div></div>
      ${body.join("\n      ")}
      ${tabs.join("\n      ")}
      ${capHtml.join("\n      ")}
      <div id="progress"><i></i>${ticks}</div>${edit.mark ? `\n      <div id="mark">${esc(edit.mark)}</div>` : ""}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      ${anim.join("\n      ")}
      tl.set({}, {}, ${TOTAL});
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
writeFileSync(join(FILM, "index.html"), html);

// ---------------------------------------------------------------- plan, captions, script
const plan = {
  name: NAME,
  file: script.file,
  duration: TOTAL,
  fps: FPS,
  sections,
  beats: placed.map((p) => ({ id: p.beat.id, section: p.beat.section, start: p.start, end: r3(p.start + p.dur), card: p.beat.card ?? null })),
  voice: placed.flatMap((p) => p.voice.map((v) => ({ ...v, file: `audio/voice/${v.id}.wav` }))),
  clips: placed.flatMap((p) => p.segs.map((s) => ({ beat: p.beat.id, ...s }))),
  captions: cues,
  fx: fx.sort((a, b) => a.at - b.at),
};
writeFileSync(join(FILM, "plan.json"), JSON.stringify(plan, null, 1));
mkdirSync(join(VIDEO, "out"), { recursive: true });
const tc = (x: number, ms = true) => {
  const h = Math.floor(x / 3600);
  const m = Math.floor((x % 3600) / 60);
  const s = Math.floor(x % 60);
  const f = Math.round((x - Math.floor(x)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${ms ? `,${String(f).padStart(3, "0")}` : ""}`;
};
writeFileSync(join(VIDEO, "out", script.file.replace(/\.mp4$/, ".en.srt")), cues.map((c, i) => `${i + 1}\n${tc(c.start)} --> ${tc(c.end)}\n${c.text}\n`).join("\n"));
const mmss = (x: number) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
const md: string[] = [`# ${script.title}: timecoded script`, "", `Generated by video/tools/build-film.ts from video/script/${NAME}.json and ${NAME}.edit.json. Length ${mmss(TOTAL)} (${TOTAL} s).`, "", "Every claim names its fact ID in src/data/facts.json. Lines with no fact IDs make no factual claim beyond what the game does.", ""];
for (const sec of sections) {
  md.push(`## ${sectionLabel.get(sec.id) ?? sec.id} (${mmss(sec.start)} to ${mmss(sec.end)})`, "");
  for (const p of placed.filter((x) => x.beat.section === sec.id)) {
    const vis = p.segs.length ? p.segs.map((s) => `${s.clip} ${s.from.toFixed(1)} s${s.rate !== 1 ? ` at ${s.rate}x` : ""}`).join(", ") : "paper page";
    md.push(`- **${mmss(p.start)}** ${p.beat.id}${p.beat.card ? ` (card: ${p.beat.card})` : ""}. Picture: ${vis}.`);
    for (const v of p.voice) {
      const l = lines.get(v.id)!;
      md.push(`  - ${mmss(v.start)} "${l.caption ?? l.text}" ${l.facts.length ? `[facts: ${l.facts.join(", ")}]` : "[no fact claim]"}`);
    }
  }
  md.push("");
}
writeFileSync(join(VIDEO, "script", `${NAME}.md`), md.join("\n"));
console.log(`film: ${mmss(TOTAL)} (${TOTAL} s), ${placed.length} beats, ${cues.length} captions, ${plan.clips.length} clip segments`);
for (const s of sections) console.log(`  ${s.id}: ${mmss(s.start)} to ${mmss(s.end)} (${(s.end - s.start).toFixed(1)} s)`);
