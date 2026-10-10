// Puts Hollow's Eve's scenes where they're shown (the pumpkin patch under the spotlight with the
// slice of earth under it, the graveyard on show pages) and keeps them alive. Everything reacts to
// a click, never to the pointer just passing by (too many sounds otherwise): pumpkins wobble with
// a knock, the house's door creaks open, the ghost (peeking out from behind its tombstone now and
// then) gets a fright and ducks back down, and under the patch the skeleton wakes up, the coffin
// opens, the mushrooms puff spores and the candy stash is found. Once in a while a pair of eyes
// looks out of the crypt's door by itself.
import { playSound } from "../sound";
import { graveyardScene, patchScene } from "./scene";
import { underScene, type Spot } from "./under";

const HOSTS = [
  { selector: ".hero__decor--bottom", draw: patchScene },
  { selector: ".tp__decor--bottom", draw: (width: number, _spots: Spot[]) => graveyardScene(width) },
];

/** The ghost peeks out every so often, for a while. */
const PEEK_EVERY_MS = [6000, 15000];
const PEEK_MS = 4200;
/** Eyes in the crypt's door: how often, for how long. */
const EYES_EVERY_MS = [20000, 45000];
const EYES_MS = 3600;
/** The house's door stays open this long (ms). */
const DOOR_OPEN_MS = 3200;

const between = ([a, b]: number[]) => a + Math.random() * (b - a);

/** The things under the patch that wake up when clicked: for how long, and the sounds they make
 *  (and when, ms). The coffin's lid scrapes open, then whoever's inside moans. */
const POKES: Record<string, { ms: number; sounds?: ["rattle" | "scrape" | "moan", number][] }> = {
  skeleton: { ms: 2600, sounds: [["rattle", 0]] },
  coffin: { ms: 2800, sounds: [["scrape", 0], ["moan", 650]] },
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

  // Clicks: on a pumpkin, the house, the ghost, or (where nothing else was clicked) something
  // under the patch.
  const resting = new Set<Element>();
  const onClick = (e: MouseEvent) => {
    const target = e.target as Element;
    const pumpkin = target.closest?.(".he-pumpkin");
    if (pumpkin) {
      pumpkin.classList.remove("is-wobbly");
      void (pumpkin as SVGGraphicsElement).getBBox();
      pumpkin.classList.add("is-wobbly", "is-poked");
      playSound("bonk");
      // Its own little reaction (the sleepy one wakes up, ...), for a moment.
      window.clearTimeout(Number((pumpkin as HTMLElement).dataset.poked));
      (pumpkin as HTMLElement).dataset.poked = String(window.setTimeout(() => pumpkin.classList.remove("is-poked"), 2200));
      return;
    }
    const house = target.closest?.(".he-house");
    if (house) {
      // The door swings open as slowly as its creak lasts, and the eyes appear once it's open.
      if (house.classList.contains("is-opening") || house.classList.contains("is-open")) return;
      house.classList.add("is-opening");
      void playSound("creak").then((seconds) => {
        const swing = Math.min(1.6, Math.max(0.35, (seconds ?? 0.6) * 0.85));
        house.querySelector<SVGElement>(".he-door")?.style.setProperty("transition-duration", `${swing}s`);
        house.querySelector<SVGElement>(".he-door-eyes")?.style.setProperty("transition-delay", `${swing * 0.75}s`);
        house.classList.replace("is-opening", "is-open");
        later(() => house.classList.remove("is-open"), Math.max(DOOR_OPEN_MS, swing * 1000 + 2200));
      });
      return;
    }
    const ghost = target.closest?.(".he-ghost.is-peeking") as SVGGElement | null;
    if (ghost) {
      // It ducks down as fast as its little cry lasts: a squeak, quick; a slide whistle, slower.
      // (The speed has to be set before it starts moving.)
      if (ghost.classList.contains("is-startled")) return;
      ghost.classList.add("is-startled");
      void playSound("boo").then((seconds) => {
        const hide = Math.min(0.75, Math.max(0.14, (seconds ?? 0.2) * 0.85));
        ghost.style.transitionDuration = `${hide}s`;
        ghost.classList.remove("is-peeking", "is-startled");
        later(() => (ghost.style.transitionDuration = ""), hide * 1000 + 100);
      });
      return;
    }
    if (!surprises || target.closest?.("a, button, input, textarea, select, .card, [role=button], [role=tab]")) return;
    const stash = document.querySelector(".he-under .heu-stash");
    if (stash && over(stash, e.clientX, e.clientY, 2)) {
      stash.classList.remove("is-poked");
      void (stash as SVGGraphicsElement).getBBox();
      stash.classList.add("is-poked");
      later(() => stash.classList.remove("is-poked"), 1800);
      playSound("treat");
      window.dispatchEvent(new CustomEvent("da:say", { detail: STASH_FOUND[Math.floor(Math.random() * STASH_FOUND.length)] }));
      return;
    }
    for (const thing of document.querySelectorAll(".he-under [data-poke]")) {
      if (resting.has(thing) || !over(thing, e.clientX, e.clientY)) continue;
      const poke = POKES[(thing as HTMLElement).dataset.poke ?? ""];
      if (!poke) continue;
      resting.add(thing);
      thing.classList.add("is-poked");
      for (const [sound, at] of poke.sounds ?? []) later(() => playSound(sound), at);
      later(() => thing.classList.remove("is-poked"), poke.ms);
      later(() => resting.delete(thing), poke.ms + 300);
      return;
    }
  };
  document.addEventListener("click", onClick);

  // The things under the patch sit behind the page, so the pointer shows they can be clicked.
  let pointing = 0;
  const onMove = (e: PointerEvent) => {
    if (pointing) return;
    pointing = requestAnimationFrame(() => {
      pointing = 0;
      const hit = [...document.querySelectorAll(".he-under [data-poke]")].some((t) => over(t, e.clientX, e.clientY));
      const onPage = (e.target as Element).closest?.("a, button, input, .card, [role=button]");
      document.documentElement.classList.toggle("he-can-poke", hit && !onPage);
    });
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
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("click", onClick);
    cancelAnimationFrame(pointing);
    document.documentElement.classList.remove("he-can-poke");
    timers.forEach((t) => window.clearTimeout(t));
    for (const host of drawn.keys()) {
      host.innerHTML = "";
      host.classList.remove("he-scene");
    }
    document.querySelectorAll(".he-under").forEach((el) => el.remove());
  };
}
