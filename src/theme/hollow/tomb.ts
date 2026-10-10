// The family tomb at the end of the path on show pages: once grand, now neglected. Worn steps up
// to a pointed doorway closed by an iron gate, darkness behind it (and now and then a pair of eyes);
// stone columns either side, the family's name carved over the door, a round stained-glass window
// glowing in the gable, stone urns on the corners and a little gargoyle crouching on the peak.
// Candles left burning on the steps, ivy climbing one side, moss, a crack and a cobweb; the moon
// catching its right-hand edges.
// Click the gate and it creaks open a little (and the eyes look out), click the gargoyle and it
// turns its head with a grind of stone, eyes blazing, click a candle and it goes out (lighting
// itself again a while later). Now and then a light passes behind the round window, as if someone
// inside walked by with a candle. See scenes.ts and hollow.css ("The tomb").

/** The family's name over the door (any length; long ones are set smaller). */
export const TOMB_NAME = "RAVENWOOD";

const STONE = "#251b31";
const STONE2 = "#2c2238";
const STEP = "#2a2036";
const EDGE = "#3d3050";
const JOINT = "#1a1224";
const MOON = "#8a74b8";
const MOSS = "#33402a";
const IVY = "#2f4a26";
const CARVE = "#130d1a";
const DARK = "#07040a";
const IRON = "#3a3048";

const f = (n: number) => n.toFixed(1);

/** Mortar lines over a wall of stone blocks, leaving out the boxes in `skip` ([x0, y0, x1, y1]). */
function blocks(x0: number, y0: number, x1: number, y1: number, rowH: number, blockW: number, skip: number[][]) {
  const inside = (x: number, y: number) => skip.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);
  let d = "";
  for (let y = y1 - rowH, row = 0; y > y0; y -= rowH, row++) {
    // Along the row, broken where something's in the way.
    let from: number | null = null;
    for (let x = x0; x <= x1; x += 1) {
      const free = !inside(x, y) && x < x1;
      if (free && from === null) from = x;
      if (!free && from !== null) {
        d += `M${from} ${y}H${x}`;
        from = null;
      }
    }
    for (let x = x0 + (row % 2 ? blockW / 2 : blockW); x < x1; x += blockW) if (!inside(x, y + rowH / 2)) d += `M${x} ${y}V${y + rowH}`;
  }
  return `<path d="${d}" stroke="${JOINT}" stroke-width="0.8" fill="none"/>`;
}

/** Ivy climbing through the points, leaves along it. */
function ivy(points: [number, number][]) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) d += `Q${points[i - 1][0] + (i % 2 ? 5 : -5)} ${(points[i - 1][1] + points[i][1]) / 2} ${points[i][0]} ${points[i][1]}`;
  const leaves = points
    .slice(1)
    .map(
      ([x, y], i) =>
        `<ellipse cx="${x + (i % 2 ? 2.4 : -2.4)}" cy="${y}" rx="2.6" ry="1.6" transform="rotate(${i % 2 ? 30 : -30} ${x} ${y})" fill="${IVY}"/>` +
        `<ellipse cx="${x + (i % 2 ? -1.5 : 1.5)}" cy="${y + 3}" rx="2.1" ry="1.3" transform="rotate(${i % 2 ? -25 : 25} ${x} ${y})" fill="#3a5a2e"/>`,
    )
    .join("");
  return `<path d="${d}" stroke="${IVY}" stroke-width="1" fill="none"/>${leaves}`;
}

/** A candle on the steps (click it to blow it out): its light, the wax, the flame, and the curl of
 *  smoke it gives off when it goes out. */
function candle(id: string, x: number, y: number, h: number) {
  return (
    `<g class="he-tomb__candle"><rect x="${x - 6}" y="${y - h - 9}" width="12" height="${h + 9}" fill="transparent"/>` +
    `<circle class="he-tomb__flame" cx="${x}" cy="${y - h - 3}" r="11" fill="url(#${id}light)"/>` +
    `<rect x="${x - 1.5}" y="${y - h}" width="3" height="${h}" rx="0.6" fill="#e9dcc0"/><path d="M${x} ${y - h}v-1.3" stroke="#2a1a10" stroke-width="0.5"/>` +
    `<ellipse class="he-tomb__flame he-flicker" cx="${x}" cy="${y - h - 2.4}" rx="1.4" ry="2.3" fill="#ffc35a" filter="url(#${id}glow)"/>` +
    `<path class="he-tomb__smoke" d="M${x} ${y - h - 1}c-2-3 2-5 0-8c-2-3 1-5 0-7" stroke="#cfc4dc" stroke-width="0.8" fill="none" stroke-linecap="round"/></g>`
  );
}

/** The tomb, standing at x, y (the middle of its bottom step), `scale` times its size (about 124
 *  wide and 186 tall at 1). */
export function tomb(id: string, x: number, y: number, scale = 1) {
  const name = TOMB_NAME.toUpperCase();
  const nameSize = Math.min(7.6, 92 / Math.max(1, name.length * 0.86));
  const door = "M-14-18V-55Q-14-73 0-81Q14-73 14-55V-18Z";
  let s = `<defs>
    <clipPath id="${id}tdoor"><path d="${door}"/></clipPath>
    <clipPath id="${id}trose"><circle cx="0" cy="-130" r="8"/></clipPath>
    <radialGradient id="${id}tdoorglow" cx="0.5" cy="1" r="0.9"><stop offset="0" stop-color="#ff9a3c" stop-opacity="0.55"/><stop offset="1" stop-color="#ff7518" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}tglass"><stop offset="0" stop-color="#ffd27a"/><stop offset="0.45" stop-color="#e0782c"/><stop offset="1" stop-color="#6a2f9a"/></radialGradient>
    <radialGradient id="${id}tpass"><stop offset="0" stop-color="#fff2c8" stop-opacity="0.95"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
  </defs>`;
  s += `<ellipse cx="0" cy="3" rx="86" ry="6" fill="#05020a" opacity="0.55"/>`;

  // The walls: stone blocks, the moon along the right-hand edge, a crack.
  s += `<rect x="-48" y="-100" width="96" height="82" fill="${STONE}" stroke="${EDGE}" stroke-width="1.2"/>`;
  s += blocks(-48, -100, 48, -18, 10, 17, [[-22, -92, 22, -18], [-44, -100, -33, -18], [33, -100, 44, -18]]);
  s += `<path d="M48-100V-18" stroke="${MOON}" stroke-width="1.2" opacity="0.5"/>`;
  s += `<path d="M28-86l-3 7 4 5-4 8 3 6-2 6" stroke="#0d0812" stroke-width="1" fill="none"/>`;

  // The doorway: a pointed arch with a moulding and a keystone. Behind the gate, darkness, a little
  // candlelight low down, and the eyes that look out now and then (or when the gate opens).
  s += `<path d="M-21-18V-56Q-21-79 0-90Q21-79 21-56V-18Z" fill="${STONE2}" stroke="${EDGE}" stroke-width="1.2"/>`;
  s += `<g class="he-tomb__door"><path d="${door}" fill="${DARK}"/><ellipse cx="0" cy="-18" rx="14" ry="16" fill="url(#${id}tdoorglow)" clip-path="url(#${id}tdoor)"/>`;
  s += `<g class="he-eyes" fill="#ffcf5a" filter="url(#${id}glow)"><ellipse cx="-4" cy="-52" rx="1.8" ry="1.1"/><ellipse cx="4" cy="-52" rx="1.8" ry="1.1"/></g>`;
  // The gate: two leaves of iron bars, hinged at the sides, a ring to pull.
  const leaf = (from: number, to: number) => {
    let bars = "";
    for (let bx = from + 2.3; bx < to; bx += 4.6) bars += `M${f(bx)}-18V-84`;
    return `${bars}M${from}-32H${to}M${from}-62H${to}`;
  };
  s += `<g clip-path="url(#${id}tdoor)"><g class="he-tomb__leaf he-tomb__leaf--l"><rect x="-14" y="-84" width="14" height="66" fill="transparent"/><path d="${leaf(-14, 0)}M-0.5-18V-84" stroke="${IRON}" stroke-width="1.3"/></g>`;
  s += `<g class="he-tomb__leaf he-tomb__leaf--r"><rect x="0" y="-84" width="14" height="66" fill="transparent"/><path d="${leaf(0, 14)}M0.5-18V-84" stroke="${IRON}" stroke-width="1.3"/><circle cx="4.5" cy="-40" r="2" fill="none" stroke="#4a3d5e" stroke-width="0.9"/></g></g></g>`;
  s += `<path d="M-4-93H4L3-86H-3Z" fill="${STONE2}" stroke="${EDGE}" stroke-width="0.9"/>`;
  s += `<path d="M14-56L4-76M14-56L8-74M14-56L12-72M7-62Q10-60 13-62M9-68Q11-66 13-67" stroke="#f3ead8" stroke-width="0.4" fill="none" opacity="0.4" pointer-events="none"/>`;

  // The columns either side.
  for (const c of [-38, 38])
    s +=
      `<rect x="${c - 4.5}" y="-96" width="9" height="74" fill="${STONE2}" stroke="${EDGE}" stroke-width="1"/><path d="M${c - 1.5}-94V-24M${c + 1.5}-94V-24" stroke="${JOINT}" stroke-width="0.6"/>` +
      `<rect x="${c - 6.5}" y="-100" width="13" height="5" fill="${STONE2}" stroke="${EDGE}" stroke-width="1"/><rect x="${c - 6}" y="-23" width="12" height="5" fill="${STONE2}" stroke="${EDGE}" stroke-width="1"/>` +
      `<path d="M${c + 4.5}-95V-23" stroke="${MOON}" stroke-width="1" opacity="0.55"/>`;

  // The frieze with the family's name, the cornice, and the gable with its round window.
  s += `<rect x="-56" y="-112" width="112" height="12" fill="${STONE2}" stroke="${EDGE}" stroke-width="1.1"/>`;
  s += `<text x="0" y="${f(-106 + nameSize * 0.36)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${f(nameSize)}" letter-spacing="${f(nameSize * 0.26)}" fill="${CARVE}">${name.replace(/[<&]/g, "")}</text>`;
  s += `<rect x="-60" y="-116" width="120" height="4" fill="${STONE2}" stroke="${EDGE}" stroke-width="1"/><path d="M-60-116H60" stroke="${MOON}" stroke-width="0.8" opacity="0.35"/>`;
  s += `<path d="M-58-116L0-154L58-116Z" fill="#1f1629" stroke="${EDGE}" stroke-width="1.2"/><path d="M-45-119L0-148L45-119Z" fill="none" stroke="${JOINT}" stroke-width="1"/><path d="M0-154L58-116" stroke="${MOON}" stroke-width="1.4" opacity="0.7"/>`;
  // The rose window: coloured glass, its tracery, and now and then a light passing behind it.
  s += `<circle cx="0" cy="-130" r="12" fill="url(#${id}light)"/><circle cx="0" cy="-130" r="8" fill="url(#${id}tglass)" opacity="0.85"/>`;
  s += `<g clip-path="url(#${id}trose)"><circle class="he-tomb__pass" cx="0" cy="-130" r="7" fill="url(#${id}tpass)"/></g>`;
  let spokes = "";
  for (let a = 0; a < 8; a++) spokes += `M0 -130L${f(Math.cos((a * Math.PI) / 4) * 8)} ${f(-130 + Math.sin((a * Math.PI) / 4) * 8)}`;
  s += `<path d="${spokes}" stroke="${EDGE}" stroke-width="0.9"/><circle cx="0" cy="-130" r="8" fill="none" stroke="${EDGE}" stroke-width="1.6"/><circle cx="0" cy="-130" r="2.4" fill="${EDGE}"/>`;
  // Urns on the corners.
  for (const c of [-53, 53])
    s += `<path d="M${c - 3.5}-116h7l-1-2q3-2 2-6.5q-1-2-3-2.5h-3q-2 .5-3 2.5q-1 4.5 2 6.5z" fill="${STONE2}" stroke="${EDGE}" stroke-width="0.9"/><circle cx="${c}" cy="-128.5" r="1.5" fill="${STONE2}" stroke="${EDGE}" stroke-width="0.8"/>`;

  // The gargoyle on the peak: wings folded, horns, its eyes glowing (click it: it turns its head).
  s += `<rect x="-6" y="-158" width="12" height="4" fill="${STONE2}" stroke="${EDGE}" stroke-width="0.9"/>`;
  s += `<g class="he-tomb__gargoyle"><rect x="-17" y="-187" width="34" height="30" fill="transparent"/>`;
  s += `<path d="M-6-163L-15-172L-13-164L-17-161L-8-158ZM6-163L15-172L13-164L17-161L8-158Z" fill="${STONE2}" stroke="${EDGE}" stroke-width="0.9"/>`;
  s += `<path d="M-7-158Q-9-166-5-171Q-2-174 0-173Q2-174 5-171Q9-166 7-158Z" fill="${STONE2}" stroke="${EDGE}" stroke-width="0.9"/><path d="M5-171Q9-166 7-158" stroke="${MOON}" stroke-width="0.8" fill="none" opacity="0.6"/>`;
  s += `<g class="he-tomb__head"><circle cx="0" cy="-177" r="4.4" fill="${STONE2}" stroke="${EDGE}" stroke-width="0.9"/><path d="M-3-180L-6-186L-1.5-181ZM3-180L6-186L1.5-181Z" fill="${STONE2}" stroke="${EDGE}" stroke-width="0.8"/><path d="M-2-174.5h4" stroke="${CARVE}" stroke-width="0.8"/>`;
  s += `<g class="he-tomb__geyes" fill="#ff6a3c" filter="url(#${id}glow)"><circle cx="-1.6" cy="-178" r="0.9"/><circle cx="1.6" cy="-178" r="0.9"/></g></g></g>`;

  // The worn steps, moss and ivy, and the candles.
  s += `<path d="M-62 0V-6H62V0Z" fill="${STEP}" stroke="${EDGE}" stroke-width="1"/><path d="M-56-6V-12H56V-6Z" fill="${STEP}" stroke="${EDGE}" stroke-width="1"/><path d="M-50-12V-18H50V-12Z" fill="${STEP}" stroke="${EDGE}" stroke-width="1"/>`;
  s += `<path d="M-62-6H62M-56-12H56M-50-18H50" stroke="#4a3d5e" stroke-width="0.8"/><path d="M62 0V-6M56-6V-12M50-12V-18" stroke="${MOON}" stroke-width="0.9" opacity="0.5"/><path d="M-20-6l3 2M30-12l2 3" stroke="${JOINT}" stroke-width="0.8"/>`;
  s += `<path d="M-60-116q8-4 16-1q6-3 12 0q-10 2-28 1zM20-116q10-3 22 0q-8 1.5-22 0zM-62-6q10-3 18 0q-9 1-18 0z" fill="${MOSS}"/>`;
  s += `<path d="M-40-130q6-4 12-2q-6 2-12 2z" fill="${MOSS}" opacity="0.8"/>`;
  s += ivy([[-47, -18], [-44, -30], [-49, -42], [-45, -55], [-50, -68], [-46, -80], [-51, -92], [-47, -104]]);
  s += candle(id, -30, -12, 8) + candle(id, -24, -12, 5) + candle(id, 34, -6, 6);

  return `<g class="he-tomb" transform="translate(${f(x)} ${f(y)}) scale(${scale})">${s}</g>`;
}
