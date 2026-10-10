// Hollow's Eve's bare trees. Every tree grows from its own seed: a trunk that forks again and again,
// each branch a little crooked and thinner than the last, some tips curling, so no two look alike.
// A few have a personality of their own: an owl keeping watch, a grumpy old tree with a face, one
// whose branches curl into spirals, and one with a tire swing still swaying.

const BARK = "#0e0814";
const FAR_BARK = "#170e20";
/** A faint moonlit edge around each tree, so it shows against dark artwork too. */
const RIM = "#34254a";
const RIM_W = 1.8;

function random(seed: number) {
  let s = (seed * 7919 + 13) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

interface Options {
  /** Leans the trunk (radians; negative is left). */
  lean?: number;
  /** How wide the branches fan out. */
  spread?: number;
  /** How likely a tip curls over, and how far (1 = a full spiral). */
  curl?: number;
  curlSize?: number;
  /** How many times it forks. */
  depth?: number;
  /** Trunk thickness, relative to its height. */
  girth?: number;
  color?: string;
  /** A filled shape that's part of the tree too (a wide trunk), sharing its outline. */
  shape?: string;
}

/** A spot where a branch bends off sideways: somewhere for an owl to sit or a swing to hang. */
interface Perch {
  x: number;
  y: number;
  /** How flat the branch is there (0: straight up, 1: flat). */
  flat: number;
  depth: number;
}

/** A tree `size` tall standing at x, y, grown from `seed`. Also returns its perches. */
export function growTree(x: number, y: number, size: number, seed: number, o: Options = {}) {
  const rand = random(seed);
  const { lean = (rand() - 0.5) * 0.25, spread = 1.1, curl = 0.3, curlSize = 0.5, depth = 4, girth = 0.075, color = BARK, shape } = o;
  let d = "";
  const strokes: { d: string; w: number }[] = [];
  const perches: Perch[] = [];
  const up = -Math.PI / 2;

  const branch = (x0: number, y0: number, angle: number, len: number, width: number, left: number) => {
    // A gently bent segment: its middle pushed off to one side.
    const bend = (rand() - 0.5) * 0.7;
    const x1 = x0 + Math.cos(angle) * len;
    const y1 = y0 + Math.sin(angle) * len;
    const cx = x0 + Math.cos(angle + bend) * len * 0.55;
    const cy = y0 + Math.sin(angle + bend) * len * 0.55;
    strokes.push({ d: `M${x0.toFixed(1)} ${y0.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`, w: width });
    if (left === 0 || width < 0.9) {
      // A tip: sometimes it hooks over, curling like a finger.
      if (rand() < curl) {
        const side = Math.cos(angle) >= 0 ? 1 : -1;
        const r = len * curlSize * (0.6 + rand() * 0.5);
        const ax = x1 + Math.cos(angle) * r;
        const ay = y1 + Math.sin(angle) * r;
        const bx = ax + side * r * 0.9;
        const by = ay + r * 0.6;
        d += `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${ax.toFixed(1)} ${ay.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
        if (curlSize > 0.8) d += `Q${(bx - side * r * 0.2).toFixed(1)} ${(by + r * 0.5).toFixed(1)} ${(bx - side * r * 0.5).toFixed(1)} ${(by + r * 0.1).toFixed(1)}`;
      }
      return;
    }
    const count = rand() < 0.2 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const fan = count === 2 ? (i === 0 ? -0.5 : 0.5) : i - 1;
      let a = angle + fan * spread * (0.55 + rand() * 0.45) + (rand() - 0.5) * 0.3;
      // Branches still reach upward a little, like real ones.
      a = a * 0.85 + up * 0.15;
      const childLen = len * (0.62 + rand() * 0.2);
      if (left >= 2 && Math.abs(Math.cos(a)) > 0.45) perches.push({ x: x1, y: y1, flat: Math.abs(Math.cos(a)), depth: left });
      branch(x1, y1, a, childLen, width * (0.6 + rand() * 0.08), left - 1);
    }
  };

  const width = Math.max(2.2, size * girth);
  // Roots spreading into the ground.
  strokes.push({ d: `M${x - width * 1.6} ${y + 2}Q${x - width * 0.4} ${y - 1} ${x} ${y - size * 0.06}Q${x + width * 0.4} ${y - 1} ${x + width * 1.7} ${y + 2}`, w: width * 0.55 });
  branch(x, y, up + lean, size * 0.36, width, depth);
  if (d) strokes.push({ d, w: Math.max(1.1, width * 0.26) });
  // Drawn twice: a little wider in moonlight for its outline, then in bark on top, so the outline
  // only shows round the outside (also of a `shape`).
  const pass = (stroke: string, extra: number) =>
    `<g stroke="${stroke}" fill="none" stroke-linecap="round" stroke-linejoin="round">${strokes.map((s) => `<path d="${s.d}" stroke-width="${(s.w + extra).toFixed(2)}"/>`).join("")}` +
    (shape ? `<path d="${shape}" fill="${stroke}" stroke-width="${extra}"/>` : "") +
    `</g>`;
  const svg = (color === BARK ? pass(RIM, RIM_W) : "") + pass(color, 0);
  return { svg, perches, width };
}

/** A distant tree on the hills: smaller, a little paler, and now and then a crow on top. */
export function farTree(x: number, y: number, size: number, seed: number) {
  const { svg, perches } = growTree(x, y, size, seed, { color: FAR_BARK, curl: 0.35, depth: 3 + (seed % 2) });
  const top = perches.sort((a, b) => a.y - b.y)[0];
  const crow = seed % 3 === 0 && top ? crowShape(top.x, top.y, 0.7) : "";
  return svg + crow;
}

function crowShape(x: number, y: number, s: number) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})" fill="${FAR_BARK}"><path d="M-7 0c2-5 7-8 12-6l4-1-3 3c1 3-1 5-4 5h-6l-5 4 1-4z"/></g>`;
}

function bestPerch(perches: Perch[], minDepth: number, side?: number, around?: number) {
  const fit = perches.filter((p) => p.depth >= minDepth && (side == null || Math.sign(p.x - (around ?? 0)) === side));
  return (fit.length ? fit : perches).sort((a, b) => b.flat - a.flat)[0];
}

/** The owl's tree: an old, wide-spreading one with an owl on a branch, blinking (hollow.css). */
export function owlTree(x: number, y: number, size: number) {
  const tree = growTree(x, y, size, 41, { spread: 1.25, curl: 0.2, depth: 4, girth: 0.085, lean: -0.08 });
  const p = bestPerch(tree.perches, 3, -1, x);
  const owl = p
    ? `<g transform="translate(${p.x.toFixed(1)} ${(p.y - 1).toFixed(1)})" class="he-owl">
        <path d="M-7 0C-9-8-7-15-5-18L-4-22-1-18H1L4-22 5-18C7-15 9-8 7 0Z" fill="${BARK}"/>
        <path d="M-4 0l-1 3M4 0l1 3" stroke="${BARK}" stroke-width="1.4"/>
        <g class="he-owl__eyes" fill="#ffd36b"><circle cx="-2.8" cy="-13" r="2.4"/><circle cx="2.8" cy="-13" r="2.4"/></g>
        <g fill="${BARK}"><circle cx="-2.6" cy="-13" r="1"/><circle cx="2.6" cy="-13" r="1"/></g>
        <path d="M-1-10.5l1 2 1-2z" fill="#c98a2e"/>
      </g>`
    : "";
  return tree.svg + owl;
}

/** The grumpy old tree: a thick, knobbly trunk with a face, its eyes glowing faintly. */
export function faceTree(x: number, y: number, size: number) {
  const girth = 0.12;
  const w = Math.max(2.2, size * girth);
  const fy = y - size * 0.2;
  // A wider trunk at the bottom, narrowing up into the branches: part of the tree, one outline.
  const top = y - size * 0.44;
  const trunk = `M${x - w * 1.15} ${y + 1}C${x - w * 0.95} ${fy} ${x - w * 0.6} ${fy - size * 0.12} ${x - w * 0.42} ${top}Q${x} ${top - w * 0.4} ${x + w * 0.42} ${top}C${x + w * 0.62} ${fy - size * 0.1} ${x + w * 1} ${fy} ${x + w * 1.25} ${y + 1}Z`;
  const tree = growTree(x, y, size, 77, { spread: 1.4, curl: 0.45, curlSize: 0.6, depth: 4, girth, lean: -0.06, shape: trunk });
  const e = w * 0.22;
  const face = `<g class="he-treeface">
    <path d="M${x - w * 0.55} ${fy - e * 0.2}q${e} ${-e * 1.3} ${e * 2} ${-e * 0.2}q${-e} ${e * 0.9} ${-e * 2} ${e * 0.2}z" fill="#ff8a2e"/>
    <path d="M${x + w * 0.55} ${fy - e * 0.2}q${-e} ${-e * 1.3} ${-e * 2} ${-e * 0.2}q${e} ${e * 0.9} ${e * 2} ${e * 0.2}z" fill="#ff8a2e"/>
    <path d="M${x - w * 0.4} ${fy + e * 2.2}q${w * 0.4} ${-e * 1.6} ${w * 0.8} ${e * 0.3}q${-w * 0.4} ${-e * 0.6} ${-w * 0.8} ${-e * 0.3}z" fill="#ff8a2e"/>
  </g>`;
  // A knot in the bark.
  const knot = `<ellipse cx="${x + w * 0.35}" cy="${y - size * 0.07}" rx="${w * 0.14}" ry="${w * 0.2}" fill="#050208"/>`;
  return tree.svg + face + knot;
}

/** A tall, thin tree whose branch tips curl into spirals. */
export function spiralTree(x: number, y: number, size: number) {
  return growTree(x, y, size, 23, { spread: 0.95, curl: 1, curlSize: 1.25, depth: 3, girth: 0.065, lean: 0.1 }).svg;
}

/** A leaning tree with an old tire swing on a branch, swaying gently. */
export function swingTree(x: number, y: number, size: number) {
  const tree = growTree(x, y, size, 58, { spread: 1.2, curl: 0.25, depth: 4, girth: 0.08, lean: 0.22 });
  const p = bestPerch(tree.perches, 2, 1, x);
  if (!p) return tree.svg;
  const drop = Math.max(18, y - p.y - 14);
  const swing = `<g class="he-swing" style="transform-origin: ${p.x.toFixed(1)}px ${p.y.toFixed(1)}px">
    <path d="M${p.x.toFixed(1)} ${p.y.toFixed(1)}v${drop.toFixed(1)}" stroke="#3a2a48" stroke-width="1.2"/>
    <ellipse cx="${p.x.toFixed(1)}" cy="${(p.y + drop + 5).toFixed(1)}" rx="7" ry="5" fill="none" stroke="${BARK}" stroke-width="3.4"/>
  </g>`;
  return tree.svg + swing;
}
