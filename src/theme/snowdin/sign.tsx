// The town sign in the navigation hangs from two ropes like a pendulum: pointing at it is a
// breeze that sets it rocking gently, and a click pushes it away from where you clicked. Swinging
// knocks clumps of snow off its top, which builds up again over a few minutes. Now and then the
// dog is asleep on top of it: then clicks only nudge the sign, and a few of them wake the dog,
// which trots off. See snowdin.css ("The town sign").
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { SoundName } from "../sound";
import { BASE, PX, drawCap, makeCap, type Cap } from "./snowcap";

/** The dog is asleep on the sign at about one start in five... */
const START_CHANCE = 0.2;
/** ...and sometimes when you come back after a while away. */
const RETURN_CHANCE = 0.34;
const AWAY_MS = 10 * 60 * 1000;
/** Clicks it takes to wake the dog. */
const NUDGES_TO_WAKE = 3;
/** How long getting up and trotting off takes (as in snowdin.css). */
const LEAVING_MS = 1700;

// The pendulum, in degrees and seconds: it swings back and forth about every 1.7 seconds and
// slowly comes to rest.
const STIFFNESS = ((2 * Math.PI) / 1.7) ** 2;
const DAMPING = 0.9;
/** Pointing at it: a breeze in time with its swing, rocking it about a degree each way. */
const BREEZE = 1.1 * DAMPING * Math.sqrt(STIFFNESS);
/** A click's push (so it swings out about 6 degrees), and the gentle one with the dog on it. */
const PUSH = 24;
const NUDGE = 5;
/** Each swing knocks off this much of the snow (all of it is 1): five swings clear it... */
const SNOW_PER_SWING = 0.2;
/** ...which takes this long to build up again from nothing. */
const SNOW_REGROW_S = 180;

const NUDGE_LINES = [
  "* The dog is sleeping on the sign. You decide not to swing it.",
  "* The dog is still asleep. It's dreaming about bones, probably.",
];
const WAKE_LINE = "* The dog wakes up, stretches, and trots off. The sign feels lighter.";

type Dog = "away" | "asleep" | "leaving";

/** A clump of snow falling off the sign (screen position, sideways throw, drop, size). */
interface Clump {
  id: number;
  x: number;
  y: number;
  dx: number;
  fall: number;
  size: number;
  ms: number;
}

let dog: Dog = "away";
let nudges = 0;
let clumps: Clump[] = [];
let nextClump = 0;
const listeners = new Set<() => void>();

function changed() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function maybeArrive(chance: number) {
  if (dog !== "away" || Math.random() >= chance) return;
  dog = "asleep";
  nudges = 0;
  changed();
}

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const signEl = () => document.querySelector<HTMLElement>(".nav__brand");

// ----- The pendulum

let angle = 0;

/** How far the sign is tilted right now (degrees), for the string of lights tied to it. */
export function signAngle() {
  return angle;
}
let speed = 0;
let hovered = false;
let breezeTime = 0;
let frame = 0;
let last = 0;
/** Which side the last press on the sign was on (-1 left, 1 right). */
let pressSide = 1;

function step(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let force = -STIFFNESS * angle - DAMPING * speed;
  if (hovered) {
    breezeTime += dt;
    force += BREEZE * Math.sin(Math.sqrt(STIFFNESS) * breezeTime);
  }
  speed += force * dt;
  angle += speed * dt;
  const sign = signEl();
  if (!hovered && Math.abs(angle) < 0.02 && Math.abs(speed) < 0.05) {
    // At rest again.
    angle = speed = 0;
    if (sign) sign.style.transform = "";
    frame = 0;
    return;
  }
  if (sign) sign.style.transform = `rotate(${angle.toFixed(3)}deg)`;
  frame = requestAnimationFrame(step);
}

function wake() {
  if (frame || still()) return;
  last = performance.now();
  frame = requestAnimationFrame(step);
}

/** Pushes the sign's bottom towards `side` (-1 left, 1 right). Turning it clockwise (a positive
 *  angle) about its hook above moves the bottom to the left, hence the minus. */
function push(side: number, amount: number) {
  speed -= side * amount;
  wake();
}

// ----- The snow on top: columns of pixel snow (2 screen pixels each) along the board, drawn on
// a small canvas that snowdin.css shows over the board's top edge (--sd-sign-cap). Swings knock
// lumps out of it, mostly at the end it swings towards, and it builds up again here and there.

/** The cap reaches this far past each end of the board (px, as in snowdin.css). */
const OVERHANG = 3;

/** Its shape with all the snow there (see snowcap.ts), and how high each column is now. */
let cap: Cap = makeCap(0);
let heights: number[] = [];
/** Snow growing back that hasn't made a whole pixel yet. */
let growing = 0;
let snowTimer = 0;

const total = (list: number[]) => list.reduce((a, b) => a + b, 0);

function drawSnow() {
  const sign = signEl();
  if (sign && heights.length > 0) sign.style.setProperty("--sd-sign-cap", `url(${drawCap(cap, heights)})`);
}

/** Sets the cap up for the board's width (all snow there at first). */
function fitCap() {
  const sign = signEl();
  if (!sign) return;
  const columns = Math.round((sign.offsetWidth + 2 * OVERHANG) / PX);
  if (columns === cap.full.length) return;
  const share = cap.full.length > 0 ? total(heights) / total(cap.full) : 1;
  cap = makeCap(columns);
  heights = cap.full.map((f) => Math.round(f * share));
  drawSnow();
}

function regrow() {
  if (snowTimer) return;
  snowTimer = window.setInterval(() => {
    growing += (total(cap.full) * 0.5) / SNOW_REGROW_S;
    while (growing >= 1) {
      growing -= 1;
      const short = heights.map((h, x) => (h < cap.full[x] ? x : -1)).filter((x) => x >= 0);
      if (short.length === 0) break;
      let x = short[Math.floor(Math.random() * short.length)];
      // A flake rolls down into the dip beside it before it settles, so the snow fills in
      // softly instead of growing in spikes.
      for (let step = 0; step < 6; step++) {
        const lower = [x - 1, x + 1].filter((n) => n >= 0 && n < heights.length && heights[n] < heights[x] && heights[n] < cap.full[n]);
        if (lower.length === 0) break;
        x = lower.reduce((a, b) => (heights[b] < heights[a] || (heights[b] === heights[a] && Math.random() < 0.5) ? b : a));
      }
      heights[x] += 1;
    }
    drawSnow();
    if (heights.every((h, x) => h >= cap.full[x])) {
      window.clearInterval(snowTimer);
      snowTimer = 0;
      growing = 0;
    }
  }, 500);
}

/** What's left settles: thin pillars slump into slopes and lone crumbs fall off. */
function settle() {
  for (let pass = 0; pass < 2; pass++) {
    heights = heights.map((h, x) => {
      const l = heights[x - 1] ?? 0;
      const r = heights[x + 1] ?? 0;
      if (l === 0 && r === 0) return 0;
      return Math.min(h, Math.round((l + r) / 2) + 1);
    });
  }
}

/** Knocks lumps of snow off, mostly at the end the sign swings towards (`side`: -1 left, 1 right). */
function shakeSnow(side: number) {
  const sign = signEl();
  const all = total(cap.full);
  if (!sign || total(heights) === 0) return;
  let left = Math.round(all * SNOW_PER_SWING);
  const hit: { x: number; top: number }[] = [];
  for (let tries = 0; left > 0 && tries < 60; tries++) {
    // A lump: somewhere along the board, more likely towards the end it swings to.
    const r = Math.random();
    const along = side > 0 ? 1 - r * r : r * r;
    const centre = Math.floor(along * heights.length);
    const reach = 2 + Math.floor(Math.random() * 4);
    const depth = 1 + Math.floor(Math.random() * 3);
    for (let dx = -reach; dx <= reach && left > 0; dx++) {
      const x = centre + dx;
      if (x < 0 || x >= heights.length || heights[x] <= 0) continue;
      const take = Math.min(heights[x], Math.max(1, Math.round(depth * (1 - Math.abs(dx) / (reach + 1)))));
      hit.push({ x, top: BASE - heights[x] });
      heights[x] -= take;
      left -= take;
    }
  }
  settle();
  // The last few crumbs go with the last swing.
  if (total(heights) < all * 0.06) {
    heights.forEach((h, x) => h > 0 && hit.push({ x, top: BASE - h }));
    heights = heights.map(() => 0);
  }
  drawSnow();
  regrow();
  if (still() || hit.length === 0) return;
  const r = sign.getBoundingClientRect();
  const fresh: Clump[] = [];
  const count = Math.min(14, Math.max(3, Math.round(hit.length / 2)));
  for (let i = 0; i < count; i++) {
    const h = hit[Math.floor(Math.random() * hit.length)];
    fresh.push({
      id: nextClump++,
      // From where the snow was, flung off towards the end it swings to.
      x: r.left - OVERHANG + h.x * PX - 2,
      y: r.top - 12 + h.top * PX,
      dx: side * (40 + Math.random() * 80),
      fall: 80 + Math.random() * 80,
      size: [3, 3, 6, 6, 9][Math.floor(Math.random() * 5)],
      ms: 850 + Math.random() * 450,
    });
  }
  clumps = [...clumps, ...fresh];
  changed();
  window.setTimeout(() => {
    clumps = clumps.filter((c) => !fresh.includes(c));
    changed();
  }, 1400);
}

/** The theme's answer to a click on the sign: something to say, or null for the usual lines. */
export function signClick({ sound }: { sound: (name: SoundName) => void }): string | null {
  // Pushed away from where it was clicked: its bottom swings towards `side`.
  const side = -pressSide;
  if (dog === "asleep") {
    nudges += 1;
    push(side, NUDGE);
    if (nudges < NUDGES_TO_WAKE) {
      sound("move");
      return NUDGE_LINES[(nudges - 1) % NUDGE_LINES.length];
    }
    dog = "leaving";
    changed();
    sound("select");
    window.setTimeout(() => {
      dog = "away";
      changed();
    }, LEAVING_MS);
    return WAKE_LINE;
  }
  if (dog === "leaving") return null;
  push(side, PUSH);
  shakeSnow(side);
  sound("select");
  return null;
}

/** The dog (when it's there) on the sign's `.nav__decor` spot, and falling clumps of snow. */
export function SignExtras() {
  const state = useSyncExternalStore(subscribe, () => dog);
  const falling = useSyncExternalStore(subscribe, () => clumps);
  const [spot, setSpot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSpot(document.querySelector<HTMLElement>(".nav__decor"));
    maybeArrive(START_CHANCE);
    fitCap();

    const sign = signEl();
    // The board's width changes once its font has loaded.
    const resized = new ResizeObserver(fitCap);
    if (sign) resized.observe(sign);
    const enter = () => {
      hovered = true;
      wake();
    };
    const leave = () => (hovered = false);
    const press = (e: PointerEvent) => {
      const r = sign!.getBoundingClientRect();
      pressSide = e.clientX < r.left + r.width / 2 ? -1 : 1;
    };
    sign?.addEventListener("pointerenter", enter);
    sign?.addEventListener("pointerleave", leave);
    sign?.addEventListener("pointerdown", press);

    // Back after a good while away: the dog may have climbed up for a nap.
    let leftAt = 0;
    const onBlur = () => (leftAt = Date.now());
    const onFocus = () => {
      if (leftAt && Date.now() - leftAt >= AWAY_MS) maybeArrive(RETURN_CHANCE);
      leftAt = 0;
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      resized.disconnect();
      sign?.removeEventListener("pointerenter", enter);
      sign?.removeEventListener("pointerleave", leave);
      sign?.removeEventListener("pointerdown", press);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      hovered = false;
    };
  }, []);

  return (
    <>
      {spot &&
        state !== "away" &&
        createPortal(
          <span className={`sd-sign__dog ${state === "leaving" ? "is-leaving" : ""}`}>
            {state === "asleep" && (
              <span className="sd-sign__z">
                <i>z</i>
                <i>z</i>
                <i>Z</i>
              </span>
            )}
          </span>,
          spot,
        )}
      {falling.length > 0 &&
        createPortal(
          <span className="sd-clumps" aria-hidden="true">
            {falling.map((c) => (
              <span
                key={c.id}
                className="sd-clump"
                style={
                  {
                    left: c.x,
                    top: c.y,
                    "--dx": `${c.dx}px`,
                    "--fall": `${c.fall}px`,
                    "--size": `${c.size}px`,
                    "--ms": `${c.ms}ms`,
                  } as React.CSSProperties
                }
              >
                <i />
              </span>
            ))}
          </span>,
          document.body,
        )}
    </>
  );
}
