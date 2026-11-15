/**
 * Puts the picture and the sound together into the final MP4.
 *
 *   node video/tools/finish.mjs [name]
 *
 * Takes video/out/picture.mp4 (the HyperFrames render, no sound),
 * video/audio/build/mix.wav and the captions, and writes
 * video/out/<file>.mp4: H.264 video copied as is, AAC 48 kHz 192 kb/s sound,
 * an English caption track (the captions are also burned into the picture),
 * and metadata that says the video was made with AI tools. Also writes the
 * upload description to video/out/<file>.description.txt.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VIDEO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2] ?? "demo";
const script = JSON.parse(readFileSync(join(VIDEO, "script", `${name}.json`), "utf8"));
const out = join(VIDEO, "out", script.file);
const PICTURE = join(VIDEO, "out", name === "demo" ? "picture.mp4" : `picture-${name}.mp4`);
const MIX = join(VIDEO, "audio", name === "demo" ? "build" : `build-${name}`, "mix.wav");
const srt = out.replace(/\.mp4$/, ".en.srt");
const AI_NOTE = "Made with AI tools: an AI coding assistant (Claude Code) helped build the game and this video, and the narration is a synthetic voice (Chatterbox, an open text-to-speech model). Gameplay is the real game. Details: AI_USE.md in https://github.com/Vurios/piecesofhome";
const TITLE = name === "demo" ? "demo" : "30-second demo";
const description = [
  `Pieces of Home (${TITLE}): a cozy browser game about the machines left on the Moon and Mars. Left behind. Still shining.`,
  "Team Hackstreet Boys, NASA Space Apps Challenge 2026. Challenge: Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars.",
  "",
  "Play free: https://piecesofhome.pages.dev",
  "Code: https://github.com/Vurios/piecesofhome",
  "",
  "NASA data used: NASA Image and Video Library, NASA Photojournal, Lunar Reconnaissance Orbiter Camera (NASA/GSFC/ASU), NASA SVS CGI Moon Kit, Viking Mars mosaic (NASA Ames, USGS), NASA NSSDCA landing sites, JPL Horizons (Voyager 1), Yale Bright Star Catalog (NASA HEASARC), NASA mission recordings. NASA images carry their credits on screen. NASA did not make, sponsor or endorse this project.",
  "",
  "Music: a score written in code for this video, with CC0 instrument samples. Sound effects: the game's own (made in code, plus CC0 samples). No outside music or footage. Best played on a laptop or desktop computer.",
  AI_NOTE,
].join("\n");
writeFileSync(out.replace(/\.mp4$/, ".description.txt"), `${description}\n`);
// The picture sets the length. (Not -shortest: the caption track ends with
// the last spoken line, before the end card, and would cut the film short.)
const length = execFileSync(
  "ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", PICTURE],
  { encoding: "utf8" },
).trim();
execFileSync(
  "ffmpeg",
  [
    "-v", "error", "-y",
    "-i", PICTURE,
    "-i", MIX,
    "-i", srt,
    "-map", "0:v:0", "-map", "1:a:0", "-map", "2:s:0",
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-c:s", "mov_text",
    "-metadata:s:a:0", "language=eng",
    "-metadata:s:s:0", "language=eng",
    "-metadata:s:s:0", "title=English",
    "-metadata", `title=Pieces of Home: ${TITLE} (Hackstreet Boys, NASA Space Apps Challenge 2026)`,
    "-metadata", "artist=Hackstreet Boys",
    "-metadata", "date=2026",
    "-metadata", `comment=${AI_NOTE}`,
    "-metadata", `description=${description}`,
    "-movflags", "+faststart",
    "-t", length,
    out,
  ],
  { stdio: "inherit" },
);
console.log(out);
