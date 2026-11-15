/**
 * Builds the presentation slides in the game's paper style: Dad's desk, his
 * corkboard and his notebook, the same look as the videos.
 *
 *   npx tsx video/tools/build-slides.ts
 *
 * Takes stills from the captured gameplay (video/capture/*.mp4; the clean
 * captures hide the HUD) and NASA images from public/images/nasa, writes
 * docs/submission/local/slides/slides.html, then prints it to
 * docs/submission/local/PiecesOfHome_Slides.pdf (16:9) and saves one image per
 * slide for the PowerPoint copy (video/tools/slides-pptx.py adds the speaker
 * notes). Speaker notes also go to docs/submission/local/speaker-notes.md.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { DRAWINGS } from "../../src/ui/drawing/machines";
import { sketch } from "../../src/ui/drawing/sketch";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const ROOT = resolve(VIDEO, "..");
const OUT = join(ROOT, "docs/submission/local");
const DIR = join(OUT, "slides");
const IMG = join(DIR, "img");
const PNG = join(VIDEO, "out/slides");
for (const d of [IMG, PNG]) mkdirSync(d, { recursive: true });

/** A clean capture (no HUD) when there is one, else the normal one. */
const cap = (clip: string) => (existsSync(join(VIDEO, "capture", `${clip}-clean.mp4`)) ? `${clip}-clean` : clip);
const stills: Record<string, [string, number]> = {
  title: ["title-still", 14.2],
  journey: [cap("bench-trip"), 4.6],
  trip: [cap("bench-trip"), 9.0],
  letter: [cap("moon-letter"), 7.0],
  card: [cap("moon-letter"), 16.5],
  cardhud: ["moon-letter", 16.5],
  laser: [cap("send-a-light"), 5.6],
  moon: [cap("moon-letter"), 1.2],
  mars: [cap("mars-devil"), 11.0],
  valinor: ["valinor-ingenuity", 2.5],
  dish: [cap("finale-dish"), 20.0],
  play: [cap("coop"), 12.0],
  milo: [cap("milo-complete"), 10.0],
  notebook: ["notebook", 6.0],
};
for (const [name, [clip, t]] of Object.entries(stills)) {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", join(VIDEO, "capture", `${clip}.mp4`), "-frames:v", "1", "-q:v", "2", join(IMG, `${name}.jpg`)]);
}
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(IMG, "cardhud.jpg"), "-vf", "crop=1000:300:460:748", "-q:v", "2", join(IMG, "cardcrop.jpg")]);
for (const f of ["apollo11-lrrr.jpg", "opportunity-tracks.jpg", "apollo15-lrv.jpg", "ingenuity-valinor.jpg"]) copyFileSync(join(ROOT, "public/images/nasa", f), join(IMG, f));
const fonts = join(DIR, "fonts");
mkdirSync(fonts, { recursive: true });
for (const f of ["kalam-latin-700-normal.woff2", "kalam-latin-400-normal.woff2", "atkinson-hyperlegible-next-latin-wght-normal.woff2", "zilla-slab-latin-700-normal.woff2"]) copyFileSync(join(ROOT, "public/fonts", f), join(fonts, f));

const credits = JSON.parse(readFileSync(join(ROOT, "src/data/credits.json"), "utf8")) as { media: { file: string; credit: string }[] };
const credit = (f: string) => credits.media.find((m) => m.file === `images/nasa/${f}`)?.credit ?? "NASA";

interface Slide {
  html: string;
  notes: string;
  bg?: "desk" | "cork" | "photo";
}
const TEAM: [string, string, string, string][] = [
  ["Adrian Kim P. De Guzman", "@vurios", "Full Stack Developer, UI/UX Designer", "#f2a541"],
  ["John Carl Q. Bolo", "@caaarl", "Full Stack Developer, Story Concept", "#c0573e"],
  ["Asthan Eilexer J. Patanao", "@tangerine", "Data Integration Developer, Art Direction", "#557358"],
  ["Victor Ronel P. Lumayad", "@viron20", "Science Research and Fact-Checking, Audio Developer", "#5c7393"],
  ["Allen P. Del Valle", "@tsugumii21", "Front-End Developer, Sound Design", "#b8661c"],
  ["Jeric S. Base", "@bululu", "QA Tester, DevOps and Deployment", "#7a5c8f"],
];

// ---- the paper pieces, the same as the videos'
/** Dad's blue-pen sketch from the game, as one still drawing. */
const doodle = (name: keyof typeof DRAWINGS, style: string, seed = 7) =>
  `<svg class="doodle" viewBox="0 0 320 220" style="${style}" aria-hidden="true">${sketch(DRAWINGS[name](), seed, { strokeWidth: 2.4, roughness: 1.2 }).map((d) => `<path d="${d}" />`).join("")}</svg>`;
let pmN = 0;
const postmark = (top: string, bottom: string, mid: string, style: string, size = 220) => {
  const id = `pm${pmN++}`;
  return `<svg class="postmark" viewBox="0 0 200 200" style="width:${size}px;height:${size}px;${style}" aria-hidden="true"><defs><path id="${id}t" d="M 30 100 A 70 70 0 0 1 170 100" /><path id="${id}b" d="M 22 100 A 78 78 0 0 0 178 100" /></defs><circle cx="100" cy="100" r="92" /><circle cx="100" cy="100" r="58" /><text class="arc"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${top}</textPath></text><text class="arc"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${bottom}</textPath></text><text class="mid" x="100" y="108" text-anchor="middle">${mid}</text></svg>`;
};
const postage = (style: string) => {
  const W = 180;
  const H = 220;
  const holes: string[] = [];
  for (let x = 0; x <= W; x += 15) holes.push(`<circle cx="${x}" cy="0" r="5.5"/><circle cx="${x}" cy="${H}" r="5.5"/>`);
  for (let y = 0; y <= H; y += 15) holes.push(`<circle cx="0" cy="${y}" r="5.5"/><circle cx="${W}" cy="${y}" r="5.5"/>`);
  return `<svg class="postage" viewBox="0 0 ${W} ${H}" style="${style}" aria-hidden="true"><defs><mask id="stm"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${holes.join("")}</g></mask></defs><g mask="url(#stm)"><rect width="${W}" height="${H}" fill="#fffaf0"/><rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="4" fill="#1d1e3c"/><g fill="#fbf6ec"><circle cx="40" cy="40" r="1.6"/><circle cx="130" cy="34" r="1.2"/><circle cx="148" cy="120" r="1.4"/><circle cx="32" cy="150" r="1.1"/><circle cx="92" cy="60" r="0.9"/></g><circle cx="72" cy="86" r="34" fill="#d7d1c4" stroke="#2b2622" stroke-width="3"/><circle cx="60" cy="76" r="7" fill="#bdb6a8"/><circle cx="84" cy="98" r="5" fill="#bdb6a8"/><circle cx="122" cy="136" r="26" fill="#d9774b" stroke="#2b2622" stroke-width="3"/><path d="M104 132 C 112 128, 126 140, 140 132" stroke="#b5532c" stroke-width="3" fill="none"/><path d="M60 160 C 80 150, 96 150, 104 140" stroke="#f2a541" stroke-width="2.5" fill="none" stroke-dasharray="5 6"/><text x="${W / 2}" y="${H - 26}" text-anchor="middle" class="pv">MOON &amp; MARS</text></g></svg>`;
};
const polaroid = (file: string, label: string, style: string, opts: { credit?: boolean; pin?: boolean; chip?: string; wide?: boolean } = {}) =>
  `<figure class="pola${opts.wide ? " wide" : ""}" style="${style}">${opts.pin ? '<span class="pin"></span>' : '<span class="tape"></span>'}<img src="img/${file}" alt="" /><figcaption><b>${label}</b>${opts.chip ? `<span class="yr">${opts.chip}</span>` : ""}${opts.credit ? `<small>Credit: ${credit(file)}</small>` : ""}</figcaption></figure>`;
const banner = (text: string, style = "") => `<div class="banner" style="${style}"><span class="tape l"></span><span class="tape r"></span>${text}</div>`;

const slides: Slide[] = [
  {
    bg: "desk",
    html: `${polaroid("title.jpg", "The real game, free in your browser", "left:80px;top:96px;width:1010px;--t:-2.5deg", { wide: true })}
${postmark("PIECES OF HOME", "PLAY FREE TODAY", "DELIVERED", "left:880px;top:560px", 190)}
<div class="paper hero" style="left:1130px;top:56px;width:740px;--t:1.2deg"><span class="tape"></span>
  <p class="kick">Team Hackstreet Boys presents</p>
  <h1>Pieces of Home</h1>
  <p class="sub">A cozy browser adventure about the machines people left on the Moon and Mars</p>
  <p class="btn">Play free: <b>piecesofhome.pages.dev</b></p>
</div>
<div class="paper letter" style="left:1150px;top:530px;width:720px;--t:-1deg">
  <p class="kick">Our challenge<br />NASA Space Apps Challenge 2026</p>
  <p class="ctitle">Abandoned but not Forgotten</p>
  <p class="csub">Storytelling about NASA's Discarded Equipment on the Moon and Mars</p>
</div>
${postage("left:1715px;top:490px;width:150px;--t:7deg")}
${postmark("OUR CHALLENGE", "SPACE APPS 2026", "★", "left:1660px;top:650px", 150)}
<div class="index team" style="left:90px;top:775px;width:1010px;--t:-0.8deg"><span class="pin"></span>
  <p class="kick">Made by team Hackstreet Boys</p>
  <ul>${TEAM.map(([n]) => `<li>${n}</li>`).join("")}</ul>
</div>`,
    notes: "Hi! We are Hackstreet Boys. Our project is Pieces of Home, a free browser game that tells the true stories of the machines people left on the Moon and Mars. Our challenge is Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars.",
  },
  {
    bg: "cork",
    html: `${banner("The problem: machines left behind")}
<div class="paper" style="left:90px;top:190px;width:780px;padding:40px 46px;--t:-1deg"><span class="tape"></span>
  <ul class="list">
    <li>People left mirrors, rovers, landers and a helicopter on the Moon and Mars.</li>
    <li>Some still work. Scientists still bounce lasers off the mirrors Apollo 11 left in 1969.</li>
    <li>Others went quiet. Opportunity was last heard from on June 10, 2018.</li>
    <li>To most kids they look like old junk, far away. Their true stories are easy to miss.</li>
  </ul>
</div>
<p class="sticky big" style="left:150px;top:840px;--t:-3deg">Old junk? Or a true story?</p>
<svg class="thread" viewBox="0 0 1920 1080"><path d="M 1150 205 Q 1360 300 1570 225 M 1150 575 Q 1360 660 1570 600" /></svg>
${polaroid("apollo11-lrrr.jpg", "Apollo 11's experiments", "left:960px;top:200px;width:380px;--t:-3deg", { pin: true, chip: "Moon · 1969", credit: true })}
${polaroid("apollo15-lrv.jpg", "The Moon buggy, Apollo 15", "left:1400px;top:220px;width:380px;--t:2.5deg", { pin: true, chip: "Moon · 1971", credit: true })}
${polaroid("opportunity-tracks.jpg", "Opportunity rover's view", "left:960px;top:570px;width:380px;--t:2deg", { pin: true, chip: "Mars · 2004", credit: true })}
${polaroid("ingenuity-valinor.jpg", "Ingenuity helicopter", "left:1400px;top:595px;width:380px;--t:-2deg", { pin: true, chip: "Mars · 2021", credit: true })}`,
    notes: "People have left many machines on the Moon and Mars. Some still do their jobs: scientists still bounce lasers off the mirrors that Apollo 11 left in 1969. Others went quiet, like the Opportunity rover, last heard from in June 2018. To most kids these machines look like old junk, far away, so their true stories are easy to miss.",
  },
  {
    bg: "desk",
    html: `${banner("Our solution: a story with a heart")}
<div class="paper note" style="left:80px;top:180px;width:700px;height:830px;--t:-1deg">
  <p class="chiprow"><span class="chip">The story</span></p>
  <ul class="list">
    <li>Remi's late dad built tiny models of real landing sites, under glass domes.</li>
    <li>He wrote a letter to each machine there, and never sent them.</li>
    <li>Players deliver the letters, learn each machine's true story, and rebuild Dad's little robot, Milo.</li>
  </ul>
  ${doodle("lamp", "left:330px;bottom:30px;width:330px")}
  <p class="sig">Dad's sketch</p>
</div>
<div class="loop">
  ${polaroid("trip.jpg", "<em>1</em> Pick a dome, fly there", "--t:-2deg", { wide: true })}
  ${polaroid("letter.jpg", "<em>2</em> Deliver Dad's letter", "--t:1.5deg", { wide: true })}
  ${polaroid("card.jpg", "<em>3</em> Read the true story", "--t:1deg", { wide: true })}
  ${polaroid("laser.jpg", "<em>4</em> Play the big idea, fix Milo", "--t:-1.5deg", { wide: true })}
</div>
<p class="sticky" style="left:1560px;top:880px;width:300px;--t:4deg">One cozy loop in every world. No timers, no fail states.</p>`,
    notes: "Our answer is a game with a heart. Remi's late dad built tiny models of real landing sites and wrote letters to the machines there. Each world is one cozy loop: pick a dome and a little rocket flies you there, deliver Dad's letter to a real machine, read its true story with a real NASA photo and source link, then play with the idea that made the machine work, like corner mirrors that send light straight back, and bring a new part home to Milo.",
  },
  {
    bg: "desk",
    html: `${banner("Real places, real NASA data")}
<div class="worlds">
  ${polaroid("moon.jpg", "Tranquility Base", "--t:-2deg", { wide: true, chip: "Apollo 11 mirrors · 1969" })}
  ${polaroid("mars.jpg", "Meridiani Planum", "--t:1.5deg", { wide: true, chip: "Opportunity · 2004 to 2018" })}
  ${polaroid("valinor.jpg", "Valinor Hills", "--t:-1deg", { wide: true, chip: "Ingenuity · 2021 to 2024" })}
  ${polaroid("dish.jpg", "The finale", "--t:2deg", { wide: true, chip: "Voyager 1 · 1977" })}
</div>
<div class="cards9">
  <div style="--tab:#f2a541"><b>NASA Image and Video Library</b><span>Apollo photos on the true story cards</span><small>images.nasa.gov</small></div>
  <div style="--tab:#233f73"><b>NASA Photojournal</b><span>Opportunity, Ingenuity and Voyager images</span><small>photojournal.jpl.nasa.gov</small></div>
  <div style="--tab:#557358"><b>LRO Camera</b><span>Apollo sites today, seen from orbit</span><small>lroc.asu.edu</small></div>
  <div style="--tab:#c0573e"><b>NASA SVS CGI Moon Kit</b><span>The Moon globe's color map</span><small>svs.gsfc.nasa.gov</small></div>
  <div style="--tab:#f2a541"><b>Viking Mars mosaic</b><span>The Mars globe's map (NASA Ames, USGS)</span><small>astrogeology.usgs.gov</small></div>
  <div style="--tab:#233f73"><b>NASA NSSDCA</b><span>Landing site coordinates for the globe pins</span><small>nssdc.gsfc.nasa.gov</small></div>
  <div style="--tab:#557358"><b>JPL Horizons</b><span>Voyager 1's light time, day by day</span><small>ssd.jpl.nasa.gov/horizons</small></div>
  <div style="--tab:#c0573e"><b>Yale Bright Star Catalog</b><span>Stars on Dad's star map (NASA HEASARC)</span><small>heasarc.gsfc.nasa.gov</small></div>
  <div style="--tab:#f2a541"><b>NASA mission sounds</b><span>Mars wind, Ingenuity's hum, Voyager plasma waves</span><small>science.nasa.gov</small></div>
</div>
<p class="stamp-s" style="left:1560px;top:930px">Every model says<br />"Model, not to scale"</p>`,
    notes: "The worlds are real landing sites: Tranquility Base with the Apollo 11 mirrors, Hadley-Apennine with the Apollo 15 Moon buggy, Meridiani Planum with Opportunity, Valinor Hills with Ingenuity, and a bonus trip to the Ocean of Storms. The finale points Dad's backyard dish at Voyager 1. NASA data is built in: photos from the NASA Image and Video Library, Photojournal and LRO, globe maps from the CGI Moon Kit and the Viking mosaic, real landing coordinates from NSSDCA, Voyager 1's light time from JPL Horizons, and real recordings like Mars wind from Perseverance. Every model says model, not to scale.",
  },
  {
    bg: "desk",
    html: `<div class="book">
  <div class="leaf l">
    <p class="chiprow"><span class="chip">Accurate by design</span></p>
    <h3>Every fact has a source</h3>
    <ul class="list sm">
      <li>Every number a player sees comes from one facts file, each with its NASA, JPL or NSSDCA link.</li>
      <li>The build fails if the game uses a fact with no source.</li>
      <li>Real photos keep their exact credit line.</li>
      <li>Voyager 1's light time follows the date, from JPL Horizons.</li>
    </ul>
    <figure class="crop"><span class="tape"></span><img src="img/cardcrop.jpg" alt="" /><figcaption>A true story card: real NASA photo, credit, source link</figcaption></figure>
  </div>
  <div class="leaf r">
    <p class="chiprow"><span class="chip green">Safe and easy</span></p>
    <h3>Made for kids and classrooms</h3>
    <ul class="list sm">
      <li>Free, in the browser. No install, no account, no ads, no tracking.</li>
      <li>1 to 4 players with a private room code. No chat: only emotes and kind preset phrases.</li>
      <li>Captions for every line, a calmer motion setting, a dyslexia-friendly font.</li>
      <li>A printable Field Guide for teachers.</li>
    </ul>
    ${polaroid("play.jpg", "Friends in one world, saying hi", "left:300px;top:640px;width:380px;--t:2deg", { wide: true })}
    <p class="tags"><span>Ages 10 and up</span><span>No chat</span></p>
  </div>
</div>`,
    notes: "We built accuracy into the code. Every number, date and claim in the game comes from one facts file, and every fact has its source link; the build fails if the game uses a fact without one. Real photos keep their exact NASA credit and Voyager 1's light time follows the date. It is also safe and easy: free in the browser with no install, account, ads or tracking, made for ages 10 and up. Friends join with a private room code and there is no chat, only emotes and kind preset phrases. There are captions, a calmer motion setting, a dyslexia-friendly font and a printable Field Guide for classrooms.",
  },
  {
    bg: "photo",
    html: `<div class="full" style="background-image:url(img/milo.jpg)"></div><div class="shade"></div>
<div class="paper impact" style="--t:-1deg"><span class="tape"></span>
  <h2 class="in">Impact</h2>
  <ul class="list">
    <li>Players meet the machines as stories, not junk.</li>
    <li>Real NASA images, data and sounds, in a game people want to finish.</li>
    <li>Ready for classrooms today: free, in the browser, with a Field Guide.</li>
    <li>Next: play-tests with players and teachers, and more machines.</li>
  </ul>
</div>
${postmark("LEFT BEHIND", "STILL ANSWERING", "1969", "left:1240px;top:150px", 230)}
${postmark("LEFT BEHIND", "STILL TEACHING", "★", "left:1520px;top:330px", 210)}
${postmark("NOT LEFT BEHIND", "STILL SENDING", "V1", "left:1290px;top:470px", 220)}`,
    notes: "Pieces of Home helps players see these machines as stories, not junk. It brings real NASA images, data and sounds into a game people want to finish, and it is ready for classrooms today. Next, we want to play-test it with players and teachers and add more machines. Left behind, but still answering, still teaching. And Voyager 1 is still sending.",
  },
  {
    bg: "desk",
    html: `${banner("Meet the team", "top:28px")}
<div class="team6">
${TEAM.map(([name, handle, role, color], i) => `  <div class="member" style="--c:${color};--t:${[-1.2, 0.8, -0.6, 1, -0.9, 0.7][i]}deg"><span class="pin"></span><span class="mono">${name.split(" ").filter((w) => /^[A-Z][a-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("")}</span><b>${name}</b><span class="role">${role}</span><small>${handle}</small></div>`).join("\n")}
</div>
<div class="paper thanks" style="--t:-0.6deg"><span class="tape"></span>
  <div><h1>Thank you!</h1><p class="best">Best on a laptop or desktop computer</p></div>
  <div class="go"><p class="btn">Play free: <b>piecesofhome.pages.dev</b></p><p class="code">Code: github.com/Vurios/piecesofhome</p></div>
</div>
<p class="fine">Built with TypeScript, Three.js and Svelte. AI tools, used openly: Claude Code (AI coding assistant) helped write the code; Chatterbox (an open AI voice) reads the video narration; details in AI_USE.md. NASA images carry their credits. NASA did not make, sponsor or endorse this project.</p>`,
    notes: "We are a team of six. Adrian and John Carl built the game end to end, with Adrian on the look and feel and John Carl on the story. Asthan wired in the NASA data and set the art direction. Victor checked every science fact and built the audio. Allen built screens of the game and its sound design. Jeric tested everything and runs our deployment. We used AI tools openly: Claude Code helped us write the code, and an open AI voice reads our video; it is all in AI_USE.md. Thank you! Play Pieces of Home free at piecesofhome.pages.dev. We are happy to take your questions.",
  },
];

const css = `
@font-face { font-family: "Kalam"; src: url("fonts/kalam-latin-700-normal.woff2"); font-weight: 700; }
@font-face { font-family: "Kalam"; src: url("fonts/kalam-latin-400-normal.woff2"); font-weight: 400; }
@font-face { font-family: "Atkinson Hyperlegible Next"; src: url("fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2"); font-weight: 200 800; }
@font-face { font-family: "Zilla Slab"; src: url("fonts/zilla-slab-latin-700-normal.woff2"); font-weight: 700; }
@page { size: 1920px 1080px; margin: 0; }
:root { --paper: #fbf6ec; --edge: #d9c7a6; --ink: #2b2622; --soft: #62574d; --dad: #233f73; --amber: #f2a541; --amberd: #b8661c; --clay: #c0573e; --sage: #557358; --dusk: #1d1e3c; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #1d1e3c; font-family: "Atkinson Hyperlegible Next", sans-serif; color: var(--ink); }
.slide { position: relative; width: 1920px; height: 1080px; overflow: hidden; page-break-after: always; break-after: page; }
.slide.desk { background: radial-gradient(ellipse 70% 60% at 25% 20%, rgba(255,214,150,.32), transparent 70%), repeating-linear-gradient(0deg, transparent 0 214px, rgba(50,25,8,.45) 214px 217px), repeating-linear-gradient(90deg, rgba(70,35,12,.07) 0 2px, transparent 2px 7px, rgba(255,230,190,.05) 7px 9px, transparent 9px 16px), linear-gradient(180deg, #9a6438, #85532c); }
.slide.cork { background: radial-gradient(circle, rgba(92,52,22,.35) 0 1.4px, transparent 2px) 0 0 / 15px 15px, radial-gradient(circle, rgba(255,226,180,.22) 0 1.1px, transparent 1.6px) 7px 8px / 12px 12px, radial-gradient(ellipse at 50% 30%, #d39a62, #b67a45 70%, #a56c3b); box-shadow: inset 0 0 0 22px #7d4f2c, inset 0 0 0 26px #5f3a1f, inset 0 0 80px rgba(0,0,0,.35); }
.slide .num { position: absolute; right: 44px; bottom: 26px; padding: 4px 14px; background: var(--paper); border-radius: 6px; font-size: 22px; color: var(--soft); box-shadow: 0 4px 10px rgba(0,0,0,.25); }
.tape { position: absolute; z-index: 3; top: -16px; left: 50%; width: 140px; height: 34px; margin-left: -70px; background: rgba(242,222,170,.88); transform: rotate(-3deg); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.pin { position: absolute; z-index: 3; top: -13px; left: 50%; width: 28px; height: 28px; margin-left: -14px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ff8a73, #c0392b 55%, #7d1d12); box-shadow: 0 4px 6px rgba(0,0,0,.4); }
.paper { position: absolute; padding: 36px 44px; background: var(--paper); border-radius: 8px; box-shadow: 0 18px 40px rgba(0,0,0,.4); transform: rotate(var(--t, 0deg)); }
.banner { position: absolute; z-index: 2; left: 0; right: 0; top: 34px; margin: 0 auto; width: fit-content; padding: 14px 64px 18px; background: var(--paper); border-radius: 6px; box-shadow: 0 10px 24px rgba(0,0,0,.35); font-family: "Kalam"; font-weight: 700; font-size: 66px; line-height: 1.1; white-space: nowrap; transform: rotate(-1.2deg); }
.banner .tape.l { left: 6%; } .banner .tape.r { left: 94%; }
.kick { font-family: "Zilla Slab"; font-weight: 700; font-size: 24px; letter-spacing: .14em; text-transform: uppercase; color: var(--amberd); }
.pola { position: absolute; padding: 14px 14px 12px; background: #fffdf8; box-shadow: 0 14px 34px rgba(0,0,0,.32); transform: rotate(var(--t, 0deg)); }
.pola img { display: block; width: 100%; aspect-ratio: 4/3; object-fit: cover; }
.pola.wide img { aspect-ratio: 16/9; }
.pola figcaption { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding-top: 10px; }
.pola figcaption b { font-family: "Kalam"; font-weight: 700; font-size: 28px; line-height: 1.15; }
.pola figcaption b em { display: inline-grid; place-items: center; width: 40px; height: 40px; margin-right: 6px; border-radius: 50%; background: var(--amber); border: 3px solid var(--ink); font-family: "Zilla Slab"; font-style: normal; font-size: 24px; }
.pola figcaption small { width: 100%; font-size: 17px; color: var(--soft); }
.yr { padding: 2px 10px; border: 2px solid var(--clay); border-radius: 4px; font-family: "Zilla Slab"; font-weight: 700; font-size: 18px; letter-spacing: .1em; text-transform: uppercase; color: var(--clay); }
.postmark { position: absolute; mix-blend-mode: multiply; transform: rotate(-16deg); }
.postmark circle { fill: none; stroke: var(--clay); stroke-width: 5; } .postmark circle + circle { stroke-width: 3; }
.postmark text { fill: var(--clay); font-family: "Zilla Slab"; font-weight: 700; } .postmark .arc { font-size: 19px; letter-spacing: 3px; } .postmark .mid { font-size: 28px; }
.slide.photo .postmark { mix-blend-mode: normal; } .slide.photo .postmark circle { fill: rgba(251,246,236,.82); } .slide.photo .postmark circle + circle { fill: none; }
.postage { position: absolute; z-index: 2; filter: drop-shadow(0 8px 10px rgba(0,0,0,.35)); transform: rotate(var(--t)); }
.postage .pv { fill: var(--paper); font-family: "Zilla Slab"; font-weight: 700; font-size: 15px; letter-spacing: 2px; }
.doodle { position: absolute; height: auto; } .doodle path { fill: none; stroke: var(--dad); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.btn { display: inline-block; margin-top: 18px; padding: 14px 30px 16px; background: var(--amber); border: 3px solid var(--ink); border-radius: 16px; box-shadow: 0 7px 0 var(--ink); font-size: 36px; white-space: nowrap; }
.btn b { font-weight: 800; }
.hero h1 { margin-top: 4px; font-family: "Zilla Slab"; font-weight: 700; font-size: 86px; line-height: 1; white-space: nowrap; }
.hero .sub { margin-top: 10px; font-family: "Kalam"; font-weight: 700; font-size: 33px; line-height: 1.22; color: var(--dad); }
.hero .btn { font-size: 31px; }
.letter { padding: 30px 40px 34px; background: repeating-linear-gradient(transparent 0 39px, rgba(92,115,147,.16) 39px 40px), var(--paper); }
.letter .kick { font-size: 19px; line-height: 1.5; }
.letter .ctitle, .letter .csub { max-width: 480px; }
.letter .ctitle { margin-top: 6px; font-family: "Kalam"; font-weight: 700; font-size: 56px; line-height: 1.05; }
.letter .csub { margin-top: 8px; max-width: 500px; font-family: "Kalam"; font-weight: 700; font-size: 30px; line-height: 1.2; color: var(--dad); }
.index { position: absolute; padding: 26px 36px 24px; background: repeating-linear-gradient(transparent 0 37px, rgba(92,115,147,.2) 37px 38px) 0 52px / 100% 100% no-repeat, linear-gradient(transparent 0 50px, rgba(192,87,62,.45) 50px 52px, transparent 52px), #fffdf6; box-shadow: 0 12px 28px rgba(0,0,0,.35); transform: rotate(var(--t)); }
.team ul { list-style: none; margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 18px; font-size: 22px; font-weight: 600; white-space: nowrap; }
.team li::before { content: "\\2726  "; color: var(--amber); }
.list { list-style: none; display: flex; flex-direction: column; gap: 26px; font-size: 38px; line-height: 1.26; }
.list li { position: relative; padding-left: 50px; }
.list li::before { content: "\\2713"; position: absolute; left: 0; top: -2px; font-family: "Zilla Slab"; font-weight: 700; font-size: 40px; color: var(--sage); }
.list.sm { font-size: 30px; gap: 18px; } .list.sm li { padding-left: 40px; } .list.sm li::before { font-size: 32px; }
.sticky { position: absolute; width: 360px; padding: 26px 28px 30px; background: linear-gradient(#fff1a8, #fbe27a); box-shadow: 0 14px 26px rgba(0,0,0,.3); transform: rotate(var(--t)); font-family: "Kalam"; font-weight: 700; font-size: 34px; line-height: 1.2; }
.sticky.big { width: 680px; font-size: 54px; color: var(--clay); }
.thread { position: absolute; inset: 0; width: 1920px; height: 1080px; } .thread path { fill: none; stroke: #b13f2c; stroke-width: 4; stroke-linecap: round; }
.note { padding: 46px 50px; background: repeating-linear-gradient(transparent 0 45px, rgba(92,115,147,.16) 45px 46px), var(--paper); }
.note .list { margin-top: 24px; }
.sig { position: absolute; left: 50px; bottom: 40px; font-family: "Kalam"; font-size: 26px; color: var(--dad); }
.chiprow { display: flex; gap: 12px; }
.chip { padding: 5px 14px; border: 2px solid var(--clay); border-radius: 4px; font-family: "Zilla Slab"; font-weight: 700; font-size: 22px; letter-spacing: .12em; text-transform: uppercase; color: var(--clay); }
.chip.green { border-color: var(--sage); color: var(--sage); }
.loop { position: absolute; left: 840px; top: 190px; width: 1010px; display: grid; grid-template-columns: 1fr 1fr; gap: 34px 36px; }
.loop .pola, .worlds .pola { position: relative; }
.worlds { position: absolute; left: 90px; right: 90px; top: 175px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 30px; }
.worlds .pola figcaption b { font-size: 30px; }
.cards9 { position: absolute; left: 90px; right: 400px; top: 545px; display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 148px; gap: 30px 24px; }
.cards9 div { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 20px 22px 14px; background: var(--paper); border-radius: 8px; box-shadow: inset 0 8px 0 var(--tab), 0 10px 22px rgba(0,0,0,.3); }
.cards9 div::before { content: ""; position: absolute; top: -14px; left: 20px; width: 96px; height: 20px; border-radius: 8px 8px 0 0; background: var(--tab); }
.cards9 b { font-family: "Zilla Slab"; font-size: 27px; line-height: 1.08; }
.cards9 span { font-size: 22px; line-height: 1.22; }
.cards9 small { margin-top: auto; font-size: 18px; color: var(--dad); }
.stamp-s { position: absolute; padding: 14px 24px; border: 5px solid var(--clay); border-radius: 10px; color: var(--clay); font-family: "Zilla Slab"; font-weight: 700; font-size: 30px; line-height: 1.15; text-align: center; background: rgba(251,246,236,.9); transform: rotate(-4deg); }
.book { position: absolute; left: 70px; top: 50px; width: 1780px; height: 960px; display: flex; transform: rotate(-0.4deg); filter: drop-shadow(0 20px 34px rgba(0,0,0,.45)); }
.leaf { position: relative; flex: 1; padding: 56px 64px; background: repeating-linear-gradient(transparent 0 45px, rgba(92,115,147,.17) 45px 46px), var(--paper); }
.leaf.l { border-radius: 16px 4px 4px 16px; box-shadow: inset -30px 0 30px -18px rgba(80,50,20,.35); }
.leaf.r { border-radius: 4px 16px 16px 4px; box-shadow: inset 30px 0 30px -18px rgba(80,50,20,.35); }
.leaf h3 { margin: 14px 0 22px; font-family: "Kalam"; font-weight: 700; font-size: 58px; line-height: 1.1; }
.crop { position: absolute; left: 64px; bottom: 50px; width: 760px; padding: 10px 10px 8px; background: #fffdf8; box-shadow: 0 10px 24px rgba(0,0,0,.25); transform: rotate(-1.2deg); }
.crop img { display: block; width: 100%; } .crop figcaption { padding-top: 6px; font-family: "Kalam"; font-weight: 700; font-size: 24px; }
.tags { position: absolute; left: 64px; bottom: 120px; display: flex; flex-direction: column; gap: 14px; }
.tags span { padding: 8px 22px; background: var(--paper); border: 3px solid var(--amberd); border-radius: 30px; font-family: "Kalam"; font-weight: 700; font-size: 30px; transform: rotate(-2deg); }
.tags span + span { border-color: var(--sage); transform: rotate(1.5deg); }
.full { position: absolute; inset: 0; background-size: cover; background-position: center; }
.shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(20,16,30,.55), rgba(20,16,30,.1) 60%, transparent); }
.impact { left: 90px; top: 110px; width: 1080px; padding: 50px 58px 54px; }
.impact h2.in { font-family: "Kalam"; font-weight: 700; font-size: 80px; line-height: 1; margin-bottom: 24px; }
.impact h2.in::after { content: ""; display: block; width: 200px; height: 9px; margin-top: 6px; border-radius: 5px; background: var(--amber); }
.impact .list { font-size: 42px; }
.team6 { position: absolute; left: 90px; right: 90px; top: 170px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 36px 30px; }
.member { position: relative; display: grid; grid-template-columns: 96px 1fr; grid-template-rows: auto auto 1fr; column-gap: 22px; row-gap: 4px; padding: 30px 28px 22px; background: var(--paper); border-radius: 10px; box-shadow: inset 0 10px 0 var(--c), 0 12px 28px rgba(0,0,0,.3); transform: rotate(var(--t)); min-height: 220px; }
.member .mono { grid-row: 1 / span 3; width: 96px; height: 96px; border-radius: 50%; background: var(--c); border: 4px solid var(--ink); display: grid; place-items: center; font-family: "Zilla Slab"; font-weight: 700; font-size: 40px; color: var(--paper); box-shadow: inset 0 -8px 0 rgba(0,0,0,.15); }
.member b { font-family: "Zilla Slab"; font-size: 34px; line-height: 1.08; }
.member .role { font-size: 25px; line-height: 1.26; }
.member small { align-self: end; font-family: "Kalam"; font-weight: 700; font-size: 25px; color: #8c8173; }
.thanks { left: 90px; right: 90px; top: 700px; display: flex; align-items: center; justify-content: space-between; padding: 34px 50px 40px; }
.thanks h1 { font-family: "Zilla Slab"; font-weight: 700; font-size: 100px; line-height: 1; }
.best { display: inline-block; margin-top: 12px; padding: 8px 20px; border: 3px solid var(--sage); border-radius: 30px; font-family: "Kalam"; font-weight: 700; font-size: 28px; }
.go { text-align: right; } .go .btn { margin-top: 0; font-size: 40px; } .code { margin-top: 18px; font-size: 28px; color: var(--soft); }
.fine { position: absolute; left: 110px; right: 300px; top: 968px; font-size: 21px; line-height: 1.4; color: rgba(251,246,236,.92); }
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Pieces of Home: slides</title><style>${css}</style></head><body>
${slides.map((s, i) => `<section class="slide ${s.bg ?? "desk"}" id="s${i + 1}">${s.html}<p class="num">${i + 1} / ${slides.length}</p></section>`).join("\n")}
</body></html>`;
writeFileSync(join(DIR, "slides.html"), html);
writeFileSync(join(DIR, "notes.json"), JSON.stringify(slides.map((s) => s.notes), null, 1));
const words = slides.reduce((a, s) => a + s.notes.split(/\s+/).length, 0);
writeFileSync(
  join(OUT, "speaker-notes.md"),
  [
    "# Speaker notes",
    "",
    `Seven slides, about ${Math.round((words / 140) * 60)} seconds of talk at a calm pace (${words} words). For a shorter slot, keep each note to its first two sentences. Slides: PiecesOfHome_Slides.pdf (PowerPoint copy with these notes: PiecesOfHome_Slides.pptx).`,
    "",
    ...slides.flatMap((s, i) => [`## Slide ${i + 1}`, "", s.notes, ""]),
  ].join("\n"),
);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(join(DIR, "slides.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.pdf({ path: join(OUT, "PiecesOfHome_Slides.pdf"), width: "1920px", height: "1080px", printBackground: true });
execFileSync(process.platform === "win32" ? "cmd" : "sh", process.platform === "win32" ? ["/c", "del", "/q", join(PNG, "slide-*.jpg")] : ["-c", `rm -f ${join(PNG, "slide-*.jpg")}`], { stdio: "ignore" });
for (let i = 1; i <= slides.length; i += 1) await page.locator(`#s${i}`).screenshot({ path: join(PNG, `slide-${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 90 });
await browser.close();
console.log(`slides: ${slides.length}, notes ${words} words`);
