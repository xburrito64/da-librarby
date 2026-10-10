// Autumn leaves drifting down over the library, falling the way real leaves do: gliding sideways
// tilted, slowing and lifting a little at the end of each swing, tipping over and gliding back the
// other way (now and then tumbling for a moment before they catch the air again), all pushed by one
// slowly changing breeze. Three depths: small dim ones far away, the usual ones, and now and then a
// big blurry one passing close by. Some come off the branch in the top bar: they wiggle a moment and
// break loose. Each leaf is painted once (a maple, oak, birch, elm or plain one, its colour shading
// from stalk to tip, veins, sometimes spots, a nibbled hole or a curled edge, the moon on its rim and
// a darker back) and then turned and tilted as it falls. Click one and it's flicked away, spinning,
// with a quiet rustle. Now and then something rare happens among them (moments.ts). They belong to
// the page: scrolling moves them along with everything else. In front of the pages, under the top bar and dialogs; the ones
// off the branch start over the top bar (a second canvas). See hollow.css (".he-leaves").
import { playSound } from "../sound";
import { perches } from "./branch";
import { startMoments, type Field } from "./moments";

/** One leaf per this many square pixels of window (not counting the near ones and the branch's). */
const AREA_PER_LEAF = 54000;
/** How many of them are far away. */
const FAR_SHARE = 0.45;
/** A leaf comes off the branch every so often (s), at most this many hanging at once. */
const BRANCH_EVERY = [7, 16];
const MAX_HANGING = 2;
/** A big one passes close by every so often (s). */
const NEAR_EVERY = [18, 40];

type Kind = "maple" | "oak" | "birch" | "elm" | "plain";
export type Depth = "far" | "mid" | "near";
/** What a leaf looks like, when it isn't up to chance: its kind and colour, or golden. */
export interface Look {
  kind?: Kind;
  color?: string;
  gold?: boolean;
}

const KINDS: Kind[] = ["maple", "maple", "oak", "oak", "birch", "elm", "plain"];
const COLORS: Record<Kind, string[]> = {
  maple: ["#c4501a", "#b8361a", "#d9822b", "#a8321a", "#e06a24"],
  oak: ["#8a4a12", "#7a3f14", "#9a5a1a", "#6e3a14", "#a0661e"],
  birch: ["#e0a03a", "#d9b23a", "#c98a22", "#e8b84a"],
  elm: ["#b8621b", "#c47a22", "#9a5a1a", "#ad6a1c"],
  plain: ["#d9822b", "#c4501a", "#7a2e10", "#b8621b"],
};

const DEPTHS: Record<Depth, { size: [number, number]; fall: [number, number]; swing: [number, number]; alpha: number; wind: number; tumble: number }> = {
  far: { size: [4.5, 6.5], fall: [11, 17], swing: [8, 16], alpha: 0.6, wind: 0.6, tumble: 0.02 },
  mid: { size: [7.5, 13], fall: [20, 32], swing: [16, 34], alpha: 0.88, wind: 1, tumble: 0.03 },
  near: { size: [22, 30], fall: [120, 160], swing: [40, 70], alpha: 0.9, wind: 1.5, tumble: 0.05 },
};

const between = ([a, b]: [number, number] | number[]) => a + Math.random() * (b - a);
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** Mixes two "#rrggbb" colours (k of the way from a to b). */
function mix(a: string, b: string, k: number) {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
}

// ---------- Painting a leaf ----------

/** A maple leaf's outline (five points), in a box from -1 to 1, the stalk at the bottom. */
const MAPLE = [
  [0, -1], [0.18, -0.55], [0.55, -0.72], [0.45, -0.3], [0.95, -0.2], [0.55, 0.12], [0.7, 0.45], [0.2, 0.32],
  [0.06, 0.62], [0, 0.7], [-0.06, 0.62], [-0.2, 0.32], [-0.7, 0.45], [-0.55, 0.12], [-0.95, -0.2], [-0.45, -0.3],
  [-0.55, -0.72], [-0.18, -0.55],
];

/** The leaves with a middle vein: how wide they are and where. */
const SHAPES: Record<Exclude<Kind, "maple">, { width: number; widest: number; teeth: number; lobes?: boolean; lopsided?: boolean }> = {
  oak: { width: 0.64, widest: 0.8, teeth: 0, lobes: true },
  birch: { width: 0.6, widest: 1.4, teeth: 0.035 },
  elm: { width: 0.56, widest: 1.2, teeth: 0.03, lopsided: true },
  plain: { width: 0.55, widest: 1, teeth: 0 },
};
/** From the tip (t 0, y -1) to where the stalk starts (t 1, y 0.85). */
const yAt = (t: number) => -1 + 1.85 * t;

/** The leaf's outline and veins (in its -1..1 box), and how far out its edge is at a height. */
function shape(kind: Kind, lobe: number) {
  const path = new Path2D();
  const veins = new Path2D();
  if (kind === "maple") {
    MAPLE.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();
    for (const [x, y] of [[0, -1], [0.95, -0.2], [-0.95, -0.2], [0.7, 0.45], [-0.7, 0.45]]) {
      veins.moveTo(0, 0.55);
      veins.lineTo(x * 0.85, y * 0.85 + 0.55 * 0.15);
    }
    return { path, veins, edge: () => 0.7, stalk: 0.62 };
  }
  const s = SHAPES[kind];
  const half = (t: number, side: number) => {
    const tt = s.lopsided && side < 0 ? t * 1.08 : t;
    if (tt >= 1 || tt <= 0) return 0;
    let w = s.width * Math.sin(Math.PI * tt ** s.widest) ** 0.9;
    if (s.lobes) w *= 0.45 + 0.55 * Math.abs(Math.sin(Math.PI * (3.5 * tt + lobe)));
    return w;
  };
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const w = half(t, 1);
    const x = w + (w > 0.05 && i % 2 ? s.teeth : 0);
    if (i === 0) path.moveTo(x, yAt(t));
    else path.lineTo(x, yAt(t));
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const w = half(t, -1);
    path.lineTo(-(w + (w > 0.05 && i % 2 ? s.teeth : 0)), yAt(t));
  }
  path.closePath();
  veins.moveTo(0, -0.9);
  veins.lineTo(0, 0.85);
  const at = s.lobes ? [0, 1, 2, 3].map((k) => (k + 0.5 - lobe) / 3.5).filter((t) => t > 0.08 && t < 0.92) : [0.24, 0.4, 0.56, 0.72];
  for (const t of at)
    for (const side of [1, -1]) {
      veins.moveTo(0, yAt(Math.min(1, t + 0.07)));
      veins.lineTo(side * 0.8 * half(t, side), yAt(t));
    }
  return { path, veins, edge: (y: number) => half((y + 1) / 1.85, 1), stalk: 0.85 };
}

interface Sprite {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  /** Its width and height (px). */
  px: number;
}

/** Paints a leaf `size` px from its middle to its tip: its front and its (darker) back. A golden one
 *  is pure gold and flawless. */
function paint(kind: Kind, color: string, size: number, depth: Depth, gold = false): Sprite {
  const dpr = window.devicePixelRatio || 1;
  const blur = depth === "near" ? 1.6 : 0;
  const px = Math.ceil(size * 2.8 + blur * 6);
  const { path, veins, edge, stalk } = shape(kind, 0.1 + Math.random() * 0.1);
  const back = gold ? "#d9a52a" : mix(color, "#24101a", 0.45);
  const flawed = gold ? 0 : 1;
  const spots = Array.from({ length: flawed && Math.random() < 0.4 ? 1 + Math.floor(Math.random() * 2) : 0 }, () => [(Math.random() - 0.5) * 0.6, -0.6 + Math.random() * 1.2, 0.15 + Math.random() * 0.15]);
  const holes = Array.from({ length: flawed && Math.random() < 0.3 ? 1 + Math.floor(Math.random() * 2) : 0 }, () => [(Math.random() - 0.5) * 0.45, -0.5 + Math.random() * 0.9, 0.06 + Math.random() * 0.05]);
  const curl = flawed && Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  const curlY = -0.5 + Math.random() * 0.8;
  const curlX = curl * (edge(curlY) + 0.2);

  const side = (front: boolean) => {
    const c = document.createElement("canvas");
    c.width = c.height = Math.ceil(px * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(size * dpr, 0, 0, size * dpr, c.width / 2, c.height / 2);
    // Shading from the tip (lighter) to the stalk (darker); the back duller.
    const fill = g.createLinearGradient(0, -1, 0, 0.9);
    if (gold && front) {
      fill.addColorStop(0, "#fff6c8");
      fill.addColorStop(0.5, "#ffd23f");
      fill.addColorStop(1, "#c98a12");
    } else if (front) {
      fill.addColorStop(0, mix(color, "#ffd27a", 0.25));
      fill.addColorStop(0.55, color);
      fill.addColorStop(1, mix(color, "#3a1206", 0.3));
    } else {
      fill.addColorStop(0, mix(back, "#ffd27a", 0.1));
      fill.addColorStop(1, mix(back, "#120610", 0.3));
    }
    g.fillStyle = fill;
    g.fill(path);
    g.save();
    g.clip(path);
    if (front)
      for (const [x, y, r] of spots) {
        const spot = g.createRadialGradient(x, y, 0, x, y, r);
        spot.addColorStop(0, "rgba(50, 16, 6, 0.45)");
        spot.addColorStop(1, "rgba(50, 16, 6, 0)");
        g.fillStyle = spot;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    // A curled edge: the other side showing where it folds over, a glint along the fold.
    if (curl) {
      g.beginPath();
      g.arc(curlX, curlY, 0.38, 0, Math.PI * 2);
      g.fillStyle = front ? back : color;
      g.fill();
      g.strokeStyle = "rgba(255, 226, 180, 0.35)";
      g.lineWidth = 0.05;
      g.stroke();
    }
    g.strokeStyle = front ? "rgba(70, 24, 8, 0.5)" : "rgba(255, 214, 170, 0.2)";
    g.lineWidth = 0.05;
    g.lineCap = "round";
    g.stroke(veins);
    g.restore();
    // The moon catching its rim.
    if (front) {
      const rim = g.createLinearGradient(-0.9, -0.9, 0, 0);
      rim.addColorStop(0, gold ? "rgba(255, 252, 230, 0.95)" : "rgba(214, 200, 255, 0.5)");
      rim.addColorStop(1, gold ? "rgba(255, 252, 230, 0)" : "rgba(214, 200, 255, 0)");
      g.strokeStyle = rim;
      g.lineWidth = 0.08;
      g.stroke(path);
    }
    // Nibbled holes.
    g.globalCompositeOperation = "destination-out";
    for (const [x, y, r] of holes) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.moveTo(x + r * 1.3, y + r * 0.5);
      g.arc(x + r * 0.6, y + r * 0.5, r * 0.7, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
    // The stalk.
    g.strokeStyle = mix(front ? color : back, "#1a0804", 0.55);
    g.lineWidth = 0.075;
    g.beginPath();
    g.moveTo(0, stalk);
    g.quadraticCurveTo(0.06, 1.05, 0.02, 1.28);
    g.stroke();
    // Far away: fading into the night.
    if (depth === "far") {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(18, 11, 28, 0.45)";
      g.fillRect(0, 0, c.width, c.height);
    }
    if (!blur) return c;
    const soft = document.createElement("canvas");
    soft.width = soft.height = c.width;
    const sg = soft.getContext("2d")!;
    sg.filter = `blur(${blur * dpr}px)`;
    sg.drawImage(c, 0, 0);
    return soft;
  };
  return { front: side(true), back: side(false), px };
}

// ---------- Falling ----------

export interface Leaf {
  depth: Depth;
  sprite: Sprite;
  x: number;
  y: number;
  size: number;
  /** How fast it sinks (px/s), how far it swings each way (px), how fast (rad/s), and how much it
   *  lifts at the end of a swing (px). */
  fall: number;
  swing: number;
  speed: number;
  lift: number;
  phase: number;
  /** Which way it lies, and how it rocks with the swing (rad). */
  heading: number;
  spin: number;
  rock: number;
  /** Turning over (round its middle vein). */
  flip: number;
  flipSpeed: number;
  /** Flicked: how fast it's still flying off (px/s), slowing as the air catches it. */
  kickX: number;
  kickY: number;
  /** Tumbling: how much (0..1), for how much longer (s), spinning how fast. */
  tumble: number;
  tumbleLeft: number;
  tumbleSpin: number;
  alpha: number;
  show: number;
  /** Seconds since it started falling (leaves off the branch take a moment to get going). */
  born: number;
  /** Still on the branch: where it hangs from, for how long, and how long it's been there. */
  hang?: { x: number; y: number; age: number; left: number };
  /** Off the branch: drawn over the top bar while it's up there, and the way it settles to lie. */
  high?: boolean;
  settle?: number;
  /** Heading for a spot (px in the window; null once it's gone), and what then (moments.ts). */
  aim?: { at: () => [number, number] | null; then: (l: Leaf) => void };
  /** Resting somewhere: places it each frame, false once it's let go (moments.ts). */
  rest?: (l: Leaf, dt: number) => boolean;
  /** Golden (glowing, sparkling); or a bat or moth in disguise, unfolding after `reveal` s. */
  gold?: boolean;
  critter?: "bat" | "moth";
  reveal?: number;
}

function spawn(depth: Depth, w: number, h: number, anywhere: boolean, size?: number, look: Look = {}): Leaf {
  const d = DEPTHS[depth];
  const kind = look.kind ?? pick(KINDS);
  const s = size ?? between(d.size);
  const fall = between(d.fall);
  const speed = (1.5 + Math.random() * 1.1) * (depth === "far" ? 0.8 : depth === "near" ? 1.2 : 1);
  return {
    depth,
    sprite: paint(kind, look.color ?? pick(COLORS[kind]), s, depth, look.gold),
    gold: look.gold,
    x: Math.random() * (w + 80) - 40,
    y: anywhere ? Math.random() * h : -s * 2 - Math.random() * 60,
    size: s,
    fall,
    swing: between(d.swing),
    speed,
    lift: ((0.55 + Math.random() * 0.4) * fall) / speed,
    phase: Math.random() * Math.PI * 2,
    heading: (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + (Math.random() - 0.5)),
    spin: (Math.random() - 0.5) * 0.5,
    rock: 0,
    kickX: 0,
    kickY: 0,
    flip: Math.random() * Math.PI * 2,
    flipSpeed: 0.4 + Math.random() * 0.9,
    tumble: 0,
    tumbleLeft: 0,
    tumbleSpin: 0,
    alpha: d.alpha,
    show: 1,
    born: 99,
  };
}

/** A leaf on the branch at (x, y), about to come off. */
function onBranch(x: number, y: number): Leaf {
  const l = spawn("mid", 0, 0, false, 8.5 + Math.random() * 4);
  l.hang = { x, y, age: 0, left: 1.6 + Math.random() * 1.4 };
  l.high = true;
  l.show = 0;
  l.alpha = 0.92;
  l.settle = Math.PI + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 - Math.random() * 0.4);
  return l;
}

/** The breeze (px/s, to the right): changing slowly, sometimes calm, sometimes gusting. */
function breeze(t: number) {
  const calm = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t / 21 + 1)) ** 2;
  return (8 + 16 * Math.sin(t / 7.3) + 7 * Math.sin(t / 2.9 + 1.7)) * calm;
}

function move(l: Leaf, dt: number, wind: number, shift: number) {
  if (l.hang) {
    // Hanging by its stalk, wiggling more and more in the breeze until it breaks loose.
    const hang = l.hang;
    hang.age += dt;
    l.show = Math.min(1, hang.age / 0.9);
    const pull = hang.age / hang.left;
    const wiggle = Math.sin(hang.age * 11) * (0.05 + 0.3 * pull * pull) + Math.sin(hang.age * 3.3) * 0.08 + wind * 0.005;
    l.heading = Math.PI + wiggle;
    l.flip = 0.3 * Math.sin(hang.age * 2);
    l.x = hang.x - 1.25 * l.size * Math.sin(wiggle);
    l.y = hang.y + 1.25 * l.size * Math.cos(wiggle);
    if (hang.age >= hang.left) {
      l.hang = undefined;
      l.born = 0;
      // At the start of a swing, so it eases sideways from still.
      l.phase = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    return;
  }
  if (l.rest) {
    if (l.rest(l, dt)) return;
    l.rest = undefined;
    l.born = Math.max(l.born, 1.4);
  }
  const d = DEPTHS[l.depth];
  l.born += dt;
  const ease = Math.min(1, l.born / 1.4);
  // Heading for a spot: the swing dies down and it drifts over as it gets close, out of the wind.
  const to = l.aim?.at();
  if (l.aim && (!to || to[1] < l.y - 12)) l.aim = undefined;
  const close = to && l.aim ? 1 - Math.min(1, (to[1] - l.y) / 260) : 0;
  if (l.aim) wind = 0;
  // Now and then it loses the air and tumbles for a moment (more often in a strong wind).
  if (l.tumbleLeft > 0) l.tumbleLeft -= dt;
  else if (ease === 1 && !l.aim && Math.random() < d.tumble * (1 + Math.abs(wind) / 50) * dt) {
    l.tumbleLeft = 0.6 + Math.random() * 0.8;
    l.tumbleSpin = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 3);
  }
  l.tumble += ((l.tumbleLeft > 0 ? 1 : 0) - l.tumble) * Math.min(1, dt * 5);
  const glide = (1 - l.tumble) * ease * (1 - 0.8 * close);
  // Swinging like a pendulum: sideways fastest in the middle of a swing, lifting a little as it
  // slows at the end, then back the other way; sinking all the while.
  l.phase += l.speed * dt;
  const vx = l.swing * l.speed * Math.cos(l.phase) * glide;
  const vy = l.fall * (0.3 + 0.7 * ease) * (1 + 1.4 * l.tumble) - l.lift * l.speed * Math.sin(2 * l.phase) * glide;
  l.x += (vx + wind * d.wind + l.kickX) * dt;
  // (A strong wind lifts them a little.)
  l.y += (vy + l.kickY - Math.max(0, Math.abs(wind) - 60) * 0.15) * dt - shift;
  if (l.aim && to) {
    l.x += (to[0] - l.x) * Math.min(1, dt * (0.6 + 4 * close * close));
    if (to[1] - l.y < 1.5) {
      const then = l.aim.then;
      l.aim = undefined;
      [l.x, l.y] = to;
      then(l);
    }
  }
  const drag = Math.exp(-dt * 2.4);
  l.kickX *= drag;
  l.kickY *= drag;
  // Tilted the way it glides (dipping into each swing, nose up at the end of it).
  const tilt = Math.max(-0.8, Math.min(0.8, Math.atan2(vy, Math.abs(vx) + 1) * Math.sign(vx) * 0.85));
  l.rock += (tilt * glide - l.rock) * Math.min(1, dt * 5);
  l.heading += (l.spin + l.tumbleSpin * l.tumble) * dt;
  if (l.settle !== undefined && l.born < 4) l.heading += (l.settle - l.heading) * Math.min(1, dt * 0.9);
  l.flip += l.flipSpeed * (1 + 9 * l.tumble) * dt;
}

/** Flicks a leaf away from where it was clicked: off it flies, spinning and tumbling, until the air
 *  catches it again (off the branch, if it was still hanging there). */
function flick(l: Leaf, fromX: number, fromY: number) {
  if (l.hang || l.rest || l.aim) {
    l.hang = l.rest = l.aim = undefined;
    l.born = Math.max(l.born, 1.4);
    l.show = 1;
  }
  let dx = l.x - fromX;
  let dy = l.y - fromY;
  const far = Math.hypot(dx, dy);
  if (far < 2) [dx, dy] = [Math.random() - 0.5, -0.5];
  const k = 1 / Math.hypot(dx, dy);
  // Mostly away from the click, and a little up.
  const speed = (l.depth === "far" ? 170 : 300) + Math.random() * 120;
  l.kickX = dx * k * speed;
  l.kickY = (Math.min(dy * k, 0.3) - 0.75) * speed;
  l.tumbleLeft = 0.8 + Math.random() * 0.5;
  l.tumbleSpin = (dx < 0 ? -1 : 1) * (8 + Math.random() * 5);
}

function draw(g: CanvasRenderingContext2D, l: Leaf) {
  // Turning over round its middle vein (rolling a little with each swing too): narrower as it turns
  // edge-on, its back showing (mirrored) past that.
  const turn = Math.cos(l.flip + 0.5 * Math.sin(l.phase) * (1 - l.tumble));
  const { front, back, px } = l.sprite;
  if (l.gold) {
    // A golden glow round it, pulsing softly.
    const r = l.size * 3.4;
    const glow = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
    const pulse = (0.8 + 0.2 * Math.sin(l.phase * 2.3)) * l.show;
    glow.addColorStop(0, `rgba(255, 226, 120, ${0.75 * pulse})`);
    glow.addColorStop(0.35, `rgba(255, 200, 70, ${0.3 * pulse})`);
    glow.addColorStop(1, "rgba(255, 190, 60, 0)");
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = glow;
    g.fillRect(l.x - r, l.y - r, r * 2, r * 2);
    g.restore();
  }
  g.save();
  g.translate(l.x, l.y);
  g.rotate(l.heading + l.rock);
  g.scale((turn < 0 ? -1 : 1) * (0.15 + 0.85 * Math.abs(turn)), 1);
  g.globalAlpha = l.alpha * l.show;
  g.drawImage(turn < 0 ? back : front, -px / 2, -px / 2, px, px);
  g.restore();
}

/** How far the library's pages have scrolled since the last call (px; down is positive), so things
 *  drawn over them can move along. `stop` ends the watching. */
export function followScroll() {
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
  return {
    take() {
      const s = scrolled;
      scrolled = 0;
      return s;
    },
    stop: () => document.removeEventListener("scroll", onScroll, true),
  };
}

/** Starts the leaves falling on `el` (and, for the ones off the branch while they're up there, on
 *  `top`, over the top bar); returns the way to stop them. */
export function startLeaves(el: HTMLCanvasElement, top: HTMLCanvasElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const g = el.getContext("2d")!;
  const gt = top.getContext("2d")!;
  /** The usual ones (far and middle), kept at a steady number. */
  let list: Leaf[] = [];
  /** The ones off the branch and the near ones, gone once they've fallen past. */
  let extra: Leaf[] = [];
  let frame = 0;
  let last = performance.now();
  let clock = Math.random() * 100;
  let nextBranch = 3 + Math.random() * 5;
  let nextNear = between(NEAR_EVERY) / 2;
  const scroll = followScroll();
  const moments = startMoments();
  const field: Field = {
    w: 0,
    h: 0,
    line: 0,
    extra,
    spawn: (depth, size, look) => spawn(depth, field.w, field.h, false, size, look),
    flick,
    draw,
  };
  // (For trying things out while developing: start a moment, see where the leaves are.)
  if (import.meta.env.DEV) Object.assign(window, { heMoment: (name: string) => moments.run(name, Object.assign(field, { extra })), heLeaves: () => [...list, ...extra] });
  // Clicking a leaf flicks it away (and the click goes no further, so whatever's under it isn't
  // clicked too). Tiny far ones are easy to miss, so they're a little bigger to hit than they look.
  const onClick = (e: MouseEvent) => {
    // Not through a dialog or menu (the leaves are under those).
    if (document.querySelector(".modal, .ctx-menu") || (e.target as Element | null)?.closest?.(".toast, .say, .update-note")) return;
    let hit: Leaf | null = null;
    let best = Infinity;
    for (const l of [...list, ...extra]) {
      const d = Math.hypot(l.x - e.clientX, l.y - e.clientY);
      const reach = l.gold ? l.size * 1.6 + 8 : Math.max(l.size * 0.95, 7) + 3;
      if (l.show > 0.3 && d < reach && d < best) [hit, best] = [l, d];
    }
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    // (A golden one, or a bat in disguise, is something else.)
    if (moments.clicked(hit)) return;
    flick(hit, e.clientX, e.clientY);
    playSound("rustle");
  };
  document.addEventListener("click", onClick, true);
  const size = (c: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width === w && c.height === h) return false;
    c.width = w;
    c.height = h;
    return true;
  };
  const fit = () => {
    size(top);
    if (!size(el) && list.length > 0) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const count = Math.max(4, Math.round((w * h) / AREA_PER_LEAF));
    const far = Math.round(count * FAR_SHARE);
    list = Array.from({ length: count }, (_, i) => spawn(i < far ? "far" : "mid", w, h, true));
  };
  const step = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    fit();
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const line = top.clientHeight;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    gt.setTransform(dpr, 0, 0, dpr, 0, 0);
    gt.clearRect(0, 0, w, line);
    const shift = scroll.take();
    const wind = breeze(clock) + moments.wind();
    Object.assign(field, { w, h, line, extra });
    moments.step(field, dt, shift);

    // Now and then one comes off the branch, or a big one passes close by.
    nextBranch -= dt;
    if (nextBranch <= 0) {
      nextBranch = between(BRANCH_EVERY);
      const spots = perches.list.filter(([x]) => x > 10 && x < w - 10);
      if (spots.length > 0 && extra.filter((l) => l.hang).length < MAX_HANGING) extra.push(onBranch(...pick(spots)));
    }
    nextNear -= dt;
    if (nextNear <= 0) {
      nextNear = between(NEAR_EVERY);
      extra.push(spawn("near", w, h, false));
    }

    list = list.map((l) => {
      move(l, dt, wind, shift);
      // Scrolled off the top: it comes back in at the bottom (and off the bottom, at the top);
      // blown off one side, it comes back in at the other.
      if (l.y < -40) l.y += h + 70;
      if (l.x < -60) l.x += w + 120;
      else if (l.x > w + 60) l.x -= w + 120;
      return l.y > h + 30 ? spawn(l.depth, w, h, false) : l;
    });
    extra = extra.filter((l) => {
      move(l, dt, wind, l.hang || l.rest ? 0 : shift);
      return l.y < h + 80 && (l.hang !== undefined || l.rest !== undefined || l.y > -80) && l.x > -120 && l.x < w + 120;
    });

    for (const l of list) if (l.depth === "far") draw(g, l);
    for (const l of list) if (l.depth === "mid") draw(g, l);
    for (const l of extra) {
      if (!l.high) {
        draw(g, l);
        continue;
      }
      // Off the branch: over the top bar while it's up there, then under it like the rest.
      const reach = l.sprite.px / 2;
      if (l.y - reach < line) draw(gt, l);
      if (l.y + reach > line) {
        g.save();
        g.beginPath();
        g.rect(0, line, w, h);
        g.clip();
        draw(g, l);
        g.restore();
      }
      if (l.y - reach > line) l.high = false;
    }
    moments.draw(g, field);
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    scroll.stop();
    document.removeEventListener("click", onClick, true);
    moments.stop();
    g.clearRect(0, 0, el.width, el.height);
    gt.clearRect(0, 0, top.width, top.height);
  };
}
