// Behind and around the library: embers floating up, autumn leaves drifting down, the top bar's
// bats and spider, the scenes, and a trick's lights going out.
import { useEffect, useRef } from "react";
import { GHOST } from "./art";
import { startTopBar } from "./topbar";
import { startScenes } from "./scenes";
import { followScroll, startLeaves } from "./leaves";

/** One ember per this many square pixels of window. */
const AREA_PER_EMBER = 26000;

interface Ember {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
  life: number;
}

/** A trick: the lights flicker out, and a ghost whooshes past. */
function trick() {
  const flash = document.createElement("div");
  flash.className = "he-trick";
  const ghost = document.createElement("div");
  ghost.className = "he-whoosh";
  ghost.innerHTML = GHOST;
  document.body.append(flash, ghost);
  window.setTimeout(() => {
    flash.remove();
    ghost.remove();
  }, 1600);
}

export default function Decor({ active, options }: { active: boolean; options: Record<string, boolean | string | undefined> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const leavesCanvas = useRef<HTMLCanvasElement>(null);
  const embers = active && options.embers !== false;
  const leaves = active && options.leaves !== false;
  const surprises = options.surprises !== false;

  useEffect(() => (active ? startTopBar() : undefined), [active]);
  useEffect(() => (leaves && leavesCanvas.current ? startLeaves(leavesCanvas.current) : undefined), [leaves]);
  useEffect(() => (active ? startScenes({ surprises }) : undefined), [active, surprises]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("he-fog-on", options.embers !== false);
    window.addEventListener("he:trick", trick);
    return () => {
      root.classList.remove("he-fog-on");
      window.removeEventListener("he:trick", trick);
    };
  }, [options.embers]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !embers || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = el.getContext("2d")!;
    let list: Ember[] = [];
    let frame = 0;
    let last = performance.now();
    // Embers belong to the page too: scrolling moves them along.
    const scroll = followScroll();

    const spawn = (w: number, h: number, anywhere: boolean): Ember => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      r: 0.8 + Math.random() * 1.6,
      speed: 10 + Math.random() * 22,
      drift: (Math.random() - 0.5) * 14,
      phase: Math.random() * Math.PI * 2,
      life: 0.4 + Math.random() * 0.6,
    });

    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (list.length > 0 && el.width === Math.round(w * dpr) && el.height === Math.round(h * dpr)) return;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      list = Array.from({ length: Math.round((w * h) / AREA_PER_EMBER) }, () => spawn(w, h, true));
    };

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      fit();
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const shift = scroll.take();
      list = list.map((e) => {
        e.y -= e.speed * dt + shift;
        if (e.y > h + 20) e.y -= h + 30;
        e.phase += dt * 1.3;
        e.x += (Math.sin(e.phase) * 8 + e.drift) * dt;
        if (e.y < -10) return spawn(w, h, false);
        // Brighter low down, fading as they rise, with a flicker.
        const fade = Math.max(0, Math.min(1, e.y / h + 0.15)) * e.life * (0.75 + 0.25 * Math.sin(e.phase * 4));
        const glow = g.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
        glow.addColorStop(0, `rgba(255, 196, 92, ${fade})`);
        glow.addColorStop(0.35, `rgba(255, 130, 40, ${fade * 0.45})`);
        glow.addColorStop(1, "rgba(255, 117, 24, 0)");
        g.fillStyle = glow;
        g.fillRect(e.x - e.r * 4, e.y - e.r * 4, e.r * 8, e.r * 8);
        return e;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      scroll.stop();
      g.clearRect(0, 0, el.width, el.height);
    };
  }, [embers]);

  return (
    <>
      <canvas ref={canvas} className="he-embers" aria-hidden="true" />
      <canvas ref={leavesCanvas} className="he-leaves" aria-hidden="true" />
    </>
  );
}
