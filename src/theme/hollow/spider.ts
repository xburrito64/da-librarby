// The spider in the top bar, hanging on its thread from the branch. Thread and spider swing together
// like a pendulum, stirred by a gentle draught and by the pointer passing close by. The silk is a bit
// springy, so it bobs when it stops. Now and then it lets itself down a little, climbs back up,
// turns around or kicks its legs. Click it and it scurries up its thread, then lowers itself
// again bit by bit. See hollow.css ("The top bar").
import { playSound } from "../sound";
import { SPIDER } from "./art";

/** How long its thread is when it's just hanging there (px). */
const REST = 40;
/** From the thread's end to the middle of the spider (px). */
const BODY = 10;
/** Pull of gravity on the swing, and how quickly a swing dies down. */
const GRAVITY = 900;
const DAMPING = 0.9;
/** Climbing and lowering speeds (px/s): calm, and scared. */
const CLIMB = 60;
const SCURRY = 320;
const LOWER = 34;
/** It stays up this long after a scare (ms). */
const HIDE_MS = [3500, 5000];
/** Between the little things it does by itself (ms). */
const IDLE_MS = [5000, 11000];

export function startSpider(layer: HTMLElement, still: boolean) {
  const el = document.createElement("div");
  el.className = "he-spider";
  el.innerHTML = `<div class="he-spider__swing"><span class="he-spider__thread"></span><span class="he-spider__body">${SPIDER}</span></div>`;
  layer.appendChild(el);
  const swing = el.firstElementChild as HTMLElement;
  const thread = swing.firstElementChild as HTMLElement;
  const body = swing.lastElementChild as HTMLElement;

  // Thread length, how fast it's changing, and where it's heading; the swing's angle and speed.
  let len = still ? REST : 1;
  let speed = 0;
  let target = REST;
  let angle = 0;
  let spin = 0;
  let scared = false;
  let x = 0;
  let shown = true;
  let frame = 0;
  let last = performance.now();
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const between = ([a, b]: number[]) => a + Math.random() * (b - a);
  const flash = (cls: string, ms: number) => {
    el.classList.add(cls);
    later(() => el.classList.remove(cls), ms);
  };

  const draw = () => {
    thread.style.height = `${len.toFixed(1)}px`;
    swing.style.transform = `rotate(${angle.toFixed(4)}rad)`;
  };

  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    // The thread: a springy pull towards where it's going, no faster than a spider can climb.
    speed += (70 * (target - len) - 10 * speed) * dt;
    // (Letting itself down is slow and steady; bobbing back after overshooting isn't held back.)
    speed = Math.max(-(scared ? SCURRY : CLIMB), Math.min(target > len ? LOWER : 140, speed));
    const before = len + BODY;
    len = Math.max(1, len + speed * dt);
    const reach = len + BODY;
    // The swing: a pendulum in a slight draught. Pulled up short, it swings quicker.
    const draught = 0.5 * Math.sin(t * 0.63) + 0.3 * Math.sin(t * 1.7 + 1.3) + 0.2 * Math.sin(t * 3.1);
    spin += (-(GRAVITY / reach) * Math.sin(angle) - DAMPING * spin + draught) * dt;
    spin *= Math.min(1.15, (before / reach) ** 2);
    spin = Math.max(-4, Math.min(4, spin));
    angle = Math.max(-0.7, Math.min(0.7, angle + spin * dt));
    draw();
    frame = requestAnimationFrame(step);
  };

  // Clicked: it scurries up, waits, then lets itself down again in stages.
  const scare = () => {
    if (scared || still || !shown) return;
    scared = true;
    target = 1;
    el.classList.add("is-scared");
    playSound("skitter");
    later(() => {
      el.classList.remove("is-scared");
      target = 14;
      later(() => {
        target = 27;
        later(() => {
          target = REST;
          scared = false;
        }, 1300);
      }, 1300);
    }, between(HIDE_MS));
  };
  body.addEventListener("click", scare);

  // The pointer passing close by stirs the air: the swing goes along with it a little.
  let px: number | null = null;
  const stir = (e: PointerEvent) => {
    const dx = px == null ? 0 : e.clientX - px;
    px = e.clientX;
    if (scared || !shown || e.clientY > 140) return;
    const reach = len + BODY;
    const bx = x + Math.sin(angle) * reach;
    const by = 6 + Math.cos(angle) * reach;
    const near = 1 - Math.hypot(e.clientX - bx, e.clientY - by) / 90;
    if (near > 0) spin += Math.max(-1.2, Math.min(1.2, dx * 0.02 * near));
  };
  window.addEventListener("pointermove", stir, { passive: true });

  // The little things it does on its own.
  const idle = () => {
    later(() => {
      if (!scared && shown) {
        const roll = Math.random();
        if (roll < 0.3) {
          // Lets itself down a little, then climbs back.
          target = REST + 10 + Math.random() * 8;
          later(() => !scared && (target = REST), between([2500, 4000]));
        } else if (roll < 0.55) {
          // Climbs up a bit.
          target = REST - 12 - Math.random() * 6;
          later(() => !scared && (target = REST), between([2000, 3000]));
        } else if (roll < 0.75) {
          flash("is-turning", 1400);
        } else {
          // Kicks its legs, setting itself swinging.
          flash("is-busy", 1200);
          spin += (Math.random() < 0.5 ? -1 : 1) * 0.9;
        }
      }
      idle();
    }, between(IDLE_MS));
  };

  if (still) draw();
  else {
    frame = requestAnimationFrame(step);
    idle();
  }

  return {
    /** Hangs it at x (the middle of the gap); hidden when there's no room. */
    place(at: number, room: boolean) {
      x = at;
      el.style.left = `${at}px`;
      shown = room;
      el.hidden = !room;
    },
    stop() {
      cancelAnimationFrame(frame);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("pointermove", stir);
      el.remove();
    },
  };
}
