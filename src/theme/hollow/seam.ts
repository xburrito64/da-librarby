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

/** A slice through the ground: layers of earth, roots hanging down, stones and seeds (repeats
 *  sideways; what's buried in it is in buriedStrip). */
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
  // Pumpkin seeds.
  for (let i = 0; i < 8; i++) {
    const x = rand() * w;
    const y = 20 + rand() * 120;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2.2" ry="3.4" fill="#5b4a33" opacity="0.7" transform="rotate(${f(rand() * 180)} ${f(x)} ${f(y)})"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`;
}

/** A worm along a path (in its own little drawing space, placed at x, y): a body with rings and a
 *  pale saddle, darker underneath and shiny on top. `head`: where its head is, for its eyes. */
function worm(x: number, y: number, d: string, o: { width: number; color: string; dark: string; saddle: number; head?: [number, number]; eyes?: "open" | "shut" | "up"; extra?: string }) {
  const { width: wd, color, dark, saddle, head, eyes, extra = "" } = o;
  const line = (stroke: string, width: number, more = "", cap = "round") => `<path d="${d}" stroke="${stroke}" stroke-width="${f(width)}" fill="none" stroke-linecap="${cap}" stroke-linejoin="round" ${more}/>`;
  let s = `<g transform="translate(${f(x + 0.8)} ${f(y + 1.2)})">${line(dark, wd)}</g>`;
  s += `<g transform="translate(${f(x)} ${f(y)})">`;
  s += line(color, wd);
  s += line("#f1b7c4", wd * 1.05, `stroke-dasharray="0 ${saddle} ${f(wd * 1.5)} 999" opacity="0.35"`, "butt");
  s += line(dark, wd, `stroke-dasharray="0.7 ${f(wd * 0.75)}" opacity="0.45"`, "butt");
  s += `<g transform="translate(-0.4 ${f(-wd * 0.22)})">${line("#ffd6df", wd * 0.28, `opacity="0.35"`)}</g>`;
  if (head && eyes) {
    const [hx, hy] = head;
    const e = wd * 0.17;
    s +=
      eyes === "shut"
        ? `<path d="M${f(hx - e * 3)} ${f(hy - e)}q${f(e)} ${f(e)} ${f(e * 2)} 0M${f(hx + e)} ${f(hy - e)}q${f(e)} ${f(e)} ${f(e * 2)} 0" stroke="#120a17" stroke-width="0.6" fill="none" stroke-linecap="round"/>`
        : `<circle cx="${f(hx - e * 2)}" cy="${f(hy - e * (eyes === "up" ? 1.8 : 1))}" r="${f(e)}" fill="#120a17"/><circle cx="${f(hx + e * 1.4)}" cy="${f(hy - e * (eyes === "up" ? 1.8 : 1))}" r="${f(e)}" fill="#120a17"/>`;
  }
  return `${s}${extra}</g>`;
}

/** A long strip (wider than any window, so nothing in it is seen twice) of things buried in the
 *  earth: worms going about their business, old bones and a skull, a fish's skeleton, a lost key,
 *  beetles and a snail. */
function buriedStrip() {
  const w = 3200;
  const h = 300;
  const BONE = "#3d3550";
  let s = "";
  const bone = (x: number, y: number, a: number, len: number) =>
    `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" fill="${BONE}"><rect x="${-len / 2}" y="-2.2" width="${len}" height="4.4" rx="2"/><circle cx="${-len / 2}" cy="-2.6" r="3.2"/><circle cx="${-len / 2}" cy="2.6" r="3.2"/><circle cx="${len / 2}" cy="-2.6" r="3.2"/><circle cx="${len / 2}" cy="2.6" r="3.2"/></g>`;
  const skull = (x: number, y: number, a: number) =>
    `<g transform="translate(${x} ${y}) rotate(${a})" fill="${BONE}"><path d="M-10 0a10 10 0 1 1 20 0v6h-4v4h-12v-4h-4z"/><circle cx="-4" cy="0" r="2.6" fill="#120a17"/><circle cx="4" cy="0" r="2.6" fill="#120a17"/><path d="M-1 4l1-2 1 2z" fill="#120a17"/><path d="M-3 7v3M0 7v3M3 7v3" stroke="#120a17" stroke-width="0.8"/></g>`;
  const fish = (x: number, y: number, a: number) => {
    let ribs = "";
    for (let i = -10; i <= 8; i += 4.5) ribs += `M${i} ${-6 + Math.abs(i) * 0.15}Q${i + 2.5} 0 ${i} ${6 - Math.abs(i) * 0.15}`;
    return `<g transform="translate(${x} ${y}) rotate(${a})" stroke="${BONE}" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M-17 0H13${ribs}M-17 0l-6-6M-17 0l-6 6"/><path d="M13-6Q23-5 24 0Q23 5 13 6Z" fill="${BONE}" stroke="none"/><circle cx="18.5" cy="-1" r="1.4" fill="#120a17" stroke="none"/></g>`;
  };
  const key = (x: number, y: number, a: number) =>
    `<g transform="translate(${x} ${y}) rotate(${a})" stroke="#5b3d2a" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.85"><circle r="4.6"/><path d="M4.6 0H22M17 0v4M21 0v3.4"/><circle r="1.6" fill="#120a17" stroke="none"/></g>`;
  const beetle = (x: number, y: number, a: number) =>
    `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M-3-3l-2-3M0-3.4v-3M3-3l2-3M-3 3l-2 3M0 3.4v3M3 3l2 3" stroke="#23193a" stroke-width="0.9" stroke-linecap="round"/><ellipse rx="5.2" ry="3.7" fill="#23193a"/><circle cx="6" r="2" fill="#23193a"/><path d="M-5 0H5" stroke="#120a17" stroke-width="0.6"/><ellipse cx="-1.6" cy="-1.8" rx="2" ry="0.8" fill="#4d3f70" opacity="0.8"/></g>`;
  const snail = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><path d="M-12 4c2-3 18-4 22-1c2-2 3-6 2-9M10 3c1-3 0-6-1-8" stroke="#56475f" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="12" cy="-6" r="0.9" fill="#56475f"/><circle cx="9" cy="-5" r="0.9" fill="#56475f"/><circle cx="-2" cy="-3" r="7" fill="#4a3550"/><path d="M-2-3m-1.5 0a1.5 1.5 0 1 1 3 0a3.2 3.2 0 1 1-6.4 0a5 5 0 1 1 10 0" stroke="#2c2038" stroke-width="1.2" fill="none"/></g>`;

  s += bone(160, 150, 18, 30) + bone(262, 248, -10, 26);
  // A worm wiggling along, wide awake.
  s += worm(420, 132, "M0 0c8-8 14 6 22-2s14 6 22-2s12 4 16-2", { width: 5, color: "#7a4256", dark: "#4a2333", saddle: 34, head: [60, -6], eyes: "open" });
  s += skull(760, 196, -8);
  s += bone(980, 70, -24, 22) + bone(992, 76, 36, 18);
  // One curled up asleep.
  s += worm(1180, 86, "M-12 2C-14-8-2-14 8-10S12 6 2 6S-6-2 2-4", { width: 4.4, color: "#8c5068", dark: "#552a3a", saddle: 10, head: [2, -4], eyes: "shut" });
  s += fish(1560, 172, -6);
  s += beetle(1840, 58, 20);
  // One coming up out of its tunnel, looking up at the patch.
  s += `<path d="M1960 206c20 6 40-8 60-2s30 10 40-2" stroke="#0d0711" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.7"/>`;
  s += worm(2060, 202, "M0 0c4-3 8-2 10-8s6-8 10-6", { width: 4.6, color: "#6b3a4a", dark: "#3f1d2b", saddle: 6, head: [20, -14], eyes: "up" });
  s += key(2380, 110, -18);
  s += bone(2560, 210, 8, 34);
  // A long thin one, pulling a leaf down into the earth.
  s += worm(2700, 70, "M0 0C20-10 40 6 60-2S90-4 100 2", { width: 3.2, color: "#5e2f3e", dark: "#3a1724", saddle: 70, extra: `<path d="M101 2q6-6 12-2q-5 6-12 2z" fill="#7a3f10"/>` });
  s += snail(3000, 140);
  s += beetle(2920, 232, -40);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`;
}

let drawn = false;
export function drawSeam() {
  if (drawn) return;
  drawn = true;
  document.documentElement.style.setProperty("--he-img-leaves", svgUrl(leavesTile()));
  document.documentElement.style.setProperty("--he-img-soil", svgUrl(soilTile()));
  document.documentElement.style.setProperty("--he-img-buried", svgUrl(buriedStrip()));
}
