/**
 * Checks that each narration clip says its script line: transcribes the clip
 * locally (HyperFrames transcribe, Parakeet or Whisper) and reports the word
 * error rate against the script. Also keeps the word timings, which the
 * subtitle builder uses.
 *
 *   node video/tools/verify-voice.mjs <dir-with-wavs> [--prefix=af_heart-]
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const dir = resolve(process.argv[2]);
const prefix = (process.argv.find((a) => a.startsWith("--prefix=")) ?? "--prefix=").slice(9);
// --ids=a,b checks just those clips and keeps the other entries already in asr.json.
const only = new Set(((process.argv.find((a) => a.startsWith("--ids=")) ?? "--ids=").slice(6)).split(",").filter(Boolean));
// Every script in video/script, so any cut (demo, global30) can be checked.
const lines = Object.fromEntries(
  readdirSync(join(VIDEO, "script"))
    .filter((f) => f.endsWith(".json") && !f.includes(".edit."))
    .flatMap((f) => JSON.parse(readFileSync(join(VIDEO, "script", f), "utf8")).sections.flatMap((s) => s.lines))
    .map((l) => [l.id, l.text]),
);

const words = (t) =>
  t
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

function wer(ref, hyp) {
  const r = words(ref);
  const h = words(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= r.length; i += 1)
    for (let j = 1; j <= h.length; j += 1) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d[r.length][h.length] / Math.max(1, r.length);
}

const tmp = join(VIDEO, "audio/build/asr");
mkdirSync(tmp, { recursive: true });
const report = only.size && existsSync(join(dir, "asr.json")) ? JSON.parse(readFileSync(join(dir, "asr.json"), "utf8")) : {};
for (const file of readdirSync(dir).filter((f) => f.endsWith(".wav") && f.startsWith(prefix) && (!only.size || only.has(basename(f, ".wav"))))) {
  const id = basename(file, ".wav").slice(prefix.length).replace(/^[a-z]+_[a-z]+-/, "");
  const ref = lines[id];
  if (!ref) continue;
  const work = join(tmp, basename(file, ".wav"));
  mkdirSync(work, { recursive: true });
  copyFileSync(join(dir, file), join(work, "clip.wav"));
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["hyperframes", "transcribe", "clip.wav", "--json", "-d", work], { cwd: work, stdio: ["ignore", "ignore", "ignore"], shell: process.platform === "win32" });
  const t = JSON.parse(readFileSync(join(work, "transcript.json"), "utf8"));
  const list = Array.isArray(t) ? t : (t.words ?? t.segments ?? []);
  const said = list.map((w) => w.text ?? w.word ?? "").join(" ");
  report[file] = { wer: Math.round(wer(ref, said) * 1000) / 1000, said, words: list.map((w) => ({ text: (w.text ?? w.word ?? "").trim(), start: w.start, end: w.end })) };
  console.log(`${file}: WER ${(report[file].wer * 100).toFixed(1)}%  "${said.trim().slice(0, 140)}"`);
}
writeFileSync(join(dir, "asr.json"), JSON.stringify(report, null, 1));
