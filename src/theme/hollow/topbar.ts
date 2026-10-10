// The top bar's little residents: a gnarled branch reaching in from the top-right corner with bats
// asleep under it (click one and they take off, coming back to hang a while later), and a spider
// swinging on its thread (see spider.ts). They sit in the gap between the menu and the search box.
// See hollow.css ("The top bar").
import { playSound } from "../sound";
import { FLYING_BAT, HANGING_BAT } from "./art";
import { drawBranch, perches } from "./branch";
import { startSpider } from "./spider";

/** Bats come back to hang this long after flying off (ms). */
const BATS_BACK_MS = [8000, 12000];
/** At most this many bats, one per this much room (px). */
const MAX_BATS = 4;
const ROOM_PER_BAT = 60;

export function startTopBar() {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layer = document.createElement("div");
  layer.className = "he-top";
  layer.setAttribute("aria-hidden", "true");
  const branch = document.createElement("div");
  branch.className = "he-branch";
  layer.appendChild(branch);
  const spider = startSpider(layer, still);
  (document.querySelector(".app") ?? document.body).appendChild(layer);

  let bats: HTMLElement[] = [];
  let under = (_x: number) => 10;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  // The gap between the menu and the search box (or the end of the bar).
  const layout = () => {
    const tabs = document.querySelector(".nav__tabs")?.getBoundingClientRect();
    const end = document.querySelector(".nav__end")?.getBoundingClientRect();
    if (!tabs) return;
    const from = tabs.right + 24;
    const to = (end && end.left > from ? end.left : window.innerWidth) - 24;
    const room = Math.max(0, to - from);
    const left = Math.max(0, from - 60);
    const count = Math.min(MAX_BATS, Math.floor(room / ROOM_PER_BAT));
    while (bats.length > count) bats.pop()!.remove();
    while (bats.length < count) {
      const bat = document.createElement("span");
      bat.className = "he-bat";
      bat.innerHTML = HANGING_BAT;
      bat.style.animationDelay = `${-bats.length * 0.7}s`;
      bat.addEventListener("click", () => scare(bat));
      layer.appendChild(bat);
      bats.push(bat);
    }
    // Spread out over the left part of the gap; the spider hangs near its right end. The branch is
    // drawn to fit (its hanging twigs keep out of their way), and they grip its underside.
    const batX = bats.map((_, i) => from + ((i + 0.5) / Math.max(1, count)) * room * 0.72);
    const spiderX = from + room * 0.86;
    const width = Math.ceil(window.innerWidth - left);
    if (branch.dataset.size !== `${left}/${width}/${count}`) {
      branch.dataset.size = `${left}/${width}/${count}`;
      const drawn = drawBranch(width, [...batX.map((x) => x + 11 - left), spiderX - left]);
      branch.innerHTML = drawn.svg;
      under = drawn.under;
      perches.list = drawn.perches.map(([x, y]) => [x + left, y]);
    }
    branch.style.left = `${left}px`;
    bats.forEach((bat, i) => {
      bat.style.left = `${batX[i]}px`;
      bat.style.top = `${under(batX[i] + 11 - left) - 3}px`;
    });
    spider.place(spiderX, room >= 80, under(spiderX - left) - 2);
  };

  // Bats near the one pointed at take off too, and fly off across the top.
  const scare = (first: HTMLElement) => {
    if (still) return;
    const near = bats.filter((b) => !b.classList.contains("is-away") && Math.abs(b.offsetLeft - first.offsetLeft) < 130);
    if (near.length === 0) return;
    playSound("flutter");
    near.forEach((bat, n) => {
      bat.classList.add("is-away");
      const flyer = document.createElement("span");
      flyer.className = "he-flyer";
      flyer.innerHTML = FLYING_BAT;
      layer.appendChild(flyer);
      const x0 = bat.offsetLeft - 10;
      const y0 = bat.offsetTop + 4;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const start = performance.now() + n * 90;
      const step = (now: number) => {
        const t = (now - start) / 1000;
        if (t < 0) return void requestAnimationFrame(step);
        const x = x0 + dir * t * 260 + Math.sin(t * 9) * 18;
        const y = y0 + 40 * Math.sin(t * 3) - t * 40 + Math.sin(t * 13) * 6;
        flyer.style.transform = `translate(${x}px, ${y}px) scaleX(${dir})`;
        flyer.style.opacity = String(Math.min(1, 2.4 - t));
        if (t < 2.4 && x > -60 && x < window.innerWidth + 60) requestAnimationFrame(step);
        else flyer.remove();
      };
      requestAnimationFrame(step);
      later(() => bat.classList.remove("is-away"), BATS_BACK_MS[0] + Math.random() * (BATS_BACK_MS[1] - BATS_BACK_MS[0]));
    });
  };

  layout();
  const resized = new ResizeObserver(layout);
  const nav = document.querySelector(".nav");
  if (nav) resized.observe(nav);
  document.querySelectorAll(".nav__tabs, .nav__end").forEach((el) => resized.observe(el));
  window.addEventListener("resize", layout);
  return () => {
    resized.disconnect();
    window.removeEventListener("resize", layout);
    timers.forEach((t) => window.clearTimeout(t));
    spider.stop();
    perches.list = [];
    layer.remove();
    bats = [];
  };
}
