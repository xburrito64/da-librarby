// Jack, the jack-o'-lantern by the app's name: a chubby pumpkin with a curly stem and a leaf, big
// carved eyes whose pupils follow the pointer, one eyebrow raised, and a snaggle-toothed grin. He blinks now and then
// (sometimes winks), laughs when you point at him, and when his candle is blown out (trick or treat,
// index.ts) his face goes dark but two little glowing eyes keep watching. See hollow.css ("The top
// bar").
import { drawPumpkin, pumpkinDefs } from "./pumpkins";

const EYE_L = "M12.2 28.4Q11.8 22.4 16.8 20.6Q20.8 22.6 20.9 28.2Q16.6 29.7 12.2 28.4Z";
const EYE_R = "M35.8 28.4Q36.2 22.4 31.2 20.6Q27.2 22.6 27.1 28.2Q31.4 29.7 35.8 28.4Z";
const GRIN = "M12.6 31.6Q24 37.2 35.4 31.6Q34 39.8 24 40.3Q14 39.8 12.6 31.6Z";
/** His eyebrows: one level, one raised (he's up to something). */
const BROWS = "M12.4 19.4Q15.8 17.4 20 18.6M28.4 17.8Q31.8 15 35.6 17.4";
const LAUGH = "M12.2 31Q24 34.6 35.8 31Q34.4 42.2 24 42.6Q13.6 42.2 12.2 31Z";

/** Jack as a picture (48 x 46). `live`: with the parts that move (for the top bar). */
export function logoSvg(live = false) {
  const p = "hl-";
  const body = drawPumpkin(p, 24, 45, { size: 40, palette: "orange", stem: "curly", extras: ["leaf"], squat: 0.8 }, { ground: false });
  const carved = (d: string) =>
    `<path d="${d}" fill="#ffb347" filter="url(#${p}soft)" opacity="0.9"/><path d="${d}" fill="none" stroke="#5a1c04" stroke-width="1.3"/><path d="${d}" fill="url(#${p}hole)" stroke="#ffd98a" stroke-width="0.5"/>`;
  const dark = (d: string) => `<path d="${d}" fill="#2a0e04" stroke="#4a1503" stroke-width="0.8"/>`;
  // An eye: the hole (carved, or dark when his candle's out) and a pupil that looks about.
  const eye = (side: "l" | "r", hole: string, pupil: string, shine: boolean) => {
    const cx = side === "l" ? 16.6 : 31.4;
    return (
      `<g class="he-logo__eye he-logo__eye--${side}">${hole}<g class="he-logo__look"><circle cx="${cx}" cy="25.6" r="1.9" fill="${pupil}"/>` +
      (shine ? `<circle cx="${cx - 0.6}" cy="24.9" r="0.6" fill="#fff6dc"/>` : "") +
      `</g></g>`
    );
  };
  const teeth = (laugh: boolean) =>
    `<g fill="#f27a1f" stroke="#5a1c04" stroke-width="0.4"><path d="M18.4 ${laugh ? 32.3 : 32.6}h2.6v2.3q-1.3 0.8-2.6 0Z"/><path d="M27.4 ${laugh ? 41.5 : 39.6}h2.4v-2.1q-1.2-0.7-2.4 0Z"/></g>`;
  return (
    `<svg ${live ? 'class="he-logo" ' : ""}xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 46" width="48" height="46">` +
    `<defs>${pumpkinDefs(p)}` +
    `<radialGradient id="${p}hole" cx="0.5" cy="0.62" r="0.7"><stop offset="0" stop-color="#fffbe2"/><stop offset="0.35" stop-color="#ffe27c"/><stop offset="0.75" stop-color="#ffaa36"/><stop offset="1" stop-color="#f06810"/></radialGradient>` +
    `<radialGradient id="${p}halo" cx="0.5" cy="0.6" r="0.5"><stop offset="0" stop-color="#ff9a3c" stop-opacity="0.45"/><stop offset="1" stop-color="#ff7518" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${p}warm" cx="0.5" cy="0.55" r="0.5"><stop offset="0" stop-color="#ffc05a" stop-opacity="0.55"/><stop offset="1" stop-color="#ff8a24" stop-opacity="0"/></radialGradient>` +
    `<filter id="${p}soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.9"/></filter></defs>` +
    // His glow, fading out well inside the picture's edges.
    `<ellipse class="he-logo__lit" cx="24" cy="30" rx="24" ry="16" fill="url(#${p}halo)"/>` +
    body +
    // Lit from inside: the skin round his face glows, and light leaks out along his lid.
    `<g class="he-logo__lit"><ellipse cx="24" cy="31" rx="15" ry="11" fill="url(#${p}warm)" style="mix-blend-mode:screen"/>` +
    `<path d="M19 14.4L21 15.6 22.6 14.9 24 16 25.4 14.9 27 15.6 29 14.4" fill="none" stroke="#ffd47a" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<g class="he-logo__brows" fill="none" stroke-linecap="round"><path d="${BROWS}" stroke="#ffb347" stroke-width="2" filter="url(#${p}soft)" opacity="0.7"/><path d="${BROWS}" stroke="#5a1c04" stroke-width="1.5"/><path d="${BROWS}" stroke="#ffe08a" stroke-width="0.7"/></g>` +
    eye("l", carved(EYE_L), "#3a1204", true) +
    eye("r", carved(EYE_R), "#3a1204", true) +
    `<g class="he-logo__grin">${carved(GRIN)}${teeth(false)}</g>` +
    (live ? `<g class="he-logo__laugh">${carved(LAUGH)}${teeth(true)}<ellipse cx="24" cy="40.2" rx="3.6" ry="1.8" fill="#ff5d73"/></g>` : "") +
    `</g>` +
    // Candle out: a dark face, but his eyes still glow a little in there.
    (live ? `<g class="he-logo__dark"><path d="${BROWS}" fill="none" stroke="#2a0e04" stroke-width="1.6" stroke-linecap="round"/>${dark(GRIN)}${eye("l", dark(EYE_L), "#ffcf5a", false)}${eye("r", dark(EYE_R), "#ffcf5a", false)}</g>` : "") +
    `</svg>`
  );
}

/** Puts the living Jack into the top bar's logo; returns how to take him out again. */
export function startLogo() {
  const spot = document.querySelector<HTMLElement>(".nav__logo");
  if (!spot) return () => {};
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  spot.insertAdjacentHTML("beforeend", logoSvg(true));
  const svg = spot.lastElementChild as SVGSVGElement;
  const looks = svg.querySelectorAll<SVGGElement>(".he-logo__look");
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  // His pupils follow the pointer.
  let frame = 0;
  let at: [number, number] | null = null;
  const look = () => {
    frame = 0;
    if (!at) return;
    const r = svg.getBoundingClientRect();
    const dx = at[0] - (r.left + r.width / 2);
    const dy = at[1] - (r.top + r.height * 0.55);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 160);
    const move = `translate(${((dx / d) * k * 1.4).toFixed(2)}px, ${((dy / d) * k * 1.1).toFixed(2)}px)`;
    looks.forEach((g) => (g.style.transform = move));
  };
  const onMove = (e: PointerEvent) => {
    at = [e.clientX, e.clientY];
    if (!frame) frame = requestAnimationFrame(look);
  };
  if (!still) window.addEventListener("pointermove", onMove, { passive: true });

  // Blinking: mostly both eyes, now and then twice, or a wink.
  const blink = () => {
    later(() => {
      const roll = Math.random();
      const cls = roll < 0.12 ? "is-winking" : "is-blinking";
      svg.classList.add(cls);
      later(() => svg.classList.remove(cls), roll < 0.12 ? 420 : 150);
      if (roll > 0.85) {
        // A double blink.
        later(() => svg.classList.add("is-blinking"), 300);
        later(() => svg.classList.remove("is-blinking"), 450);
      }
      blink();
    }, 2500 + Math.random() * 4000);
  };
  if (!still) blink();

  return () => {
    window.removeEventListener("pointermove", onMove);
    cancelAnimationFrame(frame);
    timers.forEach((t) => window.clearTimeout(t));
    svg.remove();
  };
}
