// The rare moments among the falling leaves (leaves.ts): one every minute or so, picked at random
// from what there is to see right now.
// - A gust of wind sweeps a swirl of leaves across the window (tearing the hanging ones off the
//   branch and setting the spider swinging), with a whoosh.
// - A little whirlwind lifts leaves off the pumpkin patch, spins them up and scatters them.
// - A dark leaf turns out to be a bat (or a pale one, a moth) and flaps away.
// - A golden leaf, glowing and shedding sparkles: click it before it's gone and it bursts.
// - Leaves land on things: one comes to rest by a pumpkin's stem (until the wind or a bonk takes
//   it), one gets caught on the spider's thread for a moment, one the black cat watches all the way
//   down, and one lands on Jack's head, who looks up at it and blows it away.
import { playSound } from "../sound";
import type { Depth, Leaf, Look } from "./leaves";
import { spiderNow } from "./spider";

/** A rare moment every so often (s); the first one a little sooner. */
const EVERY = [45, 100];
const FIRST = [25, 50];
/** The gust: how long (s), how strong at its height (px/s), how many leaves it brings. */
const GUST_S = 6;
const GUST_WIND = 240;
const GUST_LEAVES = [16, 21];

/** What the moments need from the leaves. */
export interface Field {
  w: number;
  h: number;
  /** Where the canvas over the top bar ends (px from the top). */
  line: number;
  /** The leaves that come and go (a moment's leaves join them). */
  extra: Leaf[];
  /** A new leaf, just above the window. */
  spawn: (depth: Depth, size?: number, look?: Look) => Leaf;
  flick: (l: Leaf, fromX: number, fromY: number) => void;
  draw: (g: CanvasRenderingContext2D, l: Leaf) => void;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fall: number;
  life: number;
  max: number;
  size: number;
}

interface Critter {
  kind: "bat" | "moth";
  x: number;
  y: number;
  t: number;
  dir: number;
  seed: number;
  /** The leaf it was, folding away as it unfolds. */
  leaf: Leaf;
}

const between = ([a, b]: number[]) => a + Math.random() * (b - a);
const side = () => (Math.random() < 0.5 ? -1 : 1);
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** Whether a box is well inside the window, below the top bar. */
function inView(r: DOMRect, f: Field, margin = 20) {
  return r.width > 0 && r.top > f.line + margin && r.bottom < f.h - margin && r.left > margin && r.right < f.w - margin;
}

// ---------- Drawing the bat and the moth ----------

/** A bat, `s` times its size (about 28 px wingspan), wings `open` (0..1) and flapping (`flap` -1..1),
 *  facing `dir`. */
function drawBat(g: CanvasRenderingContext2D, x: number, y: number, s: number, open: number, flap: number, dir: number) {
  g.save();
  g.translate(x, y);
  g.scale(s * dir, s);
  g.fillStyle = "#1a0f22";
  g.strokeStyle = "#8a74b8";
  g.lineWidth = 0.75;
  g.lineJoin = "round";
  for (const k of [-1, 1]) {
    // A wing: its leading edge out to the tip, then scalloped back between the fingers.
    const tx = k * 13 * open;
    const ty = -1 - 7 * flap * open;
    g.beginPath();
    g.moveTo(k * 1.5, -1.5);
    g.quadraticCurveTo(k * 6 * open, -4 - 5 * flap * open, tx, ty);
    const ex = k * 1.5;
    const ey = 2.5;
    for (let i = 1; i <= 3; i++) {
      const px = tx + ((ex - tx) * i) / 3;
      const py = ty + ((ey - ty) * i) / 3 + (i < 3 ? 1.5 * open : 0);
      const cx = tx + ((ex - tx) * (i - 0.5)) / 3;
      const cy = ty + ((ey - ty) * (i - 0.5)) / 3 - 1.2 * open;
      g.quadraticCurveTo(cx, cy, px, py);
    }
    g.closePath();
    g.fill();
    g.stroke();
  }
  // Body, head and ears.
  g.beginPath();
  g.ellipse(0, 0.6, 2.2, 3.4, 0, 0, Math.PI * 2);
  g.stroke();
  g.fill();
  g.beginPath();
  g.moveTo(-2, -3.6);
  g.lineTo(-1.6, -6.6);
  g.lineTo(-0.4, -4.8);
  g.lineTo(0.4, -4.8);
  g.lineTo(1.6, -6.6);
  g.lineTo(2, -3.6);
  g.arc(0, -3, 2.2, -0.3, Math.PI + 0.3);
  g.closePath();
  g.stroke();
  g.fill();
  // Little glowing eyes.
  g.fillStyle = "#ffcf5a";
  g.beginPath();
  g.arc(-0.8, -3.1, 0.45, 0, Math.PI * 2);
  g.arc(0.8, -3.1, 0.45, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** A pale moth, wings `open` (0..1), beating (`beat` 0..1, how far out they are). */
function drawMoth(g: CanvasRenderingContext2D, x: number, y: number, s: number, open: number, beat: number, dir: number) {
  g.save();
  g.translate(x, y);
  g.scale(s * dir, s);
  for (const k of [-1, 1]) {
    g.save();
    g.scale(k * (0.25 + 0.75 * beat) * open, 1);
    g.fillStyle = "#c9b48a";
    g.beginPath();
    g.ellipse(5, -1.6, 6, 3.3, -0.45, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#b39c72";
    g.beginPath();
    g.ellipse(3.8, 2.4, 4, 2.8, 0.45, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#7d6a4c";
    g.beginPath();
    g.arc(6.2, -2.2, 1.1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.fillStyle = "#5e4a36";
  g.beginPath();
  g.ellipse(0, 0.5, 1.2, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#5e4a36";
  g.lineWidth = 0.5;
  g.beginPath();
  g.moveTo(-0.4, -3.2);
  g.quadraticCurveTo(-1.6, -6, -3, -6.6);
  g.moveTo(0.4, -3.2);
  g.quadraticCurveTo(1.6, -6, 3, -6.6);
  g.stroke();
  g.restore();
}

export function startMoments() {
  let next = between(FIRST);
  let clock = 0;
  let gust: { t: number; dir: number; spawns: number[]; tore: boolean } | null = null;
  let whirl: { at: () => [number, number] | null; t: number; dur: number; drift: number; dir: number } | null = null;
  let sparks: Spark[] = [];
  let critters: Critter[] = [];
  let cat: { leaf: Leaf; el: Element; eyes: Element; look: SVGGElement } | null = null;
  let jack: { leaf: Leaf; blown: boolean } | null = null;
  const later: { at: number; fn: () => void }[] = [];
  const jackSays = (detail: { watch?: [number, number] | null; blow?: boolean }) => window.dispatchEvent(new CustomEvent("he:jack-leaf", { detail }));

  /** Sparkles: a few shed by a golden leaf, or a burst of them. */
  const sparkle = (x: number, y: number, n: number, burst: boolean) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = burst ? 40 + Math.random() * 140 : Math.random() * 8;
      const life = burst ? 0.7 + Math.random() * 0.8 : 0.7 + Math.random() * 0.6;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (burst ? 30 : -10), fall: burst ? 90 : 15, life, max: life, size: burst ? 1.5 + Math.random() * 1.6 : 1 + Math.random() * 1.1 });
    }
  };

  /** A bat (or moth) leaf unfolds into one and flies off. */
  const unfold = (l: Leaf) => {
    if (!l.critter) return;
    critters.push({ kind: l.critter, x: l.x, y: l.y, t: 0, dir: side(), seed: Math.random() * 10, leaf: { ...l } });
    if (l.critter === "bat") playSound("flutter");
    l.critter = undefined;
    l.y = Infinity;
  };

  const MOMENTS: Record<string, { weight: number; can: (f: Field) => boolean; run: (f: Field) => void }> = {
    gust: {
      weight: 2,
      can: () => !gust,
      run: () => {
        const n = Math.round(between(GUST_LEAVES));
        gust = { t: 0, dir: side(), spawns: Array.from({ length: n }, () => 0.1 + Math.random() * 1.8).sort((a, b) => a - b), tore: false };
        playSound("gust");
      },
    },
    whirl: {
      weight: 2,
      can: (f) => !whirl && patch(f) !== null,
      run: (f) => {
        const at = patch(f);
        if (!at) return;
        const dur = 4.6 + Math.random() * 1.4;
        const w = { at, t: 0, dur, drift: 0, dir: side() };
        whirl = w;
        playSound("whirl");
        const n = 7 + Math.floor(Math.random() * 4);
        const turn = side() * (4 + Math.random() * 1.5);
        for (let i = 0; i < n; i++) {
          const l = f.spawn("mid", 6.5 + Math.random() * 3.5);
          const delay = i * 0.22 + Math.random() * 0.15;
          const top = 45 + Math.random() * 70;
          let angle = Math.random() * Math.PI * 2;
          l.show = 0;
          // Lifted off the ground and spun round and up, wider the higher it gets, the ones round
          // the back a little dimmer; scattered when it dies down.
          l.rest = (l, dt) => {
            const base = w.at();
            if (!base) return false;
            const t = w.t - delay;
            if (t < 0) return true;
            const rise = top * (1 - Math.exp(-t * 0.9));
            const r = 6 + rise * 0.35;
            if (w.t > w.dur) {
              l.kickX = -Math.sin(angle) * turn * r * 1.2 + w.dir * 30;
              l.kickY = -60 - Math.random() * 70;
              l.tumbleLeft = 0.6;
              l.tumbleSpin = turn * 1.5;
              return false;
            }
            angle += turn * dt;
            l.x = base[0] + w.drift + r * Math.cos(angle);
            l.y = base[1] - 4 - rise;
            l.show = Math.min(1, t / 0.4) * (0.72 + 0.28 * Math.sin(angle));
            l.heading += turn * 0.7 * dt;
            l.flip += 6 * dt;
            l.rock = 0;
            return true;
          };
          f.extra.push(l);
        }
      },
    },
    critter: {
      weight: 2,
      can: () => critters.length === 0,
      run: (f) => {
        const bat = Math.random() < 0.7;
        const l = f.spawn("mid", 10.5 + Math.random() * 1.5, bat ? { kind: "elm", color: "#7a3418" } : { kind: "plain", color: "#a8946c" });
        l.critter = bat ? "bat" : "moth";
        l.reveal = 2.2 + Math.random() * 1.6;
        l.x = f.w * (0.15 + Math.random() * 0.7);
        f.extra.push(l);
      },
    },
    gold: {
      weight: 1,
      can: (f) => !f.extra.some((l) => l.gold),
      run: (f) => {
        const l = f.spawn("mid", 13 + Math.random() * 1.5, { kind: "maple", gold: true });
        // Slow and floaty, so there's time to catch it.
        l.fall = 13 + Math.random() * 4;
        l.swing = 30 + Math.random() * 10;
        l.lift = (0.8 * l.fall) / l.speed;
        l.alpha = 1;
        l.x = f.w * (0.15 + Math.random() * 0.7);
        f.extra.push(l);
      },
    },
    pumpkin: {
      weight: 2,
      can: (f) => pumpkinStems(f).length > 0,
      run: (f) => {
        const stems = pumpkinStems(f);
        if (stems.length === 0) return;
        const stem = stems[Math.floor(Math.random() * stems.length)];
        const pumpkin = stem.closest(".he-pumpkin")!;
        const k = side();
        const l = f.spawn("mid", 7.5 + Math.random() * 2);
        l.alpha = 1;
        const at = (): [number, number] | null => {
          if (!stem.isConnected) return null;
          const r = stem.getBoundingClientRect();
          return r.width ? [r.left + r.width / 2 + k * (r.width / 2 + l.size * 0.62), r.bottom - 1.5] : null;
        };
        const to = at()!;
        l.x = to[0] + (Math.random() - 0.5) * 120;
        l.aim = {
          at,
          then: () => {
            // It rests there, stalk to the stem, its tip drooping, until a breeze picks it up again
            // (or the pumpkin is bonked, or it's clicked).
            let left = 40 + Math.random() * 45;
            let t = 0;
            l.rest = (l, dt) => {
              const p = at();
              if (!p) return false;
              t += dt;
              left -= dt;
              if (pumpkin.matches(".is-wobbly, .is-poked") || left <= 0) {
                f.flick(l, l.x - k * 8, l.y + 12);
                return false;
              }
              [l.x, l.y] = p;
              l.heading = k * (Math.PI / 2 + 0.32) + 0.04 * Math.sin(t * 1.3);
              l.rock = 0;
              l.flip = 0;
              l.phase = 0;
              return true;
            };
          },
        };
        f.extra.push(l);
      },
    },
    spider: {
      weight: 1.5,
      can: () => spiderNow.ready && spiderNow.len > 18,
      run: (f) => {
        const along = 0.35 + Math.random() * 0.15;
        const at = (): [number, number] | null => {
          if (!spiderNow.ready) return null;
          const d = spiderNow.len * along;
          return [spiderNow.x - Math.sin(spiderNow.angle) * d, spiderNow.y + Math.cos(spiderNow.angle) * d];
        };
        const to = at();
        if (!to) return;
        const l = f.spawn("mid", 7.5 + Math.random() * 1.5);
        l.high = true;
        l.alpha = 1;
        l.x = to[0] + (Math.random() - 0.5) * 50;
        l.aim = {
          at,
          then: () => {
            // Stuck across the silk: it swings with the thread, wriggles, and after a few seconds
            // works loose (or drops at once if the spider scurries off).
            spiderNow.nudge(side() * 0.7);
            let t = 0;
            const stay = 3.5 + Math.random() * 1.5;
            const lie = side() * (Math.PI / 2 + 0.25 + Math.random() * 0.3);
            l.rest = (l, dt) => {
              const p = at();
              t += dt;
              if (!p || t > stay) return false;
              l.heading = lie + 0.35 * Math.sin(t * 7) * Math.exp(-t * 1.1) + 0.06 * Math.sin(t * 1.9) + spiderNow.angle;
              l.flip = 0.25 * Math.sin(t * 2);
              l.rock = 0;
              l.phase = 0;
              [l.x, l.y] = p;
              return true;
            };
          },
        };
        f.extra.push(l);
      },
    },
    cat: {
      weight: 1.5,
      can: (f) => !cat && catHere(f) !== null,
      run: (f) => {
        const found = catHere(f);
        if (!found) return;
        const { el, eyes, look } = found;
        const k = side();
        const at = (): [number, number] | null => {
          if (!eyes.isConnected) return null;
          const r = eyes.getBoundingClientRect();
          return [r.left + r.width / 2 + k * 28, r.top + r.height / 2];
        };
        const l = f.spawn("mid", 9 + Math.random() * 2);
        l.x = at()![0] + (Math.random() - 0.5) * 60;
        // Falls right past its nose, and on down.
        l.aim = { at, then: () => {} };
        f.extra.push(l);
        cat = { leaf: l, el, eyes, look };
      },
    },
    jack: {
      weight: 1.5,
      can: () => !jack && !document.documentElement.classList.contains("he-jack-out") && document.querySelector(".nav__logo .he-logo") !== null,
      run: (f) => {
        const svg = document.querySelector(".nav__logo .he-logo");
        if (!svg) return;
        const at = (): [number, number] | null => {
          if (!svg.isConnected) return null;
          const r = svg.getBoundingClientRect();
          return r.width ? [r.left + r.width * 0.67, r.top + r.height * 0.29] : null;
        };
        // (A yellow one, so it shows up on him.)
        const l = f.spawn("mid", 7 + Math.random() * 0.6, { kind: "birch", color: "#e8c04a" });
        l.high = true;
        l.alpha = 1;
        l.x = at()![0] + 20 + Math.random() * 50;
        const j = { leaf: l, blown: false };
        jack = j;
        l.aim = {
          at,
          then: () => {
            // On his head: he looks up at it, puffs his cheeks, and blows it off.
            let t = 0;
            jackSays({ watch: [l.x, l.y] });
            l.rest = (l, dt) => {
              const p = at();
              if (!p) return false;
              t += dt;
              [l.x, l.y] = p;
              l.heading = Math.PI / 2 + 0.3;
              l.rock = 0;
              l.flip = 0;
              l.phase = 0;
              if (t > 2.2 && !j.blown) {
                j.blown = true;
                jackSays({ blow: true });
              }
              if (t > 2.38) {
                f.flick(l, l.x - 12, l.y + 14);
                playSound("snuff");
                later.push({ at: clock + 0.9, fn: () => jackSays({ watch: null }) });
                return false;
              }
              return true;
            };
          },
        };
        f.extra.push(l);
      },
    },
  };

  /** The ground of a pumpkin patch (or graveyard) in view, at a spot along it: where it is now. */
  function patch(f: Field): (() => [number, number] | null) | null {
    for (const svg of document.querySelectorAll<SVGSVGElement>(".he-scene__svg:not(.he-grass)")) {
      const m = svg.getScreenCTM();
      if (!m) continue;
      const sx = new DOMPoint(f.w * (0.3 + Math.random() * 0.5), 0).matrixTransform(m.inverse()).x;
      const at = (): [number, number] | null => {
        const now = svg.isConnected ? svg.getScreenCTM() : null;
        if (!now) return null;
        const p = new DOMPoint(sx, 304).matrixTransform(now);
        return [p.x, p.y];
      };
      const p = at();
      if (p && p[1] > f.line + 140 && p[1] < f.h - 20) return at;
    }
    return null;
  }

  function pumpkinStems(f: Field) {
    return [...document.querySelectorAll<SVGGElement>(".he-pumpkin__stem")].filter((s) => {
      if (s.closest(".nav__logo")) return false;
      const r = s.getBoundingClientRect();
      return r.width > 2 && inView(r, f, 40);
    });
  }

  function catHere(f: Field) {
    const el = document.querySelector(".he-cat");
    const eyes = el?.querySelector(".he-cat__eyes");
    const look = el?.querySelector<SVGGElement>(".he-cat__look");
    if (!el || !eyes || !look || !inView(el.getBoundingClientRect(), f, 60)) return null;
    return { el, eyes, look };
  }

  const run = (name: string, f: Field) => {
    const m = MOMENTS[name];
    if (m && m.can(f)) m.run(f);
  };

  return {
    /** The gust's wind, on top of the breeze (px/s, to the right). */
    wind() {
      if (!gust) return 0;
      const u = gust.t / GUST_S;
      // Up quickly, dying down slowly.
      const e = u < 0.3 ? Math.sin((Math.PI / 2) * (u / 0.3)) ** 2 : Math.cos((Math.PI / 2) * ((u - 0.3) / 0.7)) ** 2;
      return gust.dir * GUST_WIND * e;
    },
    step(f: Field, dt: number, shift: number) {
      clock += dt;
      for (let i = later.length - 1; i >= 0; i--)
        if (later[i].at <= clock) {
          later[i].fn();
          later.splice(i, 1);
        }
      // Time for something?
      next -= dt;
      if (next <= 0) {
        next = between(EVERY);
        const can = Object.entries(MOMENTS).filter(([, m]) => m.can(f));
        let roll = Math.random() * can.reduce((n, [, m]) => n + m.weight, 0);
        for (const [, m] of can) {
          roll -= m.weight;
          if (roll <= 0) {
            m.run(f);
            break;
          }
        }
      }

      if (gust) {
        const gs = gust;
        gs.t += dt;
        // Its leaves come in from upwind, all along the side.
        while (gs.spawns.length > 0 && gs.spawns[0] <= gs.t) {
          gs.spawns.shift();
          const l = f.spawn(Math.random() < 0.3 ? "far" : "mid");
          l.x = gs.dir > 0 ? -30 : f.w + 30;
          l.y = f.h * (0.05 + Math.random() * 0.7);
          l.kickX = gs.dir * (120 + Math.random() * 120);
          f.extra.push(l);
        }
        if (!gs.tore && gs.t > 1.2) {
          gs.tore = true;
          for (const l of f.extra) if (l.hang) l.hang.left = l.hang.age;
          spiderNow.nudge(gs.dir * 1.6);
        }
        if (gs.t > GUST_S) gust = null;
      }

      if (whirl) {
        whirl.t += dt;
        whirl.drift += whirl.dir * 14 * dt;
        if (whirl.t > whirl.dur + 0.8) whirl = null;
      }

      // Golden leaves shed sparkles; bats and moths in disguise unfold when it's time.
      for (const l of f.extra) {
        if (l.gold && l.y > 0 && Math.random() < dt * 7) sparkle(l.x + (Math.random() - 0.5) * l.size * 1.6, l.y + (Math.random() - 0.5) * l.size * 1.6, 1, false);
        if (l.critter && l.y > 0) {
          l.reveal = (l.reveal ?? 0) - dt;
          if ((l.reveal <= 0 && l.y > f.line + 30) || l.y > f.h * 0.7) unfold(l);
        }
      }

      for (const c of critters) {
        c.t += dt;
        c.y -= shift;
        if (c.t < 0.4) continue;
        const u = c.t - 0.4;
        if (c.kind === "bat") {
          const k = Math.min(1, u / 0.8);
          c.x += c.dir * (40 + 180 * k) * dt;
          c.y += (-30 - 120 * k + 70 * Math.sin(u * 6)) * dt;
        } else {
          c.x += (c.dir * 45 + 60 * Math.sin(u * 2.3 + c.seed)) * dt;
          c.y += (-40 + 70 * Math.sin(u * 3.7 + c.seed * 2)) * dt;
        }
      }
      critters = critters.filter((c) => c.x > -50 && c.x < f.w + 50 && c.y > -50 && c.t < 25);

      for (const s of sparks) {
        s.life -= dt;
        s.vy += s.fall * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt - shift;
        s.vx *= Math.exp(-dt * 2);
      }
      sparks = sparks.filter((s) => s.life > 0);

      // The cat watching its leaf go by: wide eyes, pupils following it.
      if (cat) {
        const { leaf, el, eyes, look } = cat;
        const r = eyes.getBoundingClientRect();
        const ex = r.left + r.width / 2;
        const ey = r.top + r.height / 2;
        const gone = !eyes.isConnected || !f.extra.includes(leaf) || leaf.y > ey + 260;
        const dx = leaf.x - ex;
        const dy = leaf.y - ey;
        const d = Math.hypot(dx, dy) || 1;
        const watching = !gone && d < 330;
        el.classList.toggle("is-watching", watching);
        look.style.transform = watching ? `translate(${((dx / d) * 0.95).toFixed(2)}px, ${((dy / d) * 0.6).toFixed(2)}px)` : "";
        if (gone) cat = null;
      }
      // A leaf on Jack's head clicked away before he could blow: he stops looking at it.
      if (jack && !jack.blown && !jack.leaf.aim && !jack.leaf.rest) {
        jackSays({ watch: null });
        jack = null;
      }
      if (jack?.blown && !jack.leaf.rest) jack = null;
    },
    draw(g: CanvasRenderingContext2D, f: Field) {
      // The whirlwind: faint wisps of air turning round it.
      if (whirl) {
        const base = whirl.at();
        const env = Math.max(0, Math.min(1, whirl.t / 0.8, (whirl.dur + 0.8 - whirl.t) / 0.8));
        if (base && env > 0) {
          g.save();
          g.lineCap = "round";
          for (let i = 0; i < 4; i++) {
            const hgt = 10 + i * 24;
            const r = 8 + hgt * 0.38;
            const a = whirl.t * (5 - i * 0.6) + i * 1.7;
            g.strokeStyle = `rgba(214, 200, 255, ${0.16 * env})`;
            g.lineWidth = 1.2;
            g.beginPath();
            g.ellipse(base[0] + whirl.drift, base[1] - 4 - hgt, r, r * 0.22, 0, a, a + 2.2);
            g.stroke();
          }
          g.restore();
        }
      }
      // Bats and moths: unfolding from their leaf, then flying off.
      for (const c of critters) {
        const open = easeOut(c.t / 0.4);
        if (open < 1) {
          const ghost = c.leaf;
          ghost.show = 1 - open;
          ghost.flip = (open * Math.PI) / 2;
          f.draw(g, ghost);
        }
        if (c.kind === "bat") drawBat(g, c.x, c.y, 1.15, open, c.t < 0.4 ? 0.3 : Math.sin(c.t * Math.PI * 2 * 7), c.dir);
        else drawMoth(g, c.x, c.y, 1, open, Math.abs(Math.cos(c.t * Math.PI * 2 * 8)), c.dir);
      }
      // Sparkles: little four-pointed stars, twinkling as they fade.
      if (sparks.length > 0) {
        g.save();
        g.globalCompositeOperation = "lighter";
        for (const s of sparks) {
          const a = s.life / s.max;
          const r = s.size * (0.7 + 0.3 * Math.sin(s.life * 25 + s.x));
          g.fillStyle = `rgba(255, 196, 80, ${0.25 * a})`;
          g.beginPath();
          g.arc(s.x, s.y, r * 2.4, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = `rgba(255, 236, 160, ${a})`;
          g.beginPath();
          g.moveTo(s.x, s.y - r * 2);
          g.quadraticCurveTo(s.x, s.y, s.x + r * 2, s.y);
          g.quadraticCurveTo(s.x, s.y, s.x, s.y + r * 2);
          g.quadraticCurveTo(s.x, s.y, s.x - r * 2, s.y);
          g.quadraticCurveTo(s.x, s.y, s.x, s.y - r * 2);
          g.fill();
        }
        g.restore();
      }
    },
    /** A leaf was clicked: if it's a golden one it bursts into sparkles, if it's a bat or moth it
     *  gives itself away (true: handled here). */
    clicked(l: Leaf) {
      if (l.gold) {
        sparkle(l.x, l.y, 40, true);
        l.y = Infinity;
        playSound("treat");
        return true;
      }
      if (l.critter) {
        unfold(l);
        return true;
      }
      return false;
    },
    run,
    stop() {
      if (cat) {
        cat.el.classList.remove("is-watching");
        cat.look.style.transform = "";
      }
      if (jack) jackSays({ watch: null });
    },
  };
}
