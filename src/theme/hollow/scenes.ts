// Puts Hollow's Eve's scenes where they're shown (the pumpkin patch under the spotlight, the
// graveyard on show pages) and keeps them alive: pumpkins wobble or glow when pointed at, the ghost
// peeks out from behind its tombstone now and then (and ducks back down when you come close), and
// once in a while a pair of eyes looks out of the crypt's door.
import { playSound } from "../sound";
import { graveyardScene, patchScene } from "./scene";

const HOSTS = [
  { selector: ".hero__decor--bottom", draw: patchScene },
  { selector: ".tp__decor--bottom", draw: graveyardScene },
];

/** The ghost peeks out every so often, for a while; it hides when the pointer comes this close (px). */
const PEEK_EVERY_MS = [6000, 15000];
const PEEK_MS = 2800;
const SHY_PX = 110;
/** Eyes in the crypt's door: how often, for how long. */
const EYES_EVERY_MS = [20000, 45000];
const EYES_MS = 3600;

const between = ([a, b]: number[]) => a + Math.random() * (b - a);

export function startScenes({ surprises }: { surprises: boolean }) {
  const drawn = new Map<HTMLElement, number>();
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  const draw = () => {
    const width = window.innerWidth;
    for (const { selector, draw: scene } of HOSTS)
      document.querySelectorAll<HTMLElement>(selector).forEach((host) => {
        if (drawn.get(host) === width) return;
        drawn.set(host, width);
        host.classList.add("he-scene");
        host.innerHTML = `${scene(width)}<span class="he-fog"></span><span class="he-fog he-fog--near"></span>`;
      });
    for (const host of drawn.keys()) if (!host.isConnected) drawn.delete(host);
  };

  let queued = 0;
  const changes = new MutationObserver(() => {
    queued ||= requestAnimationFrame(() => {
      queued = 0;
      draw();
    });
  });
  changes.observe(document.body, { childList: true, subtree: true });
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(draw, 200);
  };
  window.addEventListener("resize", onResize);
  draw();

  const shown = <T extends Element>(selector: string) =>
    [...document.querySelectorAll<T>(selector)].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    });

  // Pumpkins: plain ones wobble (and go "bonk"), lit ones glow up (in the stylesheet).
  const onOver = (e: PointerEvent) => {
    const pumpkin = (e.target as Element).closest?.(".he-pumpkin");
    if (!pumpkin || pumpkin.contains(e.relatedTarget as Node) || pumpkin.classList.contains("is-jack")) return;
    pumpkin.classList.remove("is-wobbly");
    void (pumpkin as SVGGraphicsElement).getBBox();
    pumpkin.classList.add("is-wobbly");
    playSound("bonk");
  };
  document.addEventListener("pointerover", onOver);

  // The ghost ducks back down when you come looking.
  const onMove = (e: PointerEvent) => {
    for (const ghost of document.querySelectorAll(".he-ghost.is-peeking")) {
      const r = ghost.getBoundingClientRect();
      if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < SHY_PX) {
        ghost.classList.remove("is-peeking");
        ghost.classList.add("is-hiding");
        playSound("boo");
        later(() => ghost.classList.remove("is-hiding"), 400);
      }
    }
  };
  if (surprises) window.addEventListener("pointermove", onMove, { passive: true });

  const peek = () => {
    later(peek, between(PEEK_EVERY_MS));
    if (document.hidden) return;
    const ghost = shown(".he-ghost")[0];
    if (!ghost) return;
    ghost.classList.add("is-peeking");
    later(() => ghost.classList.remove("is-peeking"), PEEK_MS);
  };
  const eyes = () => {
    later(eyes, between(EYES_EVERY_MS));
    if (document.hidden) return;
    const pair = shown(".he-eyes")[0];
    if (!pair) return;
    pair.classList.add("is-open");
    later(() => pair.classList.remove("is-open"), EYES_MS);
  };
  if (surprises) {
    later(peek, 3000);
    later(eyes, between(EYES_EVERY_MS));
  }

  return () => {
    changes.disconnect();
    cancelAnimationFrame(queued);
    window.clearTimeout(resizeTimer);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("pointerover", onOver);
    window.removeEventListener("pointermove", onMove);
    timers.forEach((t) => window.clearTimeout(t));
    for (const host of drawn.keys()) {
      host.innerHTML = "";
      host.classList.remove("he-scene");
    }
  };
}
