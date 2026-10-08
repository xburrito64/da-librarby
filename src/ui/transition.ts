// Smooth moves between screens with the browser's view transitions: the page cross-fades, and an
// element given a shared name (a cover) glides from where it was to where it ends up.
import { flushSync } from "react-dom";

/** The name the show page's cover has (see .tp__cover in base.css). */
export const COVER = "tp-cover";

function canTransition() {
  return "startViewTransition" in document && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs `update` (a React state change) as a view transition. `from` is named `name` in the old
 * picture, `to` in the new one, so it glides between the two; either may be left out.
 */
export function transition(update: () => void, shared?: { name: string; from?: HTMLElement | null; to?: () => HTMLElement | null }) {
  if (!canTransition()) {
    update();
    return;
  }
  const from = shared?.from;
  if (from && shared) from.style.viewTransitionName = shared.name;
  let to: HTMLElement | null = null;
  const root = document.documentElement;
  root.classList.add("is-transitioning");
  const t = document.startViewTransition(() => {
    // A name may only be on one element at a time.
    if (from) from.style.viewTransitionName = "";
    flushSync(update);
    to = shared?.to?.() ?? null;
    if (to && shared) to.style.viewTransitionName = shared.name;
  });
  t.finished.finally(() => {
    root.classList.remove("is-transitioning");
    if (to) to.style.viewTransitionName = "";
  });
}

/** Waits until an image is ready to draw (or a short while at most), so it's in the new picture. */
export function ready(src: string | undefined, maxMs = 250): Promise<void> {
  if (!src) return Promise.resolve();
  const image = new Image();
  image.src = src;
  return Promise.race([image.decode().catch(() => {}), new Promise<void>((r) => setTimeout(r, maxMs))]);
}
