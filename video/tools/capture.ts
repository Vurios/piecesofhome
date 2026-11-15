/**
 * Frame-exact gameplay capture for the video kit.
 *
 * Opens the real game in Chrome (with the GPU) at 1920x1080, lets it load in
 * real time, then holds the page's clock (see virtual-clock.js) and records
 * one frame per step: the game runs at 60 steps a second and every second
 * step is saved, so the clip is a smooth 30 fps no matter how slow a
 * screenshot is. Frames go straight into ffmpeg (H.264, CRF 14).
 *
 * Every sound the game asks for while recording (effects, voices, music
 * scene changes) is logged with its frame, so the mix can place the game's
 * own sounds, rendered offline, on the exact frame.
 *
 * Usage: npx tsx video/tools/capture.ts <shots-module> [shot-id ...] [--base=http://localhost:5173] [--clean]
 *
 * --clean records the same shots with the game's HUD hidden (the mission note,
 * the stamp buttons, the minimap, tips and prompts) for short cuts where the
 * picture must read at a glance; the files are named <id>-clean.mp4. Speech
 * bubbles, story cards and panels stay, because they are the story.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Browser, type CDPSession, type Page } from "playwright";
import { CLEAN_HUD } from "./clean-hud";

const HERE = dirname(fileURLToPath(import.meta.url));
export const VIDEO_DIR = resolve(HERE, "..");
const CLOCK = readFileSync(join(HERE, "virtual-clock.js"), "utf8");

export const FPS = 30;
const SUBSTEPS = 2; // game frames per saved frame (60 fps inside the game)
const STEP_MS = 1000 / (FPS * SUBSTEPS);

export interface SoundEvent {
  frame: number;
  kind: "play" | "speak" | "music" | "loop";
  name: string;
  options?: unknown;
}

export interface Shot {
  id: string;
  /** Path and query on the game's origin, for example "/?test&quality=high". */
  url: string;
  /** Save data to start from (written to localStorage before the game loads). */
  save?: unknown;
  /** Extra localStorage keys. */
  storage?: Record<string, string>;
  /** Wait for this before holding the clock (default: the game is ready). */
  ready?: (c: Capture) => Promise<void>;
  /** Runs in real time before recording: teleports, panels, state. */
  setup?: (c: Capture) => Promise<void>;
  /** Runs with the clock held; everything in here is recorded. */
  run: (c: Capture) => Promise<void>;
  /** Extra CSS for this shot (for example, hiding the title menu for a still). */
  css?: string;
}



export class Capture {
  frame = 0;
  events: SoundEvent[] = [];
  private ffmpeg: ChildProcessWithoutNullStreams | null = null;
  private recording = false;

  constructor(
    readonly page: Page,
    private cdp: CDPSession,
    readonly shot: Shot,
  ) {}

  /** Calls a debug hook on window.__poh. */
  poh<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
    return this.page.evaluate(([n, a]) => {
      const poh = (window as unknown as { __poh: Record<string, (...x: unknown[]) => unknown> }).__poh;
      return poh[n as string]!(...(a as unknown[])) as never;
    }, [name, args] as const) as Promise<T>;
  }

  /** Real-time wait, before recording starts. */
  async settle(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async start(outFile: string): Promise<void> {
    mkdirSync(dirname(outFile), { recursive: true });
    this.ffmpeg = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-r", String(FPS), outFile]);
    this.ffmpeg.stderr.on("data", (d) => process.stderr.write(d));
    // Log every sound the game asks for, with the virtual time it happened.
    await this.page.evaluate(() => {
      const w = window as unknown as { __poh: { audio(): Record<string, unknown> }; __soundLog: unknown[]; __vclock: { now: number } };
      w.__soundLog = [];
      const a = w.__poh.audio() as Record<string, (...args: unknown[]) => unknown>;
      for (const [method, kind] of [
        ["play", "play"],
        ["speak", "speak"],
        ["setMusic", "music"],
        ["loop", "loop"],
      ] as const) {
        const original = a[method]!.bind(a);
        a[method] = (...args: unknown[]) => {
          w.__soundLog.push({ t: performance.now(), kind, args: JSON.parse(JSON.stringify(args.slice(0, 3), (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? null : v))) });
          return original(...args);
        };
      }
    });
    await this.page.evaluate(() => (window as unknown as { __vclock: { hold(): number } }).__vclock.hold());
    this.t0 = await this.page.evaluate(() => (window as unknown as { __vclock: { now: number } }).__vclock.now);
    this.recording = true;
  }

  private t0 = 0;

  /** Advances one saved frame (two game frames) and writes it. */
  async tick(perStep?: () => Promise<void>): Promise<void> {
    for (let i = 0; i < SUBSTEPS; i += 1) {
      if (perStep) await perStep();
      await this.page.evaluate((ms) => (window as unknown as { __vclock: { step(ms: number): number } }).__vclock.step(ms), STEP_MS);
    }
    if (!this.recording || !this.ffmpeg) return;
    const shot = await this.cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 94, optimizeForSpeed: true });
    const buf = Buffer.from(shot.data, "base64");
    if (!this.ffmpeg.stdin.write(buf)) await new Promise((r) => this.ffmpeg!.stdin.once("drain", r));
    this.frame += 1;
  }

  /** Records `seconds` of the game running on its own. */
  async play(seconds: number): Promise<void> {
    const n = Math.round(seconds * FPS);
    for (let i = 0; i < n; i += 1) await this.tick();
  }

  /** Presses a key for `seconds`, recording all along. */
  async key(code: string, seconds = 0.12, after = 0): Promise<void> {
    await this.page.keyboard.down(code);
    await this.play(seconds);
    await this.page.keyboard.up(code);
    if (after > 0) await this.play(after);
  }

  /** Clicks the centre of the first element matching `selector` (no waiting on animation frames). */
  async click(selector: string, after = 0): Promise<boolean> {
    const box = await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, selector);
    if (!box) return false;
    await this.page.mouse.move(box.x, box.y);
    await this.play(0.15);
    await this.page.mouse.down();
    await this.play(0.08);
    await this.page.mouse.up();
    if (after > 0) await this.play(after);
    return true;
  }

  /** Moves the mouse smoothly to a point over `seconds` (for hovers). */
  async glide(x: number, y: number, seconds = 0.5): Promise<void> {
    const n = Math.max(1, Math.round(seconds * FPS));
    const from = this.mouse;
    for (let i = 1; i <= n; i += 1) {
      const k = i / n;
      const e = k * k * (3 - 2 * k);
      await this.page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
      await this.tick();
    }
    this.mouse = { x, y };
  }

  private mouse = { x: 960, y: 540 };

  async exists(selector: string): Promise<boolean> {
    return this.page.evaluate((sel) => Boolean(document.querySelector(sel)), selector);
  }

  /** Records until `selector` exists (or `max` seconds). */
  async until(selector: string, max = 10): Promise<boolean> {
    const n = Math.round(max * FPS);
    for (let i = 0; i < n; i += 1) {
      if (await this.exists(selector)) return true;
      await this.tick();
    }
    return false;
  }

  /** Records until a page condition is true (or `max` seconds). */
  async untilTrue(fn: string, max = 10): Promise<boolean> {
    const n = Math.round(max * FPS);
    for (let i = 0; i < n; i += 1) {
      if (await this.page.evaluate(fn)) return true;
      await this.tick();
    }
    return false;
  }

  /**
   * Walks the player to an interactable with the virtual gamepad, steering
   * relative to the camera like a player would. Stops `stop` units away.
   */
  async walkTo(id: string | number[], opts: { stop?: number; max?: number; speed?: number } = {}): Promise<boolean> {
    const stop = opts.stop ?? 0.85;
    const speed = opts.speed ?? 0.88;
    // An interactable's id, or a point in world space (a waypoint, such as a doorway).
    const target = Array.isArray(id) ? id : await this.poh<number[] | null>("targetOf", id);
    if (!target) throw new Error(`no interactable ${String(id)}`);
    await this.page.evaluate(() => (window as unknown as { __vclock: { pad: { on(): void } } }).__vclock.pad.on());
    let arrived = false;
    const n = Math.round((opts.max ?? 12) * FPS);
    for (let i = 0; i < n && !arrived; i += 1) {
      await this.tick(async () => {
        arrived = await this.page.evaluate(
          ([tgt, stopAt, spd]) => {
            const w = window as unknown as { __poh: { player(): { position: number[] }; camera(): { forward: number[] } }; __vclock: { pad: { set(a: number[]): void } } };
            const p = w.__poh.player().position;
            const f = w.__poh.camera().forward;
            const len = (v: number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);
            const up = p.map((v) => v / len(p));
            const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
            const flat = (v: number[]) => {
              const d = dot(v, up);
              return v.map((x, i) => x - up[i]! * d);
            };
            const norm = (v: number[]) => {
              const l = len(v) || 1;
              return v.map((x) => x / l);
            };
            const fwd = norm(flat(f));
            const right = [fwd[1]! * up[2]! - fwd[2]! * up[1]!, fwd[2]! * up[0]! - fwd[0]! * up[2]!, fwd[0]! * up[1]! - fwd[1]! * up[0]!];
            const d = flat((tgt as number[]).map((x, i) => x - p[i]!));
            const dist = len(d);
            if (dist < (stopAt as number)) {
              w.__vclock.pad.set([0, 0, 0, 0]);
              return true;
            }
            const x = dot(d, right) / dist;
            const y = dot(d, fwd) / dist;
            // Ease off near the end so the stop is soft.
            const s = (spd as number) * Math.min(1, 0.45 + dist / 3);
            w.__vclock.pad.set([x * s, -y * s, 0, 0]);
            return false;
          },
          [target, stop, speed] as const,
        );
      });
    }
    await this.page.evaluate(() => (window as unknown as { __vclock: { pad: { off(): void } } }).__vclock.pad.off());
    // Hand the prompts back to the keyboard.
    await this.page.keyboard.press("ShiftLeft");
    return arrived;
  }

  async finish(outFile: string): Promise<void> {
    this.recording = false;
    const log = await this.page.evaluate(() => (window as unknown as { __soundLog: { t: number; kind: string; args: unknown[] }[] }).__soundLog ?? []);
    const frameMs = 1000 / FPS;
    this.events = log.map((e) => ({ frame: Math.max(0, Math.round((e.t - this.t0) / frameMs) - 1), kind: e.kind as SoundEvent["kind"], name: String(e.args[0] ?? ""), options: e.args.slice(1) }));
    if (this.ffmpeg) {
      this.ffmpeg.stdin.end();
      await new Promise<void>((r) => this.ffmpeg!.on("close", () => r()));
    }
    writeFileSync(outFile.replace(/\.mp4$/, ".events.json"), JSON.stringify({ shot: this.shot.id, fps: FPS, frames: this.frame, events: this.events }, null, 1));
  }
}

export async function launch(): Promise<Browser> {
  return chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "--force-color-profile=srgb"],
  });
}

export async function captureShot(browser: Browser, base: string, shot: Shot, outDir: string, opts: { clean?: boolean } = {}): Promise<{ file: string; frames: number; errors: string[] }> {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(CLOCK);
  await page.addInitScript(
    ([save, storage]) => {
      if (sessionStorage.getItem("seeded")) return;
      if (save) localStorage.setItem("poh.save.v1", JSON.stringify(save));
      for (const [k, v] of Object.entries((storage as Record<string, string>) ?? {})) localStorage.setItem(k, v);
      sessionStorage.setItem("seeded", "1");
    },
    [shot.save ?? null, shot.storage ?? {}] as const,
  );
  const css = [shot.css ?? "", opts.clean ? CLEAN_HUD : ""].join(" ").trim();
  if (css)
    await page.addInitScript((rules) => {
      const add = () => {
        const el = document.createElement("style");
        el.textContent = rules as string;
        document.head.append(el);
      };
      if (document.head) add();
      else document.addEventListener("DOMContentLoaded", add, { once: true });
    }, css);
  const cdp = await context.newCDPSession(page);
  const c = new Capture(page, cdp, shot);
  await page.goto(base + shot.url);
  if (shot.ready) await shot.ready(c);
  else await page.waitForFunction(() => document.documentElement.dataset["stage"] === "ready" || Boolean((window as unknown as { __poh?: { audio?: unknown } }).__poh?.audio), null, { timeout: 90_000 });
  if (shot.setup) await shot.setup(c);
  const file = join(outDir, `${shot.id}${opts.clean ? "-clean" : ""}.mp4`);
  await c.start(file);
  await shot.run(c);
  await c.finish(file);
  await context.close();
  return { file, frames: c.frame, errors };
}

// ---- CLI ----
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const base = (args.find((a) => a.startsWith("--base=")) ?? "--base=http://localhost:5173").slice(7);
  const rest = args.filter((a) => !a.startsWith("--"));
  const clean = args.includes("--clean");
  const mod = (await import(pathToFileURL(resolve(rest[0]!)).href)) as { shots: Shot[] };
  const only = new Set(rest.slice(1));
  const outDir = join(VIDEO_DIR, "capture");
  const browser = await launch();
  const report: Record<string, unknown> = {};
  for (const shot of mod.shots) {
    if (only.size && !only.has(shot.id)) continue;
    const t = Date.now();
    try {
      const r = await captureShot(browser, base, shot, outDir, { clean });
      report[shot.id] = { frames: r.frames, seconds: r.frames / FPS, took: Math.round((Date.now() - t) / 1000), errors: r.errors };
      console.log(`${shot.id}: ${r.frames} frames (${(r.frames / FPS).toFixed(1)} s) in ${Math.round((Date.now() - t) / 1000)} s, ${r.errors.length} errors`);
      for (const e of r.errors.slice(0, 5)) console.log("   error:", e.slice(0, 200));
    } catch (e) {
      console.log(`${shot.id}: FAILED ${String(e).slice(0, 400)}`);
      report[shot.id] = { failed: String(e) };
    }
  }
  writeFileSync(join(outDir, clean ? "report-clean.json" : "report.json"), JSON.stringify(report, null, 1));
  await browser.close();
}
