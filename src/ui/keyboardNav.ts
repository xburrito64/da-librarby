// Browsing the library with the arrow keys: they move to the nearest cover, button, tab or episode
// in that direction (by where things are on screen), and Enter opens or plays it. The theme shows
// where you are like a mouse hover (a heart in Snowdin, an outline elsewhere).
import { playSound } from "../theme/sound";

/** Everything the arrow keys can move between. */
const TARGETS = [
  ".nav__tab",
  ".hero__actions .btn",
  ".ccard__main",
  ".card",
  ".row__more",
  ".grid-page__head .btn",
  ".filter",
  ".tp__back",
  ".tp__actions .btn",
  ".seasons__tab",
  ".ep",
  ".section-title--toggle",
  ".extra",
  ".stats__show",
].join(",");

type Dir = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** The last thing moved to, to carry on from after it was briefly gone (a show page closed). */
let last: HTMLElement | null = null;

/** Whether the keyboard (rather than the mouse) was used last. */
let keyboard = false;
document.addEventListener("keydown", () => (keyboard = true), true);
document.addEventListener("pointerdown", () => (keyboard = false), true);

export function usingKeyboard() {
  return keyboard;
}

/** Chooses `el` without moving anything or making a sound (e.g. after a page opened). */
export function choose(el: HTMLElement | null | undefined) {
  if (!el) return;
  last = el;
  el.focus({ preventScroll: true });
}

function candidates(): HTMLElement[] {
  // The show page covers the rest; otherwise the browse screen. The navigation is always there.
  const page = document.querySelector(".tp") ?? document.querySelector(".browse");
  const els = [...document.querySelectorAll<HTMLElement>(".nav__tab"), ...(page?.querySelectorAll<HTMLElement>(TARGETS) ?? [])];
  return [...new Set(els)].filter((el) => {
    if ((el as HTMLButtonElement).disabled || el.closest(".is-covered")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/** How far `b` is from `a` going `dir` (lower is better), or null if it isn't that way at all. */
function distance(a: DOMRect, b: DOMRect, dir: Dir): number | null {
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  // How far apart they are sideways (0 when they overlap).
  const gapX = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
  const gapY = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
  switch (dir) {
    case "ArrowRight":
      return bx > ax + 4 ? Math.max(0, b.left - a.right) + gapY * 4 + Math.abs(by - ay) * 0.1 : null;
    case "ArrowLeft":
      return bx < ax - 4 ? Math.max(0, a.left - b.right) + gapY * 4 + Math.abs(by - ay) * 0.1 : null;
    case "ArrowDown":
      return by > ay + 4 ? Math.max(0, b.top - a.bottom) + gapX * 2 + Math.abs(bx - ax) * 0.1 : null;
    case "ArrowUp":
      return by < ay - 4 ? Math.max(0, a.top - b.bottom) + gapX * 2 + Math.abs(bx - ax) * 0.1 : null;
  }
}

function moveTo(el: HTMLElement) {
  last = el;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  playSound("move");
}

/** Call with an arrow key's event while the library is showing; true if it moved somewhere. */
export function arrowMove(e: KeyboardEvent): boolean {
  const dir = e.key as Dir;
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(dir)) return false;
  const all = candidates();
  if (all.length === 0) return false;
  const focused = document.activeElement as HTMLElement | null;
  const from = focused && all.includes(focused) ? focused : last && all.includes(last) ? last : null;

  if (!from) {
    // Nothing chosen yet: a show page starts at its Play button...
    const main = document.querySelector<HTMLElement>(".tp .tp__actions .btn");
    if (main && all.includes(main)) {
      moveTo(main);
      return true;
    }
    // ...anything else at the first thing on screen below the navigation.
    const navBottom = document.querySelector(".nav")?.getBoundingClientRect().bottom ?? 0;
    const onScreen = all
      .filter((el) => !el.closest(".nav"))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.top >= navBottom - 4 && r.bottom <= window.innerHeight)
      .sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
    const first = onScreen[0]?.el ?? all.find((el) => !el.closest(".nav"));
    if (first) moveTo(first);
    return first != null;
  }

  const here = from.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of all) {
    if (el === from) continue;
    const score = distance(here, el.getBoundingClientRect(), dir);
    if (score != null && score < bestScore) {
      best = el;
      bestScore = score;
    }
  }
  if (best) moveTo(best);
  return best != null;
}
