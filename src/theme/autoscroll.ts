// Scrolling with the middle mouse button, done by the app itself while the theme has its own
// pointers for it (the browser's own scrolling shows Windows' pointers, which a page can't change).
// It works as usual: click the wheel and move the mouse, and the page scrolls that way, faster the
// further away; click again (or, if the wheel was held while moving, let go) to stop. Where you
// clicked keeps a faded copy of the waiting picture, so you can see how far away you are.

/** "v", "h": waiting (for something that scrolls up and down, or only sideways); the others:
 *  scrolling that way. */
export type ScrollState = "v" | "h" | "up" | "down" | "left" | "right";

export interface ScrollLook {
  /** The pointer (a CSS cursor value) for each state. */
  cursors: Record<ScrollState, string>;
  /** The waiting pictures, left where you clicked (`pixels`: drawn with crisp square dots). */
  marks: Record<"v" | "h", { src: string; width: number; height: number; pixels?: boolean }>;
}

/** No scrolling until the pointer is this far (pixels) from where you clicked. */
const STILL = 15;
/** Clicking on these does what they do instead. */
const SKIP = 'a[href], input, textarea, select, [contenteditable=""], [contenteditable="true"], .player:not(.player--mini)';

const looks = new Map<string, ScrollLook>();

/** Gives `theme` its own pictures for scrolling with the middle button (null: the browser's own). */
export function setScrollLook(theme: string, look: ScrollLook | null) {
  if (look) looks.set(theme, look);
  else looks.delete(theme);
  let css = "";
  for (const [name, l] of looks) {
    for (const [state, cursor] of Object.entries(l.cursors)) {
      // (Over everything, whatever it has of its own.)
      const on = `:root[data-theme="${name}"][data-autoscroll="${state}"]`;
      css += `${on}, ${on} *:not(#as-none) { cursor: ${cursor} !important; }\n`;
    }
  }
  let style = document.getElementById("autoscroll");
  if (!style) {
    style = document.createElement("style");
    style.id = "autoscroll";
    document.head.append(style);
  }
  style.textContent = css;
  listen();
}

interface Run {
  look: ScrollLook;
  /** Where you clicked, and where the pointer is. */
  x: number;
  y: number;
  px: number;
  py: number;
  /** What scrolls up and down, and sideways. */
  v: Element | null;
  h: Element | null;
  /** The wheel is still held down; it was moved away while held. */
  held: boolean;
  dragged: boolean;
  /** Parts of a pixel still to scroll. */
  fx: number;
  fy: number;
  last: number;
  state: ScrollState | "";
  mark: HTMLImageElement;
  frame: number;
}

let run: Run | null = null;
/** Ends a click that stopped the scrolling, without it doing anything else. */
let swallowing = false;

/** The nearest thing around `from` that scrolls that way (the page itself last). */
function scroller(from: Element, vertical: boolean): Element | null {
  const can = (el: Element) => (vertical ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1);
  for (let el: Element | null = from; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (/auto|scroll|overlay/.test(vertical ? style.overflowY : style.overflowX) && can(el)) return el;
  }
  const page = document.scrollingElement;
  if (!page || !can(page)) return null;
  const hidden = [document.documentElement, document.body].some((el) => (vertical ? getComputedStyle(el).overflowY : getComputedStyle(el).overflowX) === "hidden");
  return hidden ? null : page;
}

/** How fast to scroll (pixels a second) with the pointer `d` pixels away that way. */
function speed(d: number) {
  const past = Math.max(0, Math.abs(d) - STILL);
  return Math.sign(d) * (past * 4 + past * past * 0.035);
}

function start(e: MouseEvent, look: ScrollLook, v: Element | null, h: Element | null) {
  const wait = v ? "v" : "h";
  const pic = look.marks[wait];
  const mark = document.createElement("img");
  mark.src = pic.src;
  mark.alt = "";
  Object.assign(mark.style, {
    position: "fixed",
    left: `${e.clientX - pic.width / 2}px`,
    top: `${e.clientY - pic.height / 2}px`,
    width: `${pic.width}px`,
    height: `${pic.height}px`,
    zIndex: "2147483647",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity .12s",
    imageRendering: pic.pixels ? "pixelated" : "auto",
  });
  document.body.append(mark);
  run = { look, x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, v, h, held: true, dragged: false, fx: 0, fy: 0, last: performance.now(), state: "", mark, frame: 0 };
  run.frame = requestAnimationFrame(step);
}

function stop() {
  if (!run) return;
  cancelAnimationFrame(run.frame);
  run.mark.remove();
  delete document.documentElement.dataset.autoscroll;
  run = null;
}

function step(now: number) {
  const r = run;
  if (!r) return;
  const seconds = Math.min(0.05, (now - r.last) / 1000);
  r.last = now;
  const dx = r.px - r.x;
  const dy = r.py - r.y;
  // Which way: up and down, unless it only scrolls sideways or the pointer went more sideways.
  const vertical = !!r.v && (!r.h || Math.abs(dy) >= Math.abs(dx));
  const away = vertical ? dy : dx;
  let state: ScrollState = r.v ? "v" : "h";
  if (Math.abs(away) > STILL) {
    state = vertical ? (dy < 0 ? "up" : "down") : dx < 0 ? "left" : "right";
    if (r.v) r.fy += speed(dy) * seconds;
    if (r.h) r.fx += speed(dx) * seconds;
    const top = Math.trunc(r.fy);
    const left = Math.trunc(r.fx);
    r.fy -= top;
    r.fx -= left;
    if (top) r.v?.scrollBy({ top });
    if (left) r.h?.scrollBy({ left });
  }
  if (state !== r.state) {
    r.state = state;
    document.documentElement.dataset.autoscroll = state;
    // (While waiting, the pointer is the picture itself.)
    r.mark.style.opacity = state === "v" || state === "h" ? "0" : ".7";
  }
  r.frame = requestAnimationFrame(step);
}

/** Stops the rest of a click (its release, click and menu) from doing anything. */
function swallow(e: Event) {
  e.preventDefault();
  e.stopPropagation();
}

let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener(
    "mousedown",
    (e) => {
      // Any click while scrolling stops it, and does nothing else.
      if (run) {
        stop();
        swallowing = true;
        swallow(e);
        return;
      }
      if (e.button !== 1) return;
      const look = looks.get(document.documentElement.dataset.theme ?? "");
      const target = e.target instanceof Element ? e.target : null;
      if (!look || !target || target.closest(SKIP)) return;
      const v = scroller(target, true);
      const h = scroller(target, false);
      if (!v && !h) return;
      // (Instead of the browser's own.)
      e.preventDefault();
      start(e, look, v, h);
    },
    true,
  );
  window.addEventListener(
    "mousemove",
    (e) => {
      if (!run) return;
      run.px = e.clientX;
      run.py = e.clientY;
      if (run.held && Math.hypot(run.px - run.x, run.py - run.y) > STILL) run.dragged = true;
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "mouseup",
    (e) => {
      if (swallowing) {
        swallow(e);
        // (Its click and menu come right after.)
        setTimeout(() => (swallowing = false));
        return;
      }
      if (!run || e.button !== 1) return;
      run.held = false;
      if (run.dragged) stop();
    },
    true,
  );
  for (const type of ["click", "auxclick", "contextmenu"]) {
    window.addEventListener(
      type,
      (e) => {
        if (swallowing) swallow(e);
      },
      true,
    );
  }
  window.addEventListener("keydown", stop, true);
  window.addEventListener("wheel", stop, { capture: true, passive: true });
  window.addEventListener("blur", stop);
}
