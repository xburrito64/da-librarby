// The top bar's little residents: a gnarled branch reaching in from the top-right corner with bats
// asleep under it (point at one and they take off, coming back to hang a while later), and a spider
// on its thread (point at it and it scurries up, then lowers itself again). They sit in the gap
// between the menu and the search box. See hollow.css ("The top bar").
import { playSound } from "../sound";
import { FLYING_BAT, HANGING_BAT, SPIDER } from "./art";

/** Bats come back to hang this long after flying off (ms). */
const BATS_BACK_MS = [8000, 12000];
const SPIDER_BACK_MS = 4200;
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
  branch.innerHTML = `<svg viewBox="0 0 800 40" preserveAspectRatio="none">
    <path d="M800 0L800 26C760 24 730 20 690 22C640 25 610 17 560 19C500 22 470 15 420 17C360 20 330 13 280 15C220 17 190 12 140 13C100 14 60 11 20 12L0 11C40 8 90 9 140 7C200 5 240 8 290 5C350 2 390 7 440 4C500 1 540 6 600 3C680 0 740 4 800 0Z" fill="#2a1b33"/>
    <path d="M800 1C740 5 680 1 600 4C540 7 500 2 440 5C390 8 350 3 290 6C240 9 200 6 140 8C90 10 40 9 2 11" stroke="#5a4473" stroke-width="1.6" fill="none"/>
    <path d="M610 18c-8 6-12 12-12 18M470 15c4 8 4 14 2 20M330 14c-10 4-16 10-18 16M180 13c6 6 8 12 6 18M90 11c-8 2-14 6-18 10" stroke="#2a1b33" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <path d="M598 36c-6 0-9-4-6-7c4 1 6 4 6 7zM472 35c6-1 8-6 5-8c-4 2-6 5-5 8zM72 22c-6 1-9-2-7-6c4 0 7 3 7 6z" fill="#3d2a1a"/>
  </svg>`;
  layer.appendChild(branch);
  const spider = document.createElement("div");
  spider.className = "he-spider";
  spider.innerHTML = `<span class="he-spider__thread"></span><span class="he-spider__body">${SPIDER}</span>`;
  layer.appendChild(spider);
  (document.querySelector(".app") ?? document.body).appendChild(layer);

  let bats: HTMLElement[] = [];
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
    branch.style.left = `${Math.max(0, from - 60)}px`;
    const count = Math.min(MAX_BATS, Math.floor(room / ROOM_PER_BAT));
    while (bats.length > count) bats.pop()!.remove();
    while (bats.length < count) {
      const bat = document.createElement("span");
      bat.className = "he-bat";
      bat.innerHTML = HANGING_BAT;
      bat.style.animationDelay = `${-bats.length * 0.7}s`;
      bat.addEventListener("pointerenter", () => scare(bat));
      layer.appendChild(bat);
      bats.push(bat);
    }
    // Spread out over the left part of the gap; the spider hangs near its right end.
    bats.forEach((bat, i) => {
      const x = from + ((i + 0.5) / Math.max(1, count)) * room * 0.72;
      bat.style.left = `${x}px`;
      bat.style.top = `${7 + ((i * 5) % 4)}px`;
    });
    spider.style.left = `${from + room * 0.86}px`;
    spider.hidden = room < 80;
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

  spider.addEventListener("pointerenter", () => {
    if (spider.classList.contains("is-up") || still) return;
    spider.classList.add("is-up");
    playSound("skitter");
    later(() => spider.classList.remove("is-up"), SPIDER_BACK_MS);
  });

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
    layer.remove();
    bats = [];
  };
}
