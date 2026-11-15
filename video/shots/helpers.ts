/**
 * Helpers for shot setups. These run in real time, before the clock is held,
 * to bring the game to the moment a shot starts (the same moves the
 * playthrough tests make). Nothing here is recorded.
 */
import type { Capture } from "../tools/capture";

export interface Save {
  version: 1;
  world: string;
  miloStage: number;
  carrying: string | null;
  delivered: string[];
  stamps: string[];
  flags: string[];
}

export const AFTER_PROLOGUE: Save = { version: 1, world: "home", miloStage: 0, carrying: null, delivered: ["to-the-lamp"], stamps: ["prologue"], flags: ["seen-notebook"] };
export const AFTER_CHAPTER_1: Save = { ...AFTER_PROLOGUE, miloStage: 1, delivered: ["to-the-lamp", "a11-letter-descent", "a11-letter-seismometer", "a11-letter-mirrors"], stamps: ["prologue", "chapter-1"] };

/** Settings that keep the picture clean: tutorial tips already seen. */
export const CLEAN: Record<string, string> = {};

interface State {
  world: string;
  carrying: string | null;
  delivered: string[];
  stamps: string[];
  flags: string[];
  miloStage: number;
}

export const state = (c: Capture): Promise<State> => c.poh<State>("state");

export async function goTo(c: Capture, id: string): Promise<void> {
  const ok = await c.poh<boolean>("teleportTo", id);
  if (!ok) throw new Error(`teleport to ${id}`);
  await c.settle(400);
}

/** Presses the interact key in real time, clicking away any story card first. */
export async function use(c: Capture): Promise<void> {
  while (await c.exists(".card .got")) {
    await c.settle(400);
    await c.page.locator(".card .got").first().click();
    await c.settle(300);
  }
  await c.page.keyboard.down("KeyE");
  await c.settle(120);
  await c.page.keyboard.up("KeyE");
  await c.settle(300);
}

/** Clicks through story cards in real time until `done` is true. */
export async function until(c: Capture, done: (s: State) => boolean, timeout = 60_000): Promise<void> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (done(await state(c))) return;
    if (await c.exists(".card .got")) {
      await c.settle(400);
      await c.page.locator(".card .got").first().click().catch(() => undefined);
    }
    await c.settle(250);
  }
  throw new Error(`timed out; state ${JSON.stringify(await state(c))}`);
}

export async function waitWorld(c: Capture, id: string): Promise<void> {
  await c.page.waitForFunction((w) => (window as unknown as { __poh: { worldId(): string | null } }).__poh.worldId() === w, id, { timeout: 60_000 });
}

/** Recorded: clicks every story card's "Got it" that shows up within `seconds`, pausing `read` seconds on each. */
export async function readCards(c: Capture, seconds: number, read = 2.5): Promise<void> {
  const end = c.frame + Math.round(seconds * 30);
  while (c.frame < end) {
    if (await c.exists(".card .got")) {
      await c.play(read);
      await c.click(".card .got", 0.2);
    } else await c.play(0.2);
  }
}

/** A point on the home planet's surface from latitude and longitude (degrees), the game's own convention (y is north). */
export function onPlanet(lat: number, lon: number, radius = 20): number[] {
  const a = (lat * Math.PI) / 180;
  const o = (lon * Math.PI) / 180;
  return [radius * Math.cos(a) * Math.sin(o), radius * Math.sin(a), radius * Math.cos(a) * Math.cos(o)];
}
