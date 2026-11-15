<script lang="ts">
  import { CHAPTERS, bonusOpen, type ChapterDef } from "../../content/chapters";
  import type { GameState } from "../../game/core/state";
  import Sketch from "../drawing/Sketch.svelte";
  import { DRAWINGS } from "../drawing/machines";
  import Icon from "../Icon.svelte";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";

  /**
   * Dad's journey: the chapter picker on Dad's bench. Each little world is a
   * postcard on Dad's corkboard, strung together in the order he made them,
   * with a hand-drawn sketch of its machine. A finished world wears Dad's
   * "Delivered" stamp; the next one has a pin. Pick a card, then "Let's go!"
   * dives into that dome.
   */
  interface Props {
    game: Readonly<GameState>;
    /** The dome the player pressed, picked first. */
    pick?: string | null;
    onclose: () => void;
    ongo: (world: string) => void;
  }
  let { game, pick = null, onclose, ongo }: Props = $props();

  const DRAWING: Record<string, keyof typeof DRAWINGS> = {
    tranquility: "lrrr",
    hadley: "lrv",
    meridiani: "opportunity",
    valinor: "ingenuity",
    storms: "surveyor",
  };
  const MARS = new Set(["meridiani", "valinor"]);
  /** Where each card hangs on the board, in percent, so the string zigzags. */
  const SPOTS: [number, number][] = [
    [12, 37],
    [31, 67],
    [51, 37],
    [70, 67],
    [88, 37],
  ];

  interface Card {
    chapter: ChapterDef;
    world: string;
    n: number;
    mars: boolean;
    open: boolean;
    done: boolean;
    letters: number;
    to: string[];
    x: number;
    y: number;
    tilt: number;
  }

  const explore = $derived(game.flags.includes("explore-freely"));
  const opened = $derived(game.stamps.includes("prologue") || explore);
  const cards = $derived<Card[]>(
    CHAPTERS.map((chapter, i) => {
      const [x, y] = SPOTS[i] ?? [50, 50];
      return {
        chapter,
        world: chapter.world,
        n: i + 1,
        mars: MARS.has(chapter.world),
        open: opened && (!chapter.bonus || bonusOpen(game) || explore),
        done: game.stamps.includes(chapter.id),
        letters: chapter.letters.filter((l) => game.delivered.includes(l.id)).length,
        to: chapter.letters.map((l) => l.address.replace(/^To (the )?/i, "")),
        x,
        y,
        tilt: [-3, 2.5, -1.5, 3, -2.5][i] ?? 0,
      };
    }),
  );
  const next = $derived(cards.find((c) => c.open && !c.done && !c.chapter.bonus) ?? cards.find((c) => c.open && !c.done) ?? null);
  let chosen = $state<string | null>(null);
  const selected = $derived(cards.find((c) => c.world === (chosen ?? pick ?? next?.world)) ?? cards[0]!);

  /** The string between the pins, as one gentle curve per gap. */
  const route = $derived(
    cards
      .map((c, i) => {
        if (i === 0) return `M ${c.x} ${c.y - 14}`;
        const prev = cards[i - 1]!;
        const mx = (prev.x + c.x) / 2;
        const my = Math.max(prev.y, c.y) - 4;
        return `Q ${mx} ${my} ${c.x} ${c.y - 14}`;
      })
      .join(" "),
  );

  function choose(card: Card): void {
    chosen = card.world;
  }
  function go(): void {
    if (selected.open) ongo(selected.world);
  }
</script>

<Panel title={t("journey.title")} lede={t("journey.lede")} icon="pin" size="xl" {onclose}>
  <div class="board">
    <svg class="string" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={route} />
    </svg>
    {#each cards as card (card.world)}
      <button
        type="button"
        class="card"
        class:mars={card.mars}
        class:shut={!card.open}
        class:done={card.done}
        class:picked={selected.world === card.world}
        style:left={`${card.x}%`}
        style:top={`${card.y}%`}
        style:--tilt={`${card.tilt}deg`}
        aria-pressed={selected.world === card.world}
        aria-label={`${card.chapter.bonus ? t("journey.bonus") : t("journey.chapter", { n: card.n })}: ${card.chapter.place}`}
        onclick={() => choose(card)}
        ondblclick={() => {
          choose(card);
          go();
        }}
      >
        <span class="pin" aria-hidden="true"></span>
        <span class="head">
          <span class="num">{card.chapter.bonus ? t("journey.bonus") : t("journey.chapter", { n: card.n })}</span>
          <span class="body">{card.mars ? t("journey.mars") : t("journey.moon")}</span>
        </span>
        <span class="pic">
          <Sketch id={`journey-${card.world}`} prims={DRAWINGS[DRAWING[card.world] ?? "lamp"]} still color="var(--ink)" />
          {#if !card.open}<span class="lock"><Icon name="lock" size={26} /></span>{/if}
        </span>
        <span class="place">{card.chapter.place}</span>
        <span class="meta">
          {#if card.open}
            <span class="dots" aria-label={t("journey.letters", { n: card.letters })}>
              {#each [0, 1, 2] as k (k)}<i class:got={k < card.letters}></i>{/each}
            </span>
          {:else}
            <span class="not">{card.chapter.bonus ? t("journey.bonusLocked") : t("journey.notYet")}</span>
          {/if}
        </span>
        {#if card.done}<span class="stamp" aria-hidden="true">{t("journey.done")}</span>{/if}
        {#if next?.world === card.world && !card.done}<span class="flag" aria-hidden="true">{t("journey.next")}</span>{/if}
      </button>
    {/each}
  </div>

  <div class="detail" class:mars={selected.mars}>
    <div class="what">
      <p class="kicker">{selected.chapter.bonus ? t("journey.bonus") : t("journey.chapter", { n: selected.n })} · {selected.mars ? t("journey.mars") : t("journey.moon")}</p>
      <h3>{selected.chapter.place}</h3>
      <p class="for"><b>{t("journey.for")}:</b> {selected.to.join(", ")}</p>
      <p class="for"><b>{t("journey.part")}:</b> {selected.chapter.miloPart}</p>
      <p class="scale">{t("journey.scale")}</p>
    </div>
    <button type="button" class="go" disabled={!selected.open} onclick={go}>
      {#if selected.open}<Icon name="rocket" size={22} /> {t("journey.go")}{:else}<Icon name="lock" size={20} /> {selected.chapter.bonus ? t("journey.bonusLocked") : t("journey.notYet")}{/if}
    </button>
  </div>
</Panel>

<style>
  .board {
    position: relative;
    height: clamp(350px, 50vh, 450px);
    border-radius: 14px;
    background:
      radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.08) 0 2px, transparent 3px) 0 0 / 22px 22px,
      radial-gradient(circle at 70% 60%, rgba(0, 0, 0, 0.08) 0 1.5px, transparent 2.5px) 0 0 / 17px 17px,
      linear-gradient(160deg, #b98a5c, #a37446);
    box-shadow:
      inset 0 0 0 6px #e8d5b5,
      inset 0 0 0 9px #8a6038,
      inset 0 10px 30px rgba(0, 0, 0, 0.25);
    overflow: hidden;
  }
  .string {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .string path {
    fill: none;
    stroke: #f6e3b4;
    stroke-width: 0.6;
    stroke-dasharray: 1.6 1.2;
    vector-effect: non-scaling-stroke;
    stroke-width: 2.4px;
    filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.35));
  }
  .card {
    position: absolute;
    width: clamp(132px, 15.5%, 168px);
    transform: translate(-50%, -50%) rotate(var(--tilt));
    display: grid;
    gap: 4px;
    padding: 8px 8px 10px;
    border: 0;
    border-radius: 3px;
    background: var(--paper-light);
    color: var(--ink);
    text-align: center;
    cursor: pointer;
    /* A postage stamp: a dashed perforation line just inside the edge. */
    outline: 2px dashed rgba(43, 38, 34, 0.28);
    outline-offset: -5px;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.35);
    transition:
      transform 0.28s var(--ease-spring),
      box-shadow 0.2s;
  }
  .card:hover,
  .card:focus-visible {
    transform: translate(-50%, -54%) rotate(var(--tilt)) scale(1.05);
  }
  .card.picked {
    transform: translate(-50%, -56%) rotate(0deg) scale(1.12);
    box-shadow:
      0 0 0 4px var(--amber),
      0 0 18px 4px rgba(242, 165, 65, 0.65),
      0 10px 18px rgba(0, 0, 0, 0.4);
    z-index: 2;
  }
  .card:focus-visible {
    outline: none;
  }
  .pin {
    position: absolute;
    top: 2px;
    left: 50%;
    width: 14px;
    height: 14px;
    margin-left: -7px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #ff9b84, var(--clay) 55%, var(--clay-deep));
    box-shadow: 0 2px 2px rgba(0, 0, 0, 0.35);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 12px;
    padding: 0 2px;
    font: 700 0.62rem/1 var(--label);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .body {
    color: #5c7393;
  }
  .mars .body {
    color: var(--clay);
  }
  .pic {
    position: relative;
    display: block;
    aspect-ratio: 4 / 3;
    border-radius: 2px;
    background: linear-gradient(170deg, #dfe4ea, #c4ccd6);
    border: 1.5px solid var(--ink);
    overflow: hidden;
  }
  .mars .pic {
    background: linear-gradient(170deg, #f3c7a0, #dd9c6f);
  }
  .pic :global(svg) {
    width: 100%;
    height: 100%;
  }
  .place {
    font: 700 1rem/1.1 var(--hand);
  }
  .meta {
    min-height: 14px;
    display: flex;
    justify-content: center;
  }
  .dots {
    display: flex;
    gap: 5px;
  }
  .dots i {
    width: 15px;
    height: 10px;
    border: 1.5px solid var(--ink);
    border-radius: 1px;
    background: var(--paper);
  }
  .dots i.got {
    background: var(--amber);
  }
  .not {
    font: 600 0.7rem/1.2 var(--label);
    color: var(--ink-soft);
  }
  .shut .pic {
    filter: grayscale(1) contrast(0.8);
    opacity: 0.6;
  }
  .lock {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--ink);
  }
  .stamp {
    position: absolute;
    right: -6px;
    top: 38%;
    padding: 3px 7px;
    border: 2.5px solid var(--clay);
    border-radius: 4px;
    color: var(--clay);
    font: 800 0.72rem/1 var(--label);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transform: rotate(-16deg);
    background: rgba(251, 246, 236, 0.75);
    mix-blend-mode: multiply;
  }
  .flag {
    position: absolute;
    left: 50%;
    top: -2px;
    transform: translate(-50%, -100%);
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--amber);
    color: var(--ink);
    font: 800 0.7rem/1 var(--label);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    animation: bob 1.6s ease-in-out infinite;
  }
  @keyframes bob {
    50% {
      transform: translate(-50%, calc(-100% - 4px));
    }
  }
  .detail {
    margin-top: 14px;
    display: flex;
    gap: 18px;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-radius: 12px;
    background: var(--paper-light);
    border: 2px solid var(--line-strong);
  }
  .kicker {
    margin: 0;
    font: 700 0.72rem/1 var(--label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #5c7393;
  }
  .detail.mars .kicker {
    color: var(--clay);
  }
  h3 {
    margin: 4px 0 6px;
    font: 700 1.6rem/1.05 var(--serif);
  }
  .for {
    margin: 2px 0;
    font: 500 0.95rem/1.35 var(--read);
  }
  .scale {
    margin: 6px 0 0;
    font: 600 0.72rem/1 var(--label);
    color: var(--ink-soft);
  }
  .go {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 26px;
    border-radius: 999px;
    border: 2.5px solid var(--ink);
    background: var(--amber);
    color: var(--ink);
    font: 800 1.15rem/1 var(--label);
    box-shadow: 0 5px 0 var(--ink);
    cursor: pointer;
    transition: transform 0.15s var(--ease-spring);
  }
  .go:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.04);
  }
  .go:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: 0 2px 0 var(--ink);
  }
  .go:disabled {
    background: var(--card-sunk);
    color: var(--ink-soft);
    cursor: default;
    font-size: 0.95rem;
  }
  @media (prefers-reduced-motion: reduce) {
    .flag {
      animation: none;
    }
    .card,
    .go {
      transition: none;
    }
  }
</style>
