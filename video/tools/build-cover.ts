/**
 * The title page for the project's documents, in the game's paper style: Dad's
 * desk from above, a taped photo of the real game, a lined letter with the
 * title, a Moon and Mars stamp, a postmark, Dad's blue-pen sketches and the team.
 *
 *   npx tsx video/tools/build-cover.ts
 *
 * Writes docs/submission/cover/PiecesOfHome_Title_Page.pdf (A4) and a PNG and a
 * JPEG per document label (cover-*.png, cover-*.jpg), which build-references.py and
 * build-global-form.py put on page one of their Word files.
 * Run build-slides.ts first (it makes the game stills and copies the fonts).
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { DRAWINGS } from "../../src/ui/drawing/machines";
import { sketch } from "../../src/ui/drawing/sketch";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SLIDES = join(ROOT, "docs/submission/local/slides");
const OUT = join(ROOT, "docs/submission/cover");
mkdirSync(OUT, { recursive: true });

const TEAM: [string, string, string][] = [
  ["Adrian Kim P. De Guzman", "Full Stack Developer, UI/UX Designer", "#f2a541"],
  ["John Carl Q. Bolo", "Full Stack Developer, Story Concept", "#c0573e"],
  ["Asthan Eilexer J. Patanao", "Data Integration Developer, Art Direction", "#557358"],
  ["Victor Ronel P. Lumayad", "Science Research and Fact-Checking, Audio", "#5c7393"],
  ["Allen P. Del Valle", "Front-End Developer, Sound Design", "#b8661c"],
  ["Jeric S. Base", "QA Tester, DevOps and Deployment", "#7a5c8f"],
];

/** The documents that get this cover, and the label each one shows. */
const LABELS: [string, string][] = [
  ["documentation", "Project documentation"],
  ["references", "NASA data and references"],
  ["global", "Global submission answers"],
];

const doodle = (name: keyof typeof DRAWINGS, style: string, seed = 7) =>
  `<svg class="doodle" viewBox="0 0 320 220" style="${style}" aria-hidden="true">${sketch(DRAWINGS[name](), seed, { strokeWidth: 2.2, roughness: 1.15 })
    .map((d) => `<path d="${d}" />`)
    .join("")}</svg>`;

const postmark = (style: string) =>
  `<svg class="postmark" viewBox="0 0 200 200" style="${style}" aria-hidden="true"><defs><path id="pt" d="M 30 100 A 70 70 0 0 1 170 100" /><path id="pb" d="M 22 100 A 78 78 0 0 0 178 100" /></defs><circle cx="100" cy="100" r="92" /><circle cx="100" cy="100" r="58" /><text class="arc"><textPath href="#pt" startOffset="50%" text-anchor="middle">SPACE APPS</textPath></text><text class="arc"><textPath href="#pb" startOffset="50%" text-anchor="middle">STILL SHINING</textPath></text><text class="mid" x="100" y="110" text-anchor="middle">2026</text></svg>`;

const postage = (style: string) => {
  const W = 180;
  const H = 220;
  const holes: string[] = [];
  for (let x = 0; x <= W; x += 15) holes.push(`<circle cx="${x}" cy="0" r="5.5"/><circle cx="${x}" cy="${H}" r="5.5"/>`);
  for (let y = 0; y <= H; y += 15) holes.push(`<circle cx="0" cy="${y}" r="5.5"/><circle cx="${W}" cy="${y}" r="5.5"/>`);
  return `<svg class="postage" viewBox="0 0 ${W} ${H}" style="${style}" aria-hidden="true"><defs><mask id="stm"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${holes.join("")}</g></mask></defs><g mask="url(#stm)"><rect width="${W}" height="${H}" fill="#fffaf0"/><rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="4" fill="#1d1e3c"/><g fill="#fbf6ec"><circle cx="40" cy="40" r="1.6"/><circle cx="130" cy="34" r="1.2"/><circle cx="148" cy="120" r="1.4"/><circle cx="32" cy="150" r="1.1"/><circle cx="92" cy="60" r="0.9"/></g><circle cx="72" cy="86" r="34" fill="#d7d1c4" stroke="#2b2622" stroke-width="3"/><circle cx="60" cy="76" r="7" fill="#bdb6a8"/><circle cx="84" cy="98" r="5" fill="#bdb6a8"/><circle cx="122" cy="136" r="26" fill="#d9774b" stroke="#2b2622" stroke-width="3"/><path d="M104 132 C 112 128, 126 140, 140 132" stroke="#b5532c" stroke-width="3" fill="none"/><path d="M60 160 C 80 150, 96 150, 104 140" stroke="#f2a541" stroke-width="2.5" fill="none" stroke-dasharray="5 6"/><text x="${W / 2}" y="${H - 26}" text-anchor="middle" class="pv">MOON &amp; MARS</text></g></svg>`;
};

const page = (label: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Pieces of Home: ${label}</title>
<style>
@font-face { font-family: "Kalam"; src: url("../local/slides/fonts/kalam-latin-700-normal.woff2"); font-weight: 700; }
@font-face { font-family: "Kalam"; src: url("../local/slides/fonts/kalam-latin-400-normal.woff2"); font-weight: 400; }
@font-face { font-family: "Atkinson Hyperlegible Next"; src: url("../local/slides/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2"); font-weight: 200 800; }
@font-face { font-family: "Zilla Slab"; src: url("../local/slides/fonts/zilla-slab-latin-700-normal.woff2"); font-weight: 700; }
@page { size: 210mm 297mm; margin: 0; }
:root { --paper: #fbf6ec; --edge: #d9c7a6; --ink: #2b2622; --soft: #62574d; --dad: #233f73; --amber: #f2a541; --amberd: #b8661c; --clay: #c0573e; --dusk: #1d1e3c; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 210mm; height: 297mm; }
body { position: relative; overflow: hidden; font-family: "Atkinson Hyperlegible Next", sans-serif; color: var(--ink);
  background:
    radial-gradient(ellipse 75% 45% at 18% 10%, rgba(255, 214, 150, .42), transparent 70%),
    radial-gradient(ellipse 60% 40% at 90% 100%, rgba(29, 30, 60, .35), transparent 70%),
    repeating-linear-gradient(0deg, transparent 0 158px, rgba(50, 25, 8, .45) 158px 160px),
    repeating-linear-gradient(90deg, rgba(70, 35, 12, .07) 0 2px, transparent 2px 7px, rgba(255, 230, 190, .05) 7px 9px, transparent 9px 16px),
    linear-gradient(180deg, #9a6438, #85532c);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.abs { position: absolute; }
.tape { position: absolute; z-index: 3; width: 104px; height: 26px; background: rgba(242, 222, 170, .9); box-shadow: 0 1px 2px rgba(0, 0, 0, .12); }
.topband { left: 46px; right: 46px; top: 30px; display: flex; justify-content: space-between; align-items: center; }
.label { padding: 6px 14px 5px; background: var(--paper); border-radius: 5px; box-shadow: 0 6px 14px rgba(0, 0, 0, .3); font-family: "Zilla Slab"; font-weight: 700; font-size: 15px; letter-spacing: .16em; text-transform: uppercase; color: var(--clay); transform: rotate(-1.5deg); }
.label i { display: inline-block; width: 8px; height: 8px; margin: 0 10px 2px 0; border-radius: 50%; background: var(--clay); }
.presents { font-family: "Kalam"; font-weight: 700; font-size: 19px; color: #fbe9cc; text-shadow: 0 2px 6px rgba(0, 0, 0, .35); }
.pola { left: 58px; top: 84px; width: 606px; padding: 12px 12px 8px; background: #fffdf8; box-shadow: 0 16px 36px rgba(0, 0, 0, .38); transform: rotate(-2deg); }
.pola img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.pola figcaption { padding: 7px 4px 0; font-family: "Kalam"; font-weight: 700; font-size: 19px; }
.pola figcaption span { margin-left: 8px; font-family: "Atkinson Hyperlegible Next"; font-weight: 400; font-size: 12px; color: var(--soft); padding-top: 6px; }
.postage { right: 30px; top: 58px; width: 104px; z-index: 4; filter: drop-shadow(0 8px 10px rgba(0, 0, 0, .35)); transform: rotate(7deg); }
.postage .pv { fill: var(--paper); font-family: "Zilla Slab"; font-weight: 700; font-size: 15px; letter-spacing: 2px; }
.letter { left: 70px; top: 494px; width: 654px; padding: 30px 40px 26px 44px; z-index: 2; border-radius: 6px; transform: rotate(.9deg);
  background: repeating-linear-gradient(transparent 0 31px, rgba(92, 115, 147, .17) 31px 32px), var(--paper);
  box-shadow: 0 18px 40px rgba(0, 0, 0, .42); }
.letter::before { content: ""; position: absolute; left: 26px; top: 0; bottom: 0; width: 2px; background: rgba(192, 87, 62, .28); }
.kick { font-family: "Zilla Slab"; font-weight: 700; font-size: 14px; letter-spacing: .18em; text-transform: uppercase; color: var(--amberd); }
h1 { margin-top: 2px; font-family: "Zilla Slab"; font-weight: 700; font-size: 74px; line-height: .98; letter-spacing: -.01em; color: var(--ink); }
h1 em { font-style: normal; color: var(--amberd); }
.line { margin-top: 8px; max-width: 470px; font-family: "Kalam"; font-weight: 400; font-size: 22px; line-height: 1.32; color: #3c342d; }
.line b { font-weight: 700; color: var(--dad); }
.tags { display: flex; gap: 10px; margin-top: 12px; }
.tags span { padding: 4px 14px 3px; background: #fffdf8; border: 2px solid var(--amberd); border-radius: 20px; font-family: "Kalam"; font-weight: 700; font-size: 16px; }
.tags span:nth-child(2) { transform: rotate(-2deg); } .tags span:nth-child(3) { transform: rotate(1.5deg); }
.challenge { margin-top: 14px; padding-top: 10px; border-top: 2px dashed rgba(98, 87, 77, .35); display: grid; grid-template-columns: auto 1fr; gap: 2px 14px; align-items: baseline; }
.challenge .chip { grid-row: span 2; padding: 3px 10px; border: 2px solid var(--clay); border-radius: 4px; font-family: "Zilla Slab"; font-weight: 700; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--clay); white-space: nowrap; }
.challenge b { font-family: "Kalam"; font-weight: 700; font-size: 24px; line-height: 1.05; }
.challenge small { font-size: 13.5px; color: var(--soft); }
.postmark { position: absolute; right: 34px; top: -64px; width: 150px; height: 150px; z-index: 4; transform: rotate(-12deg); opacity: .92; }
.postmark circle { fill: none; stroke: var(--clay); stroke-width: 5; } .postmark circle + circle { stroke-width: 3; }
.postmark text { fill: var(--clay); font-family: "Zilla Slab"; font-weight: 700; } .postmark .arc { font-size: 17px; letter-spacing: 3px; } .postmark .mid { font-size: 34px; }
.doodle { position: absolute; height: auto; } .doodle path { fill: none; stroke: var(--dad); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.team { left: 46px; top: 896px; width: 702px; padding: 17px 26px 13px; border-radius: 8px; background: var(--paper); box-shadow: inset 0 7px 0 var(--amber), 0 14px 30px rgba(0, 0, 0, .35); transform: rotate(-.6deg); }
.team h2 { display: flex; justify-content: space-between; align-items: baseline; font-family: "Zilla Slab"; font-weight: 700; font-size: 14px; letter-spacing: .16em; text-transform: uppercase; color: var(--amberd); }
.team h2 span { font-family: "Kalam"; font-size: 17px; letter-spacing: 0; text-transform: none; color: var(--soft); }
.team ul { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; margin-top: 8px; }
.team li { display: grid; grid-template-columns: 30px 1fr; column-gap: 9px; align-items: center; }
.team li i { grid-row: span 2; width: 30px; height: 30px; border-radius: 50%; background: var(--c); border: 2.5px solid var(--ink); display: grid; place-items: center; font-family: "Zilla Slab"; font-style: normal; font-weight: 700; font-size: 12px; color: var(--paper); }
.team li b { font-size: 13.5px; line-height: 1.15; }
.team li small { font-size: 11px; line-height: 1.2; color: var(--soft); }
.foot { left: 46px; right: 46px; bottom: 22px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.links { display: flex; gap: 10px; }
.links span { padding: 7px 14px 6px; background: var(--amber); border: 2.5px solid var(--ink); border-radius: 11px; box-shadow: 0 4px 0 var(--ink); font-size: 14px; font-weight: 700; white-space: nowrap; }
.links span.code { background: var(--paper); font-weight: 600; }
.fine { max-width: 250px; text-align: right; font-size: 10.5px; line-height: 1.35; color: #f6e6cc; text-shadow: 0 1px 3px rgba(0, 0, 0, .4); }
</style></head><body>
<div class="abs topband"><span class="label"><i></i>${label}</span><span class="presents">Team Hackstreet Boys presents</span></div>
<figure class="abs pola"><span class="tape" style="left:44%;top:-13px;transform:rotate(-3deg)"></span><img src="../local/slides/img/title.jpg" alt="The title screen of Pieces of Home" /><figcaption>The real game, free in your browser<span>(game capture)</span></figcaption></figure>
${postage("position:absolute")}
<section class="abs letter">
  <span class="tape" style="left:-30px;top:14px;transform:rotate(-38deg)"></span>
  ${postmark("")}
  <p class="kick">A cozy 3D browser game</p>
  <h1>Pieces <em>of</em> Home</h1>
  <p class="line">Deliver Dad's letters to the machines people left on the <b>Moon</b> and <b>Mars</b>, learn their true stories, and rebuild his little robot, Milo.</p>
  <div class="tags"><span>Free to play</span><span>1 to 4 players</span><span>Ages 10 and up</span></div>
  <div class="challenge"><span class="chip">Our challenge</span><b>Abandoned but not Forgotten</b><small>Storytelling about NASA's Discarded Equipment on the Moon and Mars</small></div>
  ${doodle("lrrr", "right:18px;bottom:96px;width:132px;transform:rotate(-6deg);opacity:.85", 11)}
</section>
<section class="abs team">
  <h2>Made by Team Hackstreet Boys<span>NASA Space Apps Challenge 2026</span></h2>
  <ul>${TEAM.map(([n, r, c]) => `<li style="--c:${c}"><i>${n.split(" ")[0]![0]}${n.split(" ").slice(-1)[0]![0]}</i><b>${n}</b><small>${r}</small></li>`).join("")}</ul>
</section>
<div class="abs foot"><div class="links"><span>Play free: piecesofhome.pages.dev</span><span class="code">github.com/Vurios/piecesofhome</span></div><p class="fine">NASA did not make, sponsor or endorse this project. NASA photos inside carry their credits.</p></div>
</body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 3 });
const p = await ctx.newPage();
for (const [key, label] of LABELS) {
  const html = page(label);
  if (/[–—]/.test(html)) throw new Error("dash in cover text");
  const file = join(OUT, `cover-${key}.html`);
  writeFileSync(file, html);
  await p.goto(`file:///${file.replace(/\\/g, "/")}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(OUT, `cover-${key}.png`), type: "png" });
  await p.screenshot({ path: join(OUT, `cover-${key}.jpg`), type: "jpeg", quality: 90 });
  if (key === "documentation") await p.pdf({ path: join(OUT, "PiecesOfHome_Title_Page.pdf"), width: "210mm", height: "297mm", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  console.log(`cover-${key}.png`);
}
await browser.close();
copyFileSync(join(OUT, "cover-documentation.png"), join(OUT, "PiecesOfHome_Title_Page.png"));
