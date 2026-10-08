// The eaves along the top of the window and the string of lights hanging from them, in pixel art
// on one canvas. The string is tied to the town sign's rope and hangs from nails on the beam in
// soft loops that sway in the breeze and get tugged along when the sign swings. Pointing at a bulb
// makes it glow; clicking it plays a note (higher towards the right, like a xylophone). Running
// the pointer along a row of bulbs gets a little light show. Sometimes a bulb is burnt out (click
// it to screw it back in), and rarely the dog sits on the sign chewing the cord's knot, and the
// lights go out.
import { useEffect, useRef } from "react";
import { tone } from "../synth";
import { signAngle } from "./sign";
import { makeCap, noise } from "./snowcap";

/** Screen pixels per art pixel; the strip's height and the beam's (px). */
const PX = 2;
const BAND = 56;
const BEAM = 10;
/** Between the nails, and from the sign's corner to the first nail (px). */
const SPAN = 104;
const FIRST_SPAN = 76;
/** How far a loop hangs below its ends (px), and how many bulbs it carries. */
const SAG = 13;
const BULBS_PER_LOOP = 3;

const COLORS = ["#ff5050", "#ffe04a", "#4fd66f", "#56b8ff"];
const DEAD = "#4b4b5c";
const COAL = "#1d1d26";
const WOOD = "#7a5236";
const WOOD_DARK = "#4a2e1c";
const SNOW = "#eef4ff";
const ICE = "#c9d9f0";

// Each loop swings like a pendulum (about every 1.6 s), pulled along by its neighbours.
const STIFF = ((2 * Math.PI) / 1.6) ** 2;
const DAMP = 1.2;
const PULL = 6;
const BREEZE = 30;
/** How much the sign's corner moving tugs the first loop. */
const TUG = 5;

/** Notes: a major pentatonic scale from C5 up, a step per bulb. */
const STEPS = [0, 2, 4, 7, 9];
const NOTE_HZ = 523.25;
/** Bulbs passed in a row, quickly, for the light show. */
const SWEEP = 6;
const SWEEP_MS = 1500;
const SHOW_MS = 3600;

/** A bulb is burnt out at about one start in two; the dog comes chewing at one in twelve. */
const DEAD_CHANCE = 0.5;
const DOG_CHANCE = 1 / 12;
const DOG_AFTER_MS = [40_000, 240_000];
const DOG_STAYS_MS = 80_000;
/** The lights go out (and come back) one by one, this far apart. */
const WAVE_MS = 90;

const LINES = {
  fixed: "* You screw the bulb back in. It flickers... and stays on.",
  show: "* The lights put on a little show, just for you.",
  dog: "* The lights went out. You hear chewing.",
  dogGone: "* The dog lets go and scampers off. The lights come back on.",
};

interface Loop {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Sideways sway of the loop's lowest point (px), and its speed. */
  s: number;
  v: number;
}

/** Says something in the library's message box (LibraryView listens). */
function say(text: string) {
  window.dispatchEvent(new CustomEvent("da:say", { detail: text }));
}

/** Where an element sits on the page, ignoring its transform. */
function pageBox(el: HTMLElement) {
  let left = 0;
  let top = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
    left += e.offsetLeft;
    top += e.offsetTop;
  }
  return { left, top, width: el.offsetWidth };
}

const glows = new Map<string, HTMLCanvasElement>();
/** A soft round glow in pixel art (dotted towards the edge), drawn once per colour and size. */
function glowSprite(color: string, r: number, alpha: number) {
  const key = `${color}|${r}|${alpha}`;
  let sprite = glows.get(key);
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = sprite.height = r * 2 + 1;
    const g = sprite.getContext("2d")!;
    g.fillStyle = color;
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > r) continue;
        g.globalAlpha = alpha * (1 - d / r) * (((x + y) & 1) === 0 ? 1 : 0.65);
        g.fillRect(x + r, y + r, 1, 1);
      }
    glows.set(key, sprite);
  }
  return sprite;
}

export function Lights({ active, sounds, volume }: { active: boolean; sounds: boolean; volume: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dogEl = useRef<HTMLSpanElement>(null);
  const audio = useRef({ sounds, volume });
  audio.current = { sounds, volume };

  useEffect(() => {
    const el = canvas.current;
    if (!el || !active) return;
    const g = el.getContext("2d")!;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let loops: Loop[] = [];
    let bulbs: { x: number; y: number }[] = [];
    let pivot = { x: 0, y: 0 };
    let signTop = 0;
    let corner = { x: 0, y: 0 };
    let last = performance.now();
    let frame = 0;
    let ctx: AudioContext | null = null;
    /** How deep the snow lies on the beam, per art pixel (soft mounds, like the sign's). */
    let snowOnBeam: number[] = [];

    // What's going on with the bulbs.
    let hovered = -1;
    const flashes = new Map<number, number>();
    let dead = -2; // chosen once there are bulbs; -1 = none
    /** The bulb just screwed back in flickers for a moment. */
    let fixedBulb = -1;
    let flickerUntil = 0;
    let showFrom = 0;
    let showCooldown = 0;
    const passed: { i: number; at: number }[] = [];
    // The dog: when it starts chewing (and on which loop), and when it lets go.
    let dog: { loop: number; from: number; gone?: number } | null = null;
    let dogTimer = 0;
    let dogLeave = 0;

    const layout = () => {
      const sign = document.querySelector<HTMLElement>(".nav__brand");
      const width = window.innerWidth;
      el.width = Math.ceil(width / PX);
      el.height = BAND / PX;
      el.style.width = `${el.width * PX}px`;
      if (!sign) return;
      const box = pageBox(sign);
      // The sign hangs from the beam: its ropes end there and it swings about it.
      sign.style.setProperty("--sd-pivot", `${BEAM - box.top}px`);
      pivot = { x: box.left + box.width / 2, y: BEAM };
      signTop = box.top;
      // Tied to the sign's right rope, a third of the way down from the beam.
      corner = { x: box.left + box.width - 19.5, y: BEAM + (box.top - BEAM) * 0.33 };
      const ends = [corner];
      for (let x = corner.x + FIRST_SPAN; x < width + SPAN; x += SPAN) ends.push({ x, y: BEAM });
      const old = loops;
      loops = ends.slice(1).map((b, i) => ({ ax: ends[i].x, ay: ends[i].y, bx: b.x, by: b.y, s: old[i]?.s ?? 0, v: old[i]?.v ?? 0 }));
      if (dead === -2) dead = Math.random() < DEAD_CHANCE ? 3 + Math.floor(Math.random() * Math.max(1, loops.length * BULBS_PER_LOOP - 6)) : -1;
    };

    const chime = (notes: number[], length = 0.55, gap = 0) => {
      if (!audio.current.sounds) return;
      try {
        ctx ??= new AudioContext();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const out = ctx.createGain();
        out.gain.value = ({ quiet: 0.05, normal: 0.09, loud: 0.16 } as Record<string, number>)[audio.current.volume] ?? 0.09;
        out.connect(ctx.destination);
        notes.forEach((hz, n) => {
          tone(ctx!, out, [hz], { wave: "triangle", length, level: 0.6, delay: n * gap });
          tone(ctx!, out, [hz * 2], { wave: "sine", length: length * 0.6, level: 0.18, delay: n * gap });
        });
      } catch {
        // No audio device: stay quiet.
      }
    };
    const noteOf = (i: number) => NOTE_HZ * 2 ** ((12 * Math.floor(i / 5) + STEPS[i % 5]) / 12 - (i >= 15 ? 3 : 0));

    /** How far a bulb is from where the dog is chewing, in bulbs. */
    const fromDog = (i: number) => (dog ? Math.abs(Math.floor(i / BULBS_PER_LOOP) - dog.loop) * BULBS_PER_LOOP + (i % BULBS_PER_LOOP) : 0);
    const isDark = (i: number, now: number) => {
      if (!dog) return false;
      const out = now >= dog.from + fromDog(i) * WAVE_MS;
      const back = dog.gone != null && now >= dog.gone + fromDog(i) * WAVE_MS;
      return out && !back;
    };

    const bulbAt = (x: number, y: number) => {
      let best = -1;
      let near = 9;
      bulbs.forEach((b, i) => {
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < near) {
          near = d;
          best = i;
        }
      });
      return best;
    };

    const onMove = (e: PointerEvent) => {
      const i = e.clientY < BAND ? bulbAt(e.clientX, e.clientY) : -1;
      if (i === hovered) return;
      hovered = i;
      document.documentElement.classList.toggle("sd-on-bulb", i >= 0);
      if (i < 0) return;
      const now = performance.now();
      passed.push({ i, at: now });
      while (passed.length > SWEEP || (passed.length > 0 && now - passed[0].at > SWEEP_MS)) passed.shift();
      // Along a row of bulbs, one after another: the light show.
      const steps = passed.slice(1).map((p, n) => p.i - passed[n].i);
      if (passed.length === SWEEP && (steps.every((d) => d === 1) || steps.every((d) => d === -1)) && now > showCooldown && !dog) {
        showFrom = now;
        showCooldown = now + 30_000;
        passed.length = 0;
        chime([0, 2, 4, 5, 7, 9, 10].map((n) => noteOf(n)), 0.3, 0.09);
        say(LINES.show);
      }
    };

    const onClick = (e: MouseEvent) => {
      if (e.clientY >= BAND) return;
      const i = bulbAt(e.clientX, e.clientY);
      if (i < 0) return;
      e.stopPropagation();
      e.preventDefault();
      const now = performance.now();
      if (isDark(i, now)) return;
      if (i === dead) {
        dead = -1;
        fixedBulb = i;
        flickerUntil = now + 900;
        chime([noteOf(i)], 0.4);
        say(LINES.fixed);
        return;
      }
      flashes.set(i, now + 350);
      chime([noteOf(i)]);
    };

    const letGo = (lines: boolean) => {
      if (!dog || dog.gone != null) return;
      dog.gone = performance.now();
      dogEl.current?.classList.add("is-leaving");
      if (lines) say(LINES.dogGone);
      window.setTimeout(() => {
        dog = null;
        dogEl.current?.classList.remove("is-showing", "is-leaving");
      }, loops.length * BULBS_PER_LOOP * WAVE_MS + 600);
    };
    const onDogClick = () => letGo(true);

    if (Math.random() < DOG_CHANCE && !still) {
      const [a, b] = DOG_AFTER_MS;
      dogTimer = window.setTimeout(() => {
        if (loops.length < 4) return;
        // Not while it's napping on the sign already.
        if (document.querySelector(".sd-sign__dog")) return;
        dog = { loop: 0, from: performance.now() + 900 };
        dogEl.current?.classList.add("is-showing");
        window.setTimeout(() => dog && dog.gone == null && say(LINES.dog), 1400);
        dogLeave = window.setTimeout(() => letGo(false), DOG_STAYS_MS);
      }, a + Math.random() * (b - a));
    }

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      // The spot on the sign's rope where the string is tied moves as the sign swings.
      const angle = (signAngle() * Math.PI) / 180;
      const cx = pivot.x + (corner.x - pivot.x) * Math.cos(angle) - (corner.y - pivot.y) * Math.sin(angle);
      const cy = pivot.y + (corner.x - pivot.x) * Math.sin(angle) + (corner.y - pivot.y) * Math.cos(angle);
      if (loops[0]) {
        const moved = (cx - loops[0].ax) / Math.max(dt, 0.001);
        loops[0].ax = cx;
        loops[0].ay = cy;
        if (!still) loops[0].v += moved * TUG * dt;
      }
      if (!still)
        loops.forEach((l, i) => {
          const left = loops[i - 1]?.s ?? l.s;
          const right = loops[i + 1]?.s ?? l.s;
          const breeze = BREEZE * Math.sin(t * (0.7 + 0.13 * (i % 3)) + i * 1.9);
          const force = -STIFF * l.s - DAMP * l.v + PULL * (left - l.s) + PULL * (right - l.s) + breeze;
          l.v += force * dt;
          l.s = Math.max(-16, Math.min(16, l.s + l.v * dt));
        });

      g.clearRect(0, 0, el.width, el.height);
      // The beam: snow lying on top, planks of wood with seams and a dark underside, and
      // icicles hanging from it.
      const beam = BEAM / PX;
      g.fillStyle = WOOD;
      g.fillRect(0, 1, el.width, beam - 2);
      g.fillStyle = WOOD_DARK;
      g.fillRect(0, beam - 1, el.width, 1);
      for (let x = 0; x < el.width; x++) {
        if (noise(Math.floor(x / 37) + 50) < 0.5 && x % 37 === 0) g.fillRect(x, 2, 1, beam - 3);
        if (noise(x + 60) < 0.06) g.fillRect(x, 2 + Math.floor(noise(x + 61) * 2), 2, 1);
      }
      g.fillStyle = SNOW;
      if (snowOnBeam.length !== el.width) snowOnBeam = makeCap(el.width, 99).full.map((h) => Math.max(1, Math.round(h / 2)));
      snowOnBeam.forEach((h, x) => g.fillRect(x, 0, 1, h));
      g.fillStyle = ICE;
      for (let x = 0; x < el.width; x++) {
        const n = noise(x + 900);
        if (n < 0.09) g.fillRect(x, beam, 1, 1 + Math.floor(n * 33));
      }

      // The string: a soft loop between each pair of ends, with its bulbs.
      bulbs = [];
      const lit: { x: number; y: number; i: number }[] = [];
      loops.forEach((l, li) => {
        const midX = (l.ax + l.bx) / 2 + l.s * 1.6;
        const ctrlY = Math.max(l.ay, l.by) + 2 * SAG - Math.abs(l.s) * 0.5;
        const at = (u: number) => ({
          x: (1 - u) ** 2 * l.ax + 2 * (1 - u) * u * midX + u * u * l.bx,
          y: (1 - u) ** 2 * l.ay + 2 * (1 - u) * u * ctrlY + u * u * l.by,
        });
        g.fillStyle = COAL;
        const steps = Math.ceil(Math.hypot(l.bx - l.ax, l.by - l.ay) / PX) * 2;
        for (let k = 0; k <= steps; k++) {
          const p = at(k / steps);
          g.fillRect(Math.round(p.x / PX), Math.round(p.y / PX), 1, 1);
        }
        g.fillStyle = COAL;
        g.fillRect(Math.round(l.bx / PX), BEAM / PX - 1, 1, 1);
        for (let b = 0; b < BULBS_PER_LOOP; b++) {
          const i = li * BULBS_PER_LOOP + b;
          const p = at((b + 1) / (BULBS_PER_LOOP + 1));
          const x = Math.round(p.x / PX);
          const y = Math.round(p.y / PX);
          bulbs.push({ x: x * PX + 1, y: (y + 3) * PX });
          const flicker = i === fixedBulb && now < flickerUntil && Math.floor(now / 90) % 2 === 0;
          const off = i === dead || isDark(i, now) || flicker;
          lit.push({ x, y, i: off ? -1 - i : i });
        }
      });

      // Glows first, then the bulbs over them.
      for (const b of lit) {
        if (b.i < 0) continue;
        const color = COLORS[b.i % COLORS.length];
        const twinkle = still || (b.i + Math.floor(t / 1.3)) % 2 === 0;
        const show = now - showFrom < SHOW_MS && Math.abs(((b.i - (now - showFrom) / 55) % 9) + 9) % 9 < 2;
        const bright = b.i === hovered || (flashes.get(b.i) ?? 0) > now || show;
        const glow = bright ? glowSprite(color, 6, 0.6) : glowSprite(color, twinkle ? 4 : 3, twinkle ? 0.32 : 0.16);
        g.drawImage(glow, b.x - (glow.width - 1) / 2, b.y + 3 - (glow.width - 1) / 2);
      }
      for (const b of lit) {
        const on = b.i >= 0;
        const i = on ? b.i : -1 - b.i;
        g.fillStyle = COAL;
        g.fillRect(b.x - 1, b.y + 1, 2, 1);
        g.fillStyle = on ? COLORS[i % COLORS.length] : DEAD;
        g.fillRect(b.x - 1, b.y + 2, 2, 3);
        if (on) {
          g.fillStyle = "rgba(255, 255, 255, 0.65)";
          g.fillRect(b.x - 1, b.y + 2, 1, 1);
        }
      }

      // The dog sits on the sign, gnawing at the string's knot on the rope above it.
      if (dog && dogEl.current) {
        const top = pivot.y + (corner.x - pivot.x) * Math.sin(angle) + (signTop - pivot.y) * Math.cos(angle);
        dogEl.current.style.transform = `translate(${cx - 30}px, ${top - 27}px) rotate(${signAngle()}deg)`;
      }
      frame = requestAnimationFrame(draw);
    };
    layout();
    const sign = document.querySelector<HTMLElement>(".nav__brand");
    const resized = new ResizeObserver(layout);
    if (sign) resized.observe(sign);
    window.addEventListener("resize", layout);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("click", onClick, true);
    const dogNode = dogEl.current;
    dogNode?.addEventListener("click", onDogClick);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(dogTimer);
      window.clearTimeout(dogLeave);
      resized.disconnect();
      window.removeEventListener("resize", layout);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("click", onClick, true);
      dogNode?.removeEventListener("click", onDogClick);
      document.documentElement.classList.remove("sd-on-bulb");
      ctx?.close().catch(() => {});
    };
  }, [active]);

  return (
    <>
      <canvas ref={canvas} className="sd-lights" aria-hidden="true" />
      <span ref={dogEl} className="sd-lights__dog" title="The dog" />
    </>
  );
}
