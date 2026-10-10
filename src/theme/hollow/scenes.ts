// Puts Hollow's Eve's scenes where they're shown (the pumpkin patch under the spotlight with the
// slice of earth under it, the graveyard on show pages) and keeps them alive: pumpkins wobble or glow when pointed at, the ghost
// peeks out from behind its tombstone now and then (and ducks back down when you come close), and
// once in a while a pair of eyes looks out of the crypt's door. Under the patch, things wake up
// when pointed at (the skeleton, the coffin, the mushrooms...), and the candy stash can be found.
import { playSound } from "../sound";
import { graveyardScene, patchScene } from "./scene";
import { underScene, type Spot } from "./under";

const HOSTS = [
  { selector: ".hero__decor--bottom", draw: patchScene },
  { selector: ".tp__decor--bottom", draw: (width: number, _spots: Spot[]) => graveyardScene(width) },
];

/** The ghost peeks out every so often, for a while; it hides when the pointer comes this close (px). */
const PEEK_EVERY_MS = [6000, 15000];
const PEEK_MS = 2800;
const SHY_PX = 110;
/** Eyes in the crypt's door: how often, for how long. */
const EYES_EVERY_MS = [20000, 45000];
const EYES_MS = 3600;

const between = ([a, b]: number[]) => a + Math.random() * (b - a);
/** The house's door creaks at most this often (ms). */
const HOUSE_CREAK_MS = 2500;

/** The things under the patch that wake up when pointed at: for how long, and the sound they make. */
const POKES: Record<string, { ms: number; sound?: "rattle" | "scrape" }> = {
  skeleton: { ms: 2600, sound: "rattle" },
  coffin: { ms: 2800, sound: "scrape" },
  stash: { ms: 1800 },
  mushrooms: { ms: 1900 },
  crystals: { ms: 1600 },
};
/** What you're told when you find the candy stash. */
const STASH_FOUND = [
  "You found someone's secret candy stash! I won't tell.",
  "Shh… that's the skeleton's candy. It's been saving it for years.",
  "Candy corn, three sweets and a lollipop. Finders keepers?",
  "A secret stash! Leave one for the worms.",
];

/** Whether the pointer is over an element (or near it). */
const over = (el: Element, x: number, y: number, near = 6) => {
  const r = el.getBoundingClientRect();
  return x > r.left - near && x < r.right + near && y > r.top - near && y < r.bottom + near;
};

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
        const spots: Spot[] = [];
        host.innerHTML = `${scene(width, spots)}<span class="he-fog"></span><span class="he-fog he-fog--near"></span>`;
        // Under the patch, the slice of earth, lined up with it (at the top of the rows below).
        const rows = spots.length ? document.querySelector(".home__rows") : null;
        if (rows) {
          rows.querySelector(":scope > .he-under")?.remove();
          rows.insertAdjacentHTML("beforeend", `<div class="he-under" aria-hidden="true">${underScene(Math.max(1100, Math.ceil(width)), spots)}</div>`);
        }
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

  // Pumpkins: plain ones wobble (and go "bonk"), lit ones glow up (in the stylesheet). The house's
  // door creaks open (the stylesheet opens it).
  let creaked = 0;
  const onOver = (e: PointerEvent) => {
    const house = (e.target as Element).closest?.(".he-house");
    if (house && !house.contains(e.relatedTarget as Node) && performance.now() - creaked > HOUSE_CREAK_MS) {
      creaked = performance.now();
      playSound("creak");
    }
    const pumpkin = (e.target as Element).closest?.(".he-pumpkin");
    if (!pumpkin || pumpkin.contains(e.relatedTarget as Node) || pumpkin.classList.contains("is-jack")) return;
    pumpkin.classList.remove("is-wobbly");
    void (pumpkin as SVGGraphicsElement).getBBox();
    pumpkin.classList.add("is-wobbly");
    playSound("bonk");
  };
  document.addEventListener("pointerover", onOver);

  // The ghost ducks back down when you come looking; things under the patch wake up.
  const resting = new Set<Element>();
  const onMove = (e: PointerEvent) => {
    for (const thing of document.querySelectorAll(".he-under [data-poke]")) {
      if (resting.has(thing) || !over(thing, e.clientX, e.clientY)) continue;
      const poke = POKES[(thing as HTMLElement).dataset.poke ?? ""];
      if (!poke) continue;
      resting.add(thing);
      thing.classList.add("is-poked");
      if (poke.sound) playSound(poke.sound);
      later(() => thing.classList.remove("is-poked"), poke.ms);
      later(() => resting.delete(thing), poke.ms + 1500);
    }
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

  // Clicking the candy stash (where nothing else is being clicked).
  const onClick = (e: MouseEvent) => {
    const stash = document.querySelector(".he-under .heu-stash");
    if (!stash || !over(stash, e.clientX, e.clientY, 2) || (e.target as Element).closest?.("a, button, input, .card, [role=button]")) return;
    playSound("treat");
    window.dispatchEvent(new CustomEvent("da:say", { detail: STASH_FOUND[Math.floor(Math.random() * STASH_FOUND.length)] }));
  };
  if (surprises) document.addEventListener("click", onClick);

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
    document.removeEventListener("click", onClick);
    timers.forEach((t) => window.clearTimeout(t));
    for (const host of drawn.keys()) {
      host.innerHTML = "";
      host.classList.remove("he-scene");
    }
    document.querySelectorAll(".he-under").forEach((el) => el.remove());
  };
}
