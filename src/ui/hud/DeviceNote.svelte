<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "../settings.svelte";

  /**
   * A small paper note that fades in once per visit and fades out by itself:
   * the game is made for a laptop or desktop computer with a mouse. On a phone
   * or tablet it says so plainly and stays until it is tapped away.
   */
  const KEY = "poh-device-note";
  let show = $state(false);
  let touch = $state(false);

  onMount(() => {
    const q = new URLSearchParams(location.search);
    if (q.has("test") || q.has("shot")) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Storage can be blocked; then the note just shows each visit.
    }
    touch = matchMedia("(pointer: coarse)").matches || Math.min(innerWidth, innerHeight) < 600;
    const timers = [window.setTimeout(() => (show = true), 1400)];
    if (!touch) timers.push(window.setTimeout(() => (show = false), 1400 + 5200));
    return () => timers.forEach((id) => window.clearTimeout(id));
  });
</script>

{#if show}
  <div class="note" class:touch role="status">
    <svg class="mouse" viewBox="0 0 24 32" aria-hidden="true">
      <rect x="3" y="2" width="18" height="28" rx="9" />
      <path d="M12 2 V12 M3 12 H21" />
      <rect class="wheel" x="10.6" y="6" width="2.8" height="4.4" rx="1.4" />
    </svg>
    <p>{touch ? t("device.phone") : t("device.best")}</p>
    {#if touch}<button type="button" onclick={() => (show = false)}>{t("device.ok")}</button>{/if}
  </div>
{/if}

<style>
  .note {
    position: fixed;
    left: 50%;
    top: 18px;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: min(560px, calc(100vw - 32px));
    padding: 10px 16px 10px 12px;
    border-radius: 14px;
    background: var(--paper-light);
    border: 2px solid var(--ink);
    box-shadow: 0 4px 0 var(--ink), 0 12px 24px rgba(0, 0, 0, 0.25);
    color: var(--ink);
    transform: translateX(-50%) rotate(-0.6deg);
    animation:
      fade-in 0.5s var(--ease-out) both,
      fade-out 0.6s ease-in 4.6s forwards;
    pointer-events: none;
  }
  .note.touch {
    animation: fade-in 0.5s var(--ease-out) both;
    pointer-events: auto;
  }
  .mouse {
    flex: none;
    width: 22px;
    height: 30px;
    fill: var(--paper);
    stroke: var(--ink);
    stroke-width: 2;
  }
  .wheel {
    fill: var(--amber);
    stroke-width: 1.4;
  }
  p {
    margin: 0;
    font: 600 0.98rem/1.3 var(--read);
  }
  button {
    flex: none;
    padding: 7px 14px;
    border-radius: 999px;
    border: 2px solid var(--ink);
    background: var(--amber);
    font: 800 0.9rem/1 var(--label);
    color: var(--ink);
    cursor: pointer;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translate(-50%, -12px) rotate(-0.6deg);
    }
  }
  @keyframes fade-out {
    to {
      opacity: 0;
      transform: translate(-50%, -8px) rotate(-0.6deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .note {
      animation-duration: 0.01s;
    }
  }
</style>
