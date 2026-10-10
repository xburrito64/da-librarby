// Under the pumpkin patch: the ground is cut away like a slice of earth lifted out with a spade, so
// you can see into it under the library's rows. The cut has a ragged edge with grass hanging over
// it, warm where the jack-o'-lanterns' light spills over. Below are layers, darker as they go
// down: topsoil with the patch's roots and worms going about their business, red clay with old
// bones, a skull, a lost key and a worm asleep in its burrow, then stones with a little buried
// coffin and a fish's skeleton. As wide as the window, lined up with the patch above (scene.ts).
// See hollow.css ("Under the patch").

/** One of the patch's pumpkins: where it stands (from the scene's left), how big, and lit or not. */
export interface Spot {
  x: number;
  size: number;
  lit: boolean;
}

/** How far down the slice goes (px), and where its layers begin. */
export const UNDER_H = 560;
const CLAY = 84;
const STONES = 178;
const DEEP = 290;

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
const skull = (x: number, y: number, a: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})" fill="${BONE}"><path d="M-10 0a10 10 0 1 1 20 0v6h-4v4h-12v-4h-4z"/><circle cx="-4" cy="0" r="2.6" fill="#120a17"/><circle cx="4" cy="0" r="2.6" fill="#120a17"/><path d="M-1 4l1-2 1 2z" fill="#120a17"/><path d="M-3 7v3M0 7v3M3 7v3" stroke="#120a17" stroke-width="0.8"/></g>`;
const fish = (x: number, y: number, a: number) => {
  let ribs = "";
  for (let i = -10; i <= 8; i += 4.5) ribs += `M${i} ${-6 + Math.abs(i) * 0.15}Q${i + 2.5} 0 ${i} ${6 - Math.abs(i) * 0.15}`;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})" stroke="${BONE}" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M-17 0H13${ribs}M-17 0l-6-6M-17 0l-6 6"/><path d="M13-6Q23-5 24 0Q23 5 13 6Z" fill="${BONE}" stroke="none"/><circle cx="18.5" cy="-1" r="1.4" fill="#120a17" stroke="none"/></g>`;
};
const key = (x: number, y: number, a: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})" stroke="#5b3d2a" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.85"><circle r="4.6"/><path d="M4.6 0H22M17 0v4M21 0v3.4"/><circle r="1.6" fill="#120a17" stroke="none"/></g>`;
const beetle = (x: number, y: number, a: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})"><path d="M-3-3l-2-3M0-3.4v-3M3-3l2-3M-3 3l-2 3M0 3.4v3M3 3l2 3" stroke="#23193a" stroke-width="0.9" stroke-linecap="round"/><ellipse rx="5.2" ry="3.7" fill="#23193a"/><circle cx="6" r="2" fill="#23193a"/><path d="M-5 0H5" stroke="#120a17" stroke-width="0.6"/><ellipse cx="-1.6" cy="-1.8" rx="2" ry="0.8" fill="#4d3f70" opacity="0.8"/></g>`;
const snail = (x: number, y: number) =>
  `<g transform="translate(${f(x)} ${f(y)})"><path d="M-12 4c2-3 18-4 22-1c2-2 3-6 2-9M10 3c1-3 0-6-1-8" stroke="#56475f" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="12" cy="-6" r="0.9" fill="#56475f"/><circle cx="9" cy="-5" r="0.9" fill="#56475f"/><circle cx="-2" cy="-3" r="7" fill="#4a3550"/><path d="M-2-3m-1.5 0a1.5 1.5 0 1 1 3 0a3.2 3.2 0 1 1-6.4 0a5 5 0 1 1 10 0" stroke="#2c2038" stroke-width="1.2" fill="none"/></g>`;
const coffin = (x: number, y: number, a: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})"><path d="M-30 0L-22-11H22L30 0L22 11H-22Z" fill="#2a1c2a" stroke="#45304a" stroke-width="1.5"/><path d="M-22-11L-17-7H17L22-11M-22 11L-17 7H17L22 11" stroke="#3a2840" stroke-width="1" fill="none"/><path d="M-6 0H6M0-6V6" stroke="#5a4268" stroke-width="2"/></g>`;

/** Where the cut is, up from the bottom of the patch's scene: it starts a little way inside it (the
 *  scene draws its top too), so nothing is cut off where the spotlight ends. */
export const CUT_IN = 12;

/** The slice of earth under the patch, `w` wide (the same as the patch's scene), with its cut edge
 *  at y = 0: what goes in an SVG's defs, and the picture. */
export function underArt(w: number, spots: Spot[]) {
  const rand = random(19);
  const defs = `
    <linearGradient id="heu-tunnel"><stop offset="0" stop-color="#08050c" stop-opacity="0"/><stop offset="0.4" stop-color="#08050c"/></linearGradient>
    <linearGradient id="heu-tunnel-rim"><stop offset="0" stop-color="#33244a" stop-opacity="0"/><stop offset="0.4" stop-color="#33244a"/></linearGradient>
    <radialGradient id="heu-warm"><stop offset="0" stop-color="#ff8a2e" stop-opacity="0.42"/><stop offset="0.5" stop-color="#ff7518" stop-opacity="0.13"/><stop offset="1" stop-color="#ff7518" stop-opacity="0"/></radialGradient>
    <linearGradient id="heu-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0710" stop-opacity="0"/><stop offset="1" stop-color="#0b0710"/></linearGradient>`;
  let s = "";

  // The cut's ragged edge (bites out of it here and there).
  const edge: [number, number][] = [];
  for (let x = -10; x <= w + 30; x += 14 + rand() * 26) edge.push([x, rand() < 0.2 ? 5 + rand() * 7 : rand() * 3]);
  const edgeD = "M" + edge.map(([x, y]) => `${f(x)} ${f(y)}`).join("L");

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

  // Pebbles and seeds in the topsoil, stones further down.
  for (let i = 0; i < w / 24; i++) {
    const x = rand() * w;
    const y = 14 + rand() * (CLAY - 18);
    const r = 1.5 + rand() * 3;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 1.3)}" ry="${f(r)}" fill="#2e2238"/><ellipse cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.35)}" rx="${f(r * 0.5)}" ry="${f(r * 0.25)}" fill="#3b2d4c"/>`;
  }
  for (let i = 0; i < w / 160; i++) {
    const x = rand() * w;
    const y = 16 + rand() * 50;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2.2" ry="3.4" fill="#5b4a33" opacity="0.7" transform="rotate(${f(rand() * 180)} ${f(x)} ${f(y)})"/>`;
  }
  for (let i = 0; i < w / 60; i++) {
    const x = rand() * w;
    const y = STONES + 16 + rand() * (DEEP - STONES - 10);
    const r = 5 + rand() * 10;
    s += `<path d="M${f(x - r)} ${f(y)}L${f(x - r * 0.4)} ${f(y - r * 0.8)}L${f(x + r * 0.6)} ${f(y - r * 0.7)}L${f(x + r)} ${f(y + r * 0.1)}L${f(x + r * 0.3)} ${f(y + r * 0.7)}L${f(x - r * 0.7)} ${f(y + r * 0.6)}Z" fill="#241b31" stroke="#352a47" stroke-width="1"/>`;
  }

  // Who and what lives down there (spread across the width, each in its own layer).
  const at = (t: number) => w * t;
  s += worm(at(0.2), 58, "M0 0C20-10 40 6 60-2S90-4 100 2", { width: 3.2, color: "#5e2f3e", dark: "#3a1724", saddle: 70, tunnel: "M-70 14C-40 16-20 4 0 0", extra: `<path d="M101 2q6-6 12-2q-5 6-12 2z" fill="#7a3f10"/>` });
  s += worm(at(0.36), 44, "M0 0c8-8 14 6 22-2s14 6 22-2s12 4 16-2", { width: 5, color: "#7a4256", dark: "#4a2333", saddle: 34, head: [60, -6], eyes: "open", tunnel: "M-70 24C-50 22-30 6 0 0" });
  s += worm(at(0.53), 52, "M0 0c4-3 8-2 10-8s6-8 10-6", { width: 4.6, color: "#6b3a4a", dark: "#3f1d2b", saddle: 6, head: [20, -14], eyes: "up", tunnel: "M-90 6c20 6 40-14 60-8S-14 8 0 0" });
  s += beetle(at(0.08), 62, 20) + snail(at(0.94), 46) + beetle(at(0.72), 66, -30);
  s += bone(at(0.12), 112, 18, 30) + skull(at(0.3), 132, -8) + bone(at(0.58), 108, -24, 22) + bone(at(0.59), 114, 36, 18) + key(at(0.78), 116, -18) + bone(at(0.9), 142, 8, 34);
  // A worm curled up asleep in a little hollow in the clay.
  s += `<path transform="translate(${f(at(0.66))} 124)" d="M-16 2C-17-7-7-11 1-10S15-8 16 0S9 10 0 10S-15 9-16 2Z" fill="#08050c" stroke="#2c1f3d" stroke-width="2.2" stroke-linejoin="round"/>`;
  s += worm(at(0.66), 125, "M-8 2C-9-5-1-8 5-6S8 4 1 4S-4-1 1-2", { width: 4, color: "#8c5068", dark: "#552a3a", saddle: 8, head: [1, -2], eyes: "shut" });
  s += coffin(at(0.44), 226, -6) + fish(at(0.84), 236, -8);

  // Candlelight from the lit pumpkins spilling over the edge onto the cut face.
  for (const p of spots.filter((p) => p.lit)) s += `<ellipse cx="${f(p.x)}" cy="0" rx="${f(p.size * 1.9)}" ry="${f(40 + p.size)}" fill="url(#heu-warm)"/>`;

  // The lip: a shadow under it, a pale rim where it's cut, crumbs falling, and grass and leaves
  // hanging over.
  s += `<g transform="translate(0 5)"><path d="${edgeD}" stroke="#050208" stroke-width="10" fill="none" opacity="0.55" stroke-linejoin="round"/></g>`;
  s += `<path d="${edgeD}" stroke="#55405e" stroke-width="2.2" fill="none" stroke-linejoin="round"/>`;
  for (let i = 0; i < w / 90; i++) {
    const x = rand() * w;
    for (let j = 0; j < 3; j++) s += `<circle cx="${f(x + (rand() - 0.5) * 6)}" cy="${f(10 + j * 9 + rand() * 4)}" r="${f(1.3 - j * 0.3)}" fill="#3a2a44" opacity="${f(0.9 - j * 0.28)}"/>`;
  }
  const leafColors = ["#7a3f10", "#8a4a12", "#5a2410", "#6b3412"];
  for (let x = rand() * 10; x < w; x += rand() < 0.3 ? 40 + rand() * 90 : 5 + rand() * 12) {
    const n = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const bx = x + i * 2.2;
      const len = 5 + rand() * 11;
      const dx = (rand() - 0.5) * 8;
      s += `<path d="M${f(bx)} -1Q${f(bx + dx * 0.3)} ${f(len * 0.3)} ${f(bx + dx)} ${f(len)}" stroke="${rand() < 0.5 ? "#26321b" : "#33421f"}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    }
    if (rand() < 0.22) {
      const lx = x + rand() * 10;
      const ly = rand() * 4;
      const r = 3 + rand() * 3;
      s += `<path transform="translate(${f(lx)} ${f(ly)}) rotate(${f((rand() - 0.5) * 60)})" d="M${-r} 0Q0 ${-r * 0.8} ${r} 0Q0 ${r * 0.8} ${-r} 0Z" fill="${leafColors[Math.floor(rand() * leafColors.length)]}"/>`;
    }
  }

  // Down into the night.
  s += `<rect y="${DEEP}" width="${w}" height="${UNDER_H - DEEP}" fill="url(#heu-fade)"/>`;
  return { defs, body: s };
}

/** The slice as a picture of its own, for under the spotlight (its top is hidden behind it). */
export function underScene(w: number, spots: Spot[]) {
  const { defs, body } = underArt(w, spots);
  return `<svg class="he-under__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${UNDER_H}" width="${w}" height="${UNDER_H}"><defs>${defs}</defs>${body}</svg>`;
}
