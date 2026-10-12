// Each cover's little friend, sitting on (or hanging from, or peeking over) its top edge: a
// pumpkin, candy corn, a ghost holding on, a spider on its thread, a cobweb in a corner, a bat
// asleep, a black cat, a crow, a witch's hat with someone under it, slime oozing over, a mummy's
// bandage. Not every cover gets one, and a show keeps the same friend everywhere. Some covers have
// something to say instead: a show with new episodes has the ghost holding up its badge, one
// you're partway through a candle that has burned down as far as you've watched, one you've
// finished a little grave. Point at a cover and its friend does something (the pumpkin hops, the
// bat wakes up and opens its wings, the hat lifts...). Once in a long while a pumpkin is golden,
// and now and then the spider packs up its bundle and walks over to the next cover.
import { svgUrl } from "./art";
import { drawPumpkin, pumpkinDefs } from "./pumpkins";

/** The covers' width the friends are drawn for (they keep to their side of wider ones). */
const W = 172;
/** How many of the possible picks are "no friend" (against one each for the friends). */
const NOBODY = 10;
/** Once a session, maybe: the first pumpkin to turn up is golden. */
const GOLDEN_CHANCE = 0.15;
/** How often the spider thinks about moving (ms), and how fast it walks (px a second). */
const MOVE_EVERY_MS = [90000, 200000];
const WALK_SPEED = 42;

const GH = "#f1ecff";
const GE = "#c9bde6";
const RIM = "#5a4878";
const INK = "#0d0812";
const blur = 'filter="url(#f-blur)"';
const f1 = (n: number) => n.toFixed(1);

const shadow = (cx: number, cy: number, rx: number, ry: number, o = 0.35) => `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${rx}" ry="${ry}" fill="#000" opacity="${o}" ${blur}/>`;
/** On the cover's face (below its top edge, inside its rounded corners). */
const onCover = (s: string) => `<g clip-path="url(#f-cover)">${s}</g>`;
/** Above the top edge (whatever is behind the cover). */
const above = (s: string) => `<g clip-path="url(#f-above)">${s}</g>`;
const star = (x: number, y: number, r: number, o = 1) =>
  `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="#fff" opacity="${o}" filter="url(#f-glow)"/>`;

const KERNEL = "M0 -12C2.6 -12 4.6 -7 7.4 1C8.6 4.6 9.4 7 8.6 8.6C7.4 10.4 -7.4 10.4 -8.6 8.6C-9.4 7 -8.6 4.6 -7.4 1C-4.6 -7 -2.6 -12 0 -12Z";

const DEFS =
  `<clipPath id="f-cover" clipPathUnits="userSpaceOnUse"><rect x="0" y="0" width="${W}" height="400" rx="12"/></clipPath>` +
  `<clipPath id="f-above" clipPathUnits="userSpaceOnUse"><rect x="-100" y="-200" width="400" height="200.5"/></clipPath>` +
  `<clipPath id="f-kernel" clipPathUnits="userSpaceOnUse"><path d="${KERNEL}"/></clipPath>` +
  `<filter id="f-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>` +
  `<filter id="f-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  `<radialGradient id="f-warm"><stop offset="0" stop-color="#ffb347" stop-opacity="0.55"/><stop offset="0.5" stop-color="#ff8a2e" stop-opacity="0.2"/><stop offset="1" stop-color="#ff7518" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="f-goldlight"><stop offset="0" stop-color="#ffe58a" stop-opacity="0.6"/><stop offset="0.5" stop-color="#ffcf3a" stop-opacity="0.2"/><stop offset="1" stop-color="#ffcf3a" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="f-greenlight"><stop offset="0" stop-color="#9cff3a" stop-opacity="0.3"/><stop offset="1" stop-color="#9cff3a" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="f-flame" cx="0.5" cy="0.7" r="0.6"><stop offset="0" stop-color="#fffbe0"/><stop offset="0.45" stop-color="#ffd36b"/><stop offset="1" stop-color="#ff8a2e"/></radialGradient>` +
  `<radialGradient id="f-spider" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#4a3462"/><stop offset="1" stop-color="#0f0816"/></radialGradient>` +
  `<linearGradient id="f-bat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2850"/><stop offset="1" stop-color="#120a17"/></linearGradient>` +
  `<linearGradient id="f-wax" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cbbd9c"/><stop offset="0.45" stop-color="#fff6e0"/><stop offset="1" stop-color="#c2b392"/></linearGradient>` +
  `<linearGradient id="f-hat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b3a86"/><stop offset="1" stop-color="#211330"/></linearGradient>` +
  `<linearGradient id="f-slime" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5fb81a"/><stop offset="0.45" stop-color="#b6ff5a"/><stop offset="1" stop-color="#5fb81a"/></linearGradient>` +
  `<linearGradient id="f-bandage" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3ead2"/><stop offset="1" stop-color="#c9bb98"/></linearGradient>` +
  `<linearGradient id="f-stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3d5e"/><stop offset="1" stop-color="#2a2133"/></linearGradient>` +
  `<linearGradient id="f-candyshade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#5a1a00" stop-opacity="0.35"/></linearGradient>`;

/** The golden pumpkin's colours, in place of the pale one's. */
const GOLD_DEFS = () =>
  pumpkinDefs("g").replace(/#ffd583/g, "#fff3b0").replace(/#f5ab45/g, "#ffd23f").replace(/#c47a1c/g, "#c9961a").replace(/#93590f/g, "#8a6510");

// ---------- The friends

function pumpkin(up: boolean, golden = false) {
  const x = 142;
  const light = golden ? "url(#f-goldlight)" : "url(#f-warm)";
  let s = onCover(`<ellipse cx="${x}" cy="2" rx="${up ? 84 : 62}" ry="${up ? 58 : 40}" fill="${light}" opacity="${up ? 0.85 : 0.55}"/>`);
  s += `<ellipse cx="${x}" cy="${-12 - (up ? 10 : 0)}" rx="${up ? 34 : 28}" ry="${up ? 26 : 22}" fill="${light}"/>`;
  s += drawPumpkin(golden ? "g" : "m", x, up ? -9 : 3, { size: 36, face: "cute", stem: "curly", extras: ["leaf"], squat: 0.82, palette: golden ? "pale" : "orange" }, { ground: false });
  if (golden) s += star(x - 22, -30, 4) + star(x + 20, -36, 3, 0.8) + star(x + 24, -8, 2.5, 0.9) + star(x - 14, -6, 2, 0.7) + (up ? star(x, -50, 5) + star(x - 30, -18, 3) : "");
  else if (up) s += `<g fill="#ffcf5a" filter="url(#f-glow)"><circle cx="${x - 20}" cy="-38" r="1.2"/><circle cx="${x + 18}" cy="-44" r="1"/><circle cx="${x + 4}" cy="-50" r="0.9"/></g>`;
  return s;
}

const kernel = (x: number, y: number, r: number, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><g clip-path="url(#f-kernel)"><rect x="-10" y="-13" width="20" height="8.5" fill="#fff6e6"/><rect x="-10" y="-4.5" width="20" height="7" fill="#ff8a2e"/><rect x="-10" y="2.5" width="20" height="10" fill="#ffd23a"/><rect x="-10" y="-13" width="20" height="25" fill="url(#f-candyshade)"/></g><path d="${KERNEL}" fill="none" stroke="#6e2f10" stroke-opacity="0.55" stroke-width="0.8"/><path d="M-3 -7C-4 -3 -5 1 -5.4 5" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity="0.55" fill="none"/></g>`;
const sweet = (x: number, y: number, r: number) =>
  `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-7 0L-14 -5L-13 0L-14 5Z" fill="#8a5cc4" stroke="#4a2d6e" stroke-width="0.6"/><path d="M7 0L14 -5L13 0L14 5Z" fill="#8a5cc4" stroke="#4a2d6e" stroke-width="0.6"/><ellipse rx="7.5" ry="5.5" fill="#ff7518"/><path d="M-5 -4L-1 4M-1 -5.4L3 5M3 -5L6.5 2" stroke="#5b2a8a" stroke-width="1.6"/><ellipse cx="-2.5" cy="-2.5" rx="2.4" ry="1.2" fill="#fff" opacity="0.5"/></g>`;

function candy(up: boolean) {
  return up
    ? kernel(22, -24, -26) + kernel(41, -30, 18, 0.95) + kernel(58, -18, 64, 0.85) + sweet(76, -14, 24)
    : shadow(42, 3, 26, 2.5, 0.3) + kernel(22, -9, -14) + kernel(39, -8.5, 10, 0.95) + kernel(56, -4.5, 82, 0.85) + sweet(73, -5, -6);
}

const ghostBody = (x: number, y: number, s: number) =>
  `<g transform="translate(${f1(x - 21 * s)} ${y}) scale(${s})"><path d="M21 2C10 2 4 10 4 20v22l5-4 4 4 4-4 4 4 4-4 4 4 4-4 5 4V20C38 10 32 2 21 2z" fill="${GH}" stroke="${GE}" stroke-width="1.5"/><ellipse cx="11" cy="25" rx="3" ry="2" fill="#ffb3c7" opacity="0.6"/><ellipse cx="31" cy="25" rx="3" ry="2" fill="#ffb3c7" opacity="0.6"/></g>`;
const hand = (x: number, y: number, r = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse rx="4.8" ry="3.8" fill="${GH}" stroke="${GE}" stroke-width="1"/><path d="M-1.6 1.4v2M1.4 1.4v2" stroke="${GE}" stroke-width="0.8"/></g>`;
const ghostFace = (x: number, y: number, s: number, happy: boolean) =>
  happy
    ? `<g stroke="#1a1024" stroke-width="${2 * s}" stroke-linecap="round" fill="none"><path d="M${f1(x - 9 * s)} ${f1(y + s)}q${f1(3 * s)}-${f1(4 * s)} ${f1(6 * s)} 0M${f1(x + 3 * s)} ${f1(y + s)}q${f1(3 * s)}-${f1(4 * s)} ${f1(6 * s)} 0"/></g><ellipse cx="${x}" cy="${f1(y + 10 * s)}" rx="${f1(3.5 * s)}" ry="${f1(4 * s)}" fill="#1a1024"/>`
    : `<g fill="#1a1024"><ellipse cx="${f1(x - 6 * s)}" cy="${y}" rx="${f1(3 * s)}" ry="${f1(4 * s)}"/><ellipse cx="${f1(x + 6 * s)}" cy="${y}" rx="${f1(3 * s)}" ry="${f1(4 * s)}"/><ellipse cx="${x}" cy="${f1(y + 10 * s)}" rx="${f1(3.5 * s)}" ry="${f1(4.5 * s)}"/></g><g fill="#fff"><circle cx="${f1(x - 7 * s)}" cy="${f1(y - 1.5 * s)}" r="${s}"/><circle cx="${f1(x + 5 * s)}" cy="${f1(y - 1.5 * s)}" r="${s}"/></g>`;

function ghost(up: boolean) {
  const x = 138;
  const s = 0.95;
  const y = up ? -37 : -31;
  let g = above(ghostBody(x, y, s) + ghostFace(x, y + 17 * s, s, up)) + shadow(x, 5, 17, 3, 0.3);
  if (up)
    g +=
      hand(x - 12, 0.5) +
      hand(x + 20, -23, -40) +
      `<g stroke="${GE}" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.8"><path d="M${x + 27} -31q4 4 2 9M${x + 31} -35q6 6 3 14"/></g>`;
  else g += hand(x - 12, 0.5) + hand(x + 12, 0.5);
  return g;
}

/** A spider seen from the front, its body at x, y; `climbing`: front legs reaching up its thread.
 *  Its legs come in two sets (`.he-step-a`, `.he-step-b`) so it can walk. `bundle`: it's moving. */
export function spider(x: number, y: number, climbing: boolean, scale = 1, bundle = false) {
  const L = climbing
    ? [
        [`M${x - 3} ${y - 5}Q${x - 8} ${y - 13} ${x - 1.5} ${y - 19}`, `M${x + 3} ${y - 5}Q${x + 8} ${y - 13} ${x + 1.5} ${y - 19}`],
        [`M${x - 5} ${y}Q${x - 14} ${y - 6} ${x - 15} ${y + 1}`, `M${x + 5} ${y}Q${x + 14} ${y - 6} ${x + 15} ${y + 1}`],
        [`M${x - 5} ${y + 3}Q${x - 14} ${y + 4} ${x - 15} ${y + 11}`, `M${x + 5} ${y + 3}Q${x + 14} ${y + 4} ${x + 15} ${y + 11}`],
        [`M${x - 4} ${y + 6}Q${x - 9} ${y + 12} ${x - 9} ${y + 18}`, `M${x + 4} ${y + 6}Q${x + 9} ${y + 12} ${x + 9} ${y + 18}`],
      ]
    : [
        [`M${x - 4} ${y - 1}Q${x - 12} ${y - 9} ${x - 16} ${y - 3}`, `M${x + 4} ${y - 1}Q${x + 12} ${y - 9} ${x + 16} ${y - 3}`],
        [`M${x - 5} ${y + 1}Q${x - 14} ${y - 2} ${x - 18} ${y + 5}`, `M${x + 5} ${y + 1}Q${x + 14} ${y - 2} ${x + 18} ${y + 5}`],
        [`M${x - 5} ${y + 3}Q${x - 13} ${y + 5} ${x - 15} ${y + 12}`, `M${x + 5} ${y + 3}Q${x + 13} ${y + 5} ${x + 15} ${y + 12}`],
        [`M${x - 4} ${y + 5}Q${x - 9} ${y + 11} ${x - 10} ${y + 17}`, `M${x + 4} ${y + 5}Q${x + 9} ${y + 11} ${x + 10} ${y + 17}`],
      ];
  // Alternate legs step together: left 1 and 3 with right 2 and 4, and the other way round.
  const a = [L[0][0], L[2][0], L[1][1], L[3][1]].join("");
  const b = [L[1][0], L[3][0], L[0][1], L[2][1]].join("");
  const legs = (d: string, cls: string) =>
    `<g class="${cls}" style="transform-origin:${x}px ${y + 2}px"><path d="${d}" stroke="#120a17" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="${RIM}" stroke-width="0.5" fill="none" opacity="0.8"/></g>`;
  let g = `<g transform="translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})">`;
  g += legs(a, "he-step-a") + legs(b, "he-step-b");
  g += `<ellipse cx="${x}" cy="${y + 6}" rx="7.2" ry="8.4" fill="url(#f-spider)" stroke="${RIM}" stroke-width="0.8"/><path d="M${x - 2.4} ${y + 4}l2.4 3 2.4-3M${x - 2} ${y + 9}l2 2.4 2-2.4" stroke="#ff7518" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.85"/>`;
  g += `<circle cx="${x}" cy="${y - 3.5}" r="5" fill="url(#f-spider)" stroke="${RIM}" stroke-width="0.8"/>`;
  const py = climbing ? 5.2 : 3.9;
  g += `<g fill="#fff"><circle cx="${x - 2.1}" cy="${y - 4.4}" r="2"/><circle cx="${x + 2.1}" cy="${y - 4.4}" r="2"/></g><g fill="#120a17"><circle cx="${x - 2}" cy="${y - py}" r="1.1"/><circle cx="${x + 2}" cy="${y - py}" r="1.1"/></g><g fill="#fff"><circle cx="${x - 2.4}" cy="${f1(y - py - 0.5)}" r="0.4"/><circle cx="${x + 1.6}" cy="${f1(y - py - 0.5)}" r="0.4"/></g>`;
  g += `<path d="M${x - 1.2} ${y + 0.6}l0.5 1.4 0.5-1.2M${x + 0.2} ${y + 0.8}l0.5 1.2 0.5-1.4" stroke="#f3ead8" stroke-width="0.6" fill="none"/>`;
  if (bundle)
    g +=
      `<path d="M${x + 6} ${y - 3}L${x + 15} ${y - 13}" stroke="#7a5a3a" stroke-width="1.2"/><circle cx="${x + 16.5}" cy="${y - 15.5}" r="4.2" fill="#ff7518" stroke="#8f3a08" stroke-width="0.6"/>` +
      `<g fill="#fff6e6"><circle cx="${x + 15}" cy="${y - 16.5}" r="0.8"/><circle cx="${x + 18}" cy="${y - 14.5}" r="0.8"/><circle cx="${x + 17.5}" cy="${y - 17.8}" r="0.6"/></g><path d="M${x + 14.5} ${y - 19.2}l2 -1.6 1.6 1.8" stroke="#8f3a08" stroke-width="0.8" fill="none"/>`;
  return g + "</g>";
}

function hanging(up: boolean) {
  const x = 58;
  const y = up ? 24 : 64;
  return (
    `<path d="M${x} 0V${y - 6}" stroke="rgba(243,234,216,0.7)" stroke-width="0.8"/><circle cx="${x}" cy="1" r="1.2" fill="rgba(243,234,216,0.6)"/>` +
    onCover(shadow(x + 7, y + 10, 10, 9, 0.35)) +
    spider(x, y, up)
  );
}

/** A cobweb in the top left corner (or the right, mirrored), with dew on it and a tiny spider. */
function web(up: boolean, right = false) {
  const A = [0, 14, 30, 46, 62, 76, 90].map((d) => (d * Math.PI) / 180);
  const len = [84, 78, 74, 76, 72, 78, 84];
  const R = [12, 24, 37, 50, 63];
  const pt = (i: number, r: number) => [Math.cos(A[i]) * r, Math.sin(A[i]) * r];
  let lines = "";
  A.forEach((a, i) => (lines += `M0 0L${f1(Math.cos(a) * len[i])} ${f1(Math.sin(a) * len[i])}`));
  for (const r of R)
    for (let i = 0; i < A.length - 1; i++) {
      const [x1, y1] = pt(i, r + (i % 2) * 1.5);
      const [x2, y2] = pt(i + 1, r + ((i + 1) % 2) * 1.5);
      lines += `M${f1(x1)} ${f1(y1)}Q${f1(((x1 + x2) / 2) * 0.86)} ${f1(((y1 + y2) / 2) * 0.86)} ${f1(x2)} ${f1(y2)}`;
    }
  const dew = [[1, 37], [2, 50], [3, 24], [4, 63], [5, 37], [2, 12], [3, 63]].map(([i, r]) => pt(i, r));
  let g = `<g clip-path="url(#f-cover)"><g ${right ? `transform="translate(${W} 0) scale(-1 1)"` : ""}>`;
  g += `<path d="${lines}" stroke="rgba(243,234,216,${up ? 0.8 : 0.6})" stroke-width="0.8" fill="none"/>`;
  g += dew.map(([x, y]) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="1.4" fill="#dff0ff" opacity="0.85"/><circle cx="${f1(x - 0.4)}" cy="${f1(y - 0.5)}" r="0.5" fill="#fff"/>`).join("");
  if (up) g += dew.slice(0, 5).map(([x, y], i) => star(+f1(x), +f1(y), 3 + (i % 2) * 2, 0.9)).join("");
  g += "</g></g>";
  const [sx, sy] = pt(4, 50);
  return g + spider(right ? W - sx : sx, sy, false, 0.45);
}

/** A bat asleep upside down, holding on to the edge with its feet; woken, it opens its wings
 *  (upside down too: the arms run out from its shoulders down by its head, the scalloped edges of
 *  the wings reach up towards its feet). */
function bat(up: boolean) {
  const x = 128;
  let g = onCover(shadow(x + 6, 26, up ? 20 : 10, 18, 0.35));
  g += `<g transform="translate(${x} 0)">`;
  g += `<path d="M-2.5 0v5M2.5 0v5" stroke="#2a1b38" stroke-width="1.6"/><path d="M-4.4 -0.4q1.5-2 3 0M0.8 -0.4q1.5-2 3 0" stroke="#2a1b38" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  if (up) {
    const wing = "M-4 31C-14 36-27 33-31 20C-27 20-25 15-25 10C-21 13-17 12-15 7C-13 11-8 11-4 7Z";
    const bones = "M-4 30C-14 33-24 30-30 21M-23 29.5L-25 11M-17 31L-15 8";
    g += `<path d="${wing}" fill="url(#f-bat)" stroke="#6a5288" stroke-width="0.9" stroke-linejoin="round"/><path d="${bones}" stroke="#6a5288" stroke-width="0.6" fill="none" opacity="0.7"/>`;
    g += `<g transform="scale(-1 1)"><path d="${wing}" fill="url(#f-bat)" stroke="#6a5288" stroke-width="0.9" stroke-linejoin="round"/><path d="${bones}" stroke="#6a5288" stroke-width="0.6" fill="none" opacity="0.7"/></g>`;
    g += `<ellipse cx="0" cy="19" rx="6.5" ry="14" fill="url(#f-bat)" stroke="#6a5288" stroke-width="0.9"/>`;
  } else {
    g += `<path d="M0 3C-11 8-12 24-6 32L0 36L6 32C12 24 11 8 0 3Z" fill="url(#f-bat)" stroke="#6a5288" stroke-width="0.9"/><path d="M-4 8C-8 16-8 24-5 31M4 8C8 16 8 24 5 31M0 6V33" stroke="#6a5288" stroke-width="0.6" fill="none" opacity="0.7"/>`;
  }
  g += `<path d="M-5 42L-7.5 51L-1.5 44.5ZM5 42L7.5 51L1.5 44.5Z" fill="#160d1d" stroke="#6a5288" stroke-width="0.8"/><circle cx="0" cy="38" r="7" fill="url(#f-bat)" stroke="#6a5288" stroke-width="0.9"/>`;
  g += `<path d="M-1.8 33.2l0.6-1.8 0.6 1.8ZM1.2 33.2l0.6-1.8 0.6 1.8Z" fill="#fff"/>`;
  g += up
    ? `<g fill="#ffcf5a" filter="url(#f-glow)"><circle cx="-2.7" cy="38.6" r="1.6"/><circle cx="2.7" cy="38.6" r="1.6"/></g><g fill="#160d1d"><circle cx="-2.7" cy="38.9" r="0.6"/><circle cx="2.7" cy="38.9" r="0.6"/></g>`
    : `<path d="M-4.4 38q1.6 1.4 3.2 0M1.2 38q1.6 1.4 3.2 0" stroke="#a08cc8" stroke-width="0.9" fill="none" stroke-linecap="round"/><g font-family="Georgia, serif" font-style="italic" fill="#c9bde6" opacity="0.75"><text x="-14" y="44" font-size="7">z</text><text x="-20" y="35" font-size="9">z</text></g>`;
  return g + "</g>";
}

function cat(up: boolean) {
  const x = 58;
  const ears = up
    ? `<path d="M${x - 14} -11L${x - 20} -28L${x - 6} -19Z"/><path d="M${x + 14} -10L${x + 17} -29L${x + 5} -18Z"/>`
    : `<path d="M${x - 14} -10L${x - 16} -29L${x - 5} -18Z"/><path d="M${x + 14} -10L${x + 16} -29L${x + 5} -18Z"/>`;
  const tail = `M${x + 36} 0C${x + 38} -16 ${x + 50} -24 ${x + 56} -18C${x + 60} -14 ${x + 55} -9 ${x + 51} -12`;
  let g = onCover(shadow(x, 7, 24, 3.5, 0.35));
  if (up) g += `<path d="${tail}" stroke="${RIM}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="${tail}" stroke="${INK}" stroke-width="5.4" fill="none" stroke-linecap="round"/>`;
  g += above(
    `<g fill="${INK}" stroke="${RIM}" stroke-width="0.9" stroke-linejoin="round">${ears}<ellipse cx="${x}" cy="-3" rx="17" ry="15"/></g>` +
      `<g fill="#3a1f3c">${up ? `<path d="M${x - 15} -14L${x - 17} -23L${x - 9} -18Z"/>` : `<path d="M${x - 13.5} -13L${x - 14.5} -24L${x - 8} -18Z"/>`}<path d="M${x + 13.5} -13L${x + 14.5} -24L${x + 8} -18Z"/></g>`,
  );
  g += up
    ? `<g stroke="#9cff3a" stroke-width="1.8" stroke-linecap="round" fill="none" filter="url(#f-glow)"><path d="M${x - 9} -7q3.2-3.6 6.4 0M${x + 2.6} -7q3.2-3.6 6.4 0"/></g>`
    : `<g fill="#9cff3a" filter="url(#f-glow)"><ellipse cx="${x - 6}" cy="-8" rx="3.4" ry="3"/><ellipse cx="${x + 6}" cy="-8" rx="3.4" ry="3"/></g><g fill="#07040a"><ellipse cx="${x - 6}" cy="-8" rx="0.8" ry="2.5"/><ellipse cx="${x + 6}" cy="-8" rx="0.8" ry="2.5"/></g>`;
  g += `<path d="M${x - 1.6} -3h3.2l-1.6 1.8z" fill="#c76a8a"/><g stroke="${RIM}" stroke-width="0.6" opacity="0.8"><path d="M${x - 7} -2L${x - 20} -4M${x - 7} -1L${x - 20} 0M${x + 7} -2L${x + 20} -4M${x + 7} -1L${x + 20} 0"/></g>`;
  g += `<g fill="${INK}" stroke="${RIM}" stroke-width="0.9"><ellipse cx="${x - 11}" cy="1.6" rx="6.2" ry="4.2"/><ellipse cx="${x + 11}" cy="1.6" rx="6.2" ry="4.2"/></g><g stroke="${RIM}" stroke-width="0.7"><path d="M${x - 13} 3.6v2M${x - 9} 3.6v2M${x + 9} 3.6v2M${x + 13} 3.6v2"/></g>`;
  return g;
}

function crow(up: boolean) {
  const x = 34;
  let g = onCover(shadow(x - 12, 8, 14, 4, 0.3));
  g += `<g transform="translate(${x} 0)">`;
  g += `<path d="M-10 -5L-27 7L-23 9L-21 6L-19 10L-8 -1Z" fill="#120a17" stroke="${RIM}" stroke-width="0.7" stroke-linejoin="round"/>`;
  g += `<path d="M-14 -8C-13 -21 3 -25 10 -19C15 -14 12 -5 5 -2L-6 -1.5C-12 -2 -15 -4 -14 -8Z" fill="#120a17" stroke="${RIM}" stroke-width="0.8"/>`;
  g += up
    ? `<path d="M-4 -12C-14 -16 -24 -26 -22 -40C-18 -36 -14 -36 -10 -36C-12 -32 -8 -30 -4 -30C-6 -26 -2 -20 2 -14Z" fill="#1d1428" stroke="${RIM}" stroke-width="0.7" stroke-linejoin="round"/><path d="M-6 -16L-18 -34M-3 -16L-9 -32" stroke="${RIM}" stroke-width="0.5" opacity="0.7"/>`
    : `<path d="M-11 -10C-5 -18 5 -16 4 -9C1 -5 -6 -6 -12 -7Z" fill="#1d1428" stroke="${RIM}" stroke-width="0.6"/><path d="M-8 -9l6 -1.4M-6 -7l7 -1" stroke="${RIM}" stroke-width="0.5" opacity="0.7"/>`;
  g += `<circle cx="10" cy="-21" r="7" fill="#120a17" stroke="${RIM}" stroke-width="0.8"/>`;
  g += up
    ? `<path d="M16 -25L27 -27L16 -21Z" fill="#3d3448" stroke="${RIM}" stroke-width="0.5"/><path d="M16 -19.5L25 -14L16 -17.5Z" fill="#3d3448" stroke="${RIM}" stroke-width="0.5"/>` +
      `<text x="27" y="-32" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="10" fill="#f3ead8" transform="rotate(-8 27 -32)">caw!</text><path d="M-20 -30q4 2 3 7q-3-1-3-7z" fill="#1d1428" stroke="${RIM}" stroke-width="0.4"/>`
    : `<path d="M16 -23L26 -20L16 -17.5Z" fill="#3d3448" stroke="${RIM}" stroke-width="0.5"/>`;
  g += `<circle cx="12" cy="-22.5" r="1.8" fill="#ffcf5a"/><circle cx="12.4" cy="-22.5" r="0.8" fill="#07040a"/>`;
  g += `<path d="M-2 -2V1.6M3 -2V1.6" stroke="#3d3448" stroke-width="1.3"/><path d="M-4.2 1.6q2.2 1.8 4.4 0M0.8 1.6q2.2 1.8 4.4 0" stroke="#3d3448" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  return g + "</g>";
}

/** A witch's hat left on the cover; pointed at, it lifts: a little fuzzy someone was sitting under
 *  it, and now wears it pushed up on its head. */
function hat(up: boolean) {
  const x = 118;
  const h =
    `<path d="M${x - 15} -3C${x - 12} -18 ${x - 6} -30 ${x + 12} -44C${x + 10} -40 ${x + 6} -32 ${x + 5} -24C${x + 4} -14 ${x + 8} -6 ${x + 15} -3Z" fill="url(#f-hat)" stroke="#6a4f8e" stroke-width="0.8"/>` +
    `<path d="M${x - 2} -30l5 1.2-0.6 5-5-1z" fill="#3a2458" stroke="#ffb35c" stroke-width="0.5" stroke-dasharray="1 1"/>` +
    `<ellipse cx="${x}" cy="-1" rx="27" ry="5.5" fill="url(#f-hat)" stroke="#6a4f8e" stroke-width="0.8"/>` +
    `<path d="M${x - 14} -8C${x - 6} -11 ${x + 8} -11 ${x + 14} -8L${x + 15} -3C${x + 8} -6 ${x - 6} -6 ${x - 15} -3Z" fill="#ff7518"/><rect x="${x - 3}" y="-10.4" width="6" height="6" fill="none" stroke="#ffd36b" stroke-width="1.2"/>`;
  if (!up) return onCover(shadow(x, 4, 25, 3.5, 0.4)) + h;
  // The little one: round and fuzzy, big shiny eyes, a small smile, its feet on the edge.
  const cx = x - 1;
  const cy = -10;
  let fuzz = "";
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = i % 2 ? 9.6 : 11.2;
    fuzz += `${i ? "L" : "M"}${f1(cx + Math.cos(a) * r)} ${f1(cy + Math.sin(a) * r * 0.92)}`;
  }
  let g = onCover(shadow(x, 4, 18, 3, 0.35));
  g += `<g fill="${INK}" stroke="${RIM}" stroke-width="0.8"><ellipse cx="${cx - 5}" cy="0" rx="3.4" ry="2"/><ellipse cx="${cx + 5}" cy="0" rx="3.4" ry="2"/></g>`;
  g += `<path d="${fuzz}Z" fill="${INK}" stroke="${RIM}" stroke-width="0.8" stroke-linejoin="round"/>`;
  g += `<g fill="#fff"><ellipse cx="${cx - 3.6}" cy="${cy}" rx="2.9" ry="3.3"/><ellipse cx="${cx + 3.6}" cy="${cy}" rx="2.9" ry="3.3"/></g><g fill="#1a1024"><circle cx="${cx - 3.2}" cy="${cy + 0.6}" r="1.7"/><circle cx="${cx + 4}" cy="${cy + 0.6}" r="1.7"/></g><g fill="#fff"><circle cx="${cx - 3.8}" cy="${cy - 0.3}" r="0.6"/><circle cx="${cx + 3.4}" cy="${cy - 0.3}" r="0.6"/></g>`;
  g += `<path d="M${cx - 2} ${cy + 5}q2 1.8 4 0" stroke="#c9bde6" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
  // The hat, pushed up and back on its head.
  g += `<g transform="translate(4 -14) rotate(-12 ${x} -1) scale(0.92) translate(${f1(x * 0.087)} 0)">${h}</g>`;
  return g;
}

function slime(up: boolean) {
  const drip = (x: number, len: number) =>
    `<path d="M${x - 3.6} 0C${x - 3} ${f1(len * 0.5)} ${x - 2.4} ${f1(len - 5)} ${x - 3.2} ${f1(len - 3)}C${x - 3.8} ${f1(len + 2.6)} ${x + 3.8} ${f1(len + 2.6)} ${x + 3.2} ${f1(len - 3)}C${x + 2.4} ${f1(len - 5)} ${x + 3} ${f1(len * 0.5)} ${x + 3.6} 0Z" fill="url(#f-slime)"/><ellipse cx="${x - 1.2}" cy="${f1(len - 1.6)}" rx="0.9" ry="1.3" fill="#f2ffd6" opacity="0.8"/>`;
  const k = up ? 1.7 : 1;
  let g = onCover(`<ellipse cx="96" cy="8" rx="56" ry="30" fill="url(#f-greenlight)"/>` + shadow(97, 4, 38, 3, 0.3));
  g += `<path d="M58 1C60 -5 70 -8 80 -6C92 -9 104 -8 116 -6C127 -7 134 -3 136 1Z" fill="url(#f-slime)"/>`;
  g += `<path d="M58 0H136C135 3 130 4.5 124 4.5C112 5.5 100 4 90 5C78 6 66 4.5 60 3.5Z" fill="#7fdc22"/>`;
  g += drip(70, 14 * k) + drip(88, 26 * k) + drip(104, 9 * k) + drip(122, 18 * k);
  g += `<path d="M66 -4.6C76 -6.6 90 -7 100 -6.4" stroke="#f2ffd6" stroke-width="1" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  g += `<circle cx="110" cy="-5.6" r="2" fill="none" stroke="#e6ffb0" stroke-width="0.7" opacity="0.8"/><circle cx="84" cy="-6" r="1.2" fill="none" stroke="#e6ffb0" stroke-width="0.6" opacity="0.8"/>`;
  if (up) g += `<ellipse cx="88" cy="62" rx="3.4" ry="4" fill="url(#f-slime)"/><g stroke="#e6ffb0" stroke-width="0.8" fill="none" opacity="0.8"><circle cx="122" cy="-10" r="4"/><path d="M116 -14l-2-2M128 -14l2-2M122 -16v-3"/></g>`;
  return g;
}

function mummy(up: boolean) {
  const band = (pts: string) => `<g clip-path="url(#f-cover)"><polygon points="${pts}" fill="url(#f-bandage)" stroke="#9a8a68" stroke-width="0.6"/></g>`;
  let g = onCover(`<polygon points="128,-2 146,-2 174,28 174,44" fill="#0b0710" opacity="0.92"/>` + shadow(150, 26, 24, 26, 0.25));
  g += up
    ? `<ellipse cx="151" cy="13" rx="4" ry="3" fill="#f3ead8"/><circle cx="151" cy="13.4" r="2" fill="#9cff3a" filter="url(#f-glow)"/><circle cx="151" cy="13.4" r="0.9" fill="#07040a"/><ellipse cx="162" cy="27" rx="3.6" ry="2.7" fill="#f3ead8"/><circle cx="162" cy="27.3" r="1.8" fill="#9cff3a" filter="url(#f-glow)"/><circle cx="162" cy="27.3" r="0.8" fill="#07040a"/>`
    : `<ellipse cx="152" cy="15" rx="4" ry="2.4" fill="#f3ead8"/><circle cx="152" cy="15.6" r="1.8" fill="#9cff3a" filter="url(#f-glow)"/><circle cx="152" cy="15.6" r="0.8" fill="#07040a"/><path d="M147.6 14.4q4.4-3 8.8 0V12.6h-8.8Z" fill="#4a3d2e"/>`;
  g += band("114,-2 128,-2 174,44 174,58") + band("146,-2 158,-2 174,14 174,27") + band("160,-2 166,-2 174,5 174,11");
  g += `<g clip-path="url(#f-cover)" stroke="#b3a37f" stroke-width="0.5" opacity="0.7"><path d="M118 0L172 52M123 -1L173 47M150 0L172 21M154 -1L173 17"/></g>`;
  g += up
    ? `<path d="M172 56C178 62 172 70 182 76C186 79 184 84 188 88L182 90C179 84 180 80 174 76C166 70 170 62 166 58Z" fill="url(#f-bandage)" stroke="#9a8a68" stroke-width="0.6"/>`
    : `<path d="M172 56C176 64 170 72 174 80C176 84 174 88 175 92L169 92C168 87 170 84 168 80C164 72 168 64 166 58Z" fill="url(#f-bandage)" stroke="#9a8a68" stroke-width="0.6"/>`;
  return g;
}

/** A show you've finished: a little grave on its cover. */
function grave(up: boolean) {
  const x = 140;
  let g = onCover(shadow(x, 4, 18, 3, 0.35));
  if (up) g += `<g fill="#9cff3a" opacity="0.8" filter="url(#f-glow)"><circle cx="${x - 20}" cy="-20" r="1"/><circle cx="${x + 22}" cy="-28" r="0.9"/><circle cx="${x - 8}" cy="-44" r="0.8"/></g>`;
  g +=
    `<path d="M${x - 13} 0V-22Q${x - 13} -32 ${x} -37Q${x + 13} -32 ${x + 13} -22V0Z" fill="url(#f-stone)" stroke="#5a4878" stroke-width="1"/>` +
    `<path d="M${x - 10} 0V-21Q${x - 10} -29 ${x} -33Q${x + 10} -29 ${x + 10} -21V0" stroke="#16101e" stroke-width="0.8" fill="none"/>` +
    `<text x="${x}" y="-17" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="8.5" fill="#16101e" letter-spacing="0.6">RIP</text><path d="M${x - 6} -10H${x + 6}M${x - 4} -6.6H${x + 4}" stroke="#16101e" stroke-width="0.9"/>` +
    `<path d="M${x - 12} -24Q${x - 8} -31 ${x - 2} -33Q${x - 6} -28 ${x - 12} -24Z" fill="#33402a"/>` +
    `<g stroke="#2f4a26" stroke-width="1.3" stroke-linecap="round"><path d="M${x - 18} 0l-2-6M${x - 16} 0l1-7M${x - 14} 0l3-5M${x + 15} 0l-1-6M${x + 17} 0l2-7M${x + 19} 0l3-4"/></g>`;
  // A flower left on it; pointed at, a little ghost of a wisp rises.
  g += `<path d="M${x + 20} 0v-9" stroke="#2f4a26" stroke-width="0.9"/><circle cx="${x + 20}" cy="-10" r="2.2" fill="#ff7518"/><circle cx="${x + 20}" cy="-10" r="0.8" fill="#ffd36b"/>`;
  if (up) g += `<path d="M${x} -40C${x - 5} -44 ${x + 5} -48 ${x} -52" stroke="${GH}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.5" ${blur}/>`;
  return g;
}

/** Something new: the ghost holds up the badge (which sits right under the edge, see hollow.css). */
function newGhost(up: boolean) {
  const x = 30;
  const s = 0.9;
  return above(ghostBody(x, up ? -36 : -30, s) + ghostFace(x, (up ? -36 : -30) + 17 * s, s, up)) + hand(15, 5.5, -30) + hand(45, 5.5, 30);
}

/** Partway through: a candle burned down as far as you've watched (`p`, 0..1), its wax run down
 *  the cover. Pointed at, the flame flares up. */
function candle(up: boolean, p: number) {
  const x = 24;
  const top = -(5 + 30 * (1 - p));
  // A drip of wax down the cover: thin, a little wider where it left the edge, a drop at its end.
  const drip = (dx: number, len: number) => {
    const c = x + dx;
    return `<path d="M${f1(c - 2.4)} 0C${f1(c - 2)} ${f1(len * 0.35)} ${f1(c - 1.2)} ${f1(len * 0.6)} ${f1(c - 1.3)} ${f1(len - 2.4)}C${f1(c - 2.5)} ${f1(len - 1.2)} ${f1(c - 2)} ${f1(len + 1.8)} ${c} ${f1(len + 1.8)}C${f1(c + 2)} ${f1(len + 1.8)} ${f1(c + 2.5)} ${f1(len - 1.2)} ${f1(c + 1.3)} ${f1(len - 2.4)}C${f1(c + 1.2)} ${f1(len * 0.6)} ${f1(c + 2)} ${f1(len * 0.35)} ${f1(c + 2.4)} 0Z" fill="#efe3c6"/><ellipse cx="${f1(c - 0.6)}" cy="${f1(len)}" rx="0.6" ry="0.9" fill="#fff" opacity="0.7"/>`;
  };
  const fl = up ? 1.45 : 1;
  let g = onCover(`<ellipse cx="${x}" cy="0" rx="${up ? 70 : 50}" ry="${up ? 56 : 40}" fill="url(#f-warm)" opacity="${up ? 0.8 : 0.55}"/>` + shadow(x + 4, 6, 12, 3, 0.3));
  // The wax that ran over the edge (more, the further it has burned), and its drips.
  const pool = 10 + 6 * p;
  g += `<path d="M${f1(x - pool)} 0C${f1(x - pool + 2)} 2.6 ${f1(x - 4)} 3.4 ${x} 2.8C${f1(x + 5)} 3.6 ${f1(x + pool - 2)} 2.4 ${f1(x + pool)} 0Z" fill="#efe3c6"/>`;
  g += drip(-6, 5 + 14 * p) + drip(5, 8 + 22 * p) + (p > 0.4 ? drip(10.5, 3 + 9 * p) : "");
  g += `<ellipse cx="${x}" cy="0" rx="${f1(pool)}" ry="2.4" fill="#f6eedb"/>`;
  g += `<rect x="${x - 7}" y="${f1(top)}" width="14" height="${f1(-top)}" fill="url(#f-wax)"/><ellipse cx="${x}" cy="${f1(top)}" rx="7" ry="2" fill="#fff6e0"/>`;
  g += `<path d="M${x - 7} ${f1(top + 1)}q0 ${f1(Math.min(6, -top - 2))} 1.4 ${f1(Math.min(8, -top - 1))}q1.6 2 1.6-5M${x + 3} ${f1(top + 1)}q0 4 1.4 ${f1(Math.min(6, -top - 1))}q1.4 1 1.4-4" fill="#fff6e0" opacity="0.9"/>`;
  g += `<path d="M${x} ${f1(top)}V${f1(top - 4)}" stroke="#2a1b2a" stroke-width="1"/>`;
  g += `<circle cx="${x}" cy="${f1(top - 8)}" r="${f1(15 * fl)}" fill="url(#f-warm)"/>`;
  g += `<g transform="translate(${x} ${f1(top - 4)}) scale(${fl})"><path d="M0 -12C3 -7 4.5 -3 0 0C-4.5 -3 -3 -7 0 -12Z" fill="url(#f-flame)" filter="url(#f-glow)"/></g>`;
  if (up) g += `<g fill="#ffcf5a" filter="url(#f-glow)"><circle cx="${x - 6}" cy="${f1(top - 24)}" r="1"/><circle cx="${x + 7}" cy="${f1(top - 27)}" r="0.9"/></g>`;
  return g;
}

interface Friend {
  /** The picture's box, as drawn (from the cover's top left; the edge is y = 0). */
  box: [number, number, number, number];
  /** Which side of the cover it keeps to. */
  side: "left" | "right";
  draw: (up: boolean) => string;
  /** How far it moves up between resting and pointed at (px), so the change reads as a move. */
  rise?: number;
  /** Uses pumpkins (and which colours). */
  pumpkin?: "m" | "g";
}

const FRIENDS: Record<string, Friend> = {
  pumpkin: { box: [56, -52, 172, 62], side: "right", draw: (u) => pumpkin(u), rise: 10, pumpkin: "m" },
  golden: { box: [56, -60, 172, 62], side: "right", draw: (u) => pumpkin(u, true), rise: 10, pumpkin: "g" },
  candy: { box: [0, -46, 96, 12], side: "left", draw: candy, rise: 10 },
  ghost: { box: [110, -44, 174, 10], side: "right", draw: ghost, rise: 6 },
  spider: { box: [36, -2, 80, 86], side: "left", draw: hanging, rise: 30 },
  web: { box: [0, 0, 88, 88], side: "left", draw: (u) => web(u) },
  webRight: { box: [84, 0, 172, 88], side: "right", draw: (u) => web(u, true) },
  bat: { box: [94, -4, 162, 54], side: "right", draw: bat },
  cat: { box: [34, -32, 122, 12], side: "left", draw: cat, rise: 2 },
  crow: { box: [4, -46, 90, 14], side: "left", draw: crow },
  hat: { box: [86, -60, 150, 8], side: "right", draw: hat, rise: 6 },
  slime: { box: [38, -22, 154, 70], side: "left", draw: slime },
  mummy: { box: [110, -4, 190, 94], side: "right", draw: mummy },
  grave: { box: [116, -56, 166, 10], side: "right", draw: grave },
  new: { box: [4, -40, 60, 14], side: "left", draw: newGhost, rise: 6 },
};
for (let tenths = 1; tenths <= 9; tenths++) FRIENDS[`candle${tenths}`] = { box: [0, -66, 96, 60], side: "left", draw: (u) => candle(u, tenths / 10) };

/** Who may sit on a cover, picked by the show (with "nobody" too, so not every cover has one). */
const PICKS = ["pumpkin", "candy", "ghost", "spider", "web", "webRight", "bat", "cat", "crow", "hat", "slime", "mummy"];

function picture(f: Friend, up: boolean) {
  const [x0, y0, x1, y1] = f.box;
  const defs = DEFS + (f.pumpkin === "m" ? pumpkinDefs("m") : f.pumpkin === "g" ? GOLD_DEFS() : "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${x1 - x0}" height="${y1 - y0}"><defs>${defs}</defs>${f.draw(up)}</svg>`;
}

/** The stylesheet placing each friend (its pictures, where, how big). */
function rules() {
  return Object.entries(FRIENDS)
    .map(([name, f]) => {
      const [x0, y0, x1, y1] = f.box;
      const at = f.side === "left" ? `--hf-left: ${x0}px;` : `--hf-right: ${W - x1}px;`;
      return `:root[data-theme="hollow"] [data-he-friend="${name}"] { ${at} --hf-top: ${y0}px; --hf-w: ${x1 - x0}px; --hf-h: ${y1 - y0}px; --hf-rise: ${f.rise ?? 0}px; --hf-rest: ${svgUrl(picture(f, false))}; --hf-up: ${svgUrl(picture(f, true))}; }`;
    })
    .join("\n");
}

/** The same number for a show every time, spread well. */
function hash(id: number) {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** The walking spider (the one moving house), drawn small enough to walk along a cover's edge. */
const WALKER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -26 48 46" width="48" height="46"><defs>${DEFS}</defs>${spider(0, 0, false, 0.9, true)}</svg>`;

export function startFriends({ surprises }: { surprises: boolean }) {
  const style = document.createElement("style");
  style.id = "he-friends";
  style.textContent = rules();
  document.head.append(style);

  // Changes to who sits where, this session: the golden pumpkin, the spider's moves.
  const moved = new Map<number, string | null>();
  let goldenDecided = !surprises;

  const friendOf = (el: HTMLElement) => {
    const id = Number(el.dataset.id);
    if (!Number.isFinite(id)) return null;
    const state = el.dataset.state;
    if (state === "new") return "new";
    if (state === "partway") return `candle${el.dataset.progress ?? 5}`;
    if (state === "finished") return "grave";
    if (moved.has(id)) return moved.get(id) ?? null;
    const pick = hash(id) % (PICKS.length + NOBODY);
    const friend = pick < PICKS.length ? PICKS[pick] : null;
    if (friend === "pumpkin" && !goldenDecided) {
      goldenDecided = true;
      if (Math.random() < GOLDEN_CHANCE) {
        moved.set(id, "golden");
        return "golden";
      }
    }
    return friend;
  };

  const place = () => {
    document.querySelectorAll<HTMLElement>(".card[data-id], .tp__cover[data-id]").forEach((el) => {
      const friend = friendOf(el);
      if (friend) {
        if (el.dataset.heFriend !== friend) el.dataset.heFriend = friend;
      } else if (el.dataset.heFriend) delete el.dataset.heFriend;
    });
  };

  let queued = 0;
  const changes = new MutationObserver(() => {
    queued ||= requestAnimationFrame(() => {
      queued = 0;
      place();
    });
  });
  changes.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-id", "data-state", "data-progress"] });
  place();

  // Now and then the spider packs up and walks along the covers' top edges to the next one along
  // (one with nobody on it), and settles there.
  const timers = new Set<number>();
  let walking = 0;
  let walker: HTMLElement | null = null;
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const seen = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth && r.top > 60 && r.bottom < window.innerHeight;
  };
  const move = () => {
    later(move, MOVE_EVERY_MS[0] + Math.random() * (MOVE_EVERY_MS[1] - MOVE_EVERY_MS[0]));
    if (document.hidden || walking) return;
    const from = [...document.querySelectorAll<HTMLElement>('.card[data-he-friend="spider"]')].find((card) => {
      const next = card.nextElementSibling as HTMLElement | null;
      return seen(card) && next?.matches(".card[data-id]") && !next.dataset.heFriend && seen(next);
    });
    const to = from?.nextElementSibling as HTMLElement | undefined;
    if (!from || !to) return;
    const fromArt = from.querySelector(".card__art") ?? from;
    const toArt = to.querySelector(".card__art") ?? to;
    walker = document.createElement("div");
    walker.className = "he-walker";
    walker.innerHTML = WALKER;
    document.body.append(walker);
    moved.set(Number(from.dataset.id), null);
    place();
    const start = performance.now();
    let duration = 0;
    const step = (now: number) => {
      const a = fromArt.getBoundingClientRect();
      const b = toArt.getBoundingClientRect();
      const ax = a.left + 58;
      const bx = b.left + 58;
      duration ||= (Math.abs(bx - ax) / WALK_SPEED) * 1000;
      const t = Math.min(1, (now - start) / duration);
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      walker!.style.transform = `translate(${(ax + (bx - ax) * ease - 24).toFixed(1)}px, ${(a.top - 40).toFixed(1)}px)`;
      if (t < 1 && from.isConnected && to.isConnected) {
        walking = requestAnimationFrame(step);
        return;
      }
      walking = 0;
      walker?.remove();
      walker = null;
      moved.set(Number(to.dataset.id), "spider");
      place();
    };
    walking = requestAnimationFrame(step);
  };
  if (surprises) later(move, MOVE_EVERY_MS[0]);

  if (import.meta.env.DEV) Object.assign(window, { heSpiderMove: move });

  return () => {
    changes.disconnect();
    cancelAnimationFrame(queued);
    cancelAnimationFrame(walking);
    walker?.remove();
    timers.forEach((t) => window.clearTimeout(t));
    style.remove();
    document.querySelectorAll<HTMLElement>("[data-he-friend]").forEach((el) => delete el.dataset.heFriend);
  };
}
