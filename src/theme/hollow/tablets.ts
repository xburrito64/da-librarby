// The stone tablets (the home banner's description, a show's description, its About, a season's
// header, the episode up next): each carved on its own. Its broken outline, the stone (a tint, grain,
// rain stains, lichen, a crack, now and then a carving) and what sits on it (a cobweb, moss, grass,
// mushrooms or ivy, now and then a candle stub, a fallen leaf or a snail) all come from a seed: what
// the tablet shows (the show's name, which tablet), so a show always gets the same stone and every
// show its own. Two or three things on a tablet, kept off the words; tablets side by side differ.
//
// Drawn as two pictures the stylesheet puts under and over the tablet (hollow.css), so nothing is
// added inside the page's own elements.

/** Which elements are tablets. */
const TABLETS = ".hero__desc-box, .tp__desc-box, .mabout__group, .tp__seasonbar, .ep.is-next";

/** How far the things on a tablet may reach out past its edges (px); hollow.css matches it. */
const PAD = 28;

/** One tablet in about this many gets a rare extra. */
const EXTRA_CHANCE = 0.14;

const TINTS = [
  ["#34293f", "#261d31", "#1d1626"],
  ["#2f2d3b", "#22222e", "#191921"],
  ["#3a2b3b", "#2a1f2b", "#1f171f"],
  ["#302a42", "#232033", "#1a1727"],
];

const GREENS = ["#3c5a30", "#4f7040", "#2e4526", "#456638"];

const CARVINGS: Record<string, string> = {
  moon: "M2.4 -6.6A6.8 6.8 0 1 0 2.4 6.6A5.4 5.4 0 0 1 2.4 -6.6Z",
  rune: "M0 7.5V-7.5M0 -.5L-5.2 -7M0 -.5L5.2 -7",
  pumpkin: "M-6.5 .5C-6.5 -4 -3.4 -6 0 -6C3.4 -6 6.5 -4 6.5 .5C6.5 4.6 3.4 6.4 0 6.4C-3.4 6.4 -6.5 4.6 -6.5 .5ZM0 -6L.6 -8.6M-3.6 -1.2L-1.6 -1.2L-2.6 -3.2ZM1.6 -1.2L3.6 -1.2L2.6 -3.2ZM-3.8 2Q0 4.8 3.8 2",
  spiral: "M0 0C1.2 0 1.6 1.4 .6 2.2C-.8 3.2 -3 2.2 -3 0C-3 -2.8 0 -4.4 2.6 -3.4C5.6 -2.2 6 2 3.8 4.2C1.2 6.8 -4 6.4 -6 3",
};

type Corner = "tl" | "tr" | "br" | "bl";

/** What a tablet got, so the one beside it can get something else. */
interface Used {
  web: Corner | null;
  growth: string | null;
  extra: string | null;
  tint: number;
}

interface Carved {
  clip: string;
  tint: string;
  stone: string;
  bits: string;
  used: Used;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

const random = (seed: string) => {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const n1 = (n: number) => +n.toFixed(1);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Carves a tablet `w`×`h` from `seed`, unlike `beside` (the tablet before it) where it can be. */
function carve(w: number, h: number, seed: string, beside: Used | null): Carved {
  const r = random(seed);
  const R = (a: number, b: number) => a + (b - a) * r();
  const chance = (p: number) => r() < p;
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const weighted = <K extends string>(o: Record<K, number>): K => {
    const e = (Object.entries(o) as [K, number][]).filter(([, v]) => v > 0);
    let t = e.reduce((s, [, v]) => s + v, 0) * r();
    for (const [k, v] of e) if ((t -= v) < 0) return k;
    return e[e.length - 1][0];
  };
  const small = h < 120;
  const tall = h > 250;

  // Room taken by what's already there (so nothing sits on anything else).
  const taken: [number, number, number, number][] = [];
  const free = (x0: number, y0: number, x1: number, y1: number) => !taken.some((c) => x0 < c[2] && x1 > c[0] && y0 < c[3] && y1 > c[1]);
  const take = (x0: number, y0: number, x1: number, y1: number) => taken.push([x0, y0, x1, y1]);

  // What it gets: one or two things on a small tablet, two or three on others, rarely an extra.
  const things = new Set<string>();
  const pool: Record<string, number> = { web: beside?.web ? 1.5 : 3, growth: 3, crack: 2.4, lichen: 1.4, stain: 1.1 };
  const count = small ? (chance(0.5) ? 1 : 2) : chance(0.45) ? 2 : 3;
  while (things.size < count) {
    const k = weighted(pool);
    things.add(k);
    pool[k] = 0;
  }
  if (chance(EXTRA_CHANCE)) things.add("extra");

  // The outline: each corner worn round or cut, now and then one broken off; chips along the sides.
  const corners: Corner[] = ["tl", "tr", "br", "bl"];
  const chunkAt = chance(0.16) ? pick(corners) : null;
  const corner = {} as Record<Corner, number[][]>;
  for (const c of corners) {
    if (c === chunkAt) {
      const B = R(16, small ? 18 : 26);
      corner[c] = [[0, B], [B * R(0.18, 0.3), B * R(0.62, 0.75)], [B * R(0.45, 0.58), B * R(0.42, 0.55)], [B * R(0.6, 0.72), B * R(0.12, 0.24)], [B, 0]];
      continue;
    }
    const a = R(2, 9);
    const b = R(2, 9);
    corner[c] = chance(0.45) ? [[0, b], [a * R(0.22, 0.4), b * R(0.22, 0.4)], [a, 0]] : [[0, b], [a, 0]];
  }
  const at: Record<Corner, (u: number, v: number) => [number, number]> = {
    tl: (u, v) => [u, v],
    tr: (u, v) => [w - u, v],
    br: (u, v) => [w - u, h - v],
    bl: (u, v) => [u, h - v],
  };
  const cornerPoints = (c: Corner) => {
    const p = corner[c].map(([u, v]) => at[c](u, v));
    return c === "tr" || c === "bl" ? p.reverse() : p;
  };
  const along = (c: Corner) => corner[c][corner[c].length - 1][0];
  const down = (c: Corner) => corner[c][0][1];
  interface Chip { p: number; cw: number; d: number; m: number; two: boolean }
  const side = (len: number, from: number, to: number) => {
    const n = Math.max(0, Math.round((len / 230) * R(0.3, 1.5)));
    const out: Chip[] = [];
    for (let tries = 0; out.length < n && tries < 40; tries++) {
      const cw = R(6, 18);
      const p = R(from + 8, to - cw - 8);
      if (out.every((o) => p + cw + 12 < o.p || p > o.p + o.cw + 12)) out.push({ p, cw, d: R(1.5, 4.5), m: R(0.3, 0.7), two: chance(0.3) });
    }
    return out.sort((a, b) => a.p - b.p);
  };
  const chipShape = (c: Chip) => (c.two ? [[0, 0], [c.cw * c.m * 0.45, c.d * 0.85], [c.cw * c.m, c.d], [c.cw, 0]] : [[0, 0], [c.cw * c.m, c.d], [c.cw, 0]]);
  // Where cracks may start: the deepest point of each chip, and which way is into the stone.
  const starts: { x: number; y: number; nx: number; ny: number }[] = [];
  const pts: number[][] = [...cornerPoints("tl")];
  for (const c of side(w, along("tl"), w - along("tr"))) {
    pts.push(...chipShape(c).map(([t, s]) => [c.p + t, s]));
    starts.push({ x: c.p + c.cw * c.m, y: c.d, nx: 0, ny: 1 });
  }
  pts.push(...cornerPoints("tr"));
  for (const c of side(h, down("tr"), h - down("br"))) {
    pts.push(...chipShape(c).map(([t, s]) => [w - s, c.p + t]));
    starts.push({ x: w - c.d, y: c.p + c.cw * c.m, nx: -1, ny: 0 });
  }
  pts.push(...cornerPoints("br"));
  for (const c of side(w, along("bl"), w - along("br")).reverse()) {
    pts.push(...chipShape(c).reverse().map(([t, s]) => [c.p + t, h - s]));
    starts.push({ x: c.p + c.cw * c.m, y: h - c.d, nx: 0, ny: -1 });
  }
  pts.push(...cornerPoints("bl"));
  for (const c of side(h, down("tl"), h - down("bl")).reverse()) {
    pts.push(...chipShape(c).reverse().map(([t, s]) => [s, c.p + t]));
    starts.push({ x: c.d, y: c.p + c.cw * c.m, nx: 1, ny: 0 });
  }
  const clip = `polygon(${pts.map(([x, y]) => `${n1(x)}px ${n1(y)}px`).join(",")})`;

  // The stone: a tint (mostly the usual one), soft weathering and a fine grain.
  const tintAt = Number(weighted({ 0: 3, 1: 1, 2: 1, 3: 1, ...(beside ? { [beside.tint]: 0.4 } : {}) }));
  const t = TINTS[tintAt];
  const tint = `linear-gradient(${n1(R(160, 180))}deg, ${t[0]} 0%, ${t[1]} 55%, ${t[2]} 100%)`;
  let stone = `<defs>
<filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${Math.floor(R(1, 999))}"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0"/></filter>
<filter id="m" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${n1(R(0.8, 1.6)) / 100}" numOctaves="3" seed="${Math.floor(R(1, 999))}"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.2 0 0 0 -1.05"/></filter>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a060e" stop-opacity=".34"/><stop offset="1" stop-color="#0a060e" stop-opacity="0"/></linearGradient>
<filter id="b"><feGaussianBlur stdDeviation="4"/></filter>
</defs><rect width="${w}" height="${h}" filter="url(#m)" opacity=".3"/><rect width="${w}" height="${h}" filter="url(#g)" opacity=".055"/>`;
  let bits = `<defs><filter id="glow" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="2.4"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="sh" x="-1" y="-1" width="3" height="3"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000" flood-opacity=".6"/></filter></defs>`;

  // Where rain ran down.
  if (things.has("stain")) {
    for (let i = 0, n = 1 + Math.floor(R(0, 2.6)); i < n; i++) {
      const x = R(w * 0.2, w - 24);
      const sw = R(8, 24);
      stone += `<rect x="${n1(x - sw / 2)}" y="-6" width="${n1(sw)}" height="${n1(h * R(0.35, 0.8))}" rx="${n1(sw / 2)}" fill="url(#s)" filter="url(#b)"/>`;
    }
  }

  // Something growing at its foot, or ivy creeping down a side.
  let ivyCorner: Corner | null = null;
  const growth = things.has("growth") ? weighted({ moss: 3, grass: 2, mushrooms: 1.3, ivy: h > 150 ? 1.6 : 0, ...(beside?.growth ? { [beside.growth]: 0 } : {}) }) : null;
  const clump = (x: number, W: number, H: number, fill: string) => {
    const n = Math.max(3, Math.round(W / 15));
    let d = `M${n1(x)} ${h + 1}`;
    for (let i = 0; i < n; i++) {
      const top = h - H * R(0.7, 1) * (1 - Math.abs((i + 0.5) / n - 0.5) * 0.6);
      d += ` Q${n1(x + (W * (i + 0.5)) / n)} ${n1(top - 5)} ${n1(x + (W * (i + 1)) / n)} ${n1(i === n - 1 ? h + 1 : h - R(0, 3))}`;
    }
    return `<path d="${d}Z" fill="${fill}"/>`;
  };
  const moss = (x: number, W: number, H: number) => {
    let s = clump(x - W * 0.06, W * 1.1, H * 0.8, "#283322") + clump(x, W, H, "#33402a");
    for (let i = 0; i < W / 14; i++) s += `<path d="M${n1(x + R(6, W - 6) - 3)} ${n1(h - R(2, H * 0.6))}q3 -2.2 6 0" stroke="#4a5e36" stroke-width="1" fill="none"/>`;
    for (let i = 0; i < W / 18; i++) s += `<circle cx="${n1(x + R(4, W - 4))}" cy="${n1(h - R(1, H * 0.5))}" r=".8" fill="#6c8a48"/>`;
    return s;
  };
  if (growth === "ivy") {
    ivyCorner = chance(0.7) ? "tr" : "tl";
    const right = ivyCorner === "tr";
    const sg = right ? -1 : 1;
    const edge = right ? w : 0;
    const length = h * R(0.38, 0.72);
    const run = R(24, 60);
    const leaves: number[][] = [];
    let top = `M${edge} ${n1(R(2, 4))}`;
    for (let d = 10; d < run; d += 10) {
      const y = R(1.5, 5);
      top += ` L${n1(edge + sg * d)} ${n1(y)}`;
      leaves.push([edge + sg * d, y, Math.PI / 2 + (leaves.length % 2 ? 1 : -1) * R(0.7, 1.5)]);
    }
    let vine = `M${edge} 1`;
    let x = edge + sg * R(4, 7);
    for (let y = 2; y < length; y += R(9, 13)) {
      x = clamp(x + R(-2.5, 2.5), Math.min(edge + sg * 3, edge + sg * 11), Math.max(edge + sg * 3, edge + sg * 11));
      vine += ` L${n1(x)} ${n1(y)}`;
      leaves.push([x, y, (right ? Math.PI : 0) + (leaves.length % 2 ? 1 : -1) * R(0.5, 1.4)]);
    }
    bits += `<g filter="url(#sh)"><path d="${vine}" stroke="#2a3d22" stroke-width="1.3" fill="none" stroke-linejoin="round"/><path d="${top}" stroke="#2a3d22" stroke-width="1.2" fill="none"/>`;
    for (const [lx, ly, a] of leaves) {
      bits += `<g transform="translate(${n1(lx)} ${n1(ly)}) rotate(${n1((a * 180) / Math.PI + 90)}) scale(${n1(R(0.9, 1.4))})"><path d="M0 0C-3 -1 -5 -4 -3.6 -6.2C-2.6 -7.6 -1 -6.6 0 -8.4C1 -6.6 2.6 -7.6 3.6 -6.2C5 -4 3 -1 0 0Z" fill="${pick(GREENS)}"/><path d="M0 0V-6.5" stroke="#243620" stroke-width=".5"/></g>`;
    }
    bits += `</g>`;
    take(right ? w - 20 : 0, 0, right ? w : 20, length + 6);
    take(right ? w - run - 8 : 0, 0, right ? w : run + 8, 12);
  } else if (growth) {
    const W = growth === "moss" ? R(small ? 44 : 54, small ? 72 : 104) : growth === "grass" ? 34 : 44;
    let x: number | null = null;
    for (let i = 0; i < 12 && x == null; i++) {
      const c = R(10, Math.max(10, w - W - 10));
      if (free(c - 4, h - 34, c + W + 4, h + 2)) x = c;
    }
    if (x != null) {
      if (growth === "moss") bits += moss(x, W, R(small ? 10 : 12, small ? 14 : 19));
      if (growth === "grass") {
        bits += moss(x + 3, 28, 7);
        for (let i = 0, n = Math.round(R(6, 10)); i < n; i++) {
          const bx = x + R(6, 28);
          const H = R(9, small ? 15 : 19);
          const lean = R(-9, 9);
          bits += `<path d="M${n1(bx)} ${h + 1}Q${n1(bx + lean * 0.25)} ${n1(h - H * 0.6)} ${n1(bx + lean)} ${n1(h - H)}" stroke="${pick(["#4a5e36", "#5d7a3e", "#3c5a30", "#6b8a45"])}" stroke-width="${n1(R(1, 1.7))}" fill="none" stroke-linecap="round"/>`;
        }
      }
      if (growth === "mushrooms") {
        const glow = chance(0.55);
        const cap = glow ? pick(["#c9a2ff", "#9ff0d0", "#ffb35c"]) : pick(["#d9c7a6", "#b9774a"]);
        bits += moss(x, W, 7);
        let sx = x + R(7, 12);
        for (let i = 0, n = 2 + (chance(0.5) ? 1 : 0); i < n; i++) {
          const H = R(7, 13);
          const cw = R(8, 13);
          bits += `<path d="M${n1(sx - 1.7)} ${h - 2}L${n1(sx - 1.1)} ${n1(h - H)}H${n1(sx + 1.1)}L${n1(sx + 1.7)} ${h - 2}Z" fill="#e3d6bb"/><path d="M${n1(sx - cw / 2)} ${n1(h - H + 1)}Q${n1(sx)} ${n1(h - H - cw * 0.95)} ${n1(sx + cw / 2)} ${n1(h - H + 1)}Z" fill="${cap}"${glow ? ` filter="url(#glow)"` : ""}/>`;
          if (!glow) bits += `<circle cx="${n1(sx - cw * 0.15)}" cy="${n1(h - H - cw * 0.25)}" r="1.1" fill="#f3ead8" opacity=".8"/>`;
          sx += R(8, 13);
        }
      }
      take(x, h - 22, x + W, h + 2);
    }
  }

  // A cobweb in a corner (small at the top left, where the heading is; never the bottom left,
  // where the words are): now and then torn, sometimes with someone at home.
  let web: Corner | null = null;
  if (things.has("web")) {
    const weights: Record<Corner, number> = { tl: 1, tr: 2.2, bl: 0, br: 0.35 };
    if (beside?.web) weights[beside.web] = 0;
    if (ivyCorner) weights[ivyCorner] = 0;
    for (const c of corners) {
      const [x, y] = at[c](0, 0);
      const x1 = x + (c[1] === "r" ? -40 : 40);
      const y1 = y + (c[0] === "b" ? -40 : 40);
      if (!free(Math.min(x, x1), Math.min(y, y1), Math.max(x, x1), Math.max(y, y1))) weights[c] = 0;
    }
    if (Object.values(weights).some((v) => v > 0)) {
      web = weighted(weights);
      const S = web === "tl" ? R(21, 28) : tall ? R(37, 55) : R(25, 35);
      const k = Math.round(R(4, 6.4));
      const ang = Array.from({ length: k }, (_, i) => ((R(2, 7) + (i * (R(80, 87) - 4)) / (k - 1) + R(-3, 3)) * Math.PI) / 180);
      const len = ang.map(() => S * R(0.82, 1.05));
      const P = (i: number, fr: number) => at[web!](Math.cos(ang[i]) * len[i] * fr, Math.sin(ang[i]) * len[i] * fr);
      const [ox, oy] = at[web](0, 0);
      const torn = chance(0.3);
      const nr = Math.round(R(3, 4.4));
      const rings = Array.from({ length: nr }, (_, j) => (j + 1) / (nr + 0.25) + R(-0.04, 0.04));
      const gap = torn ? [rings.length - 1 - Math.floor(R(0, 2)), Math.floor(R(0, k - 1))] : null;
      let d = "";
      for (let i = 0; i < k; i++) {
        const [x, y] = P(i, 1);
        d += `M${n1(ox)} ${n1(oy)}L${n1(x)} ${n1(y)}`;
      }
      rings.forEach((fr, j) => {
        for (let i = 0; i < k - 1; i++) {
          if (gap && j >= gap[0] && (i === gap[1] || (j === rings.length - 1 && i === gap[1] + 1))) continue;
          const [x1, y1] = P(i, fr);
          const [x2, y2] = P(i + 1, fr);
          d += `M${n1(x1)} ${n1(y1)}Q${n1(ox + ((x1 + x2) / 2 - ox) * 0.86)} ${n1(oy + ((y1 + y2) / 2 - oy) * 0.86)} ${n1(x2)} ${n1(y2)}`;
        }
      });
      bits += `<path d="${d}" stroke="rgba(243,234,216,.42)" stroke-width=".7" fill="none"/>`;
      let spider: number[] | null = null;
      if (gap && web === "tr") {
        const [x, y] = P(clamp(gap[1], 0, k - 1), rings[rings.length - 1]);
        const L = R(10, 24);
        const sw = R(-6, 6);
        bits += `<path d="M${n1(x)} ${n1(y)}q${n1(sw)} ${n1(L * 0.5)} ${n1(sw * 0.4)} ${n1(L)}q${n1(-sw * 0.3)} 2 ${n1(sw * 0.2)} 3.5" stroke="rgba(243,234,216,.4)" stroke-width=".6" fill="none"/>`;
        if (chance(0.5)) spider = [x + sw * 0.4, y + L + 6];
      }
      if (web === "tr" && !spider && chance(0.25)) spider = P(Math.floor(k / 2), rings[Math.min(1, rings.length - 1)] + 0.08);
      if (spider) {
        let legs = "";
        for (const sx of [-1, 1]) {
          for (let i = 0; i < 4; i++) {
            const ya = [-1.2, -0.3, 0.5, 1.3][i];
            legs += `<path d="M0 ${ya}L${n1(sx * 3.4)} ${n1(ya - 2.4 + i * 0.9)}L${n1(sx * 5.4)} ${n1(ya - 1.8 + i * 2.5)}"/>`;
          }
        }
        bits += `<g transform="translate(${n1(spider[0])} ${n1(spider[1])}) scale(1.6)"><g stroke="#140d1b" stroke-width=".9" fill="none" stroke-linecap="round" stroke-linejoin="round">${legs}</g><ellipse cx="0" cy="1.2" rx="2.7" ry="3.3" fill="#140d1b" stroke="rgba(201,182,238,.45)" stroke-width=".5"/><circle cx="0" cy="-2.2" r="1.8" fill="#140d1b" stroke="rgba(201,182,238,.45)" stroke-width=".5"/><circle cx="-.65" cy="-2.5" r=".4" fill="#ff9a45"/><circle cx=".65" cy="-2.5" r=".4" fill="#ff9a45"/></g>`;
      }
      take(Math.min(ox, web[1] === "r" ? w - S : S), Math.min(oy, web[0] === "b" ? h - S : S), Math.max(ox, web[1] === "r" ? w - S : S), Math.max(oy, web[0] === "b" ? h - S : S));
    }
  }

  // Lichen speckles by an edge.
  if (things.has("lichen")) {
    const spread = h < 200 ? 11 : 20;
    const spots = [[w - R(5, 10), R(h * 0.3, h * 0.75)], [R(w * 0.5, w - 20), h - R(3, 7)], [R(w * 0.55, w - 30), R(3, 7)], [R(20, w * 0.4), h - R(3, 7)]].sort(() => r() - 0.5);
    const [lx, ly] = spots.find(([x, y]) => free(x - 14, y - 14, x + 14, y + 14)) ?? spots[0];
    const col = pick(["#a9c38a", "#d0843f", "#d9cf8a", "#a9c38a"]);
    for (let i = 0, n = Math.round(R(14, 26)); i < n; i++) {
      const a = R(0, Math.PI * 2);
      const dd = Math.abs(R(-1, 1) * R(0, 1)) * spread;
      const rr = R(1, spread > 11 ? 3.4 : 2.6);
      const cx = n1(lx + Math.cos(a) * dd);
      const cy = n1(ly + Math.sin(a) * dd * 0.8);
      stone += chance(0.25)
        ? `<circle cx="${cx}" cy="${cy}" r="${n1(rr + 0.6)}" fill="none" stroke="${col}" stroke-width=".6" opacity="${n1(R(0.3, 0.5))}"/>`
        : `<circle cx="${cx}" cy="${cy}" r="${n1(rr)}" fill="${col}" opacity="${n1(R(0.28, 0.5))}"/>`;
    }
    take(lx - 14, ly - 14, lx + 14, ly + 14);
  }

  // A crack, from a chip in the right side (or near the right end of the top or foot) or the broken
  // corner, staying close to where it starts (away from the words).
  if (things.has("crack") || (chunkAt && chunkAt !== "tl" && chunkAt !== "bl")) {
    const right = starts.filter((c) => c.nx === -1 || c.x > w * 0.75);
    const reach = small ? 34 : tall ? 80 : 50;
    const from =
      chunkAt === "tr" || chunkAt === "br"
        ? (() => {
            const [x, y] = at[chunkAt](corner[chunkAt][2][0], corner[chunkAt][2][1]);
            return { x, y, nx: -1, ny: chunkAt[0] === "b" ? -1 : 1 };
          })()
        : right.length
          ? pick(right)
          : { x: w, y: R(h * 0.2, h * 0.8), nx: -1, ny: 0 };
    const walk = (x: number, y: number, a: number, n: number) => {
      let d = `M${n1(x)} ${n1(y)}`;
      const p: number[][] = [];
      for (let i = 0; i < n; i++) {
        a += R(-0.4, 0.4);
        const L = R(7, 14);
        x = clamp(x + Math.cos(a) * L, Math.max(w * 0.5, from.x - reach), w - 3);
        y = clamp(y + Math.sin(a) * L, Math.max(3, from.y - reach), Math.min(h - 3, from.y + reach));
        d += `L${n1(x)} ${n1(y)}`;
        p.push([x, y, a]);
      }
      return { d, p };
    };
    const main = walk(from.x, from.y, Math.atan2(from.ny, from.nx) + R(-0.5, 0.5), Math.round(R(5, small ? 6 : 10)));
    let d = main.d;
    if (main.p.length > 2 && chance(0.7)) {
      const [bx, by, ba] = pick(main.p.slice(1, -1));
      d += walk(bx, by, ba + (chance(0.5) ? 1 : -1) * R(0.6, 1.1), Math.round(R(2, 4))).d;
    }
    stone += `<path d="${d}" stroke="rgba(255,255,255,.08)" stroke-width="1" fill="none" transform="translate(.6 1)" stroke-linejoin="bevel"/><path d="${d}" stroke="#0f0a15" stroke-width="1.35" fill="none" opacity=".95" stroke-linejoin="bevel"/>`;
  }

  // Rare: a carving, a burnt-down candle, a fallen leaf, a snail.
  let extra: string | null = null;
  if (things.has("extra")) {
    extra = weighted({ carved: 1.2, wax: 1, leaf: 1, snail: 1, ...(beside?.extra ? { [beside.extra]: 0 } : {}) });
    if (extra === "carved") {
      const path = CARVINGS[pick(Object.keys(CARVINGS))];
      const spots = [[w - R(30, 46), h - R(26, 34)], [w - R(30, 46), R(30, 40)], [w * R(0.55, 0.8), h - R(24, 30)]];
      const [x, y] = spots.find(([x, y]) => free(x - 18, y - 18, x + 18, y + 18)) ?? spots[0];
      stone += `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(R(-12, 12))}) scale(${n1(R(1.7, 2.1))})" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${path}" stroke="rgba(255,255,255,.14)" stroke-width="1" transform="translate(.5 .6)"/><path d="${path}" stroke="#0d0812" stroke-width="1.1" opacity=".9"/></g>`;
      take(x - 18, y - 18, x + 18, y + 18);
    }
    if (extra === "wax") {
      let x: number | null = null;
      for (let i = 0; i < 12 && x == null; i++) {
        const c = R(w * 0.5, w - 60);
        if (free(c - 4, 0, c + 44, 30)) x = c;
      }
      x ??= w * 0.62;
      const W = R(28, 40);
      let rim = `M${n1(x)} 2C${n1(x - 1)} -1 ${n1(x + 3)} -2.4 ${n1(x + W * 0.5)} -2.4C${n1(x + W - 3)} -2.4 ${n1(x + W + 1)} -1 ${n1(x + W)} 2`;
      for (let i = 6, px = x + W; i > 0; i--) {
        const nx = x + (W * (i - 1)) / 6;
        rim += `Q${n1((px + nx) / 2)} ${n1(R(4.5, 7.5))} ${n1(nx)} ${n1(i === 1 ? 2 : R(2.5, 4))}`;
        px = nx;
      }
      let wax = `<path d="${rim}Z"/>`;
      const lengths = [R(16, 26), R(6, 10), R(10, 17)].sort(() => r() - 0.5);
      for (let i = 0, n = 2 + Math.floor(R(0, 1.8)); i < n; i++) {
        const dx = x + 6 + ((W - 12) * (i + R(0.25, 0.75))) / n;
        const L = lengths[i];
        const dw = R(3.4, 5);
        wax += `<path d="M${n1(dx - dw * 0.7)} 4C${n1(dx - dw * 0.3)} ${n1(4 + L * 0.3)} ${n1(dx - dw * 0.3)} ${n1(4 + L * 0.6)} ${n1(dx - dw * 0.5)} ${n1(4 + L - dw * 0.4)}A${n1(dw * 0.5)} ${n1(dw * 0.5)} 0 1 0 ${n1(dx + dw * 0.5)} ${n1(4 + L - dw * 0.4)}C${n1(dx + dw * 0.3)} ${n1(4 + L * 0.6)} ${n1(dx + dw * 0.3)} ${n1(4 + L * 0.3)} ${n1(dx + dw * 0.7)} 4Z"/>`;
      }
      bits += `<defs><linearGradient id="w" x1="0" x2="1"><stop offset="0" stop-color="#f6ecd4"/><stop offset=".7" stop-color="#e9dbb8"/><stop offset="1" stop-color="#cbb98f"/></linearGradient></defs><g fill="url(#w)" filter="url(#sh)">${wax}</g><g transform="translate(${n1(x + W * R(0.35, 0.6))} -1)"><rect x="-4" y="-9" width="8" height="9" rx="1.2" fill="#e9dcbc"/><path d="M-4 -8.2Q-2 -6.4 0 -8Q2 -6.6 4 -8.2" stroke="#d2c29b" stroke-width=".8" fill="none"/><path d="M0 -9V-11.6" stroke="#1d141f" stroke-width="1" stroke-linecap="round"/><path d="M0 -12.5C-2 -15 2 -17 0 -20" stroke="#b9aecb" stroke-width=".8" fill="none" opacity=".45"/></g><path d="M${n1(x + W * 0.12)} 0.2q${n1(W * 0.15)} -1.4 ${n1(W * 0.3)} -.6" stroke="#fffaf0" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".8"/>`;
      take(x - 4, 0, x + W + 4, 30);
    }
    if (extra === "leaf") {
      let x: number | null = null;
      for (let i = 0; i < 12 && x == null; i++) {
        const c = R(w * 0.4, w - 34);
        if (free(c - 20, 0, c + 20, 14)) x = c;
      }
      x ??= w * 0.6;
      const [fill, vein] = pick([["#d9822b", "#9c4a16"], ["#b5541c", "#6e2c0c"], ["#c99a2e", "#7c5a14"], ["#a8431c", "#5c200a"]]);
      bits += `<g transform="translate(${n1(x)} -1) rotate(${n1(90 + R(-22, 22))}) scale(${n1(R(1.6, 1.9))})" filter="url(#sh)"><path d="M0 -8.5C3 -7 4.4 -5 3.6 -3.4C5.6 -2.6 6 -.2 4.6 1C5.2 3 3.6 5 1.6 5.2L.5 8.5L-.5 8.5L-1.6 5.2C-3.6 5 -5.2 3 -4.6 1C-6 -.2 -5.6 -2.6 -3.6 -3.4C-4.4 -5 -3 -7 0 -8.5Z" fill="${fill}"/><path d="M0 -7.5V10M0 -3L2.6 -4.6M0 -3L-2.6 -4.6M0 1L3 -.4M0 1L-3 -.4" stroke="${vein}" stroke-width=".55" fill="none"/></g>`;
      take(x - 20, 0, x + 20, 14);
    }
    if (extra === "snail") {
      const body = `<path d="M-30 -1.2H-9" stroke="rgba(214,226,255,.28)" stroke-width="1.6" stroke-linecap="round"/><path d="M-11 0Q-12 -3 -8 -3.2L5 -3.2Q8 -3.2 9 -6.2L10.2 -7Q11.4 -6 10.8 -3Q10.2 0 7 0Z" fill="#9b9886"/><path d="M8.6 -5.2L9.6 -10M9.8 -4.8L12.4 -9" stroke="#9b9886" stroke-width="1" stroke-linecap="round"/><circle cx="9.6" cy="-10" r=".8" fill="#2a2633"/><circle cx="12.4" cy="-9" r=".8" fill="#2a2633"/><circle cx="-1" cy="-7.4" r="5.6" fill="#a5763f" stroke="#6e4a26" stroke-width=".7"/><path d="M-1 -7.4m1.4 0a1.4 1.4 0 1 1 -1.4 -1.4a2.8 2.8 0 1 1 -2.8 2.8a4.2 4.2 0 0 1 4.2 -4.2" stroke="#6e4a26" stroke-width=".7" fill="none"/><path d="M-4.4 -10.4q2 -1.8 4.6 -1.4" stroke="#e0b47a" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".7"/>`;
      let x: number | null = null;
      if (!chance(0.4)) {
        for (let i = 0; i < 12 && x == null; i++) {
          const c = R(w * 0.35, w - 60);
          if (free(c - 50, h - 26, c + 20, h + 2)) x = c;
        }
      }
      if (x == null) {
        const y = R(h * 0.45, h * 0.75);
        bits += `<g transform="translate(${w - 0.5} ${n1(y)}) rotate(-90) scale(1.5)" filter="url(#sh)">${body}</g>`;
        take(w - 22, y - 20, w, y + 50);
      } else {
        bits += `<g transform="translate(${n1(x)} ${h - 0.5}) scale(${chance(0.5) ? 1.5 : -1.5} 1.5)" filter="url(#sh)">${body}</g>`;
        take(x - 50, h - 26, x + 20, h + 2);
      }
    }
  }

  stone += `<polygon points="${pts.map(([x, y]) => `${n1(x)},${n1(y)}`).join(" ")}" fill="none" stroke="#4a3d5e" stroke-width="2.2"/>`;
  return { clip, tint, stone, bits, used: { web, growth, extra, tint: tintAt } };
}

const svgUrl = (w: number, h: number, box: string, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box}">${body}</svg>`)}")`;

/** What a tablet shows, as its seed: the show (or the home banner's) name and which tablet it is. */
function seedOf(el: HTMLElement) {
  const text = (sel: string, within: ParentNode = document) => within.querySelector(sel)?.textContent?.trim() ?? "";
  if (el.matches(".hero__desc-box")) return `${text(".hero__title", el.closest(".hero") ?? document)}|banner`;
  const show = text(".tp__title");
  if (el.matches(".tp__desc-box")) return `${show}|description`;
  if (el.matches(".mabout__group")) return `${show}|${text(".mabout__heading", el)}`;
  if (el.matches(".tp__seasonbar")) return `${show}|${text(".tp__seasonname", el)}`;
  if (el.matches(".ep")) return `${show}|${text(".ep__name", el)}|next`;
  return el.textContent?.slice(0, 80) ?? "";
}

/** Carves the tablets on the page (and again when one changes size or shows something else). */
export function startTablets() {
  const known = new Map<HTMLElement, string>();
  const carved = new Map<string, Carved>();
  const sizes = new ResizeObserver(() => schedule());
  let frame = 0;

  const clear = (el: HTMLElement) => {
    for (const p of ["--he-stone", "--he-stone-clip", "--he-stone-tint", "--he-tablet-bits"]) el.style.removeProperty(p);
    sizes.unobserve(el);
    known.delete(el);
  };

  const pass = () => {
    frame = 0;
    const now = [...document.querySelectorAll<HTMLElement>(TABLETS)];
    const live = new Set(now);
    for (const el of [...known.keys()]) if (!live.has(el)) clear(el);
    let before: { el: HTMLElement; used: Used } | null = null;
    for (const el of now) {
      if (!known.has(el)) sizes.observe(el);
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      // The tablet before it, if it sits right beside it (a show's About).
      const beside = before && before.el.parentElement === el.parentElement ? before.used : null;
      if (w < 40 || h < 30) {
        before = null;
        continue;
      }
      const seed = seedOf(el);
      const key = `${seed}|${w}x${h}|${beside ? JSON.stringify(beside) : ""}`;
      let c = carved.get(key);
      if (!c) {
        if (carved.size > 300) carved.clear();
        c = carve(w, h, seed, beside);
        carved.set(key, c);
      }
      before = { el, used: c.used };
      if (known.get(el) === key) continue;
      known.set(el, key);
      el.style.setProperty("--he-stone-clip", c.clip);
      el.style.setProperty("--he-stone-tint", c.tint);
      el.style.setProperty("--he-stone", svgUrl(w, h, `0 0 ${w} ${h}`, c.stone));
      el.style.setProperty("--he-tablet-bits", svgUrl(w + PAD * 2, h + PAD * 2, `${-PAD} ${-PAD} ${w + PAD * 2} ${h + PAD * 2}`, c.bits));
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(pass);
  };

  // Tablets come and go with the page (and the banner shows one show after another).
  const changes = new MutationObserver(schedule);
  changes.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("he:fonts", schedule);
  schedule();

  return () => {
    cancelAnimationFrame(frame);
    changes.disconnect();
    sizes.disconnect();
    window.removeEventListener("he:fonts", schedule);
    for (const el of [...known.keys()]) clear(el);
  };
}
