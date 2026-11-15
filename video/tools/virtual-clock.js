/*
 * Virtual clock for frame-exact capture. The capture script injects this into
 * the page (Playwright addInitScript); the game itself never loads it, so
 * normal play is untouched.
 *
 * Until `__vclock.hold()` is called, time runs as usual (the game loads in
 * real time). After it, time only moves when the capture script calls
 * `__vclock.step(ms)`: timers due in that window fire in order, then every
 * queued animation frame runs once with the new time, then every CSS and Web
 * Animations animation is set to the matching moment. Each step is one frame,
 * so a slow screenshot never makes motion jump.
 *
 * It also stands in a virtual gamepad (`__vclock.pad`) so the capture script
 * can steer the player smoothly through the game's own gamepad input.
 */
// tsx keeps function names with a __name helper inside evaluated callbacks; give the page one.
globalThis.__name = globalThis.__name || ((f) => f);

(() => {
  const realNow = performance.now.bind(performance);
  const realDateNow = Date.now.bind(Date);
  const realRaf = window.requestAnimationFrame.bind(window);
  const realSetTimeout = window.setTimeout.bind(window);
  const realClearTimeout = window.clearTimeout.bind(window);
  const realSetInterval = window.setInterval.bind(window);
  const realClearInterval = window.clearInterval.bind(window);
  const dateBase = realDateNow() - realNow();

  let held = false;
  let vt = 0;
  const now = () => (held ? vt : realNow());
  performance.now = now;
  Date.now = () => Math.round(dateBase + now());

  // ---- animation frames ----
  let nextId = 1;
  let queue = new Map();
  let pumping = false;
  const pump = () => {
    if (held) {
      pumping = false;
      return;
    }
    const run = queue;
    queue = new Map();
    const t = realNow();
    for (const cb of run.values()) {
      try {
        cb(t);
      } catch (e) {
        console.error(e);
      }
    }
    if (queue.size) realRaf(pump);
    else pumping = false;
  };
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    queue.set(id, cb);
    if (!held && !pumping) {
      pumping = true;
      realRaf(pump);
    }
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    queue.delete(id);
  };

  // ---- timers ----
  // Real timers while time runs; virtual ones once it is held.
  const timers = new Map();
  let timerSeq = 1;
  const virtualIds = new Set();
  window.setTimeout = (fn, ms = 0, ...args) => {
    if (!held) return realSetTimeout(fn, ms, ...args);
    const id = 1e9 + timerSeq++;
    timers.set(id, { due: vt + Math.max(0, ms), fn, args, every: 0, seq: timerSeq });
    virtualIds.add(id);
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    if (!held) return realSetInterval(fn, ms, ...args);
    const id = 1e9 + timerSeq++;
    const every = Math.max(4, ms);
    timers.set(id, { due: vt + every, fn, args, every, seq: timerSeq });
    virtualIds.add(id);
    return id;
  };
  window.clearTimeout = (id) => {
    if (virtualIds.has(id)) timers.delete(id);
    else realClearTimeout(id);
  };
  window.clearInterval = (id) => {
    if (virtualIds.has(id)) timers.delete(id);
    else realClearInterval(id);
  };

  // ---- CSS and Web Animations ----
  const seen = new WeakMap();
  const syncAnimations = () => {
    for (const a of document.getAnimations()) {
      let rec = seen.get(a);
      if (!rec) {
        rec = { base: Number(a.currentTime ?? 0), from: vt };
        seen.set(a, rec);
      }
      if (rec.done) continue;
      const rate = a.playbackRate || 1;
      const t = rec.base + (vt - rec.from) * rate;
      const timing = a.effect ? a.effect.getComputedTiming() : null;
      const end = timing ? Number(timing.endTime) : Infinity;
      if (Number.isFinite(end) && t >= end) {
        rec.done = true;
        try {
          a.finish();
        } catch {
          /* an animation that cannot finish is left as it is */
        }
        continue;
      }
      try {
        if (a.playState !== "paused") a.pause();
        a.currentTime = t;
      } catch {
        /* ignore */
      }
    }
  };

  // ---- virtual gamepad ----
  const pad = {
    id: "capture-pad",
    index: 0,
    connected: true,
    mapping: "standard",
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  };
  let padOn = false;
  const realGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
  navigator.getGamepads = () => (padOn ? [pad, null, null, null] : realGetGamepads());

  window.__vclock = {
    get held() {
      return held;
    },
    get now() {
      return now();
    },
    hold() {
      if (held) return vt;
      vt = realNow();
      held = true;
      return vt;
    },
    /** Moves time forward by `ms` and runs one frame. */
    step(ms) {
      const target = vt + ms;
      // Timers due inside the window, earliest first (new ones too).
      for (let guard = 0; guard < 10000; guard += 1) {
        let next = null;
        let nextId = 0;
        for (const [id, t] of timers) {
          if (t.due <= target && (!next || t.due < next.due || (t.due === next.due && t.seq < next.seq))) {
            next = t;
            nextId = id;
          }
        }
        if (!next) break;
        vt = Math.max(vt, next.due);
        if (next.every) next.due += next.every;
        else timers.delete(nextId);
        try {
          if (typeof next.fn === "function") next.fn(...next.args);
        } catch (e) {
          console.error(e);
        }
      }
      vt = target;
      pad.timestamp = vt;
      const run = queue;
      queue = new Map();
      for (const cb of run.values()) {
        try {
          cb(vt);
        } catch (e) {
          console.error(e);
        }
      }
      syncAnimations();
      return vt;
    },
    pad: {
      on() {
        padOn = true;
      },
      off() {
        padOn = false;
        pad.axes = [0, 0, 0, 0];
      },
      set(axes, buttons = {}) {
        pad.axes = axes.slice(0, 4);
        for (const [i, v] of Object.entries(buttons)) {
          const b = pad.buttons[Number(i)];
          b.pressed = Boolean(v);
          b.value = v ? 1 : 0;
        }
      },
    },
  };
})();
