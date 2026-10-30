// The drawings' little movements (grass swaying, faces flickering, bats flapping, the cat
// breathing...) are CSS animations on parts of big vector pictures. The browser can't hand those
// to the graphics card: every step makes it go over the whole page again (its pieces and layers),
// and with the pictures stepping every frame the page couldn't keep up with a fast screen (at
// 144 Hz there are 7 ms for a frame). So they're stepped here instead, all together, 36-odd times
// a second: the page is gone over once for all of them, and the frames in between are left free
// (for scrolling, a page opening). Pictures that are off screen or covered don't move at all, and
// none move while the page is being scrolled (then every frame is needed for that); they carry on
// from where they were.
//
// (Moving the parts through their style instead, with no animation left, spares the browser its
// layers for them, but then the graphics card has to draw the pictures again at every step: worse.)

import { cancelFrame, frame as nextFrame } from "./freeze";

/** The pictures move on this often (ms): every 4th frame at 144 Hz, every 3rd at 120, every 2nd at 60. */
const STEP_MS = 24;
/** How often new animations are looked for (a picture drawn again, a page opened). */
const ADOPT_EVERY_MS = 500;
/** The pictures hold still until the page has stopped scrolling for this long (ms). */
const SCROLL_HOLD_MS = 250;

/** Starts stepping the pictures' animations; returns the way to stop (they run on their own again). */
export function startClock() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  /** Each picture's animations, and where each was when taken over (its time, and when that was). */
  const pictures = new Map<SVGSVGElement, Map<Animation, { base: number; t0: number }>>();
  const onScreen = new Set<Element>();
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) onScreen.add(e.target);
      else onScreen.delete(e.target);
    }
  });

  // Their own time, which stands still while the page is scrolled.
  let held = 0;
  let heldSince = 0;
  let scrolledAt = -Infinity;
  const time = (now: number) => (heldSince || now) - held;
  const onScroll = () => (scrolledAt = performance.now());
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });

  const adopt = () => {
    const now = time(performance.now());
    // Gone: the picture's been taken away, or all its animations have ended.
    for (const [root, anims] of pictures) {
      if (!root.isConnected || anims.size === 0) {
        observer.unobserve(root);
        onScreen.delete(root);
        pictures.delete(root);
      }
    }
    for (const a of document.getAnimations()) {
      const target = (a.effect as KeyframeEffect | null)?.target;
      // Only endless ones: ones that end (a wobble when clicked) are left to finish by themselves.
      if (!(target instanceof SVGElement) || a.effect?.getTiming().iterations !== Infinity || a.playState !== "running") continue;
      let root = target.ownerSVGElement;
      if (!root) continue;
      while (root.ownerSVGElement) root = root.ownerSVGElement;
      let anims = pictures.get(root);
      if (!anims) {
        anims = new Map();
        pictures.set(root, anims);
        observer.observe(root);
      }
      anims.set(a, { base: Number(a.currentTime ?? 0), t0: now });
      a.pause();
      // Ended (its class removed, or the page started it over: a new one then): let go before it's
      // stepped again, which would start it again, never to be let go.
      const theirs = anims;
      a.addEventListener("cancel", () => theirs.delete(a), { once: true });
    }
  };

  let last = 0;
  const step = (now: number) => {
    frame = nextFrame(step);
    if (now - last < STEP_MS) return;
    last = now;
    if (now - scrolledAt < SCROLL_HOLD_MS) {
      heldSince ||= now;
      return;
    }
    if (heldSince) {
      held += now - heldSince;
      heldSince = 0;
    }
    const t = time(now);
    for (const [root, anims] of pictures) {
      if (!onScreen.has(root) || root.closest(".is-covered")) continue;
      // (Not asking each one how it is: that has the browser work out the page's styles, each time.)
      for (const [a, at] of anims) a.currentTime = at.base + (t - at.t0);
    }
  };

  adopt();
  const adopting = window.setInterval(adopt, ADOPT_EVERY_MS);
  let frame = nextFrame(step);
  return () => {
    window.clearInterval(adopting);
    cancelFrame(frame);
    observer.disconnect();
    document.removeEventListener("scroll", onScroll, { capture: true });
    const now = time(performance.now());
    for (const anims of pictures.values())
      for (const [a, at] of anims) {
        if (a.playState === "idle") continue;
        a.currentTime = at.base + (now - at.t0);
        a.play();
      }
  };
}
