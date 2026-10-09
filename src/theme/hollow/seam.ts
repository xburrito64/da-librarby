// Where the pumpkin patch meets the page below it: pictures for the ground going on down into the
// page (see hollow.css, "Below the patch").
import { svgUrl } from "./art";

function random(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const f = (n: number) => n.toFixed(1);

/** Fallen leaves and bits of earth, scattered (repeats sideways). */
function leavesTile() {
  const rand = random(17);
  const w = 640;
  const h = 280;
  let s = "";
  const colors = ["#6b3412", "#7a3f10", "#4d2a14", "#8a4a12", "#5a2410"];
  for (let i = 0; i < 46; i++) {
    const x = rand() * w;
    const y = Math.pow(rand(), 1.6) * h;
    const r = 3 + rand() * 5;
    const a = rand() * 360;
    const c = colors[Math.floor(rand() * colors.length)];
    // A little leaf: two curves meeting at the tips, and a vein.
    s += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" opacity="${f(0.35 + rand() * 0.4)}"><path d="M${-r} 0Q0 ${-r * 0.8} ${r} 0Q0 ${r * 0.8} ${-r} 0Z" fill="${c}"/><path d="M${-r} 0H${r * 1.3}" stroke="#2a1408" stroke-width="0.6"/></g>`;
  }
  for (let i = 0; i < 90; i++) s += `<circle cx="${f(rand() * w)}" cy="${f(Math.pow(rand(), 1.4) * h)}" r="${f(0.6 + rand() * 1.2)}" fill="#2a1d36" opacity="0.8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`;
}

/** A slice through the ground: layers of earth, roots hanging down, stones, a few old bones and
 *  a worm (repeats sideways). */
function soilTile() {
  const rand = random(29);
  const w = 760;
  const h = 300;
  let s = "";
  // Layers of earth, gently wavy.
  for (const [y, c] of [[44, "#1b1124"], [118, "#190f20"], [204, "#160d1d"]] as [number, string][]) {
    let d = `M0 ${y}`;
    for (let x = 0; x <= w; x += 40) d += `L${x} ${f(y + Math.sin(x / 70 + y) * 5 + Math.sin(x / 23) * 2)}`;
    s += `<path d="${d}" stroke="${c}" stroke-width="10" fill="none" opacity="0.9"/>`;
  }
  // Roots from the patch above, branching as they go down.
  const root = (x: number, y: number, a: number, len: number, wd: number, depth: number): string => {
    const x1 = x + Math.cos(a) * len;
    const y1 = y + Math.sin(a) * len;
    const bend = (rand() - 0.5) * len * 0.5;
    let p = `<path d="M${f(x)} ${f(y)}Q${f((x + x1) / 2 + bend)} ${f((y + y1) / 2)} ${f(x1)} ${f(y1)}" stroke="#2b1a16" stroke-width="${f(wd)}" fill="none" stroke-linecap="round"/>`;
    if (depth > 0) for (let i = 0; i < 2; i++) p += root(x1, y1, a + (rand() - 0.5) * 1.3, len * 0.65, wd * 0.6, depth - 1);
    return p;
  };
  for (const x of [60, 250, 410, 600, 700]) s += root(x, 0, Math.PI / 2 + (rand() - 0.5) * 0.5, 40 + rand() * 30, 3, 3);
  // Stones.
  for (let i = 0; i < 16; i++) {
    const x = rand() * w;
    const y = 30 + rand() * (h - 40);
    const r = 3 + rand() * 7;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 1.4)}" ry="${f(r)}" fill="#241a30"/><ellipse cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.35)}" rx="${f(r * 0.5)}" ry="${f(r * 0.25)}" fill="#32264a"/>`;
  }
  // Old bones, and a little skull.
  const bone = (x: number, y: number, a: number, len: number) =>
    `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" fill="#3d3550"><rect x="${-len / 2}" y="-2.2" width="${len}" height="4.4" rx="2"/><circle cx="${-len / 2}" cy="-2.6" r="3.2"/><circle cx="${-len / 2}" cy="2.6" r="3.2"/><circle cx="${len / 2}" cy="-2.6" r="3.2"/><circle cx="${len / 2}" cy="2.6" r="3.2"/></g>`;
  s += bone(160, 150, 18, 30) + bone(520, 92, -24, 24) + bone(660, 230, 8, 34);
  s += `<g transform="translate(330 214)" fill="#3d3550"><path d="M-10 0a10 10 0 1 1 20 0v6h-4v4h-12v-4h-4z"/><circle cx="-4" cy="0" r="2.6" fill="#120a17"/><circle cx="4" cy="0" r="2.6" fill="#120a17"/><path d="M-1 4l1-2 1 2z" fill="#120a17"/></g>`;
  // A worm, wiggling through.
  s += `<path d="M440 170c8-8 14 6 22-2s14 6 22-2" stroke="#6d3a4c" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="485" cy="166" r="1" fill="#120a17"/>`;
  // Pumpkin seeds.
  for (let i = 0; i < 8; i++) {
    const x = rand() * w;
    const y = 20 + rand() * 120;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2.2" ry="3.4" fill="#5b4a33" opacity="0.7" transform="rotate(${f(rand() * 180)} ${f(x)} ${f(y)})"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`;
}

let drawn = false;
export function drawSeam() {
  if (drawn) return;
  drawn = true;
  document.documentElement.style.setProperty("--he-img-leaves", svgUrl(leavesTile()));
  document.documentElement.style.setProperty("--he-img-soil", svgUrl(soilTile()));
}
