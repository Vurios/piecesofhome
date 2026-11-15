/**
 * The web copy of the 30-second video for https://piecesofhome.pages.dev/trailer/:
 * the same film re-encoded smaller (H.264 CRF 23, AAC 128 kb/s, fast start),
 * a poster frame from the end card, and WebVTT captions from the .srt.
 *
 *   node video/tools/web-trailer.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VIDEO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(VIDEO, "..");
const SRC = join(VIDEO, "out", "HackstreetBoys_PiecesOfHome_30s.mp4");
const DST = join(ROOT, "public", "trailer");
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });

ff(["-i", SRC, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-map_metadata", "0", join(DST, "pieces-of-home-30s.mp4")]);
ff(["-ss", "28.6", "-i", SRC, "-frames:v", "1", "-vf", "scale=1280:-1", "-q:v", "4", join(DST, "poster.jpg")]);
const srt = readFileSync(SRC.replace(/\.mp4$/, ".en.srt"), "utf8");
writeFileSync(join(DST, "captions.vtt"), "WEBVTT\n\n" + srt.replace(/\r/g, "").replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2"));
console.log(`trailer: ${(statSync(join(DST, "pieces-of-home-30s.mp4")).size / 1e6).toFixed(1)} MB, poster and captions written`);
