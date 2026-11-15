/**
 * The demo video's gameplay shots. Every shot is the real game in Chrome;
 * setups use the test hooks to start at the right moment, then everything
 * that is recorded is played with real input (walking, the interact key,
 * clicks). Run: npx tsx video/tools/capture.ts video/shots/demo.ts [ids]
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Shot } from "../tools/capture";
import { CLEAN_HUD } from "../tools/clean-hud";
import { AFTER_CHAPTER_1, AFTER_PROLOGUE, goTo, onPlanet, readCards, state, until, use, waitWorld, type Save } from "./helpers";

const HIGH = "&quality=high";
/** Tutorial tips off, so the picture stays clean. */
const CLEAN = { "poh.settings.v1": JSON.stringify({ tips: false }) };

const ALL_LETTERS = ["to-the-lamp", "a11-letter-descent", "a11-letter-seismometer", "a11-letter-mirrors", "a15-letter-wheels", "a15-letter-seats", "a15-letter-tracks", "opp-letter-bounce", "opp-letter-grinder", "opp-letter-panels", "ing-letter-field", "ing-letter-tracks", "ing-letter-heli"];
const AFTER_CHAPTER_4: Save = { version: 1, world: "home", miloStage: 4, carrying: null, delivered: ALL_LETTERS, stamps: ["prologue", "chapter-1", "chapter-2", "chapter-3", "chapter-4"], flags: ["seen-notebook"] };
const ROOM = "lamp-otter-comet-42";

const IN_TRANQUILITY: Save = {
  ...AFTER_PROLOGUE,
  world: "tranquility",
  carrying: "a11-letter-mirrors",
  delivered: ["to-the-lamp", "a11-letter-descent", "a11-letter-seismometer"],
  flags: ["seen-notebook", "chapter-1:arrived"],
};

export const shots: Shot[] = [
  {
    // The title screen as it builds, without the menu, for the slides and the end cards.
    id: "title-still",
    url: `/?test&intro${HIGH}`,
    css: "#ui .menu, #ui .corner, #ui .skip { visibility: hidden !important; }",
    ready: async (c) => {
      await c.page.waitForFunction(() => {
        const b = document.querySelector<HTMLButtonElement>("#light");
        return Boolean(b && !b.disabled && b.offsetParent !== null);
      }, null, { timeout: 120_000 });
      await c.settle(2500);
    },
    run: async (c) => {
      await c.play(0.5);
      await c.click("#light");
      await c.untilTrue("Boolean(document.querySelector('button.chain'))", 25);
      await c.play(4);
    },
  },
  {
    // A clean, slow look at the home planet: Remi strolls to the mailbox while the camera circles.
    id: "planet-stroll",
    url: `/?test${HIGH}`,
    storage: CLEAN,
    save: AFTER_PROLOGUE,
    css: CLEAN_HUD,
    setup: async (c) => {
      await c.settle(1500);
      await c.page.keyboard.down("Minus");
      await c.settle(700);
      await c.page.keyboard.up("Minus");
      await c.settle(600);
    },
    run: async (c) => {
      await c.play(0.6);
      await c.page.keyboard.down("Comma");
      await c.walkTo("mailbox", { max: 8, speed: 0.7 });
      await c.walkTo(onPlanet(-3.2, 16), { max: 9, stop: 1.4, speed: 0.75 });
      await c.page.keyboard.up("Comma");
      await c.play(1.5);
    },
  },
  {
    // Remi walks across the yard to the mailbox, with Mom on the porch.
    id: "test-walk",
    url: `/?test${HIGH}`,
    setup: async (c) => {
      await c.settle(1500);
    },
    run: async (c) => {
      await c.play(1);
      await c.walkTo("mailbox", { max: 8 });
      await c.play(1);
      await c.key("KeyE", 0.15, 2);
    },
  },
  {
    // Loader, the light switch, the title flight, the pull chain, the storybook.
    id: "opening",
    url: `/?test&intro${HIGH}`,
    ready: async (c) => {
      await c.page.waitForFunction(() => {
        const b = document.querySelector<HTMLButtonElement>("#light");
        return Boolean(b && !b.disabled && b.offsetParent !== null);
      }, null, { timeout: 120_000 });
      await c.settle(2500);
    },
    run: async (c) => {
      await c.play(1.5);
      await c.click("#light");
      await c.untilTrue("Boolean(document.querySelector('button.chain'))", 25);
      await c.play(2.5);
      await c.click("button.chain");
      await c.until(".tab", 12);
      await c.play(2);
      await c.click(".tab");
      await c.until(".next", 10);
      for (let i = 0; i < 4; i += 1) {
        await c.play(3.2);
        await c.click(".next");
      }
      await c.play(3);
    },
  },
  {
    // Remi walks through the yard into Dad's workshop, to the bench of domes, then dives into the Moon dome.
    id: "workshop-trip",
    url: `/?test${HIGH}`,
    save: AFTER_PROLOGUE,
    setup: async (c) => {
      await c.settle(1500);
    },
    run: async (c) => {
      await c.play(0.8);
      // Through the workshop door (a waypoint just outside it), not straight at the lamp through the wall.
      await c.walkTo(onPlanet(-3.2, 16), { max: 12, stop: 1.4 });
      await c.walkTo("lamp", { max: 10, stop: 1.6 });
      await c.walkTo("dome-tranquility", { max: 8, stop: 0.7 });
      await c.play(0.8);
      await c.key("KeyE", 0.15);
      // Dad's journey opens with the Moon dome picked: a beat to read it, then "Let's go!".
      await c.play(2.2);
      await c.page.getByRole("button", { name: /Let's go/ }).click();
      await c.untilTrue("window.__poh.worldId() === 'tranquility'", 30);
      await c.play(4);
    },
  },
  {
    // Tranquility Base: the last of the three letters, to the mirrors, then the true story card.
    id: "moon-letter",
    url: `/?test&world=tranquility${HIGH}`,
    save: IN_TRANQUILITY,
    setup: async (c) => {
      await waitWorld(c, "tranquility");
      await c.settle(2000);
      const s = await state(c);
      if (s.carrying !== "a11-letter-mirrors") await c.poh("patch", { carrying: "a11-letter-mirrors" });
    },
    run: async (c) => {
      await c.play(0.6);
      await c.walkTo("letter-lrrr", { max: 10 });
      await c.play(0.5);
      await c.key("KeyE", 0.15);
      await readCards(c, 34, 4);
    },
  },
  {
    // Send a Light: the last step, the blink from Earth comes back from the corner cubes.
    id: "send-a-light",
    url: `/?test&world=tranquility${HIGH}`,
    // Both spare mirrors already fitted (mirror-a, mirror-b): with only one, the blink never comes back ("Ping... but no pong").
    save: { ...IN_TRANQUILITY, carrying: null, delivered: [...IN_TRANQUILITY.delivered, "a11-letter-mirrors"], flags: [...IN_TRANQUILITY.flags, "send-a-light:started", "send-a-light:mirror-a", "send-a-light:mirror-b", "send-a-light:mirrors", "send-a-light:turn"] },
    setup: async (c) => {
      await waitWorld(c, "tranquility");
      await c.settle(2500);
      await goTo(c, "earth-console");
      await c.page.keyboard.press("KeyS");
      await c.settle(800);
    },
    run: async (c) => {
      await c.play(0.8);
      await c.walkTo("earth-console", { max: 4, stop: 0.7 });
      await c.key("KeyE", 0.15);
      // Ping, the real round trip, pong, then all hundred cubes glint back at Earth.
      await readCards(c, 22, 3);
    },
  },
  {
    // Home through the lamp light with the corner-cube eyes; Milo gets them; the stamp.
    id: "milo-eyes",
    url: `/?test${HIGH}`,
    storage: CLEAN,
    save: { ...AFTER_CHAPTER_1, miloStage: 0, carrying: "part:chapter-1", stamps: ["prologue"], flags: ["seen-notebook", "chapter-1:arrived", "send-a-light:started", "send-a-light:mirrors", "send-a-light:turn", "send-a-light:done"] },
    setup: async (c) => {
      await c.settle(1500);
      await goTo(c, "milo");
      await c.page.keyboard.down("KeyS");
      await c.settle(500);
      await c.page.keyboard.up("KeyS");
      await c.page.keyboard.down("Equal");
      await c.settle(900);
      await c.page.keyboard.up("Equal");
      await c.settle(800);
    },
    run: async (c) => {
      await c.play(0.6);
      await c.walkTo("milo", { max: 5, stop: 0.75 });
      await c.key("KeyE", 0.15);
      await readCards(c, 40, 3.5);
    },
  },
  {
    // Inside the workshop: Remi walks to the bench and picks the Moon dome; the dive and the rocket trip.
    id: "bench-trip",
    url: `/?test${HIGH}`,
    storage: CLEAN,
    save: AFTER_PROLOGUE,
    setup: async (c) => {
      await c.settle(1500);
      await goTo(c, "milo");
      await c.page.keyboard.down("KeyS");
      await c.settle(700);
      await c.page.keyboard.up("KeyS");
      await c.settle(900);
    },
    run: async (c) => {
      await c.play(1);
      await c.walkTo("dome-tranquility", { max: 8, stop: 0.7 });
      await c.play(0.6);
      await c.key("KeyE", 0.15);
      // Dad's journey opens with the Moon dome picked: a beat to read it, then "Let's go!".
      await c.play(2.2);
      await c.page.getByRole("button", { name: /Let's go/ }).click();
      await c.untilTrue("window.__poh.worldId() === 'tranquility'", 30);
      await c.play(12);
    },
  },
  {
    // Meridiani Planum: the breeze flags are lined up; a dust devil runs along them and cleans Opportunity's panels.
    id: "mars-devil",
    url: `/?test&world=meridiani${HIGH}`,
    storage: CLEAN,
    save: { ...AFTER_CHAPTER_1, world: "meridiani", delivered: [...AFTER_CHAPTER_1.delivered, "opp-letter-bounce", "opp-letter-grinder", "opp-letter-panels"], flags: ["seen-notebook", "chapter-3:arrived", "wait-for-the-wind:started", "wait-for-the-wind:flags"] },
    setup: async (c) => {
      await waitWorld(c, "meridiani");
      await c.settle(2500);
      await goTo(c, "letter-panels");
      await c.page.keyboard.down("KeyS");
      await c.settle(700);
      await c.page.keyboard.up("KeyS");
      await c.poh("world", "guide");
      await c.settle(1200);
    },
    run: async (c) => {
      await c.play(1.2);
      await c.poh("world", "devil");
      await readCards(c, 22, 3.5);
    },
  },
  {
    // Valinor Hills: Remi flies Dad's toy helicopter (the same idea as Ingenuity).
    id: "valinor-flight",
    url: `/?test&world=valinor${HIGH}`,
    storage: CLEAN,
    save: { ...AFTER_CHAPTER_1, world: "valinor", delivered: [...AFTER_CHAPTER_1.delivered, "ing-letter-field", "ing-letter-tracks", "ing-letter-heli"], flags: ["seen-notebook", "chapter-4:arrived", "thin-air:started", "thin-air:bench"] },
    setup: async (c) => {
      await waitWorld(c, "valinor");
      await c.settle(2500);
      await goTo(c, "scout-pad");
      await c.page.keyboard.down("KeyS");
      await c.settle(600);
      await c.page.keyboard.up("KeyS");
      await c.settle(800);
    },
    run: async (c) => {
      await c.play(0.8);
      await c.walkTo("scout-pad", { max: 5, stop: 0.75 });
      await c.key("KeyE", 0.15);
      await c.play(9);
    },
  },
  {
    // The real Ingenuity's model where it stays, a slow turn of the camera, then Dad's letter to it.
    id: "valinor-ingenuity",
    url: `/?test&world=valinor${HIGH}`,
    storage: CLEAN,
    save: { ...AFTER_CHAPTER_1, world: "valinor", delivered: [...AFTER_CHAPTER_1.delivered, "ing-letter-field", "ing-letter-tracks"], carrying: "ing-letter-heli", flags: ["seen-notebook", "chapter-4:arrived"] },
    setup: async (c) => {
      await waitWorld(c, "valinor");
      await c.settle(2500);
      await goTo(c, "letter-ingenuity");
      await c.page.keyboard.down("KeyS");
      await c.settle(900);
      await c.page.keyboard.up("KeyS");
      await c.settle(800);
    },
    run: async (c) => {
      await c.page.keyboard.down("Period");
      await c.play(3);
      await c.page.keyboard.up("Period");
      await c.walkTo("letter-ingenuity", { max: 5, stop: 0.8 });
      await c.key("KeyE", 0.15);
      await readCards(c, 16, 3.5);
    },
  },
  {
    // Notebook: Dad's pages after the first chapter, turned with the arrow key.
    id: "notebook",
    url: `/?test${HIGH}`,
    storage: CLEAN,
    save: AFTER_CHAPTER_1,
    setup: async (c) => {
      await c.settle(1500);
    },
    run: async (c) => {
      await c.play(0.8);
      await c.key("KeyN", 0.1, 2.2);
      for (let i = 0; i < 4; i += 1) await c.key("ArrowRight", 0.1, 2.4);
    },
  },
  {
    // Finale: night, Dad's last letter, the backyard dish and the star map; the letter to Voyager 1.
    id: "finale-dish",
    url: `/?test${HIGH}`,
    storage: CLEAN,
    save: AFTER_CHAPTER_4,
    setup: async (c) => {
      await until(c, (s) => s.flags.includes("finale:begun"), 60_000);
      for (let i = 0; i < 20 && (await state(c)).carrying !== "v1-letter"; i += 1) {
        await goTo(c, "mailbox");
        await use(c);
        await c.settle(800);
      }
      // Let Dad's letter beat finish (the dish ignores the key while a story beat plays).
      for (let i = 0; i < 50; i += 1) {
        if (await c.exists(".card .got")) await c.page.locator(".card .got").first().click().catch(() => undefined);
        await c.settle(300);
      }
      await goTo(c, "dish");
      await c.page.keyboard.down("KeyS");
      await c.settle(600);
      await c.page.keyboard.up("KeyS");
      await c.settle(800);
    },
    run: async (c) => {
      await c.play(0.6);
      await c.walkTo("dish", { max: 5, stop: 0.75 });
      await c.key("KeyE", 0.15);
      for (let i = 0; i < 80 && !(await c.exists(".dish svg.map")); i += 1) {
        if (await c.exists(".card .got")) {
          await c.play(2.5);
          await c.click(".card .got", 0.3);
        } else await c.play(0.4);
        if (i === 20 || i === 40) await c.key("KeyE", 0.15);
      }
      if (!(await c.exists(".dish svg.map"))) throw new Error("the star map did not open");
      await c.play(1.5);
      // Tonight's place of Voyager 1 from the Horizons table, on the map's own projection.
      const rows = (JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../src/data/voyager1.json"), "utf8")) as { rows: { date: string; ra: number; dec: number }[] }).rows;
      const today = new Date().toISOString().slice(0, 10);
      const v = rows.find((r) => r.date === today) ?? rows[0]!;
      const spot = await c.page.evaluate((v) => {
        const box = document.querySelector(".dish svg.map")!.getBoundingClientRect();
        const K = 720 / 64;
        const x = 360 - (v.ra - 259) * Math.cos((9 * Math.PI) / 180) * K;
        const y = 220 - (v.dec - 9) * K;
        return { x: box.left + (x / 720) * box.width, y: box.top + (y / 440) * box.height };
      }, v);
      await c.glide(spot.x, spot.y, 1.2);
      await c.page.mouse.down();
      await c.play(0.08);
      await c.page.mouse.up();
      await c.play(2);
      const send = await c.page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /Send Dad's letter/.test(x.textContent ?? ""));
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (send) {
        await c.glide(send.x, send.y, 0.8);
        await c.page.mouse.down();
        await c.play(0.08);
        await c.page.mouse.up();
      }
      await c.play(7);
    },
  },
  {
    // Milo finished, in the workshop with every part.
    id: "milo-complete",
    url: `/?test${HIGH}`,
    storage: CLEAN,
    save: { ...AFTER_CHAPTER_4, miloStage: 5, stamps: [...AFTER_CHAPTER_4.stamps, "finale"], flags: ["seen-notebook", "finale:begun", "finale:ended"] },
    setup: async (c) => {
      await c.settle(1500);
      await goTo(c, "milo");
      await c.page.keyboard.down("KeyS");
      await c.settle(900);
      await c.page.keyboard.up("KeyS");
      await c.page.keyboard.down("Equal");
      await c.settle(1000);
      await c.page.keyboard.up("Equal");
      await c.settle(800);
    },
    run: async (c) => {
      await c.page.keyboard.down("Comma");
      await c.play(5);
      await c.page.keyboard.up("Comma");
      await c.walkTo("milo", { max: 4, stop: 0.9 });
      await c.key("KeyE", 0.15);
      await readCards(c, 9, 3);
    },
  },
  {
    // The Field Guide (works without 3D, prints for classrooms) and the settings.
    id: "guide-settings",
    url: `/?test${HIGH}`,
    storage: CLEAN,
    save: AFTER_CHAPTER_1,
    setup: async (c) => {
      await c.settle(1500);
    },
    run: async (c) => {
      await c.play(0.5);
      await c.page.evaluate(() => (window as unknown as { __poh: { panel(id: string): void } }).__poh.panel("guide"));
      await c.play(3.5);
      await c.page.mouse.move(960, 600);
      for (let i = 0; i < 10; i += 1) {
        await c.page.mouse.wheel(0, 120);
        await c.play(0.25);
      }
      await c.play(1.5);
      await c.page.keyboard.press("Escape");
      await c.play(0.6);
      await c.page.evaluate(() => (window as unknown as { __poh: { panel(id: string): void } }).__poh.panel("settings"));
      await c.play(2.5);
      await c.click("#set-tab-reading", 3.5);
      await c.click("#set-tab-motion", 3.5);
    },
  },
  {
    // Two players in one room: a friend joins with the room code, then emotes and a preset phrase.
    id: "coop",
    url: `/?test&room=${ROOM}${HIGH}`,
    storage: CLEAN,
    save: AFTER_PROLOGUE,
    setup: async (c) => {
      await c.page.waitForFunction(() => document.documentElement.dataset["net"] === "connected", null, { timeout: 60_000 });
      const friend = await c.page.context().browser()!.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await friend.newPage();
      await page.addInitScript((save) => {
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem("poh.save.v1", JSON.stringify(save));
          localStorage.setItem("poh.settings.v1", JSON.stringify({ tips: false }));
          sessionStorage.setItem("seeded", "1");
        }
      }, AFTER_PROLOGUE);
      await page.goto(c.page.url().replace(/quality=high/, "quality=low"));
      await page.waitForFunction(() => document.documentElement.dataset["net"] === "connected", null, { timeout: 60_000 });
      await page.evaluate(() => (window as unknown as { __poh: { pick(k: string): void } }).__poh.pick("nori"));
      await page.waitForTimeout(1500);
      await page.evaluate(() => (window as unknown as { __poh: { teleportTo(id: string): boolean } }).__poh.teleportTo("mailbox"));
      await page.keyboard.down("KeyD");
      await page.waitForTimeout(700);
      await page.keyboard.up("KeyD");
      await c.poh("teleportTo", "mailbox");
      await c.page.keyboard.down("KeyS");
      await c.settle(900);
      await c.page.keyboard.up("KeyS");
      await c.settle(2500);
      friendPage = page;
    },
    run: async (c) => {
      const friend = friendPage!;
      // The Play together panel: a private room code, no chat.
      await c.page.evaluate(() => (window as unknown as { __poh: { panel(id: string): void } }).__poh.panel("together"));
      await c.play(4.5);
      await c.page.keyboard.press("Escape");
      await c.play(1.2);
      // The friend waves, in real time on their own screen.
      await friend.keyboard.press("KeyG");
      await friend.waitForTimeout(500);
      await friend.locator(".wheel .emote").first().click({ timeout: 3000 }).catch(() => undefined);
      await c.play(2.5);
      await c.key("KeyG", 0.1, 1.2);
      const buttons = await c.page.evaluate(() => [...document.querySelectorAll(".wheel button")].map((b) => (b.textContent ?? "").trim()));
      console.log("   emote wheel:", buttons.join(" | "));
      await c.click(".wheel .emotes .emote:nth-of-type(2)", 2.5);
      await c.key("KeyG", 0.1, 1.2);
      await c.click(".wheel .phrases .phrase:nth-of-type(3)", 3);
      await friend.keyboard.press("KeyG");
      await friend.waitForTimeout(500);
      await friend.locator(".wheel .phrase").nth(5).click({ timeout: 3000 }).catch(() => undefined);
      await c.play(4);
      await friend.context().close();
      friendPage = null;
    },
  },
];

let friendPage: import("playwright").Page | null = null;
