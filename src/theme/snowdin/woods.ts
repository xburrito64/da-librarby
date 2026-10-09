// Life in Snowdin's woods. The town under the spotlight and the forest on show pages are drawn live
// on a canvas (in place of the flat pictures), so their trees can do things: pointing at one shakes
// the snow off its branches (it builds up again over a minute or so), now and then a clump drops
// off a branch by itself, and once in a while a pair of eyes blinks in the dark between the trees,
// gone as soon as you come looking. The pictures themselves are in scenes.ts.
import { liveScenes, onScenes } from "./art";
import type { Scene, SnowBit } from "./scenes";

/** How long a shaken tree sways (ms), and how long its snow takes to build up again, per step. */
const SWAY_MS = 700;
const REGROW_MS = 25_000;
/** Falling snow speeds up by this much (art pixels per second, every second). */
const GRAVITY = 120;
/** At most this many bits of snow fall off a shaken tree. */
const MAX_BITS = 40;
/** A clump drops off a branch by itself every so often (ms). */
const DROP_EVERY = [5_000, 14_000];
/** Eyes in the dark: how often they might show up, how likely they do then, for how long (ms),
 *  and when they blink. */
const EYES_EVERY = [45_000, 150_000];
const EYES_CHANCE = 0.5;
const EYES_MS = 5200;
const BLINKS = [
  [1500, 1650],
  [3300, 3450],
];
/** They're gone when the pointer comes this close (art pixels). */
const EYES_SHY = 28;
const EYE = "#f3f7ff";

/** Where each scene is shown. */
const HOSTS = { town: ".hero__decor--bottom", forest: ".tp__decor--bottom" } as const;
type Kind = keyof typeof HOSTS;

/** Pointing at these (or at a box in front of the trees) doesn't shake a tree. */
const CONTROLS = "button, a, input, select, textarea, [role='button'], .card, .tp__cover, .tp__desc-box, .hero__desc-box";

interface Bit extends SnowBit {
  vx: number;
  vy: number;
  floor: number;
  tree: number;
}

interface Eyes {
  tree: number;
  x: number;
  y: number;
  until: number;
  from: number;
}

interface Woods {
  host: HTMLElement;
  kind: Kind;
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  scene: Scene;
  /** Per tree: how it looks (an index into SNOW_LOOKS), when it was last shaken, and when its
   *  snow builds up a step again. */
  look: number[];
  shook: number[];
  regrow: number[];
  /** Which tree is at each pixel (-1: something in front of the trees, -2: nothing). */
  owner: Int16Array;
  bits: Bit[];
  eyes: Eyes | null;
  /** The tree the pointer is on. */
  pointed: number;
}

const between = ([a, b]: number[]) => a + Math.random() * (b - a);

function fit(w: Woods, scene: Scene) {
  w.scene = scene;
  w.canvas.width = scene.w;
  w.canvas.height = scene.h;
  const n = scene.trees.length;
  w.look = new Array(n).fill(2);
  w.shook = new Array(n).fill(-Infinity);
  w.regrow = new Array(n).fill(0);
  w.bits = [];
  w.eyes = null;
  w.owner = new Int16Array(scene.w * scene.h).fill(-2);
  let tree = 0;
  for (const layer of scene.layers) {
    if (layer instanceof HTMLCanvasElement) {
      const alpha = layer.getContext("2d")!.getImageData(0, 0, scene.w, scene.h).data;
      for (let i = 0; i < w.owner.length; i++) if (alpha[i * 4 + 3] > 128) w.owner[i] = -1;
    } else {
      for (let y = 0; y < layer.h; y++)
        for (let x = 0; x < layer.w; x++) {
          const sx = layer.x + x;
          const sy = layer.y + y;
          if (layer.shape[y * layer.w + x] && sx >= 0 && sx < scene.w && sy >= 0 && sy < scene.h) w.owner[sy * scene.w + sx] = tree;
        }
      tree++;
    }
  }
}

function sway(w: Woods, i: number, now: number) {
  const age = now - w.shook[i];
  if (age >= SWAY_MS) return 0;
  return Math.round(Math.sin((age / 1000) * Math.PI * 2 * 5) * 1.6 * (1 - age / SWAY_MS));
}

/** Draws the scene's layers in order, each tree as it looks and sways now. */
function draw(w: Woods, now: number) {
  const { g, scene } = w;
  g.clearRect(0, 0, scene.w, scene.h);
  let i = 0;
  for (const layer of scene.layers) {
    if (layer instanceof HTMLCanvasElement) {
      g.drawImage(layer, 0, 0);
      continue;
    }
    const shift = sway(w, i, now);
    g.drawImage(layer.looks[w.look[i]], layer.x + shift, layer.y);
    // What's just in front of this tree: its falling snow, and eyes in its dark.
    for (const b of w.bits) {
      if (b.tree !== i) continue;
      g.fillStyle = b.c;
      g.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
    }
    const e = w.eyes;
    if (e && e.tree === i && now < e.until && !BLINKS.some(([a, b]) => now - e.from >= a && now - e.from < b)) {
      g.fillStyle = EYE;
      g.fillRect(e.x + shift, e.y, 1, 1);
      g.fillRect(e.x + 2 + shift, e.y, 1, 1);
    }
    i++;
  }
}

function busy(w: Woods, now: number) {
  return w.bits.length > 0 || w.shook.some((t) => now - t < SWAY_MS) || (w.eyes != null && now < w.eyes.until + 100);
}

/** Lets a few of `from` (bits of a tree's snow) fall. */
function spill(w: Woods, tree: number, from: SnowBit[], count: number) {
  const t = w.scene.trees[tree];
  for (let k = 0; k < count && from.length > 0; k++) {
    const b = from[Math.floor(Math.random() * from.length)];
    w.bits.push({
      ...b,
      vx: (Math.random() - 0.5) * 10,
      vy: -Math.random() * 8,
      floor: t.y + t.h - 1 - Math.random() * 2,
      tree,
    });
  }
}

/** Visible on screen (not scrolled away, not hidden). */
function onScreen(w: Woods) {
  const r = w.canvas.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
}

export function startWoods() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const all = new Map<HTMLElement, Woods>();
  let frame = 0;
  let last = 0;

  const tick = (now: number) => {
    frame = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let again = false;
    for (const w of all.values()) {
      for (const b of w.bits) {
        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      w.bits = w.bits.filter((b) => b.y < b.floor);
      draw(w, now);
      if (busy(w, now)) again = true;
    }
    if (again) frame = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const shake = (w: Woods, i: number, now: number) => {
    if (now - w.shook[i] < SWAY_MS) return;
    w.shook[i] = now;
    const snow = w.scene.trees[i].snow[w.look[i]];
    if (snow.length > 0) {
      spill(w, i, snow, Math.min(MAX_BITS, Math.ceil(snow.length * 0.6)));
      w.look[i] = 0;
      w.regrow[i] = now + REGROW_MS;
    }
    if (w.eyes?.tree === i) w.eyes.until = now;
    kick();
  };

  // Finding where the scenes are shown, as pages come and go.
  const attach = () => {
    const scenes = liveScenes();
    for (const [host, w] of all)
      if (!host.isConnected) {
        all.delete(host);
        w.canvas.remove();
      }
    if (!scenes) return;
    (Object.keys(HOSTS) as Kind[]).forEach((kind) => {
      document.querySelectorAll<HTMLElement>(HOSTS[kind]).forEach((host) => {
        if (all.has(host)) return;
        const canvas = document.createElement("canvas");
        canvas.className = "sd-woods";
        canvas.setAttribute("aria-hidden", "true");
        const w = { host, kind, canvas, g: canvas.getContext("2d")!, pointed: -2 } as Woods;
        fit(w, scenes[kind]);
        host.prepend(canvas);
        host.classList.add("sd-live");
        all.set(host, w);
        kick();
      });
    });
  };
  let queued = 0;
  const changes = new MutationObserver(() => {
    queued ||= requestAnimationFrame(() => {
      queued = 0;
      attach();
    });
  });
  changes.observe(document.body, { childList: true, subtree: true });
  const stopScenes = onScenes(() => {
    const scenes = liveScenes();
    if (!scenes) return;
    for (const w of all.values()) fit(w, scenes[w.kind]);
    kick();
  });
  attach();

  const onMove = (e: PointerEvent) => {
    const now = performance.now();
    const control = e.target instanceof Element && e.target.closest(CONTROLS) != null;
    for (const w of all.values()) {
      const r = w.canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * w.scene.w);
      const y = Math.floor(((e.clientY - r.top) / r.height) * w.scene.h);
      const inside = r.width > 0 && x >= 0 && y >= 0 && x < w.scene.w && y < w.scene.h;
      // Whatever is watching from the trees doesn't like being looked at.
      if (inside && w.eyes && now < w.eyes.until && Math.hypot(x - w.eyes.x, y - w.eyes.y) < EYES_SHY) {
        w.eyes.until = now;
        kick();
      }
      const over = inside && !control ? w.owner[y * w.scene.w + x] : -2;
      if (over === w.pointed) continue;
      w.pointed = over;
      if (over >= 0) shake(w, over, now);
    }
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  // Snow building up again on shaken trees.
  const regrowing = window.setInterval(() => {
    const now = performance.now();
    for (const w of all.values()) {
      let changed = false;
      w.look.forEach((look, i) => {
        if (look < 2 && now >= w.regrow[i]) {
          w.look[i] = look + 1;
          w.regrow[i] = now + REGROW_MS;
          changed = true;
        }
      });
      if (changed) kick();
    }
  }, 1000);

  const shown = () => [...all.values()].filter(onScreen);

  // Now and then a clump drops off a branch by itself (off one of the bigger trees, to be seen).
  let dropTimer = 0;
  const drop = () => {
    dropTimer = window.setTimeout(drop, between(DROP_EVERY));
    const w = shown()[0];
    if (!w || w.scene.trees.length === 0 || document.hidden) return;
    let pick = -1;
    for (let k = 0; k < 4; k++) {
      const i = Math.floor(Math.random() * w.scene.trees.length);
      if (w.look[i] === 2 && (pick < 0 || w.scene.trees[i].h > w.scene.trees[pick].h)) pick = i;
    }
    if (pick < 0) return;
    const snow = w.scene.trees[pick].snow[2].filter((b) => w.owner[b.y * w.scene.w + b.x] === pick);
    if (snow.length === 0) return;
    const at = snow[Math.floor(Math.random() * snow.length)];
    const clump = snow.filter((b) => Math.abs(b.y - at.y) <= 1 && Math.abs(b.x - at.x) <= 2);
    spill(w, pick, clump, 2 + Math.floor(Math.random() * 3));
    kick();
  };
  dropTimer = window.setTimeout(drop, between(DROP_EVERY));

  // Once in a while, eyes in the dark under the trees (away from the text on the left).
  let eyesTimer = 0;
  const peek = () => {
    eyesTimer = window.setTimeout(peek, between(EYES_EVERY));
    const w = shown()[0];
    if (!w || Math.random() >= EYES_CHANCE || document.hidden) return;
    const { trees, w: width } = w.scene;
    for (let tries = 0; tries < 30; tries++) {
      const i = Math.floor(Math.random() * trees.length);
      const t = trees[i];
      if (t.x < width * 0.4) continue;
      const x = t.x + Math.floor(t.w / 2) - 1;
      const y = t.y + Math.round(t.h * 0.72);
      const dark = [x, x + 2].every((ex) => w.owner[y * width + ex] === i && !t.snow[2].some((b) => b.x === ex && b.y === y));
      if (!dark) continue;
      const now = performance.now();
      w.eyes = { tree: i, x, y, from: now, until: now + EYES_MS };
      kick();
      return;
    }
  };
  eyesTimer = window.setTimeout(peek, between(EYES_EVERY));

  return () => {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(queued);
    changes.disconnect();
    stopScenes();
    window.removeEventListener("pointermove", onMove);
    window.clearInterval(regrowing);
    window.clearTimeout(dropTimer);
    window.clearTimeout(eyesTimer);
    for (const [host, w] of all) {
      w.canvas.remove();
      host.classList.remove("sd-live");
    }
    all.clear();
  };
}
