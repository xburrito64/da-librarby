// The drawings' little movements (grass swaying, faces flickering, bats flapping, the cat
// breathing...) are CSS animations on parts of big vector pictures. The browser can't hand those
// to the graphics card: every step redraws the whole picture (thousands of shapes), and with every
// picture stepping every frame the page couldn't keep up with a fast screen (at 144 Hz there are
// 7 ms for a frame). So they're stepped here instead: each frame the picture that has waited the
// longest moves on (several small ones together), so each still moves 30-odd times a second, and
// pictures that are off screen or covered don't move at all.

import { cancelFrame, frame as nextFrame } from "./freeze";

/** A picture moves on at most this often (ms), even when it's the only one. */
const MIN_GAP_MS = 1000 / 60;
/** Pictures moved on in one frame together have at most this many shapes (the first one any size). */
const SHAPES_PER_FRAME = 1600;
/** How often new animations are looked for (a picture drawn again, a page opened). */
const ADOPT_EVERY_MS = 500;

interface Picture {
  root: SVGSVGElement;
  shapes: number;
  /** Each animation and where it was when taken over (its time, and when that was). */
  anims: Map<Animation, { base: number; t0: number }>;
  last: number;
}

/** Starts stepping the pictures' animations; returns the way to stop (they run on their own again). */
export function startClock() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const pictures = new Map<SVGSVGElement, Picture>();
  const onScreen = new Set<Element>();
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) onScreen.add(e.target);
      else onScreen.delete(e.target);
    }
  });

  const adopt = () => {
    const now = performance.now();
    for (const a of document.getAnimations()) {
      const target = (a.effect as KeyframeEffect | null)?.target;
      // Only endless ones: ones that end (a wobble when clicked) are left to finish by themselves.
      if (!(target instanceof SVGElement) || a.effect?.getTiming().iterations !== Infinity) continue;
      let root = target.ownerSVGElement;
      if (!root) continue;
      while (root.ownerSVGElement) root = root.ownerSVGElement;
      let picture = pictures.get(root);
      if (!picture) {
        picture = { root, shapes: root.getElementsByTagName("*").length, anims: new Map(), last: 0 };
        pictures.set(root, picture);
        observer.observe(root);
      }
      if (picture.anims.has(a) || a.playState !== "running") continue;
      picture.anims.set(a, { base: Number(a.currentTime ?? 0), t0: now });
      a.pause();
    }
    // Gone: the picture's been taken away, or the animation ended (its class removed).
    for (const [root, picture] of pictures) {
      for (const a of picture.anims.keys()) if (a.playState === "idle") picture.anims.delete(a);
      if (!root.isConnected || picture.anims.size === 0) {
        observer.unobserve(root);
        onScreen.delete(root);
        pictures.delete(root);
      }
    }
  };

  const step = (now: number) => {
    frame = nextFrame(step);
    const due = [...pictures.values()]
      .filter((p) => now - p.last >= MIN_GAP_MS && onScreen.has(p.root) && !p.root.closest(".is-covered"))
      .sort((a, b) => a.last - b.last);
    let shapes = 0;
    for (const p of due) {
      if (shapes > 0 && shapes + p.shapes > SHAPES_PER_FRAME) break;
      shapes += p.shapes;
      p.last = now;
      for (const [a, at] of p.anims) a.currentTime = at.base + (now - at.t0);
    }
  };

  adopt();
  const adopting = window.setInterval(adopt, ADOPT_EVERY_MS);
  let frame = nextFrame(step);
  return () => {
    window.clearInterval(adopting);
    cancelFrame(frame);
    observer.disconnect();
    const now = performance.now();
    for (const picture of pictures.values())
      for (const [a, at] of picture.anims) {
        a.currentTime = at.base + (now - at.t0);
        a.play();
      }
  };
}
