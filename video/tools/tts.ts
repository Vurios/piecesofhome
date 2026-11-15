/**
 * Narration from the script, with one of two engines:
 *
 * - Kokoro (default): the open Kokoro-82M model (Apache-2.0) run locally
 *   through kokoro-js. Voices look like "af_heart" or "bm_george".
 * - Gemini: Google's Gemini TTS (TTS_ENGINE=gemini). Reads GEMINI_API_KEY
 *   from docs/submission/private/.env (git-ignored) or the environment and
 *   never prints it. Voices look like "Sulafat".
 *
 *   npx tsx video/tools/tts.ts audition <voice,voice,...> [line-id ...]
 *   npx tsx video/tools/tts.ts lines <voice> [line-id ...]
 *
 * Writes 24 kHz mono WAV files:
 * auditions to video/audio/voice/auditions/<voice>-<line>.wav, final lines to
 * video/audio/voice/<line>.wav, plus voice/lines.json with each duration.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const ROOT = resolve(VIDEO, "..");
const ENGINE = process.env["TTS_ENGINE"] ?? "kokoro";
const MODEL = ENGINE === "gemini" ? (process.env["TTS_MODEL"] ?? "gemini-3.8-flash-tts") : "Kokoro-82M-v1.0 (onnx-community/Kokoro-82M-v1.0-ONNX)";
/** Kokoro reads some names better spelled the way they sound. Captions keep the real spelling. */
const SAY: [RegExp, string][] = [
  [/Hackstreet/g, "Hack-street"],
];

function key(): string {
  if (process.env["GEMINI_API_KEY"]) return process.env["GEMINI_API_KEY"];
  const file = join(ROOT, "docs/submission/private/.env");
  if (existsSync(file)) {
    const m = readFileSync(file, "utf8").match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1]!.trim();
  }
  throw new Error("GEMINI_API_KEY is missing (docs/submission/private/.env)");
}

interface Line {
  id: string;
  text: string;
}
interface Script {
  style: string;
  sections: { lines: Line[] }[];
}

export function loadScript(name = process.env["SCRIPT"] ?? "demo"): Script {
  return JSON.parse(readFileSync(join(VIDEO, "script", `${name}.json`), "utf8")) as Script;
}

function wav(pcm: Buffer, rate = 24000): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

let kokoro: { generate(text: string, o: { voice: string; speed: number }): Promise<{ audio: Float32Array; sampling_rate: number }> } | null = null;

async function speakKokoro(text: string, voice: string): Promise<Buffer> {
  if (!kokoro) {
    const { KokoroTTS } = await import("kokoro-js");
    kokoro = (await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" })) as never;
  }
  let said = text;
  for (const [a, b] of SAY) said = said.replace(a, b);
  const out = await kokoro!.generate(said, { voice, speed: Number(process.env["TTS_SPEED"] ?? 0.95) });
  const pcm = Buffer.alloc(out.audio.length * 2);
  for (let i = 0; i < out.audio.length; i += 1) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out.audio[i]! * 32767))), i * 2);
  return wav(pcm, out.sampling_rate);
}

async function speak(text: string, style: string, voice: string): Promise<Buffer> {
  if (ENGINE !== "gemini") return speakKokoro(text, voice);
  const body = {
    contents: [{ parts: [{ text: `${style}\n"${text}"` }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key() },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[] };
      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part?.inlineData) throw new Error("no audio in the reply");
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] ?? 24000);
      return wav(Buffer.from(part.inlineData.data, "base64"), rate);
    }
    const msg = (await res.text()).slice(0, 300);
    console.log(`  attempt ${attempt}: HTTP ${res.status} ${msg}`);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
  throw new Error("TTS failed");
}

function seconds(w: Buffer): number {
  return (w.length - 44) / (w.readUInt32LE(24) * 2);
}

const [mode, voiceArg, ...ids] = process.argv.slice(2);
const script = loadScript();
const all = script.sections.flatMap((s) => s.lines);
const pick = ids.length ? all.filter((l) => ids.includes(l.id)) : all;

if (mode === "audition") {
  const dir = join(VIDEO, "audio/voice/auditions");
  mkdirSync(dir, { recursive: true });
  for (const voice of voiceArg!.split(",")) {
    for (const line of pick) {
      const out = join(dir, `${voice}-${line.id}.wav`);
      if (existsSync(out)) continue;
      const w = await speak(line.text, script.style, voice);
      writeFileSync(out, w);
      console.log(`${voice} ${line.id}: ${seconds(w).toFixed(2)} s`);
    }
  }
} else if (mode === "lines") {
  const dir = join(VIDEO, "audio/voice");
  mkdirSync(dir, { recursive: true });
  const indexFile = join(dir, "lines.json");
  const index = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as Record<string, unknown>) : {};
  for (const line of pick) {
    const w = await speak(line.text, script.style, voiceArg!);
    writeFileSync(join(dir, `${line.id}.wav`), w);
    index[line.id] = { voice: voiceArg, model: MODEL, text: line.text, seconds: Math.round(seconds(w) * 1000) / 1000 };
    writeFileSync(indexFile, JSON.stringify(index, null, 1));
    console.log(`${line.id}: ${seconds(w).toFixed(2)} s`);
  }
} else {
  console.log("usage: tts.ts audition <voices> [ids] | lines <voice> [ids]");
}
