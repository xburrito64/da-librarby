// The black cat on the cemetery gate (drawn in scene.ts), alive: it breathes and flicks the tip of
// its tail (hollow.css), and now and then flicks an ear, blinks slowly, yawns, licks a paw or
// looks up at the bats or the spider. Its eyes follow the pointer when it comes close, and a leaf
// falling past (moments.ts). Clicked, it trills and does something (squints happily at you,
// stretches up tall, or flicks its ear and tail), never the same twice running; once in a while it
// hops down instead, strolls along the fence and back, and hops up again.
import { playSound } from "../sound";
import { spiderNow } from "./spider";

/** How close the pointer has to come for its eyes to follow it (px). */
const NEAR = 240;
/** How often it does something by itself (ms). */
const LIFE_EVERY_MS = [7000, 16000];
/** What it does by itself, and how often (relatively). */
const LIFE = { ear: 3, blink: 3, look: 2, yawn: 1, lick: 1 };
/** What it does when clicked, and for how long (ms). */
const CLICKED = { happy: 1700, stretch: 1500, flick: 1100 };
/** Clicked, the chance it goes for a stroll along the fence instead. */
const WALK_CHANCE = 0.08;
/** Its stroll: how far along the fence (scene units), how fast, how long it stops at the end. */
const WALK_FAR = 64;
const WALK_SPEED = 15;
const WALK_PAUSE = 1.4;
const HOP = 0.45;

const between = ([a, b]: number[]) => a + Math.random() * (b - a);

/** What the cat watches when something passes (moments.ts tells it about a falling leaf). */
let watchLeaf: (at: [number, number] | null) => void = () => {};
/** The cat clicked (scenes.ts finds it under the pointer). */
let clicked = () => {};
export const catWatches = (at: [number, number] | null) => watchLeaf(at);
export const pokeCat = () => clicked();

export function startCat({ surprises }: { surprises: boolean }) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const cat = () => document.querySelector<SVGGElement>(".he-cat");
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  };

  // Where its eyes go: a leaf going past first, then the pointer close by, then whatever it looked
  // up at by itself.
  let leaf: [number, number] | null = null;
  let pointer: [number, number] | null = null;
  let lookingAt: [number, number] | null = null;
  const gaze = () => {
    const el = cat();
    const eyes = el?.querySelector(".he-cat__eyes");
    const look = el?.querySelector<SVGGElement>(".he-cat__look");
    const turn = el?.querySelector<SVGGElement>(".he-cat__turn");
    if (!el || !eyes || !look || !turn) return;
    const r = eyes.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const near = pointer && Math.hypot(pointer[0] - ex, pointer[1] - ey) < NEAR ? pointer : null;
    const at = leaf ?? near ?? lookingAt;
    el.classList.toggle("is-watching", at !== null && at !== lookingAt);
    if (!at) {
      look.style.transform = "";
      turn.style.transform = "";
      return;
    }
    const dx = at[0] - ex;
    const dy = at[1] - ey;
    const d = Math.hypot(dx, dy) || 1;
    look.style.transform = `translate(${((dx / d) * 0.95).toFixed(2)}px, ${((dy / d) * 0.6).toFixed(2)}px)`;
    // Its head turns a little that way too.
    turn.style.transform = `translate(${((dx / d) * 0.5).toFixed(2)}px, ${((dy / d) * 0.3).toFixed(2)}px) rotate(${((dx / d) * 6).toFixed(1)}deg)`;
  };
  watchLeaf = (at) => {
    leaf = at;
    gaze();
  };
  let moving = 0;
  const onMove = (e: PointerEvent) => {
    pointer = [e.clientX, e.clientY];
    moving ||= requestAnimationFrame(() => {
      moving = 0;
      gaze();
    });
  };
  const onLeave = () => {
    pointer = null;
    gaze();
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);

  // Busy with something (a yawn, a stroll...): nothing else starts meanwhile.
  let busy = false;
  const act = (el: Element, name: string, ms: number) => {
    busy = true;
    el.classList.add(name);
    later(() => {
      el.classList.remove(name);
      busy = false;
    }, ms);
  };

  // By itself, now and then.
  let lastLife = "";
  const life = () => {
    later(life, between(LIFE_EVERY_MS));
    const el = cat();
    if (!el || busy || document.hidden || still || !shown(el)) return;
    const can = Object.entries(LIFE).filter(([name]) => name !== lastLife && (name !== "look" || (!leaf && !pointer)));
    let roll = Math.random() * can.reduce((n, [, w]) => n + w, 0);
    const name = can.find(([, w]) => (roll -= w) <= 0)?.[0] ?? "ear";
    lastLife = name;
    if (name === "ear") act(el, "is-ear", 1100);
    else if (name === "blink") act(el, "is-slow-blink", 1900);
    else if (name === "yawn") act(el, "is-yawning", 2600);
    else if (name === "lick") act(el, "is-licking", 3200);
    else {
      // It looks up at the bats by the moon, or the spider on its thread.
      const bat = document.querySelector(".he-mb--near");
      const r = bat?.getBoundingClientRect();
      const spider: [number, number] | null = spiderNow.ready ? [spiderNow.x + Math.sin(spiderNow.angle) * spiderNow.len, spiderNow.y + Math.cos(spiderNow.angle) * spiderNow.len] : null;
      lookingAt = spider && (Math.random() < 0.5 || !r) ? spider : r ? [r.left + r.width / 2, r.top + r.height / 2] : null;
      if (!lookingAt) return;
      busy = true;
      gaze();
      later(() => {
        lookingAt = null;
        busy = false;
        gaze();
      }, 3400);
    }
  };
  later(life, between(LIFE_EVERY_MS));

  // Clicked: a trill, and something to go with it.
  let lastClicked = "";
  clicked = () => {
    const el = cat();
    if (!el || busy) return;
    void playSound("mrrp");
    if (surprises && !still && Math.random() < WALK_CHANCE) {
      stroll(el);
      return;
    }
    const names = Object.keys(CLICKED).filter((n) => n !== lastClicked) as (keyof typeof CLICKED)[];
    const name = names[Math.floor(Math.random() * names.length)];
    lastClicked = name;
    act(el, `is-${name}`, CLICKED[name]);
    // (Flicking its tail, it flicks an ear too.)
    if (name === "flick") {
      el.classList.add("is-ear");
      later(() => el.classList.remove("is-ear"), CLICKED.flick);
    }
  };

  // Its stroll: hops down onto the fence's top rail, walks along it, stops, turns round, walks
  // back and hops up again.
  let strolling = 0;
  const stroll = (el: SVGGElement) => {
    const walker = el.parentNode?.querySelector<SVGGElement>(".he-cat-walk");
    if (!walker) return;
    busy = true;
    const x0 = Number(walker.dataset.x);
    const y0 = Number(walker.dataset.y);
    const rail = Number(walker.dataset.rail);
    const down = x0 - 13;
    const far = down - WALK_FAR;
    const walkS = WALK_FAR / WALK_SPEED;
    const legs = [HOP, HOP + walkS, HOP + walkS + WALK_PAUSE, HOP + walkS * 2 + WALK_PAUSE, HOP * 2 + walkS * 2 + WALK_PAUSE];
    el.classList.add("is-away");
    walker.classList.add("is-out");
    const start = performance.now();
    const put = (x: number, y: number, facing: number) => walker.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${1.12 * facing} 1.12)`);
    const step = (now: number) => {
      if (!walker.isConnected) {
        busy = false;
        strolling = 0;
        return;
      }
      const t = (now - start) / 1000;
      const ease = (u: number) => u * u * (3 - 2 * u);
      let walking = false;
      if (t < legs[0]) {
        const u = t / HOP;
        put(x0 + (down - x0) * u, y0 + (rail - y0) * u - Math.sin(Math.PI * u) * 7, 1);
      } else if (t < legs[1]) {
        walking = true;
        put(down + (far - down) * ease((t - legs[0]) / walkS), rail, 1);
      } else if (t < legs[2]) {
        put(far, rail, t < legs[1] + WALK_PAUSE / 2 ? 1 : -1);
      } else if (t < legs[3]) {
        walking = true;
        put(far + (down - far) * ease((t - legs[2]) / walkS), rail, -1);
      } else if (t < legs[4]) {
        const u = (t - legs[3]) / HOP;
        put(down + (x0 - down) * u, rail + (y0 - rail) * u - Math.sin(Math.PI * u) * 9, -1);
      } else {
        el.classList.remove("is-away");
        walker.classList.remove("is-out", "is-walking");
        put(x0, y0, 1);
        busy = false;
        strolling = 0;
        return;
      }
      walker.classList.toggle("is-walking", walking);
      strolling = requestAnimationFrame(step);
    };
    strolling = requestAnimationFrame(step);
  };

  if (import.meta.env.DEV)
    Object.assign(window, {
      heCatStroll: () => {
        const el = cat();
        if (el && !busy) stroll(el);
      },
    });

  return () => {
    window.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    cancelAnimationFrame(moving);
    cancelAnimationFrame(strolling);
    timers.forEach((t) => window.clearTimeout(t));
    watchLeaf = () => {};
    clicked = () => {};
    const el = cat();
    el?.classList.remove("is-away", "is-watching");
    el?.parentNode?.querySelector(".he-cat-walk")?.classList.remove("is-out", "is-walking");
  };
}
