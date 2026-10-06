// Snowdin's pixel scenes, drawn at 1 pixel = 1 art pixel and shown scaled up (3x) with crisp edges.
// Everything here is drawn from code, nothing is taken from the game.

const C = {
  far: "#0d1322", farSnow: "#2e3d5c",
  mid: "#132036", midSnow: "#7f96bb",
  near: "#182a45", nearSnow: "#dfe9fa",
  trunk: "#24180f",
  snow: "#f3f7ff", snow2: "#c9d6ec", snow3: "#97abcf", ice: "#bfe2ff",
  wood: "#8b5a36", wood2: "#71462a", wood3: "#4a2c1a", roof: "#33200f",
  win: "#ffcf5c", win2: "#fff3b8", winDim: "#d9902f", door: "#4f301d",
  red: "#ff5050", green: "#4fd66f", yellow: "#ffe04a", blue: "#56b8ff", orange: "#ff9a3c",
  gtree: "#1c5a3b", gtree2: "#2a7b51", gsnow: "#e2f1e7",
  post: "#262636", lamp: "#ffe9a8", coal: "#1d1d26", cloth: "#efe6cf", cloth2: "#c9b994", ink: "#3b2416",
};
const BULBS = [C.red, C.yellow, C.green, C.blue, C.orange];

function canvasArt(w, h, draw) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  const P = {
    w, h,
    rect(x, y, rw, rh, c, a = 1) { g.globalAlpha = a; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), rw, rh); g.globalAlpha = 1; },
    dot(x, y, c, a = 1) { P.rect(x, y, 1, 1, c, a); },
  };
  draw(P);
  return cv.toDataURL();
}

// A tiny pixel font (3-5 wide, 5 tall) for signs.
const GLYPHS = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], I: ["###", ".#.", ".#.", ".#.", "###"],
  L: ["#..", "#..", "#..", "#..", "###"], M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"], O: [".#.", "#.#", "#.#", "#.#", ".#."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"], T: ["###", ".#.", ".#.", ".#.", ".#."], Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"], N: ["#..#", "##.#", "#.##", "#..#", "#..#"], S: [".##", "#..", ".#.", "..#", "##."],
  " ": ["..", "..", "..", "..", ".."],
};
function textWidth(s) {
  return [...s].reduce((n, ch) => n + GLYPHS[ch][0].length + 1, -1);
}
function text(P, x, y, s, c) {
  for (const ch of s) {
    const gl = GLYPHS[ch];
    gl.forEach((row, yy) => [...row].forEach((v, xx) => v === "#" && P.dot(x + xx, y + yy, c)));
    x += gl[0].length + 1;
  }
}

// Deterministic randomness, so the scenes look the same every time.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

// A snowy pine: stacked tiers, each with a snowy ledge along its bottom and snow on its upper edges.
function pine(P, cx, base, h, body, snow, { width = h * 0.46, trunk = C.trunk, tiers } = {}) {
  const trunkH = Math.max(2, Math.round(h * 0.1));
  const crownH = h - trunkH;
  const n = tiers ?? Math.max(3, Math.round(h / 8));
  const tierH = crownH / n;
  const maxHalf = width / 2;
  P.rect(cx - 1, base - trunkH, h > 26 ? 3 : 2, trunkH, trunk);
  const top = base - trunkH - crownH;
  for (let y = 0; y < crownH; y++) {
    const t = Math.min(n - 1, Math.floor(y / tierH));
    const pos = (y - t * tierH) / tierH;
    const tierHalf = maxHalf * (0.3 + (0.7 * (t + 1)) / n);
    const half = Math.max(0, Math.round(tierHalf * (0.3 + 0.7 * pos)));
    const row = top + y;
    P.rect(cx - half, row, half * 2 + 1, 1, body);
    const ledge = y + 1 >= Math.round((t + 1) * tierH);
    if (ledge) {
      P.rect(cx - half, row, half * 2 + 1, 1, snow);
    } else if (pos > 0.35) {
      P.dot(cx - half, row, snow);
      if (pos > 0.6) P.dot(cx - half + 1, row, snow);
    }
  }
  P.dot(cx, top, snow);
}

function forestBand(P, rand, { from, to, base, minH, maxH, step, body, snow, scaleLeft }) {
  for (let x = from; x < to; x += step + Math.round(rand() * step * 0.6)) {
    let h = minH + rand() * (maxH - minH);
    if (scaleLeft && x < scaleLeft) h *= 0.4 + (0.6 * x) / scaleLeft;
    pine(P, x, base, Math.round(h), body, snow);
  }
}

// Snowy ground with soft blue shadows and a lumpy top edge.
function ground(P, rand, top) {
  for (let x = 0; x < P.w; x++) {
    const bump = Math.round(Math.sin(x / 9) * 1.2 + Math.sin(x / 23 + 1) * 1.5 + 1.5);
    P.rect(x, top - bump, 1, P.h - top + bump, C.snow);
    P.dot(x, top - bump, C.snow2);
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.round(rand() * P.w), y = top + 3 + Math.round(rand() * (P.h - top - 4));
    const w = 3 + Math.round(rand() * 8);
    P.rect(x, y, w, 1, C.snow2);
    if (rand() < 0.4) P.rect(x + 1, y + 1, w - 2, 1, C.snow3, 0.6);
  }
}

function glow(P, cx, cy, r, c, a) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r) P.dot(cx + x, cy + y, c, a * (1 - d / r) * (((x + y) & 1) === 0 ? 1 : 0.7));
    }
}

function windowAt(P, x, y, w = 7, h = 6) {
  glow(P, x + w / 2, y + h / 2, 7, C.win, 0.22);
  P.rect(x - 1, y - 1, w + 2, h + 2, C.wood3);
  P.rect(x, y, w, h, C.win);
  P.rect(x + 1, y + 1, 2, 2, C.win2);
  P.rect(x + Math.floor(w / 2), y, 1, h, C.wood3);
  P.rect(x, y + Math.floor(h / 2), w, 1, C.wood3);
  P.rect(x - 1, y - 2, w + 2, 1, C.snow); // snow on the sill above
  P.rect(x - 1, y + h + 1, w + 2, 1, C.snow2);
}

function doorAt(P, x, base, w = 7, h = 11) {
  P.rect(x - 1, base - h - 1, w + 2, h + 1, C.wood3);
  P.rect(x, base - h, w, h, C.door);
  P.rect(x + 1, base - h + 1, w - 2, 1, C.wood2);
  P.dot(x + w - 2, base - Math.round(h / 2), C.yellow);
  P.rect(x - 2, base - 1, w + 4, 1, C.snow2);
}

// A log cabin with a heavy snowy roof and icicles.
function cabin(P, rand, x, base, w, h, { roofH = 12, windows = [], door = 0.5, chimney = false, lights = false, sign = null } = {}) {
  const ov = 4;
  const cx = x + w / 2;
  // walls
  P.rect(x, base - h, w, h, C.wood);
  for (let yy = base - h + 2; yy < base; yy += 3) P.rect(x, yy, w, 1, C.wood2);
  P.rect(x, base - h, 2, h, C.wood3);
  P.rect(x + w - 2, base - h, 2, h, C.wood3);
  // chimney (behind the roof snow)
  if (chimney) {
    const chx = Math.round(x + w * 0.72);
    P.rect(chx, base - h - roofH - 2, 5, roofH, "#5b5566");
    P.rect(chx - 1, base - h - roofH - 4, 7, 2, C.snow);
    for (let i = 0; i < 4; i++) P.rect(chx + 1 + i, base - h - roofH - 8 - i * 4, 3 - (i > 1), 2, "#9a98ae", 0.5 - i * 0.1);
  }
  // roof: a thick snow gable with a dark fascia
  const top = base - h - roofH;
  for (let r = 0; r < roofH; r++) {
    const half = Math.round(((r + 1) / roofH) * (w / 2 + ov));
    P.rect(cx - half, top + r, half * 2, 1, C.snow);
    P.rect(cx + Math.round(half * 0.25), top + r, Math.round(half * 0.75), 1, C.snow2);
    P.dot(cx - half, top + r, C.snow2);
  }
  P.rect(cx - 1, top - 1, 2, 1, C.snow);
  P.rect(x - ov, base - h, w + ov * 2, 2, C.roof);
  P.rect(x - ov, base - h - 1, w + ov * 2, 1, C.snow3);
  // icicles
  for (let ix = x - ov + 1; ix < x + w + ov - 1; ix += 2 + Math.round(rand() * 3)) {
    P.rect(ix, base - h + 2, 1, 1 + Math.round(rand() * 2), C.ice);
  }
  // string lights along the eaves
  if (lights) {
    for (let i = 0, lx = x - ov + 2; lx < x + w + ov - 2; lx += 4, i++) {
      const sag = Math.round(Math.sin((i % 3) * 1.4)) + 1;
      P.dot(lx, base - h + 2, C.coal);
      P.rect(lx, base - h + 3 + sag, 1, 2, BULBS[i % BULBS.length]);
      glow(P, lx, base - h + 4 + sag, 2, BULBS[i % BULBS.length], 0.25);
    }
  }
  for (const [wx, wy] of windows) windowAt(P, x + wx, base - h + wy);
  if (door != null) doorAt(P, Math.round(x + w * door - 3), base);
  if (sign) {
    const tw = textWidth(sign);
    const sx = Math.round(cx - tw / 2 - 3), sy = base - h + 7;
    P.rect(sx - 1, sy - 1, tw + 8, 9, C.wood3);
    P.rect(sx, sy, tw + 6, 7, "#a0703f");
    P.rect(sx, sy, tw + 6, 1, C.snow);
    text(P, sx + 3, sy + 1, sign, "#fff1d6");
  }
  // snow drifting against the walls
  P.rect(x - 2, base - 2, w + 4, 2, C.snow);
}

function lampPost(P, x, base, h = 26) {
  glow(P, x + 1, base - h + 2, 13, C.lamp, 0.38);
  P.rect(x, base - h + 4, 2, h - 4, C.post);
  P.rect(x - 2, base - h, 6, 1, C.post);
  P.rect(x - 1, base - h + 1, 4, 3, C.lamp);
  P.rect(x - 2, base - h + 4, 6, 1, C.post);
  P.rect(x - 2, base - h - 1, 6, 1, C.snow);
  P.rect(x - 1, base - 1, 4, 1, C.snow2);
}

function snowman(P, x, base) {
  const ball = (cx, cy, r) => {
    for (let y = -r; y <= r; y++)
      for (let xx = -r; xx <= r; xx++)
        if (xx * xx + y * y <= r * r + r) P.dot(cx + xx, cy + y, xx + y > r * 0.6 ? C.snow2 : C.snow);
  };
  ball(x, base - 5, 5);
  ball(x, base - 13, 4);
  ball(x, base - 19, 3);
  P.dot(x - 1, base - 20, C.coal);
  P.dot(x + 1, base - 20, C.coal);
  P.rect(x + 1, base - 19, 2, 1, C.orange);
  P.dot(x, base - 13, C.coal);
  P.dot(x, base - 11, C.coal);
  P.rect(x - 8, base - 15, 4, 1, C.trunk);
  P.dot(x - 9, base - 16, C.trunk);
  P.rect(x + 5, base - 14, 4, 1, C.trunk);
  P.dot(x + 9, base - 15, C.trunk);
}

// The decorated tree in the middle of town, with presents.
function giftTree(P, cx, base, h) {
  pine(P, cx, base, h, C.gtree, C.gsnow, { width: h * 0.62, trunk: "#3a2414" });
  const rand = rng(77);
  for (let i = 0; i < 26; i++) {
    const y = base - Math.round(h * 0.15) - Math.round(rand() * h * 0.72);
    const spread = ((base - y) / h) * 0;
    const reach = Math.round((h * 0.62 * 0.5) * (1 - (base - y) / h) * 0.9);
    const x = cx - reach + Math.round(rand() * reach * 2) + spread;
    const c = BULBS[i % BULBS.length];
    glow(P, x, y, 2, c, 0.4);
    P.dot(x, y, c);
  }
  // star
  const sy = base - h - 2;
  P.rect(cx - 1, sy - 1, 3, 3, C.yellow);
  P.dot(cx, sy - 3, C.yellow); P.dot(cx, sy + 3, C.yellow); P.dot(cx - 3, sy, C.yellow); P.dot(cx + 3, sy, C.yellow);
  P.dot(cx, sy - 2, C.yellow); P.dot(cx, sy + 2, C.yellow); P.dot(cx - 2, sy, C.yellow); P.dot(cx + 2, sy, C.yellow);
  glow(P, cx, sy, 6, C.yellow, 0.25);
  // presents
  const gift = (x, w, hh, c, rib) => {
    P.rect(x, base - hh, w, hh, c);
    P.rect(x + Math.floor(w / 2), base - hh, 1, hh, rib);
    P.rect(x, base - hh + 1, w, 1, rib);
    P.rect(x + Math.floor(w / 2) - 1, base - hh - 1, 3, 1, rib);
  };
  gift(cx - 12, 6, 5, C.red, C.yellow);
  gift(cx - 5, 5, 4, C.blue, C.snow);
  gift(cx + 4, 7, 6, C.green, C.red);
  gift(cx + 12, 4, 3, C.orange, C.snow);
}

// A cloth banner on two poles.
function banner(P, x1, x2, y, base, words) {
  for (const px of [x1, x2]) {
    P.rect(px, y - 2, 2, base - y + 2, C.wood3);
    P.rect(px - 1, y - 3, 4, 1, C.snow);
  }
  const tw = textWidth(words);
  const w = x2 - x1 - 4;
  P.rect(x1 + 2, y, w + 2, 9, C.cloth2);
  P.rect(x1 + 3, y, w, 8, C.cloth);
  P.rect(x1 + 3, y, w, 1, C.snow);
  text(P, Math.round(x1 + 3 + (w - tw) / 2), y + 2, words, C.ink);
}

// A wooden sentry station.
function sentry(P, rand, x, base) {
  const w = 26;
  P.rect(x + 2, base - 22, 2, 22, C.wood3);
  P.rect(x + w - 4, base - 22, 2, 22, C.wood3);
  // counter
  P.rect(x, base - 10, w, 10, C.wood);
  for (let yy = base - 8; yy < base; yy += 3) P.rect(x, yy, w, 1, C.wood2);
  P.rect(x - 1, base - 11, w + 2, 2, C.wood3);
  P.rect(x - 1, base - 12, w + 2, 1, C.snow);
  // roof
  P.rect(x - 3, base - 25, w + 6, 3, C.roof);
  P.rect(x - 3, base - 28, w + 6, 3, C.snow);
  P.rect(x - 1, base - 29, w + 2, 1, C.snow);
  for (let ix = x - 2; ix < x + w + 2; ix += 3 + Math.round(rand() * 2)) P.rect(ix, base - 22, 1, 1 + Math.round(rand() * 2), C.ice);
  P.rect(x - 2, base - 2, w + 4, 2, C.snow);
}

function townScene(w = 427, h = 72) {
  return canvasArt(w, h, (P) => {
    const rand = rng(11);
    const g = h - 9;
    forestBand(P, rand, { from: 4, to: w, base: g - 6, minH: 18, maxH: 34, step: 7, body: C.far, snow: C.farSnow, scaleLeft: 230 });
    forestBand(P, rand, { from: 150, to: w, base: g - 2, minH: 24, maxH: 40, step: 19, body: C.mid, snow: C.midSnow, scaleLeft: 260 });
    banner(P, 282, 377, 9, g, "WELCOME TO DA LIBRARBY");
    cabin(P, rand, 226, g, 52, 32, { roofH: 15, windows: [[7, 6], [37, 6], [7, 19]], door: 0.72, chimney: true });
    giftTree(P, 330, g, 36);
    lampPost(P, 296, g, 26);
    cabin(P, rand, 379, g, 44, 30, { roofH: 13, windows: [[5, 18], [32, 18]], door: 0.5, lights: true, sign: "LIBRARBY" });
    snowman(P, 214, g + 1);
    lampPost(P, 168, g, 22);
    ground(P, rand, g);
  });
}

function forestScene(w = 427, h = 72) {
  return canvasArt(w, h, (P) => {
    const rand = rng(5);
    const g = h - 9;
    forestBand(P, rand, { from: 2, to: w, base: g - 7, minH: 20, maxH: 36, step: 6, body: C.far, snow: C.farSnow, scaleLeft: 240 });
    forestBand(P, rand, { from: 120, to: w, base: g - 3, minH: 30, maxH: 48, step: 13, body: C.mid, snow: C.midSnow, scaleLeft: 260 });
    pine(P, 352, g + 1, 54, C.near, C.nearSnow);
    lampPost(P, 372, g, 27);
    sentry(P, rand, 384, g);
    pine(P, 420, g + 1, 60, C.near, C.nearSnow);
    ground(P, rand, g);
    // footprints along the path
    for (let x = 140; x < w; x += 9) P.rect(x, g + 3 + ((x / 9) & 1) * 2, 2, 1, C.snow3);
  });
}
