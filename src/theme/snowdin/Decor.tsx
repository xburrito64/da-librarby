// Falling snow behind the library, and keeping the town and forest as wide as the window.
// The snow belongs to the page: scrolling moves it along with everything else (flakes leaving one
// edge come back at the other). Inside the spotlight and show-page artwork, the stylesheet lets
// snow fall within the scene.
import { useEffect, useRef } from "react";
import { drawScenes } from "./art";

/** One snowflake per this many square pixels of window. */
const AREA_PER_FLAKE = 9000;
/** Snowflakes are art pixels, like everything else (3 screen pixels). */
const FLAKE = 3;
/** Now and then (about one start in ten), a little dog visits town for the session. */
const DOG_VISIT_CHANCE = 0.1;

interface Flake {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  alpha: number;
}

export default function Decor({ active, options }: { active: boolean; options: Record<string, boolean | string | undefined> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const snow = active && options.snow !== false;

  // Tells the stylesheet whether snow falls inside the scenes too.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("sd-snow-on", options.snow !== false);
    return () => root.classList.remove("sd-snow-on");
  }, [options.snow]);

  useEffect(() => {
    if (Math.random() >= DOG_VISIT_CHANCE) return;
    const root = document.documentElement;
    root.classList.add("sd-dog-visit");
    return () => root.classList.remove("sd-dog-visit");
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    let width = window.innerWidth;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (window.innerWidth !== width) drawScenes((width = window.innerWidth));
      }, 250);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !snow || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = el.getContext("2d")!;
    let flakes: Flake[] = [];
    let frame = 0;
    let last = performance.now();
    // How far pages have scrolled since the last frame.
    let scrolled = 0;
    const tops = new WeakMap<Element, number>();
    const onScroll = (e: Event) => {
      const page = e.target;
      if (!(page instanceof HTMLElement) || !page.classList.contains("view")) return;
      scrolled += page.scrollTop - (tops.get(page) ?? page.scrollTop);
      tops.set(page, page.scrollTop);
    };
    document.addEventListener("scroll", onScroll, true);
    document.querySelectorAll(".view").forEach((page) => tops.set(page, page.scrollTop));

    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Same size and already snowing: nothing to do. (Coming back from the player starts with no
      // flakes, even though the window kept its size.)
      if (flakes.length > 0 && el.width === Math.round(w * dpr) && el.height === Math.round(h * dpr)) return;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      flakes = Array.from({ length: Math.round((w * h) / AREA_PER_FLAKE) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() < 0.8 ? FLAKE : FLAKE * 2,
        speed: 14 + Math.random() * 26,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.3 + Math.random() * 0.5,
      }));
    };

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      fit();
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      g.clearRect(0, 0, el.width, el.height);
      const shift = scrolled;
      scrolled = 0;
      for (const f of flakes) {
        f.y += f.speed * dt - shift;
        f.phase += dt * 0.6;
        f.x += Math.sin(f.phase) * 6 * dt;
        // Out at one edge, back in at the other.
        if (f.y > h || f.y < -f.size) {
          f.y = ((f.y % h) + h) % h;
          f.x = Math.random() * w;
        }
        g.fillStyle = `rgba(238, 244, 255, ${f.alpha})`;
        g.fillRect(Math.round(f.x * dpr), Math.round(f.y * dpr), Math.round(f.size * dpr), Math.round(f.size * dpr));
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, true);
      g.clearRect(0, 0, el.width, el.height);
    };
  }, [snow]);

  return <canvas ref={canvas} className="sd-snow" aria-hidden="true" />;
}
