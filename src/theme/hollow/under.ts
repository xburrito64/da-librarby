// Under the pumpkin patch: the ground is cut away like a slice of earth lifted out with a spade, so
// you can see into it under the library's rows. The cut has a ragged edge with grass hanging over
// it, warm where the jack-o'-lanterns' light spills over. Below are layers, darker as they go
// down: topsoil with the patch's roots and worms going about their business; red clay with a
// sleeping skeleton, glowing mushrooms, someone's candy stash, old bones and a worm asleep in its
// burrow; then stones with an old coffin, purple crystals and fossils. Some of them do something
// when pointed at (scenes.ts). As wide as the window, lined up with the patch above (scene.ts).
// See hollow.css ("Under the patch").

/** One of the patch's pumpkins: where it stands (from the scene's left), how big, and lit or not. */
export interface Spot {
  x: number;
  size: number;
  lit: boolean;
}

/** How far down the slice goes (px), and where its layers begin. */
export const UNDER_H = 560;
const CLAY = 76;
const STONES = 150;
const DEEP = 262;

const f = (n: number) => n.toFixed(1);
const BONE = "#3d3550";

function random(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A gently wavy line across the slice, for where one layer meets the next. */
function wavy(w: number, y: number, amp: number, k: number, phase: number) {
  let d = `M0 ${f(y)}`;
  for (let x = 0; x <= w + 40; x += 40) d += `L${x} ${f(y + Math.sin(x / k + phase) * amp + Math.sin(x / (k * 0.37) + phase * 3) * amp * 0.35)}`;
  return d;
}

/** A worm along a path (in its own little drawing space, placed at x, y and shrunk to `scale`): a
 *  body with rings and a pale saddle, darker underneath and shiny on top, in the tunnel it has dug
 *  (`tunnel`, a path leading up to it; none if it's lying in a burrow drawn for it). `head`: where
 *  its head is, for its eyes. */
function worm(x: number, y: number, d: string, o: { width: number; color: string; dark: string; saddle: number; scale?: number; tunnel?: string; head?: [number, number]; eyes?: "open" | "shut" | "up"; extra?: string }) {
  const { width: wd, color, dark, saddle, scale = 0.7, tunnel, head, eyes, extra = "" } = o;
  const line = (stroke: string, width: number, more = "", cap = "round", path = d) =>
    `<path d="${path}" stroke="${stroke}" stroke-width="${f(width)}" fill="none" stroke-linecap="${cap}" stroke-linejoin="round" ${more}/>`;
  let s = `<g transform="translate(${f(x)} ${f(y)}) scale(${scale})">`;
  // Its tunnel: a dark hollow in the earth with a paler rim, fading out far behind it.
  if (tunnel != null) {
    s += line("url(#heu-tunnel-rim)", wd + 5, "", "round", tunnel + d);
    s += line("url(#heu-tunnel)", wd + 2.6, "", "round", tunnel + d);
  }
  s += `<g transform="translate(0.6 1)">${line(dark, wd)}</g>`;
  s += line(color, wd);
  s += line("#f1b7c4", wd * 1.05, `stroke-dasharray="0 ${saddle} ${f(wd * 1.5)} 999" opacity="0.35"`, "butt");
  s += line(dark, wd, `stroke-dasharray="0.7 ${f(wd * 0.75)}" opacity="0.45"`, "butt");
  s += `<g transform="translate(-0.3 ${f(-wd * 0.22)})">${line("#ffd6df", wd * 0.28, `opacity="0.3"`)}</g>`;
  if (head && eyes) {
    const [hx, hy] = head;
    const e = wd * 0.17;
    s +=
      eyes === "shut"
        ? `<path d="M${f(hx - e * 3)} ${f(hy - e)}q${f(e)} ${f(e)} ${f(e * 2)} 0M${f(hx + e)} ${f(hy - e)}q${f(e)} ${f(e)} ${f(e * 2)} 0" stroke="#120a17" stroke-width="0.7" fill="none" stroke-linecap="round"/>`
        : `<circle cx="${f(hx - e * 2)}" cy="${f(hy - e * (eyes === "up" ? 1.8 : 1))}" r="${f(e)}" fill="#120a17"/><circle cx="${f(hx + e * 1.4)}" cy="${f(hy - e * (eyes === "up" ? 1.8 : 1))}" r="${f(e)}" fill="#120a17"/>`;
  }
  return `${s}${extra}</g>`;
}

const bone = (x: number, y: number, a: number, len: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" fill="${BONE}"><rect x="${-len / 2}" y="-2.2" width="${len}" height="4.4" rx="2"/><circle cx="${-len / 2}" cy="-2.6" r="3.2"/><circle cx="${-len / 2}" cy="2.6" r="3.2"/><circle cx="${len / 2}" cy="-2.6" r="3.2"/><circle cx="${len / 2}" cy="2.6" r="3.2"/></g>`;
const key = (x: number, y: number, a: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})" stroke="#5b3d2a" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.85"><circle r="4.6"/><path d="M4.6 0H22M17 0v4M21 0v3.4"/><circle r="1.6" fill="#120a17" stroke="none"/></g>`;
const beetle = (x: number, y: number, a: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})"><path d="M-3-3l-2-3M0-3.4v-3M3-3l2-3M-3 3l-2 3M0 3.4v3M3 3l2 3" stroke="#23193a" stroke-width="0.9" stroke-linecap="round"/><ellipse rx="5.2" ry="3.7" fill="#23193a"/><circle cx="6" r="2" fill="#23193a"/><path d="M-5 0H5" stroke="#120a17" stroke-width="0.6"/><ellipse cx="-1.6" cy="-1.8" rx="2" ry="0.8" fill="#4d3f70" opacity="0.8"/></g>`;
const snail = (x: number, y: number) =>
  `<g transform="translate(${f(x)} ${f(y)})"><path d="M-12 4c2-3 18-4 22-1c2-2 3-6 2-9M10 3c1-3 0-6-1-8" stroke="#56475f" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="12" cy="-6" r="0.9" fill="#56475f"/><circle cx="9" cy="-5" r="0.9" fill="#56475f"/><circle cx="-2" cy="-3" r="7" fill="#4a3550"/><path d="M-2-3m-1.5 0a1.5 1.5 0 1 1 3 0a3.2 3.2 0 1 1-6.4 0a5 5 0 1 1 10 0" stroke="#2c2038" stroke-width="1.2" fill="none"/></g>`;
const BONE_LIT = "#4b4263";

/** A little skeleton asleep on its side, curled up, its hand for a pillow. Pointed at, it lifts
 *  its head, waves and chatters (hollow.css, scenes.ts). */
const skeleton = (x: number, y: number) =>
  `<g class="heu-skel" data-poke="skeleton" transform="translate(${f(x)} ${f(y)}) scale(1.3)" fill="none" stroke="${BONE_LIT}" stroke-linecap="round" stroke-linejoin="round">` +
  // Legs, drawn up (knees forward), and the feet.
  `<path d="M16 2L6 10L14 17M19 3L10 12L17 19" stroke-width="2.6"/><path d="M14 17h-5M17 19h-5" stroke-width="2"/>` +
  // Spine and hips.
  `<path d="M-14 0Q0 -4 16 1" stroke-width="2.4" stroke-dasharray="2.4 1.2"/><ellipse cx="17" cy="2" rx="4" ry="3.4" fill="${BONE_LIT}" stroke="none"/>` +
  // Ribs.
  `<path d="M-12-1q2 7 6 8M-8-2q2 7 6 8M-4-3q2 7 6 8M0-3q2 6 5 7" stroke-width="1.6"/>` +
  // The arm tucked in (it waves when pointed at), and the one under its head.
  `<g class="heu-skel__arm"><path d="M-12 -1L-5 7L3 8" stroke-width="2.2"/><path d="M3 8l2.4-1M3 8l2.6 1M3 8l1.6 2.2" stroke-width="1.2"/></g>` +
  `<path d="M-13 1L-22 6L-30 3" stroke-width="2.2"/>` +
  // The skull, its jaw apart so it can chatter.
  `<g class="heu-skel__head"><path d="M-37-9a8 8 0 1 1 15 2v3h-12z" fill="${BONE_LIT}" stroke="none"/><circle cx="-29" cy="-8" r="2.4" fill="#120a17" stroke="none"/><circle cx="-24" cy="-7" r="2" fill="#120a17" stroke="none"/>` +
  `<g class="heu-skel__jaw"><path d="M-33-3.5h10v2.6q-5 2-10 0z" fill="${BONE_LIT}" stroke="none"/><path d="M-31-3.4v2M-28-3.4v2.4M-25-3.4v2" stroke="#120a17" stroke-width="0.7"/></g></g>` +
  `<text class="heu-skel__z" x="-26" y="-20" font-size="8" font-weight="800" fill="#8d7fb0" stroke="none" font-family="Baloo 2 Variable, sans-serif">z</text></g>`;

/** Mushrooms growing off a root, glowing softly; they puff spores when you come near. */
const mushrooms = (x: number, y: number) => {
  const cap = (cx: number, cy: number, r: number, tilt: number) =>
    `<g transform="rotate(${tilt} ${f(cx)} ${f(cy + r * 1.6)})"><path d="M${f(cx - r * 0.18)} ${f(cy + r * 1.7)}Q${f(cx)} ${f(cy + r * 0.8)} ${f(cx - r * 0.1)} ${f(cy)}h${f(r * 0.36)}Q${f(cx + r * 0.1)} ${f(cy + r * 0.8)} ${f(cx + r * 0.2)} ${f(cy + r * 1.7)}z" fill="#c9c2d9"/>` +
    `<path d="M${f(cx - r)} ${f(cy)}Q${f(cx - r)} ${f(cy - r * 0.9)} ${f(cx)} ${f(cy - r * 0.9)}Q${f(cx + r)} ${f(cy - r * 0.9)} ${f(cx + r)} ${f(cy)}Q${f(cx)} ${f(cy + r * 0.25)} ${f(cx - r)} ${f(cy)}z" fill="url(#heu-shroom)"/>` +
    `<circle cx="${f(cx - r * 0.35)}" cy="${f(cy - r * 0.45)}" r="${f(r * 0.14)}" fill="#e9fff6" opacity="0.8"/><circle cx="${f(cx + r * 0.3)}" cy="${f(cy - r * 0.3)}" r="${f(r * 0.1)}" fill="#e9fff6" opacity="0.7"/></g>`;
  return (
    `<g class="heu-shrooms" data-poke="mushrooms" transform="translate(${f(x)} ${f(y)})">` +
    `<ellipse class="heu-shrooms__glow" cx="0" cy="-2" rx="26" ry="18" fill="url(#heu-shroom-glow)"/>` +
    `<path d="M-30 6Q-10 2 0 8T30 6" stroke="#3d2822" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    cap(-9, -4, 6, -12) + cap(1, -10, 8, 4) + cap(10, -1, 4.5, 18) +
    `<g class="heu-shrooms__spores" fill="#9fffd8">${[-6, 1, 7, -2, 4].map((sx, i) => `<circle cx="${sx}" cy="-12" r="${0.8 + (i % 2) * 0.4}" style="animation-delay:${i * 0.18}s"/>`).join("")}</g></g>`
  );
};

/** Someone's secret candy stash in a little burrow: candy corn, sweets in twisted wrappers and a
 *  lollipop. It glints when pointed at; click it and you've found it (scenes.ts). */
const stash = (x: number, y: number) => {
  const corn = (cx: number, cy: number, a: number) =>
    `<g transform="translate(${cx} ${cy}) rotate(${a})"><path d="M-3.4 3.2L0-4.6L3.4 3.2Q0 4.4-3.4 3.2Z" fill="#ffd23f"/><path d="M-2.1 0.2L-1 -2.2H1L2.1 0.2Z" fill="#ff8a1f"/><path d="M-0.95 -2.2L0-4.6L0.95-2.2Z" fill="#fff6e6"/></g>`;
  const sweet = (cx: number, cy: number, a: number, c: string) =>
    `<g transform="translate(${cx} ${cy}) rotate(${a})"><path d="M-7-2.6L-4 0-7 2.6ZM7-2.6L4 0 7 2.6Z" fill="${c}" opacity="0.85"/><ellipse rx="4.2" ry="3" fill="${c}"/><path d="M-2.4-1.2q2.4-1.2 4.8 0" stroke="#fff" stroke-width="0.7" fill="none" opacity="0.6"/></g>`;
  return (
    `<g class="heu-stash" data-poke="stash" transform="translate(${f(x)} ${f(y)})">` +
    `<path d="M-26 6C-28-6-14-14 0-14S27-6 26 5S12 15 0 15S-24 15-26 6Z" fill="#08050c" stroke="#2c1f3d" stroke-width="2.2"/>` +
    `<path d="M14-16l2 4" stroke="#f3ead8" stroke-width="1.4" stroke-linecap="round"/><circle cx="13" cy="-18" r="4" fill="#9b5de5"/><path d="M11-19.5a2.4 2.4 0 0 1 4 1" stroke="#fff" stroke-width="0.8" fill="none" opacity="0.7"/>` +
    sweet(-12, 6, 10, "#e94f64") + sweet(10, 7, -14, "#58c46d") + corn(-2, 4, -8) + corn(4, 9, 22) + corn(-17, 10, 40) + sweet(0, 11, 4, "#4aa3ff") + corn(16, 0, -30) +
    `<g class="heu-stash__glints" fill="#fff6dc">${[[-10, 0], [6, 2], [16, -6], [-2, 8]].map(([gx, gy], i) => `<path d="M${gx} ${gy - 3}L${gx + 0.8} ${gy}L${gx} ${gy + 3}L${gx - 0.8} ${gy}ZM${gx - 3} ${gy}L${gx} ${gy + 0.8}L${gx + 3} ${gy}L${gx} ${gy - 0.8}Z" style="animation-delay:${i * 0.15}s"/>`).join("")}</g></g>`
  );
};

/** An old wooden coffin, lying a little crooked: planks, a long cross on the lid, and nails. Pointed at, the lid slides open a crack and a pair of eyes looks out. */
const coffin = (x: number, y: number, a: number) => {
  const shape = "M-42-6L-30-15L40-10L40 10L-30 15L-42 6Z";
  return (
    `<g class="heu-coffin" data-poke="coffin" transform="translate(${f(x)} ${f(y)}) rotate(${a})">` +
    `<path d="${shape}" fill="#08050c"/>` +
    `<g class="heu-coffin__eyes" fill="#ffcf5a"><ellipse cx="-31" cy="-3.4" rx="2" ry="1.4"/><ellipse cx="-31" cy="3.4" rx="2" ry="1.4"/></g>` +
    `<g class="heu-coffin__lid"><path d="${shape}" fill="#3b2531" stroke="#1e1119" stroke-width="1.6"/>` +
    `<path d="M-38-3.5L-28-11L38-7.5M-38 3.5L-28 11L38 7.5M-30 -1.5H38M-30 1.5H38" stroke="#2c1a25" stroke-width="0.8" fill="none" opacity="0.8"/>` +
    `<path d="M-36-5L-29-12L37-8.5V8.5L-29 12L-36 5Z" fill="none" stroke="#4e3242" stroke-width="1"/>` +
    `<path d="M-16 0H26M-6-6V6" stroke="#7a5868" stroke-width="2.6" stroke-linecap="round"/>` +
    `<g fill="#8a7a96">${[[-32, -8], [-32, 8], [34, -7], [34, 7]].map(([nx, ny]) => `<circle cx="${nx}" cy="${ny}" r="0.9"/>`).join("")}</g></g>` +
    `</g>`
  );
};

/** A cluster of purple crystals in a split rock, glowing faintly. */
const crystals = (x: number, y: number) => {
  const shard = (bx: number, by: number, h: number, wd: number, tilt: number) =>
    `<g transform="rotate(${tilt} ${bx} ${by})"><path d="M${bx - wd} ${by}V${by - h * 0.7}L${bx} ${by - h}L${bx + wd} ${by - h * 0.7}V${by}Z" fill="#7b4fc2"/><path d="M${bx} ${by - h}L${bx + wd} ${by - h * 0.7}V${by}H${bx}Z" fill="#5a3596"/><path d="M${bx - wd * 0.5} ${by - h * 0.15}V${by - h * 0.7}" stroke="#d8c2ff" stroke-width="0.8" opacity="0.7"/></g>`;
  return (
    `<g class="heu-crystals" data-poke="crystals" transform="translate(${f(x)} ${f(y)})">` +
    `<ellipse class="heu-crystals__glow" cx="0" cy="-6" rx="30" ry="20" fill="url(#heu-crystal-glow)"/>` +
    `<path d="M-24 6Q-26-6-16-8L-10 2L10 2L16-8Q26-6 24 6Q0 12-24 6Z" fill="#2a2038" stroke="#3c2f50" stroke-width="1"/>` +
    shard(-8, 3, 16, 3.4, -18) + shard(0, 3, 22, 4, 0) + shard(8, 3, 14, 3, 20) + shard(-14, 4, 9, 2.4, -36) + shard(13, 4, 8, 2.2, 38) +
    `<g class="heu-crystals__glints" fill="#fff">${[[0, -18], [-9, -11], [9, -10]].map(([gx, gy], i) => `<circle cx="${gx}" cy="${gy}" r="0.9" style="animation-delay:${i * 0.9}s"/>`).join("")}</g></g>`
  );
};

/** A fossil in a slab of pale stone: a fish, or a spiral shell. */
const fossil = (x: number, y: number, a: number, kind: "fish" | "shell") => {
  const slab = kind === "fish" ? "M-30-12L22-15L33-3L28 12L-24 14L-34 2Z" : "M-17-13L13-15L19 1L12 14L-14 13L-20-2Z";
  let mark = "";
  if (kind === "fish") {
    let ribs = "";
    for (let i = -10; i <= 8; i += 4.5) ribs += `M${i} ${-6 + Math.abs(i) * 0.15}Q${i + 2.5} 0 ${i} ${6 - Math.abs(i) * 0.15}`;
    mark = `<g stroke="#2a2138" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M-17 0H13${ribs}M-17 0l-6-6M-17 0l-6 6"/><path d="M13-6Q23-5 24 0Q23 5 13 6Z" fill="#2a2138" stroke="none"/></g>`;
  } else {
    mark =
      `<path d="M0 0m-1.6 0a1.6 1.6 0 1 1 3.2 0a3.4 3.4 0 1 1-6.8 0a5.4 5.4 0 1 1 10.8 0a7.6 7.6 0 1 1-15.2 0" stroke="#2a2138" stroke-width="1.3" fill="none"/>` +
      [...Array(9)]
        .map((_, i) => {
          const t = (i / 9) * Math.PI * 2;
          return `<path d="M${f(Math.cos(t) * 5)} ${f(Math.sin(t) * 5)}L${f(Math.cos(t) * 8)} ${f(Math.sin(t) * 8)}" stroke="#2a2138" stroke-width="0.7"/>`;
        })
        .join("");
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})"><path d="${slab}" fill="#3a3046" stroke="#4b3f5a" stroke-width="1.2" stroke-linejoin="round"/>${mark}</g>`;
};

/** A rounded stone, lit a little from above. */
function stone(x: number, y: number, r: number, rand: () => number) {
  const n = 7;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + rand() * 0.4;
    const k = 0.8 + rand() * 0.3;
    pts.push([x + Math.cos(t) * r * 1.25 * k, y + Math.sin(t) * r * 0.85 * k]);
  }
  // Smooth: through the middle of each side, bending at the corners.
  const mid = (i: number) => {
    const [ax, ay] = pts[i % n];
    const [bx, by] = pts[(i + 1) % n];
    return [(ax + bx) / 2, (ay + by) / 2];
  };
  let d = `M${f(mid(0)[0])} ${f(mid(0)[1])}`;
  for (let i = 1; i <= n; i++) d += `Q${f(pts[i % n][0])} ${f(pts[i % n][1])} ${f(mid(i)[0])} ${f(mid(i)[1])}`;
  return `<path d="${d}Z" fill="#241b31" stroke="#1a1325" stroke-width="1"/><ellipse cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.4)}" rx="${f(r * 0.6)}" ry="${f(r * 0.22)}" fill="#3a2e4c" opacity="0.8"/>`;
}

/** Where the cut is, up from the bottom of the patch's scene: it starts a little way inside it (the
 *  scene draws its top too), so nothing is cut off where the spotlight ends. */
export const CUT_IN = 12;

/** The slice of earth under the patch, `w` wide (the same as the patch's scene), with its cut edge
 *  at y = 0: what goes in an SVG's defs, the picture, and how far down its ragged edge is at x. */
export function underArt(w: number, spots: Spot[]) {
  const rand = random(19);
  const defs = `
    <linearGradient id="heu-tunnel"><stop offset="0" stop-color="#08050c" stop-opacity="0"/><stop offset="0.4" stop-color="#08050c"/></linearGradient>
    <linearGradient id="heu-tunnel-rim"><stop offset="0" stop-color="#33244a" stop-opacity="0"/><stop offset="0.4" stop-color="#33244a"/></linearGradient>
    <radialGradient id="heu-warm"><stop offset="0" stop-color="#ff8a2e" stop-opacity="0.42"/><stop offset="0.5" stop-color="#ff7518" stop-opacity="0.13"/><stop offset="1" stop-color="#ff7518" stop-opacity="0"/></radialGradient>
    <linearGradient id="heu-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0710" stop-opacity="0"/><stop offset="1" stop-color="#0b0710"/></linearGradient>
    <linearGradient id="heu-shroom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dffc9"/><stop offset="1" stop-color="#2fb592"/></linearGradient>
    <radialGradient id="heu-shroom-glow"><stop offset="0" stop-color="#5dffc0" stop-opacity="0.35"/><stop offset="1" stop-color="#5dffc0" stop-opacity="0"/></radialGradient>
    <radialGradient id="heu-crystal-glow"><stop offset="0" stop-color="#a77bff" stop-opacity="0.4"/><stop offset="1" stop-color="#a77bff" stop-opacity="0"/></radialGradient>`;
  let s = "";

  // The cut's ragged edge (bites out of it here and there).
  const edge: [number, number][] = [];
  for (let x = -10; x <= w + 30; x += 14 + rand() * 26) edge.push([x, rand() < 0.2 ? 5 + rand() * 7 : rand() * 3]);
  const edgeD = "M" + edge.map(([x, y]) => `${f(x)} ${f(y)}`).join("L");
  /** How far down the edge is at x. */
  const edgeAt = (x: number) => {
    const i = Math.max(0, edge.findIndex(([ex]) => ex > x) - 1);
    const [ax, ay] = edge[i];
    const [bx, by] = edge[Math.min(edge.length - 1, i + 1)];
    return bx === ax ? ay : ay + ((by - ay) * (x - ax)) / (bx - ax);
  };

  // The cut face, and its layers of earth, darker as they go down, each edge catching a little light.
  s += `<path d="${edgeD}L${w + 30} ${UNDER_H}L-10 ${UNDER_H}Z" fill="#21141f"/>`;
  const layer = (y: number, amp: number, k: number, ph: number, fill: string, edge: string) =>
    `<path d="${wavy(w, y, amp, k, ph)}L${w + 40} ${UNDER_H}L0 ${UNDER_H}Z" fill="${fill}"/><path d="${wavy(w, y, amp, k, ph)}" stroke="${edge}" stroke-width="2" fill="none" opacity="0.55"/>`;
  s += layer(CLAY, 7, 140, 1, "#25131a", "#3a2230") + layer(STONES, 9, 190, 2, "#1a1222", "#2e2340") + layer(DEEP, 8, 160, 3, "#130d1a", "#251b33");

  // The patch's roots, from under every pumpkin (and the odd weed), branching down.
  const root = (x: number, y: number, a: number, len: number, wd: number, depth: number): string => {
    const x1 = x + Math.cos(a) * len;
    const y1 = y + Math.sin(a) * len;
    let p = `<path d="M${f(x)} ${f(y)}Q${f((x + x1) / 2 + (rand() - 0.5) * len * 0.5)} ${f((y + y1) / 2)} ${f(x1)} ${f(y1)}" stroke="#3d2822" stroke-width="${f(wd)}" fill="none" stroke-linecap="round"/>`;
    if (depth > 0) for (let i = 0; i < 2; i++) p += root(x1, y1, a + (rand() - 0.5) * 1.2, len * 0.66, wd * 0.62, depth - 1);
    return p;
  };
  for (const p of spots) s += root(p.x + (rand() - 0.5) * p.size * 0.3, 12, Math.PI / 2 + (rand() - 0.5) * 0.4, 16 + p.size * 0.4, 1.2 + p.size * 0.03, 3);
  for (let x = 30 + rand() * 60; x < w; x += 140 + rand() * 180) s += root(x, 12, Math.PI / 2 + (rand() - 0.5) * 0.6, 20 + rand() * 22, 2.2, 3);

  // Pebbles and seeds in the topsoil.
  for (let i = 0; i < w / 24; i++) {
    const x = rand() * w;
    const y = 14 + rand() * (CLAY - 18);
    const r = 1.5 + rand() * 3;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 1.3)}" ry="${f(r)}" fill="#2e2238"/><ellipse cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.35)}" rx="${f(r * 0.5)}" ry="${f(r * 0.25)}" fill="#3b2d4c"/>`;
  }
  for (let i = 0; i < w / 160; i++) {
    const x = rand() * w;
    const y = 16 + rand() * 46;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2.2" ry="3.4" fill="#5b4a33" opacity="0.7" transform="rotate(${f(rand() * 180)} ${f(x)} ${f(y)})"/>`;
  }

  const at = (t: number) => w * t;
  // Where the special things lie in the stones (x, y, room round them), so the stones keep clear.
  const things: [number, number, number][] = [
    [at(0.26), 182, 30],
    [at(0.44), 194, 50],
    [at(0.62), 178, 34],
    [at(0.8), 194, 40],
    [at(0.93), 186, 22],
  ];
  // Faint lines of sediment through the stony layer.
  for (const [y, ph] of [[STONES + 34, 0.7], [STONES + 70, 2.4], [STONES + 104, 4.1]]) s += `<path d="${wavy(w, y, 4, 120, ph)}" stroke="#221a2e" stroke-width="1.2" fill="none" stroke-dasharray="90 30 40 60" opacity="0.7"/>`;
  // Stones in a few loose heaps (one big stone, smaller ones round it) and a couple of boulders
  // sitting across where the clay meets the stones; none on top of another, or of the things.
  const placed: [number, number, number][] = [...things];
  const free = (x: number, y: number, r: number) => placed.every(([px, py, pr]) => Math.hypot(px - x, (py - y) * 1.4) > pr + r + 3);
  const put = (x: number, y: number, r: number) => {
    if (!free(x, y, r)) return;
    placed.push([x, y, r]);
    s += stone(x, y, r, rand);
  };
  for (const t of [0.12, 0.53, 0.71]) put(at(t), STONES + rand() * 4, 13 + rand() * 4);
  // Heaps in the gaps between the special things: a stone or two, smaller ones round it, gravel.
  for (const [t, y] of [[0.05, 176], [0.15, 200], [0.35, 178], [0.53, 204], [0.71, 186], [0.87, 172], [0.99, 198]] as const) {
    const hx = at(t) + (rand() - 0.5) * 20;
    put(hx, y, 7 + rand() * 4);
    put(hx + 16 + rand() * 6, y + 4 + rand() * 4, 4 + rand() * 3);
    for (let i = 0; i < 4; i++) put(hx + (rand() - 0.5) * 70, y + (rand() - 0.5) * 30, 2.2 + rand() * 3);
    for (let i = 0; i < 6; i++) put(hx + (rand() - 0.5) * 90, y + (rand() - 0.3) * 34, 1.2 + rand() * 1.2);
  }
  // Deeper down, fewer and bigger, fading into the dark.
  for (let x = 60 + rand() * 100; x < w; x += 200 + rand() * 160) put(x, DEEP + 10 + rand() * 30, 9 + rand() * 6);

  // Who and what lives in the topsoil: worms going about their business, beetles, a snail.
  s += worm(at(0.2), 50, "M0 0C20-10 40 6 60-2S90-4 100 2", { width: 3.2, color: "#5e2f3e", dark: "#3a1724", saddle: 70, tunnel: "M-70 14C-40 16-20 4 0 0", extra: `<path d="M101 2q6-6 12-2q-5 6-12 2z" fill="#7a3f10"/>` });
  s += worm(at(0.36), 40, "M0 0c8-8 14 6 22-2s14 6 22-2s12 4 16-2", { width: 5, color: "#7a4256", dark: "#4a2333", saddle: 34, head: [60, -6], eyes: "open", tunnel: "M-70 24C-50 22-30 6 0 0" });
  s += worm(at(0.53), 48, "M0 0c4-3 8-2 10-8s6-8 10-6", { width: 4.6, color: "#6b3a4a", dark: "#3f1d2b", saddle: 6, head: [20, -14], eyes: "up", tunnel: "M-90 6c20 6 40-14 60-8S-14 8 0 0" });
  s += beetle(at(0.08), 56, 20) + snail(at(0.94), 44) + beetle(at(0.72), 58, -30);
  // In the clay: a skeleton asleep, glowing mushrooms, someone's candy stash, a worm asleep in its
  // burrow, old bones and a lost key.
  s += bone(at(0.05), 104, 18, 28) + skeleton(at(0.17), 110) + mushrooms(at(0.33), 102) + stash(at(0.46), 108);
  s += bone(at(0.565), 104, -24, 22) + bone(at(0.575), 110, 36, 18);
  s += `<path transform="translate(${f(at(0.67))} 112)" d="M-16 2C-17-7-7-11 1-10S15-8 16 0S9 10 0 10S-15 9-16 2Z" fill="#08050c" stroke="#2c1f3d" stroke-width="2.2" stroke-linejoin="round"/>`;
  s += worm(at(0.67), 113, "M-8 2C-9-5-1-8 5-6S8 4 1 4S-4-1 1-2", { width: 4, color: "#8c5068", dark: "#552a3a", saddle: 8, head: [1, -2], eyes: "shut" });
  s += key(at(0.78), 104, -18) + bone(at(0.9), 120, 8, 30);
  // In the stones: a fossil shell, the coffin, purple crystals, a fossil fish, and a little skull.
  const [shell, box, gems, fishy, head] = things;
  s += fossil(shell[0], shell[1], -8, "shell") + coffin(box[0], box[1], -4) + crystals(gems[0], gems[1]) + fossil(fishy[0], fishy[1], 6, "fish");
  s += `<g transform="translate(${f(head[0])} ${head[1]}) rotate(14)" fill="${BONE}"><path d="M-8 0a8 8 0 1 1 16 0v5h-3v3h-10v-3h-3z"/><circle cx="-3.2" cy="0" r="2.1" fill="#120a17"/><circle cx="3.2" cy="0" r="2.1" fill="#120a17"/><path d="M-0.8 3.4l0.8-1.6 0.8 1.6z" fill="#120a17"/></g>`;

  // Candlelight from the lit pumpkins spilling over the edge onto the cut face.
  for (const p of spots.filter((p) => p.lit)) s += `<ellipse cx="${f(p.x)}" cy="0" rx="${f(p.size * 1.9)}" ry="${f(40 + p.size)}" fill="url(#heu-warm)"/>`;

  // The lip: a shadow under it, a pale rim where it's cut, crumbs falling, fine roots poking out
  // of the cut and dangling, and the odd fallen leaf lying on the edge. (The grass growing along
  // it is the scene's, see grass.ts.)
  s += `<g transform="translate(0 5)"><path d="${edgeD}" stroke="#050208" stroke-width="10" fill="none" opacity="0.55" stroke-linejoin="round"/></g>`;
  s += `<path d="${edgeD}" stroke="#55405e" stroke-width="2.2" fill="none" stroke-linejoin="round"/>`;
  for (let i = 0; i < w / 90; i++) {
    const x = rand() * w;
    for (let j = 0; j < 3; j++) s += `<circle cx="${f(x + (rand() - 0.5) * 6)}" cy="${f(10 + j * 9 + rand() * 4)}" r="${f(1.3 - j * 0.3)}" fill="#3a2a44" opacity="${f(0.9 - j * 0.28)}"/>`;
  }
  for (let x = rand() * 10; x < w; x += rand() < 0.35 ? 30 + rand() * 60 : 4 + rand() * 9) {
    const top = edgeAt(x) + 3;
    const len = 4 + rand() * 12;
    const dx = (rand() - 0.5) * 6;
    const thick = rand() < 0.2;
    s += `<path d="M${f(x)} ${f(top)}q${f(dx * 0.2 + (rand() - 0.5) * 3)} ${f(len * 0.5)} ${f(dx)} ${f(len)}" stroke="${thick ? "#4a3228" : "#5d4236"}" stroke-width="${thick ? 1.5 : 0.8}" fill="none" stroke-linecap="round" opacity="0.85"/>`;
  }
  const leafColors = ["#7a3f10", "#8a4a12", "#5a2410", "#6b3412"];
  for (let x = rand() * 40; x < w; x += 50 + rand() * 120) {
    const ly = edgeAt(x) - 1 + rand() * 3;
    const r = 3 + rand() * 3;
    s += `<path transform="translate(${f(x)} ${f(ly)}) rotate(${f((rand() - 0.5) * 60)})" d="M${-r} 0Q0 ${-r * 0.8} ${r} 0Q0 ${r * 0.8} ${-r} 0Z" fill="${leafColors[Math.floor(rand() * leafColors.length)]}"/>`;
  }

  // Down into the night.
  s += `<rect y="${DEEP}" width="${w}" height="${UNDER_H - DEEP}" fill="url(#heu-fade)"/>`;
  return { defs, body: s, edgeAt };
}

/** The slice as a picture of its own, for under the spotlight: from where the spotlight (which
 *  draws the top of it) ends, so the two meet without overlapping. */
export function underScene(w: number, spots: Spot[]) {
  const { defs, body } = underArt(w, spots);
  return `<svg class="he-under__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 ${CUT_IN} ${w} ${UNDER_H - CUT_IN}" width="${w}" height="${UNDER_H - CUT_IN}"><defs>${defs}</defs>${body}</svg>`;
}
