// The old branch across the top bar, reaching in from the top-right corner: thick and gnarled
// where it comes in (partly out of view), bending and thinning to a tip. Bark with grain and knots,
// the moon catching its top edge, twigs reaching up and hanging down (some curled at the tip), a
// broken-off stub, a few dry leaves still on it and a cobweb in a fork. Drawn at the window's real
// width (never stretched); the bats and the spider grip its underside (see topbar.ts).

const BARK = "#24172e";
const BARK_DARK = "#140c1a";
const RIM = "#4d3b66";
const MOON = "#7a65a3";
const f = (n: number) => n.toFixed(1);

/** How tall the drawing is (px). */
export const BRANCH_H = 70;

function random(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export interface Branch {
  svg: string;
  /** Where its underside is at x (px from its left end), for something to hang from it. */
  under: (x: number) => number;
}

/** The branch, `w` px long. `keepClear`: x positions (from its left end) where things hang, so
 *  hanging twigs stay out of their way. */
export function drawBranch(w: number, keepClear: number[]): Branch {
  const rand = random(23);
  // How far along it is (0 at the tip, 1 where it comes in), its middle line and its thickness.
  const u = (x: number) => Math.max(0, Math.min(1, x / w));
  const middle = (x: number) => 25 - 11 * u(x) + 2.8 * Math.sin(x / 61 + 0.8) + 1.3 * Math.sin(x / 23 + 2.1) + 0.6 * Math.sin(x / 9);
  const knots = [0.33, 0.58, 0.81].map((t) => t * w);
  const thick = (x: number) => {
    const bulge = knots.reduce((b, k) => b + 1.6 * Math.exp(-(((x - k) / 9) ** 2)), 0);
    // Thick most of the way, thinning fast only towards the tip.
    return 1.5 + (3.5 + 14 * u(x) ** 0.8 - 1.5) * Math.min(1, x / 70) + bulge * (0.4 + u(x));
  };
  const top = (x: number) => middle(x) - thick(x) / 2;
  const under = (x: number) => middle(x) + thick(x) / 2;

  // The branch's outline: along the top from the tip, back along the underside, a rounded tip.
  const xs: number[] = [];
  for (let x = 2; x <= w + 30; x += 6) xs.push(x);
  let outline = `M0 ${f(middle(0))}`;
  for (const x of xs) outline += `L${f(x)} ${f(top(x))}`;
  for (const x of [...xs].reverse()) outline += `L${f(x)} ${f(under(x))}`;
  outline += "Z";

  // Twigs: reaching up and out towards the tip, or hanging down (away from the bats and spider).
  // Each is a tapered stroke, sometimes forking, sometimes curled at the end.
  const twigs: { d: string; wd: number }[] = [];
  const twig = (x: number, y: number, angle: number, len: number, wd: number, fork: boolean) => {
    const bend = (rand() - 0.5) * 0.8;
    const x1 = x + Math.cos(angle) * len;
    const y1 = y + Math.sin(angle) * len;
    const cx = x + Math.cos(angle + bend) * len * 0.55;
    const cy = y + Math.sin(angle + bend) * len * 0.55;
    // Tapering: the curve split in two halves (thick, then thin).
    const mx = (x + 2 * cx + x1) / 4;
    const my = (y + 2 * cy + y1) / 4;
    twigs.push({ d: `M${f(x)} ${f(y)}Q${f((x + cx) / 2)} ${f((y + cy) / 2)} ${f(mx)} ${f(my)}`, wd });
    twigs.push({ d: `M${f(mx)} ${f(my)}Q${f((cx + x1) / 2)} ${f((cy + y1) / 2)} ${f(x1)} ${f(y1)}`, wd: Math.max(0.8, wd * 0.55) });
    if (fork && len > 10) {
      const side = rand() < 0.5 ? -1 : 1;
      twigs.push({ d: `M${f(mx)} ${f(my)}q${f(Math.cos(angle + side * 0.8) * len * 0.25)} ${f(Math.sin(angle + side * 0.8) * len * 0.25)} ${f(Math.cos(angle + side * 0.7) * len * 0.45)} ${f(Math.sin(angle + side * 0.7) * len * 0.45)}`, wd: wd * 0.6 });
    }
    if (rand() < 0.35) {
      const s = Math.cos(angle) < 0 ? -1 : 1;
      const r = 3 + rand() * 2;
      twigs.push({ d: `M${f(x1)} ${f(y1)}q${f(Math.cos(angle) * r)} ${f(Math.sin(angle) * r)} ${f(Math.cos(angle) * r + s * r)} ${f(Math.sin(angle) * r + r * 0.7)}`, wd: Math.max(0.9, wd * 0.6) });
    }
    return [x1, y1] as const;
  };
  const clear = (x: number, room: number) => keepClear.every((k) => Math.abs(k - x) > room);
  const leaves: [number, number, number][] = [];
  let webAt: [number, number] | null = null;
  for (let x = 24 + rand() * 20; x < w - 10; x += 26 + rand() * 40) {
    const t = u(x);
    if (rand() < 0.66) {
      // Up and back towards the tip (near where it comes in, some long ones going out of view).
      const long = t > 0.6 && rand() < 0.35;
      const [ex, ey] = twig(x, top(x) + 1.5, -Math.PI / 2 - 0.35 - rand() * 0.7, (long ? 26 : 7) + rand() * 14 * (0.5 + t), 1.4 + t * 3, rand() < 0.45);
      if (rand() < 0.25) leaves.push([ex, ey, -30 + rand() * 60]);
    } else if (clear(x, 26)) {
      // Hanging down.
      const [ex, ey] = twig(x, under(x) - 1, Math.PI / 2 - 0.4 + rand() * 0.5, 6 + rand() * 10, 1.1 + t * 1.6, false);
      if (rand() < 0.5) leaves.push([ex, ey - 0.5, 70 + rand() * 40]);
      if (!webAt && t > 0.55) webAt = [x, under(x)];
    }
  }
  // A thick stub, broken off, near where the branch comes in.
  const sx = w * 0.9;
  const stub = `M${f(sx - 4)} ${f(top(sx) + 2)}L${f(sx - 7)} ${f(top(sx) - 9)}L${f(sx - 2)} ${f(top(sx) - 11)}L${f(sx + 1)} ${f(top(sx) - 8)}L${f(sx + 3)} ${f(top(sx) + 2)}Z`;

  // Drawn twice, like the trees: a little wider in the rim colour, then the bark on top, so the
  // outline only shows round the outside.
  const strokes = (color: string, extra: number) =>
    `<g stroke="${color}" fill="none" stroke-linecap="round" stroke-linejoin="round">${twigs.map((t) => `<path d="${t.d}" stroke-width="${f(t.wd + extra)}"/>`).join("")}</g>`;
  let s = `<defs><linearGradient id="hb-bark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#36254a"/><stop offset="0.45" stop-color="${BARK}"/><stop offset="1" stop-color="${BARK_DARK}"/></linearGradient></defs>`;
  s += `<g fill="${RIM}" stroke="${RIM}" stroke-width="2" stroke-linejoin="round"><path d="${outline}"/><path d="${stub}"/></g>${strokes(RIM, 2)}`;
  s += strokes(BARK, 0);
  s += `<path d="${outline}" fill="url(#hb-bark)"/><path d="${stub}" fill="${BARK}"/><path d="M${f(sx - 7)} ${f(top(sx) - 9)}L${f(sx - 2)} ${f(top(sx) - 11)}L${f(sx + 1)} ${f(top(sx) - 8)}" stroke="#5c4a52" stroke-width="1" fill="none"/>`;

  // Bark: grain running along it, broken into strands, thinner and fewer towards the tip.
  for (let line = 0; line < 4; line++) {
    const off = -0.28 + line * 0.19;
    let d = "";
    for (let x = 20 + rand() * 40; x < w + 20; ) {
      const len = 30 + rand() * 70;
      if (thick(x) > 5) {
        d += `M${f(x)} ${f(middle(x) + off * thick(x))}`;
        for (let xx = x + 6; xx < Math.min(x + len, w + 20); xx += 6) d += `L${f(xx)} ${f(middle(xx) + off * thick(xx) + Math.sin(xx / 7 + line) * 0.6)}`;
      }
      x += len + 10 + rand() * 30;
    }
    if (d) s += `<path d="${d}" stroke="${line % 2 ? BARK_DARK : "#2f2040"}" stroke-width="${line % 2 ? 1.1 : 0.8}" fill="none" stroke-linecap="round" opacity="0.9"/>`;
  }
  // Knots, where it bulges.
  for (const k of knots) {
    const ky = middle(k) + thick(k) * 0.08;
    s += `<ellipse cx="${f(k)}" cy="${f(ky)}" rx="${f(thick(k) * 0.32)}" ry="${f(thick(k) * 0.2)}" fill="${BARK_DARK}" stroke="#3a2a4d" stroke-width="0.9"/><ellipse cx="${f(k - 0.6)}" cy="${f(ky - 0.4)}" rx="${f(thick(k) * 0.12)}" ry="${f(thick(k) * 0.07)}" fill="#07040a"/>`;
  }
  // The moon catching its top edge.
  let moon = "";
  for (let x = 6; x <= w + 30; x += 6) moon += `${moon ? "L" : "M"}${f(x)} ${f(top(x) + 0.9)}`;
  s += `<path d="${moon}" stroke="${MOON}" stroke-width="1.1" fill="none" opacity="0.7" stroke-linecap="round"/>`;

  // Dry leaves still hanging on.
  const leafColors = ["#7a3f14", "#8a4a12", "#5e2a12"];
  for (const [lx, ly, a] of leaves.slice(0, 4))
    s += `<path transform="translate(${f(lx)} ${f(ly)}) rotate(${f(a)})" d="M0 0Q4-4 9-1Q5 3 0 0Z" fill="${leafColors[Math.floor(rand() * 3)]}" stroke="#2a1408" stroke-width="0.5"/><path transform="translate(${f(lx)} ${f(ly)}) rotate(${f(a)})" d="M0 0L8-1" stroke="#2a1408" stroke-width="0.5"/>`;

  // A small cobweb under it, strung between the branch and a hanging twig.
  if (webAt) {
    const [wx, wy] = webAt as [number, number];
    const spokes = [0.15, 0.6, 1.05, 1.5].map((a) => [wx - 2 + Math.cos(Math.PI / 2 + a) * 15, wy + Math.sin(Math.PI / 2 + a) * 12]);
    let web = spokes.map(([px, py]) => `M${f(wx)} ${f(wy)}L${f(px)} ${f(py)}`).join("");
    for (const k of [0.4, 0.7, 1]) web += `M${spokes.map(([px, py]) => `${f(wx + (px - wx) * k)} ${f(wy + (py - wy) * k)}`).join("Q" + f(wx - 4) + " " + f(wy + 5 * k) + " ")}`;
    s += `<path d="${web}" stroke="#f3ead8" stroke-width="0.5" fill="none" opacity="0.35"/>`;
  }

  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${BRANCH_H}" viewBox="0 0 ${w} ${BRANCH_H}" overflow="visible">${s}</svg>`, under };
}
