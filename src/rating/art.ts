// The stickers ratings are shown with, as SVG pictures: stars, each theme's own stickers (five,
// lit or filled as far as the rating goes, halves too) and each theme's three "feelings" (not for
// me, liked it, loved it). Pictures are made once and kept.
import { pumpkinPicture } from "../theme/hollow/pumpkins";

const cache = new Map<string, string>();
const url = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const kept = (key: string, make: () => string) => {
  let u = cache.get(key);
  if (!u) {
    u = url(make());
    cache.set(key, u);
  }
  return u;
};

/** A sticker drawn empty and full; a half shows the full one's left half over the empty one. */
interface Pair {
  viewBox: string;
  defs?: string;
  empty: string;
  full: string;
  /** Pixel art: drawn without smoothing. */
  pixel?: boolean;
}

function picture(pair: Pair, part: number) {
  const [x, y, w, h] = pair.viewBox.split(" ").map(Number);
  const crisp = pair.pixel ? ' shape-rendering="crispEdges"' : "";
  const half = `<clipPath id="half"><rect x="${x}" y="${y}" width="${w / 2}" height="${h}"/></clipPath>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${pair.viewBox}"${crisp}><defs>${pair.defs ?? ""}${half}</defs>` +
    (part >= 1 ? pair.full : pair.empty + (part > 0 ? `<g clip-path="url(#half)">${pair.full}</g>` : "")) +
    `</svg>`
  );
}

const STAR = "M12 1.8l3.1 6.4 7 .9-5.1 4.9 1.3 7-6.3-3.4-6.3 3.4 1.3-7L1.9 9.1l7-.9z";

/** Plain gold stars (the "stars" style, in every theme). */
const GOLD: Pair = {
  viewBox: "0 0 24 24",
  defs: `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".45" stop-color="#f5c542"/><stop offset="1" stop-color="#c98a0b"/></linearGradient>`,
  empty: `<path d="${STAR}" fill="#3a3540" stroke="#1d1a22" stroke-width="1" stroke-linejoin="round"/>`,
  full: `<path d="${STAR}" fill="url(#g)" stroke="#7a4b00" stroke-width="1" stroke-linejoin="round"/>`,
};

/** Velvet: gold foil, with a shine across it. */
const FOIL: Pair = {
  viewBox: "0 0 24 24",
  defs:
    `<linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset=".3" stop-color="#e9c46a"/><stop offset=".55" stop-color="#fff2b0"/><stop offset=".75" stop-color="#c9972f"/><stop offset="1" stop-color="#8f6514"/></linearGradient>`,
  empty: `<path d="${STAR}" fill="#2a2620" stroke="#4a4232" stroke-width="1" stroke-linejoin="round"/>`,
  full: `<path d="${STAR}" fill="url(#f)" stroke="#6b4a08" stroke-width=".9" stroke-linejoin="round"/><path d="M8 8.6l2.6-.4" stroke="#fffbe6" stroke-width="1" stroke-linecap="round" opacity=".8"/>`,
};

/** Paper: stars stamped in red ink, a little rough. */
const INK: Pair = {
  viewBox: "0 0 24 24",
  defs: `<filter id="r"><feTurbulence baseFrequency="1.2" numOctaves="1" seed="4"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 1.5"/><feComposite in="SourceGraphic" operator="in"/></filter>`,
  empty: `<path d="${STAR}" fill="none" stroke="#b9ab94" stroke-width="1.3" stroke-linejoin="round"/>`,
  full: `<path d="${STAR}" fill="#c4231b" stroke="#9c1a13" stroke-width="1" stroke-linejoin="round" filter="url(#r)"/>`,
};

/** Neon: glowing outlines. */
const NEON: Pair = {
  viewBox: "-3 -3 30 30",
  defs: `<filter id="n" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
  empty: `<path d="${STAR}" fill="none" stroke="#4a3570" stroke-width="1.5" stroke-linejoin="round"/>`,
  full: `<path d="${STAR}" fill="#ff4fd8" fill-opacity=".18" stroke="#ff4fd8" stroke-width="1.6" stroke-linejoin="round" filter="url(#n)"/>`,
};

/** Mochi: puffy pink stars. */
const PUFFY = "M12 2.6c1 0 1.6 .8 2.3 2.3l1.3 2.7 3 .4c1.7 .3 2.6 .8 2.8 1.7.3.9-.3 1.7-1.5 2.9l-2.2 2.1.5 3c.3 1.7.1 2.7-.6 3.2s-1.7.2-3.2-.6L12 19l-2.4 1.3c-1.5.8-2.5 1.1-3.2.6s-.9-1.5-.6-3.2l.5-3-2.2-2.1C2.9 11.4 2.3 10.6 2.6 9.7c.2-.9 1.1-1.4 2.8-1.7l3-.4 1.3-2.7C10.4 3.4 11 2.6 12 2.6z";
const MOCHI: Pair = {
  viewBox: "0 0 24 24",
  defs: `<radialGradient id="m" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffe3ee"/><stop offset=".6" stop-color="#ff9fbe"/><stop offset="1" stop-color="#f06f9a"/></radialGradient>`,
  empty: `<path d="${PUFFY}" fill="#f6e6ee" stroke="#e7c3d3" stroke-width="1"/>`,
  full: `<path d="${PUFFY}" fill="url(#m)" stroke="#e2557c" stroke-width=".8"/><ellipse cx="9.5" cy="9" rx="2" ry="1.2" fill="#fff" opacity=".7"/>`,
};

/** Snowdin: Undertale's save point, in pixels. */
const SAVE = [".....Y.....", ".....Y.....", "....YYY....", "....YWY....", "..YYYWYYY..", "YYYWWWWWYYY", "..YYYWYYY..", "....YWY....", "....YYY....", ".....Y.....", ".....Y....."];
const pixels = (rows: string[], colors: Record<string, string>, dx = 0, dy = 0) =>
  rows
    .flatMap((row, y) => [...row].map((c, x) => (colors[c] ? `<rect x="${x + dx}" y="${y + dy}" width="1" height="1" fill="${colors[c]}"/>` : "")))
    .join("");
const SAVE_STAR: Pair = {
  viewBox: "0 0 11 11",
  pixel: true,
  empty: pixels(SAVE, { Y: "#3d3d3d", W: "#6b6b6b" }),
  full: pixels(SAVE, { Y: "#ffff00", W: "#ffffff" }),
};

/** Hollow's Eve: jack-o'-lanterns, lit as far as the rating goes. */
let pumpkins: Pair | null = null;
function hollowPumpkins(): Pair {
  if (pumpkins) return pumpkins;
  const inner = (svg: string) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const spec = { size: 32, face: "classic", stem: "short", squat: 0.86 } as const;
  const lit = inner(pumpkinPicture(40, 40, spec, 4));
  const unlit = inner(pumpkinPicture(40, 40, { ...spec, unlit: true }, 4));
  // (Each brings the same definitions along; the unlit one is darkened, as if out.)
  pumpkins = { viewBox: "0 0 40 40", empty: `<g style="filter: saturate(.3) brightness(.55)">${unlit}</g>`, full: lit };
  return pumpkins;
}

const SETS: Record<string, () => Pair> = {
  hollow: hollowPumpkins,
  snowdin: () => SAVE_STAR,
  velvet: () => FOIL,
  paper: () => INK,
  neon: () => NEON,
  mochi: () => MOCHI,
};

/** One of the five stickers: `part` 0 (empty), 0.5 or 1 (full). `theme`: the theme's own, else stars. */
export function sticker(part: number, theme: string | null): string {
  const set = theme ? (SETS[theme] ?? (() => GOLD)) : () => GOLD;
  return kept(`${theme ?? "stars"}:${part}`, () => picture(set(), part));
}

/** Whether a theme's stickers are pixel art. */
export const isPixel = (theme: string | null) => theme === "snowdin";

// ---------- Feelings: not for me (0), liked it (1), loved it (2) ----------

const svg = (body: string, viewBox = "0 0 64 64", extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${extra}>${body}</svg>`;
const sparkle = (x: number, y: number, r: number, color: string) =>
  `<path d="M${x} ${y - r}l${r * 0.3} ${r * 0.7} ${r * 0.7} ${r * 0.3}-${r * 0.7} ${r * 0.3}-${r * 0.3} ${r * 0.7}-${r * 0.3}-${r * 0.7}-${r * 0.7}-${r * 0.3} ${r * 0.7}-${r * 0.3}z" fill="${color}"/>`;

function jackOLantern(mood: number) {
  const body = mood === 0 ? ["#9a5a2a", "#6e3a16", "#4a250c"] : mood === 1 ? ["#ffb04a", "#ff7a12", "#b84b06"] : ["#ffc35e", "#ff8a1c", "#c95408"];
  const face = mood === 0 ? "#2a1406" : mood === 1 ? "#ffcf5a" : "#fff1a0";
  const eyes =
    mood === 0
      ? `<path d="M19 33l8 3-8 2z" fill="${face}"/><path d="M45 33l-8 3 8 2z" fill="${face}"/>`
      : mood === 1
        ? `<path d="M20 36l5-7 5 7z" fill="${face}"/><path d="M34 36l5-7 5 7z" fill="${face}"/>`
        : `<path d="M18 35c2-6 9-6 11 0z" fill="${face}"/><path d="M35 35c2-6 9-6 11 0z" fill="${face}"/>`;
  const mouth =
    mood === 0
      ? `<path d="M22 50c4-5 16-5 20 0l-3 1c-4-3-10-3-14 0z" fill="${face}"/>`
      : mood === 1
        ? `<path d="M21 43c5 6 17 6 22 0l-2 4c-4 4-14 4-18 0z" fill="${face}"/>`
        : `<path d="M16 41c4 13 28 13 32 0z" fill="${face}"/><path d="M22 41v4h4v-4zM30 41v5h4v-5zM38 41v4h4v-4z" fill="${body[1]}"/>`;
  return svg(
    `<defs><radialGradient id="b" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="${body[0]}"/><stop offset=".65" stop-color="${body[1]}"/><stop offset="1" stop-color="${body[2]}"/></radialGradient></defs>` +
      (mood === 2 ? sparkle(8, 13, 6, "#ffe27a") + sparkle(57, 10, 4.5, "#ffe27a") : "") +
      `<g ${mood === 0 ? 'transform="rotate(-8 32 40)"' : ""}><path d="M30 18c0-5 1-8 4-10l3 2c-3 2-3 5-3 8z" fill="${mood === 0 ? "#4a5a2a" : "#5b7a2a"}"/>` +
      `<ellipse cx="32" cy="40" rx="27" ry="21" fill="url(#b)" stroke="#2a1406" stroke-width="1.5"/>` +
      `<path d="M24 20c-6 6-6 34 0 40M40 20c6 6 6 34 0 40" stroke="${body[2]}" stroke-width="1.6" fill="none" opacity=".7"/>` +
      eyes +
      mouth +
      `</g>`,
  );
}

const HEART = [".RR...RR.", "RRRR.RRRR", "RRRRRRRRR", "RRRRRRRRR", ".RRRRRRR.", "..RRRRR..", "...RRR...", "....R...."];
function soul(mood: number) {
  // (Room all round, so the sparkles of a loved one fit inside the picture.)
  let r = "";
  if (mood === 0) {
    // Broken in two along a zig-zag, the halves a little apart.
    const crack = [4, 5, 4, 3, 4, 5, 4, 4];
    HEART.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c !== "R" || x === crack[y]) return;
        r += `<rect x="${x + 4 + (x < crack[y] ? -0.6 : 0.6)}" y="${y + 4}" width="1" height="1" fill="#8a8a8a"/>`;
      }),
    );
  } else {
    r += pixels(HEART, { R: "#ff0000" }, 4, 4);
  }
  if (mood === 2) {
    r += `<rect x="6" y="6" width="1" height="1" fill="#ffffff"/>`;
    for (const [x, y] of [[2, 2], [14, 3], [14, 13], [2, 12]]) {
      r += `<rect x="${x}" y="${y}" width="1" height="1" fill="#ffff00"/>`;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) r += `<rect x="${x + dx}" y="${y + dy}" width="1" height="1" fill="#ffff00" opacity=".6"/>`;
    }
  }
  return svg(r, "0 0 17 16", 'shape-rendering="crispEdges"');
}

const puff = (x: number, y: number, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><circle r="4" fill="#fff6dc"/><circle cx="3" cy="-2" r="3" fill="#fffbea"/><circle cx="-3" cy="-1.5" r="2.8" fill="#ffefc2"/></g>`;
const BUCKET = `<path d="M16 26h32l-4 32H20z" fill="#fff"/><path d="M21 26l2 32h4l-1-32zM31 26v32h4V26zM42 26l-1 32h4l2-32z" fill="#d7263d"/><path d="M14 23h36v5H14z" fill="#b51d31"/>`;
function popcorn(mood: number) {
  if (mood === 0) return svg(`<g transform="rotate(-100 32 40)">${BUCKET}</g>` + puff(46, 52, 0.8) + puff(54, 56, 0.6));
  if (mood === 1) return svg(BUCKET + puff(22, 22) + puff(30, 20) + puff(38, 21) + puff(44, 23, 0.9) + puff(27, 15, 0.8) + puff(36, 14, 0.8));
  return svg(
    BUCKET +
      puff(20, 21) + puff(28, 17) + puff(36, 16) + puff(44, 20) + puff(24, 11, 0.9) + puff(32, 8) + puff(40, 10, 0.9) +
      puff(10, 14, 0.7) + puff(54, 9, 0.7) + puff(52, 30, 0.6) +
      sparkle(58, 25, 4, "#f5c542") + sparkle(6, 33, 3.5, "#f5c542"),
  );
}

function stamp(mood: number) {
  const [text, ink, size, rot] = mood === 0 ? ["MEH.", "#5b6b85", 16, -9] : mood === 1 ? ["GOOD", "#222222", 15, 4] : ["MUST SEE", "#c4231b", 9, -6];
  return svg(
    `<defs><filter id="w"><feTurbulence baseFrequency=".9" numOctaves="2" seed="${mood + 3}"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.1 1.55"/><feComposite in="SourceGraphic" operator="in"/></filter></defs>` +
      `<g transform="rotate(${rot} 32 32)" filter="url(#w)" opacity=".92"><rect x="4" y="16" width="56" height="32" rx="4" fill="#fffdf6" fill-opacity=".85" stroke="${ink}" stroke-width="2.6"/><rect x="7.5" y="19.5" width="49" height="25" rx="2" fill="none" stroke="${ink}" stroke-width="1"/>` +
      (mood === 2 ? `<text x="32" y="27" text-anchor="middle" font-size="7" fill="${ink}">★ ★ ★</text>` : "") +
      `<text x="32" y="${mood === 2 ? 39 : 38}" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="${size}" letter-spacing="${mood === 2 ? 0 : 1}" fill="${ink}">${text}</text></g>`,
  );
}

function arcade(mood: number) {
  const [l1, l2, color] = mood === 0 ? ["GAME", "OVER", "#ff3b5c"] : mood === 1 ? ["1UP", "", "#39ff8f"] : ["HIGH", "SCORE!", "#ff4fd8"];
  const glow = `<filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${mood === 2 ? 2.4 : 1.6}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const t = (s: string, y: number, fs: number) =>
    `<text x="32" y="${y}" text-anchor="middle" font-family="Courier New, monospace" font-weight="900" font-size="${fs}" fill="none" stroke="${color}" stroke-width="1.6">${s}</text>`;
  const words = l2 ? t(l1, 30, 15) + t(l2, 47, 15) : t(l1, 41, 22);
  const lines = mood === 2 ? `<path d="M9 54h46M14 11h36" stroke="#36e2ff" stroke-width="1.6"/>` : "";
  return svg(
    `<defs>${glow}</defs><rect x="3" y="5" width="58" height="54" rx="8" fill="#0d0820" stroke="#2a1b4d" stroke-width="2"/><g filter="url(#g)" ${mood === 0 ? 'opacity=".75"' : ""}>${words}${lines}</g>`,
  );
}

function mochi(mood: number) {
  const body =
    mood === 0
      ? `<path d="M6 54c0-9 10-13 26-13s26 4 26 13z" fill="#fde7ef" stroke="#e9aac0" stroke-width="1.5"/>`
      : `<path d="M8 52c0-18 10-30 24-30s24 12 24 30c0 4-4 6-24 6S8 56 8 52z" fill="#fff0f5" stroke="#e9aac0" stroke-width="1.5"/>`;
  const face =
    mood === 0
      ? `<path d="M22 49h5M37 49h5" stroke="#6b4a5a" stroke-width="2" stroke-linecap="round"/><path d="M29 53q3-2 6 0" stroke="#6b4a5a" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M45 44c1 2 1 3 0 4-1-1-1-2 0-4z" fill="#8fc7ff"/>`
      : mood === 1
        ? `<circle cx="24" cy="40" r="2.2" fill="#6b4a5a"/><circle cx="40" cy="40" r="2.2" fill="#6b4a5a"/><path d="M28 45q4 3 8 0" stroke="#6b4a5a" stroke-width="1.8" fill="none" stroke-linecap="round"/><ellipse cx="19" cy="45" rx="3.5" ry="2" fill="#ffb3c8"/><ellipse cx="45" cy="45" rx="3.5" ry="2" fill="#ffb3c8"/>`
        : `<path d="M20 41q4-5 8 0M36 41q4-5 8 0" stroke="#6b4a5a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M27 45q5 6 10 0z" fill="#e2557c"/><ellipse cx="18" cy="46" rx="4" ry="2.4" fill="#ff8fb0"/><ellipse cx="46" cy="46" rx="4" ry="2.4" fill="#ff8fb0"/>` +
          `<path d="M12 12c0-3 4-3 4 0 0-3 4-3 4 0 0 3-4 5-4 6 0-1-4-3-4-6z" fill="#ff6f9a"/><path d="M47 8c0-2.4 3.2-2.4 3.2 0 0-2.4 3.2-2.4 3.2 0 0 2.4-3.2 4-3.2 4.8 0-.8-3.2-2.4-3.2-4.8z" fill="#ff6f9a"/>`;
  return svg(body + face);
}

const FEELINGS: Record<string, (mood: number) => string> = {
  hollow: jackOLantern,
  snowdin: soul,
  velvet: popcorn,
  paper: stamp,
  neon: arcade,
  mochi,
};

/** A theme's feelings sticker: 0 not for me, 1 liked it, 2 loved it. */
export function feeling(mood: number, theme: string): string {
  const draw = FEELINGS[theme] ?? popcorn;
  return kept(`feel:${theme}:${mood}`, () => draw(mood));
}
