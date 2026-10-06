// Snowdin's pixel scenes: drawn from code at 1 pixel = 1 art pixel, shown 3x bigger with crisp
// edges. Nothing here comes from the game itself.

const C = {
  far: "#0d1322", farSnow: "#2e3d5c",
  mid: "#132036", midSnow: "#7f96bb",
  near: "#182a45", nearSnow: "#dfe9fa",
  trunk: "#24180f",
  snow: "#f3f7ff", snow2: "#c9d6ec", snow3: "#97abcf", ice: "#bfe2ff",
  wood: "#8b5a36", wood2: "#71462a", wood3: "#4a2c1a", roof: "#33200f",
  win: "#ffcf5c", win2: "#fff3b8", door: "#4f301d",
  red: "#ff5050", green: "#4fd66f", yellow: "#ffe04a", blue: "#56b8ff", orange: "#ff9a3c",
  gtree: "#1c5a3b", gsnow: "#e2f1e7",
  post: "#262636", lamp: "#ffe9a8", coal: "#1d1d26", cloth: "#efe6cf", cloth2: "#c9b994", ink: "#3b2416",
};
const BULBS = [C.red, C.yellow, C.green, C.blue, C.orange];

/** How much bigger than an art pixel things are drawn on screen. */
export const SCALE = 3;

interface Painter {
  w: number;
  h: number;
  rect(x: number, y: number, w: number, h: number, c: string, a?: number): void;
  dot(x: number, y: number, c: string, a?: number): void;
}

export function paint(w: number, h: number, draw: (p: Painter) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  const p: Painter = {
    w,
    h,
    rect(x, y, rw, rh, c, a = 1) {
      g.globalAlpha = a;
      g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), rw, rh);
      g.globalAlpha = 1;
    },
    dot(x, y, c, a = 1) {
      p.rect(x, y, 1, 1, c, a);
    },
  };
  draw(p);
  return canvas.toDataURL();
}

/** Same numbers every time, so the scenes don't reshuffle. */
function random(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// A tiny pixel font for signs.
const GLYPHS: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], I: ["###", ".#.", ".#.", ".#.", "###"],
  L: ["#..", "#..", "#..", "#..", "###"], M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"], O: [".#.", "#.#", "#.#", "#.#", ".#."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"], T: ["###", ".#.", ".#.", ".#.", ".#."], Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"], " ": ["..", "..", "..", "..", ".."],
};

function textWidth(s: string) {
  return [...s].reduce((n, ch) => n + GLYPHS[ch][0].length + 1, -1);
}

function text(p: Painter, x: number, y: number, s: string, c: string) {
  for (const ch of s) {
    const glyph = GLYPHS[ch];
    glyph.forEach((row, yy) => [...row].forEach((v, xx) => v === "#" && p.dot(x + xx, y + yy, c)));
    x += glyph[0].length + 1;
  }
}

/** A snowy pine: stacked tiers, a snowy ledge along each tier's bottom, snow on the upper edges. */
function pine(p: Painter, cx: number, base: number, h: number, body: string, snow: string, { width = h * 0.46, trunk = C.trunk } = {}) {
  const trunkH = Math.max(2, Math.round(h * 0.1));
  const crownH = h - trunkH;
  const tiers = Math.max(3, Math.round(h / 8));
  const tierH = crownH / tiers;
  const maxHalf = width / 2;
  p.rect(cx - 1, base - trunkH, h > 26 ? 3 : 2, trunkH, trunk);
  const top = base - trunkH - crownH;
  for (let y = 0; y < crownH; y++) {
    const t = Math.min(tiers - 1, Math.floor(y / tierH));
    const pos = (y - t * tierH) / tierH;
    const tierHalf = maxHalf * (0.3 + (0.7 * (t + 1)) / tiers);
    const half = Math.max(0, Math.round(tierHalf * (0.3 + 0.7 * pos)));
    const row = top + y;
    p.rect(cx - half, row, half * 2 + 1, 1, body);
    if (y + 1 >= Math.round((t + 1) * tierH)) p.rect(cx - half, row, half * 2 + 1, 1, snow);
    else if (pos > 0.35) {
      p.dot(cx - half, row, snow);
      if (pos > 0.6) p.dot(cx - half + 1, row, snow);
    }
  }
  p.dot(cx, top, snow);
}

/** A band of pines; they get smaller towards the left (where the text is). */
function forest(p: Painter, rand: () => number, o: { from: number; to: number; base: number; minH: number; maxH: number; step: number; body: string; snow: string; lowUntil?: number }) {
  for (let x = o.from; x < o.to; x += o.step + Math.round(rand() * o.step * 0.6)) {
    let h = o.minH + rand() * (o.maxH - o.minH);
    if (o.lowUntil && x < o.lowUntil) h *= 0.4 + (0.6 * x) / o.lowUntil;
    pine(p, x, o.base, Math.round(h), o.body, o.snow);
  }
}

function ground(p: Painter, rand: () => number, top: number) {
  for (let x = 0; x < p.w; x++) {
    const bump = Math.round(Math.sin(x / 9) * 1.2 + Math.sin(x / 23 + 1) * 1.5 + 1.5);
    p.rect(x, top - bump, 1, p.h - top + bump, C.snow);
    p.dot(x, top - bump, C.snow2);
  }
  for (let i = 0; i < p.w / 10; i++) {
    const x = Math.round(rand() * p.w);
    const y = top + 3 + Math.round(rand() * (p.h - top - 4));
    const w = 3 + Math.round(rand() * 8);
    p.rect(x, y, w, 1, C.snow2);
    if (rand() < 0.4) p.rect(x + 1, y + 1, w - 2, 1, C.snow3, 0.6);
  }
}

function glow(p: Painter, cx: number, cy: number, r: number, c: string, a: number) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r) p.dot(cx + x, cy + y, c, a * (1 - d / r) * (((x + y) & 1) === 0 ? 1 : 0.7));
    }
}

function windowAt(p: Painter, x: number, y: number, w = 7, h = 6) {
  glow(p, x + w / 2, y + h / 2, 7, C.win, 0.22);
  p.rect(x - 1, y - 1, w + 2, h + 2, C.wood3);
  p.rect(x, y, w, h, C.win);
  p.rect(x + 1, y + 1, 2, 2, C.win2);
  p.rect(x + Math.floor(w / 2), y, 1, h, C.wood3);
  p.rect(x, y + Math.floor(h / 2), w, 1, C.wood3);
  p.rect(x - 1, y - 2, w + 2, 1, C.snow);
  p.rect(x - 1, y + h + 1, w + 2, 1, C.snow2);
}

function doorAt(p: Painter, x: number, base: number, w = 7, h = 11) {
  p.rect(x - 1, base - h - 1, w + 2, h + 1, C.wood3);
  p.rect(x, base - h, w, h, C.door);
  p.rect(x + 1, base - h + 1, w - 2, 1, C.wood2);
  p.dot(x + w - 2, base - Math.round(h / 2), C.yellow);
  p.rect(x - 2, base - 1, w + 4, 1, C.snow2);
}

interface CabinOptions {
  roofH?: number;
  windows?: [number, number][];
  door?: number;
  chimney?: boolean;
  lights?: boolean;
  sign?: string;
}

/** A log cabin under a heavy snowy roof, with icicles. */
function cabin(p: Painter, rand: () => number, x: number, base: number, w: number, h: number, o: CabinOptions = {}) {
  const { roofH = 12, windows = [], door = 0.5, chimney = false, lights = false, sign } = o;
  const overhang = 4;
  const cx = x + w / 2;
  p.rect(x, base - h, w, h, C.wood);
  for (let yy = base - h + 2; yy < base; yy += 3) p.rect(x, yy, w, 1, C.wood2);
  p.rect(x, base - h, 2, h, C.wood3);
  p.rect(x + w - 2, base - h, 2, h, C.wood3);
  if (chimney) {
    const chx = Math.round(x + w * 0.72);
    p.rect(chx, base - h - roofH - 2, 5, roofH, "#5b5566");
    p.rect(chx - 1, base - h - roofH - 4, 7, 2, C.snow);
    for (let i = 0; i < 4; i++) p.rect(chx + 1 + i, base - h - roofH - 8 - i * 4, 3 - (i > 1 ? 1 : 0), 2, "#9a98ae", 0.5 - i * 0.1);
  }
  const top = base - h - roofH;
  for (let r = 0; r < roofH; r++) {
    const half = Math.round(((r + 1) / roofH) * (w / 2 + overhang));
    p.rect(cx - half, top + r, half * 2, 1, C.snow);
    p.rect(cx + Math.round(half * 0.25), top + r, Math.round(half * 0.75), 1, C.snow2);
    p.dot(cx - half, top + r, C.snow2);
  }
  p.rect(cx - 1, top - 1, 2, 1, C.snow);
  p.rect(x - overhang, base - h, w + overhang * 2, 2, C.roof);
  p.rect(x - overhang, base - h - 1, w + overhang * 2, 1, C.snow3);
  for (let ix = x - overhang + 1; ix < x + w + overhang - 1; ix += 2 + Math.round(rand() * 3)) {
    p.rect(ix, base - h + 2, 1, 1 + Math.round(rand() * 2), C.ice);
  }
  if (lights) {
    for (let i = 0, lx = x - overhang + 2; lx < x + w + overhang - 2; lx += 4, i++) {
      const sag = Math.round(Math.sin((i % 3) * 1.4)) + 1;
      p.dot(lx, base - h + 2, C.coal);
      p.rect(lx, base - h + 3 + sag, 1, 2, BULBS[i % BULBS.length]);
      glow(p, lx, base - h + 4 + sag, 2, BULBS[i % BULBS.length], 0.25);
    }
  }
  for (const [wx, wy] of windows) windowAt(p, x + wx, base - h + wy);
  if (door != null) doorAt(p, Math.round(x + w * door - 3), base);
  if (sign) {
    const tw = textWidth(sign);
    const sx = Math.round(cx - tw / 2 - 3);
    const sy = base - h + 7;
    p.rect(sx - 1, sy - 1, tw + 8, 9, C.wood3);
    p.rect(sx, sy, tw + 6, 7, "#a0703f");
    p.rect(sx, sy, tw + 6, 1, C.snow);
    text(p, sx + 3, sy + 1, sign, "#fff1d6");
  }
  p.rect(x - 2, base - 2, w + 4, 2, C.snow);
}

function lampPost(p: Painter, x: number, base: number, h = 26) {
  glow(p, x + 1, base - h + 2, 13, C.lamp, 0.38);
  p.rect(x, base - h + 4, 2, h - 4, C.post);
  p.rect(x - 2, base - h, 6, 1, C.post);
  p.rect(x - 1, base - h + 1, 4, 3, C.lamp);
  p.rect(x - 2, base - h + 4, 6, 1, C.post);
  p.rect(x - 2, base - h - 1, 6, 1, C.snow);
  p.rect(x - 1, base - 1, 4, 1, C.snow2);
}

function snowman(p: Painter, x: number, base: number) {
  const ball = (cx: number, cy: number, r: number) => {
    for (let y = -r; y <= r; y++)
      for (let xx = -r; xx <= r; xx++) if (xx * xx + y * y <= r * r + r) p.dot(cx + xx, cy + y, xx + y > r * 0.6 ? C.snow2 : C.snow);
  };
  ball(x, base - 5, 5);
  ball(x, base - 13, 4);
  ball(x, base - 19, 3);
  p.dot(x - 1, base - 20, C.coal);
  p.dot(x + 1, base - 20, C.coal);
  p.rect(x + 1, base - 19, 2, 1, C.orange);
  p.dot(x, base - 13, C.coal);
  p.dot(x, base - 11, C.coal);
  p.rect(x - 8, base - 15, 4, 1, C.trunk);
  p.dot(x - 9, base - 16, C.trunk);
  p.rect(x + 5, base - 14, 4, 1, C.trunk);
  p.dot(x + 9, base - 15, C.trunk);
}

/** The decorated tree in the middle of town, with presents. */
function giftTree(p: Painter, cx: number, base: number, h: number) {
  pine(p, cx, base, h, C.gtree, C.gsnow, { width: h * 0.62, trunk: "#3a2414" });
  const rand = random(77);
  for (let i = 0; i < 26; i++) {
    const y = base - Math.round(h * 0.15) - Math.round(rand() * h * 0.72);
    const reach = Math.round(h * 0.62 * 0.5 * (1 - (base - y) / h) * 0.9);
    const x = cx - reach + Math.round(rand() * reach * 2);
    const c = BULBS[i % BULBS.length];
    glow(p, x, y, 2, c, 0.4);
    p.dot(x, y, c);
  }
  const sy = base - h - 2;
  p.rect(cx - 1, sy - 1, 3, 3, C.yellow);
  for (const [dx, dy] of [[0, -3], [0, 3], [-3, 0], [3, 0], [0, -2], [0, 2], [-2, 0], [2, 0]]) p.dot(cx + dx, sy + dy, C.yellow);
  glow(p, cx, sy, 6, C.yellow, 0.25);
  const gift = (x: number, w: number, gh: number, c: string, ribbon: string) => {
    p.rect(x, base - gh, w, gh, c);
    p.rect(x + Math.floor(w / 2), base - gh, 1, gh, ribbon);
    p.rect(x, base - gh + 1, w, 1, ribbon);
    p.rect(x + Math.floor(w / 2) - 1, base - gh - 1, 3, 1, ribbon);
  };
  gift(cx - 12, 6, 5, C.red, C.yellow);
  gift(cx - 5, 5, 4, C.blue, C.snow);
  gift(cx + 4, 7, 6, C.green, C.red);
  gift(cx + 12, 4, 3, C.orange, C.snow);
}

function banner(p: Painter, x1: number, x2: number, y: number, base: number, words: string) {
  for (const px of [x1, x2]) {
    p.rect(px, y - 2, 2, base - y + 2, C.wood3);
    p.rect(px - 1, y - 3, 4, 1, C.snow);
  }
  const tw = textWidth(words);
  const w = x2 - x1 - 4;
  p.rect(x1 + 2, y, w + 2, 9, C.cloth2);
  p.rect(x1 + 3, y, w, 8, C.cloth);
  p.rect(x1 + 3, y, w, 1, C.snow);
  text(p, Math.round(x1 + 3 + (w - tw) / 2), y + 2, words, C.ink);
}

/** A little wooden sentry station. */
function sentry(p: Painter, rand: () => number, x: number, base: number) {
  const w = 26;
  p.rect(x + 2, base - 22, 2, 22, C.wood3);
  p.rect(x + w - 4, base - 22, 2, 22, C.wood3);
  p.rect(x, base - 10, w, 10, C.wood);
  for (let yy = base - 8; yy < base; yy += 3) p.rect(x, yy, w, 1, C.wood2);
  p.rect(x - 1, base - 11, w + 2, 2, C.wood3);
  p.rect(x - 1, base - 12, w + 2, 1, C.snow);
  p.rect(x - 3, base - 25, w + 6, 3, C.roof);
  p.rect(x - 3, base - 28, w + 6, 3, C.snow);
  p.rect(x - 1, base - 29, w + 2, 1, C.snow);
  for (let ix = x - 2; ix < x + w + 2; ix += 3 + Math.round(rand() * 2)) p.rect(ix, base - 22, 1, 1 + Math.round(rand() * 2), C.ice);
  p.rect(x - 2, base - 2, w + 4, 2, C.snow);
}

export const SCENE_HEIGHT = 72;
/** The left part stays low and calm, where the spotlight's text sits. */
const QUIET_LEFT = 230;

/** Snowdin town along the bottom of the home spotlight: everything sits towards the right. */
export function townScene(width: number) {
  const w = Math.max(427, Math.ceil(width / SCALE));
  const r = w - 427; // things are placed as on a 427-wide scene, shifted right
  return paint(w, SCENE_HEIGHT, (p) => {
    const rand = random(11);
    const g = SCENE_HEIGHT - 9;
    forest(p, rand, { from: 4, to: w, base: g - 6, minH: 18, maxH: 34, step: 7, body: C.far, snow: C.farSnow, lowUntil: QUIET_LEFT });
    forest(p, rand, { from: 150, to: w, base: g - 2, minH: 24, maxH: 40, step: 19, body: C.mid, snow: C.midSnow, lowUntil: QUIET_LEFT + 30 });
    banner(p, r + 282, r + 377, 9, g, "WELCOME TO DA LIBRARBY");
    cabin(p, rand, r + 226, g, 52, 32, { roofH: 15, windows: [[7, 6], [37, 6], [7, 19]], door: 0.72, chimney: true });
    giftTree(p, r + 330, g, 36);
    lampPost(p, r + 296, g, 26);
    cabin(p, rand, r + 379, g, 44, 30, { roofH: 13, windows: [[5, 18], [32, 18]], door: 0.5, lights: true, sign: "LIBRARBY" });
    snowman(p, r + 214, g + 1);
    lampPost(p, r + 168, g, 22);
    ground(p, rand, g);
  });
}

/** Snowdin forest along the bottom of a show page, with a sentry station on the right. */
export function forestScene(width: number) {
  const w = Math.max(427, Math.ceil(width / SCALE));
  const r = w - 427;
  return paint(w, SCENE_HEIGHT, (p) => {
    const rand = random(5);
    const g = SCENE_HEIGHT - 9;
    forest(p, rand, { from: 2, to: w, base: g - 7, minH: 20, maxH: 36, step: 6, body: C.far, snow: C.farSnow, lowUntil: QUIET_LEFT + 10 });
    forest(p, rand, { from: 120, to: w, base: g - 3, minH: 30, maxH: 48, step: 13, body: C.mid, snow: C.midSnow, lowUntil: QUIET_LEFT + 30 });
    pine(p, r + 352, g + 1, 54, C.near, C.nearSnow);
    lampPost(p, r + 372, g, 27);
    sentry(p, rand, r + 384, g);
    pine(p, r + 420, g + 1, 60, C.near, C.nearSnow);
    ground(p, rand, g);
    for (let x = 140; x < w; x += 9) p.rect(x, g + 3 + ((x / 9) & 1) * 2, 2, 1, C.snow3);
  });
}

/** A strip of string lights (repeats sideways); `glowOnly` draws just the bright bulb glows. */
export function lightsTile(glowOnly = false) {
  const w = 64;
  return paint(w, 22, (p) => {
    const wireY = (x: number) => 2 + Math.round(9 * Math.sin((Math.PI * x) / w));
    if (!glowOnly) for (let x = 0; x < w; x++) p.dot(x, wireY(x), C.coal);
    [8, 24, 40, 56].forEach((x, i) => {
      const y = wireY(x) + 1;
      const c = [C.red, C.yellow, C.green, C.blue][i];
      if (glowOnly) {
        if (i % 2 === 0) {
          glow(p, x, y + 4, 5, c, 0.5);
          p.rect(x - 1, y + 2, 2, 3, "#ffffff", 0.7);
        }
        return;
      }
      p.rect(x - 1, y, 2, 1, C.coal);
      p.rect(x - 1, y + 1, 3, 4, c);
      p.dot(x - 1, y + 2, "#ffffff", 0.6);
      glow(p, x, y + 3, 3, c, 0.25);
    });
  });
}
