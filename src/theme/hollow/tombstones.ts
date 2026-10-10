// The tombstones in the scenes, every one its own: a cat's little grave with ears and a paw print,
// a broken one with its top lying in the grass, a leaning cross with ivy, a gothic one with "RIP"
// (the ghost's), a mossy one with a candle burning in front, an obelisk with a tiny skull, one with
// angel wings, a Celtic cross, an old sunken slab, one with a crescent moon and a crack, a wooden
// grave marker, and a small one with a heart and wilted flowers. Drawn standing at x, y (the middle
// of the foot), `h` px tall.

export type Stone =
  | "rip"
  | "cat"
  | "broken"
  | "ivyCross"
  | "gothic"
  | "candle"
  | "obelisk"
  | "angel"
  | "celtic"
  | "slab"
  | "moon"
  | "wooden"
  | "heart";

const EDGE = "#4a3d5e";
const CARVE = "#16101e";
const MOSS = "#33402a";
const LEAF = "#2f4a26";

/** Stone colours, slightly different grey-purples. */
const STONE = ["#2c2238", "#2a2533", "#31263c", "#282131"];

/** Draws in a box about 24 wide and 36 tall (y up is negative), scaled to `h`. */
export function tombstone(kind: Stone, x: number, y: number, h: number, tilt = 0, id = "", shade = 0) {
  const fill = STONE[shade % STONE.length];
  const solid = (d: string, more = "") => `<path d="${d}" fill="${fill}" stroke="${EDGE}" stroke-width="1.2" vector-effect="non-scaling-stroke" stroke-linejoin="round" ${more}/>`;
  const carve = (d: string, w = 1.4) => `<path d="${d}" stroke="${CARVE}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const text = (t: string, cy: number, size = 6.5) =>
    `<text x="0" y="${cy}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${size}" fill="${CARVE}" letter-spacing="0.6">${t}</text>`;
  const ivy = (points: [number, number][]) => {
    let d = `M${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) d += `Q${points[i - 1][0] + (i % 2 ? 4 : -4)} ${(points[i - 1][1] + points[i][1]) / 2} ${points[i][0]} ${points[i][1]}`;
    const leaves = points.slice(1).map(([lx, ly], i) => `<ellipse cx="${lx + (i % 2 ? 2 : -2)}" cy="${ly}" rx="2.1" ry="1.3" transform="rotate(${i % 2 ? 30 : -30} ${lx} ${ly})" fill="${LEAF}"/>`).join("");
    return `<path d="${d}" stroke="${LEAF}" stroke-width="0.9" fill="none"/>${leaves}`;
  };
  const crack = (d: string) => `<path d="${d}" stroke="#120c18" stroke-width="0.9" fill="none" stroke-linejoin="bevel"/>`;
  let s = "";
  switch (kind) {
    case "rip":
      s = solid("M-11 0V-24A11 11 0 0 1 11-24V0Z") + text("RIP", -18) + carve("M-6-12H6M-4.5-8.5H4.5", 1);
      break;
    case "cat":
      // A pet's grave: a little stone with cat ears, and a paw print carved in it.
      s =
        solid("M-10 0V-19Q-10-27-6.5-29.5L-7.5-36L-2-31Q0-31.6 2-31L7.5-36L6.5-29.5Q10-27 10-19V0Z") +
        `<g fill="${CARVE}"><ellipse cx="0" cy="-15" rx="3.4" ry="2.8"/><circle cx="-3.6" cy="-19.4" r="1.4"/><circle cx="-1.2" cy="-21.2" r="1.4"/><circle cx="1.2" cy="-21.2" r="1.4"/><circle cx="3.6" cy="-19.4" r="1.4"/></g>`;
      break;
    case "broken":
      // Snapped off: the stump, and its top lying in the grass beside it.
      s =
        solid("M-10 0V-16L-6.5-19L-3-15.5L1-20L5-16.5L10-18.5V0Z") +
        carve("M-5-9H5", 1) +
        `<g transform="translate(15 -2.6) rotate(84)">${solid("M-10 0V-5A10 10 0 0 1 10-5V0L6.5 2.5L3-1L-1 3L-5-0.5Z")}</g>` +
        `<g fill="${fill}" stroke="${EDGE}" stroke-width="0.8" vector-effect="non-scaling-stroke"><path d="M-14 0l2-2 2 2z"/><path d="M7 0l1.5-1.6 1.6 1.6z"/></g>`;
      break;
    case "ivyCross":
      s = solid("M-2.6 0V-24H-9V-30H-2.6V-37H2.6V-30H9V-24H2.6V0Z") + ivy([[-1.5, 0], [2, -6], [-2, -12], [2, -18], [-1, -24], [-6, -27], [6, -28]]);
      break;
    case "gothic":
      // The ghost's: tall, pointed, a carved border and "RIP".
      s = solid("M-15 0V-27Q-15-38 0-45Q15-38 15-27V0Z") + carve("M-11.5 0V-26Q-11.5-35 0-40.5Q11.5-35 11.5-26V0", 1) + text("RIP", -24, 7.5) + carve("M-6-15H6M-7-11H7", 1);
      break;
    case "candle":
      // A mossy one, a candle left burning in front of it.
      s =
        solid("M-10 0V-22A10 10 0 0 1 10-22V0Z") +
        `<path d="M-9.6-23Q-6-33 0-32Q5-32.6 8-28Q4-29 2-27Q-2-30-5-27Q-7-26-9.6-23Z" fill="${MOSS}"/>` +
        carve("M-5-17H5M-4-13H4M-5-9H5", 1) +
        `<rect x="7" y="-6" width="3.2" height="6" rx="0.6" fill="#e9dcc0"/><path d="M8.6-6v-1.4" stroke="#2a1a10" stroke-width="0.5"/>` +
        `<ellipse class="he-flicker" cx="8.6" cy="-9" rx="1.5" ry="2.3" fill="#ffc35a" filter="url(#${id}glow)"/>`;
      break;
    case "obelisk":
      s = solid("M-10 0V-5H-7L-5-40L0-46L5-40L7-5H10V0Z") + carve("M-7-5H7", 1) +
        `<g fill="${CARVE}"><path d="M-3-26a3 3 0 1 1 6 0v2h-1.4v1.4h-3.2v-1.4h-1.4z"/></g><g fill="${fill}"><circle cx="-1.2" cy="-26" r="0.8"/><circle cx="1.2" cy="-26" r="0.8"/></g>`;
      break;
    case "angel":
      // Stone wings either side of its top.
      s =
        solid("M-17-26Q-18-34-11-36Q-12-31-9.5-29Q-13-29-13.5-26Q-16-26.5-17-26Z") +
        solid("M17-26Q18-34 11-36Q12-31 9.5-29Q13-29 13.5-26Q16-26.5 17-26Z") +
        solid("M-10 0V-23A10 10 0 0 1 10-23V0Z") + carve("M-5-16H5M-4-12H4", 1) + carve("M0-25v-5M-2.2-28H2.2", 1.1);
      break;
    case "celtic":
      s =
        solid("M-3 0V-22H-10V-28H-3V-36H3V-28H10V-22H3V0Z") +
        `<circle cx="0" cy="-25" r="7" fill="none" stroke="${fill}" stroke-width="2.6"/><circle cx="0" cy="-25" r="7" fill="none" stroke="${EDGE}" stroke-width="0.6" vector-effect="non-scaling-stroke"/>` +
        carve("M0-33V-17M-8-25H8", 0.6);
      break;
    case "slab":
      // Old and sunk, leaning back, moss along its top.
      s = solid("M-13 0V-15Q-13-18-9-18.5L10-21Q13-21 13-18V0Z") + `<path d="M-12.6-15.5Q-11-18.6-7-18.6L4-20.2Q-2-17.6-6-18Q-9-17-12.6-15.5Z" fill="${MOSS}"/>` + carve("M-7-11L7-13M-6-7L6-8.6", 1);
      break;
    case "moon":
      s =
        solid("M-11 0V-24A11 11 0 0 1 11-24V0Z") +
        `<path d="M2-27a6 6 0 1 0 0 10a4.6 4.6 0 1 1 0-10z" fill="${CARVE}"/>` +
        carve("M-5-11H5", 1) +
        crack("M7-33L4.5-28L6-25L3-20L4-17");
      break;
    case "wooden":
      // Two planks nailed together, the wood weathered.
      s =
        `<g fill="#3b2b24" stroke="#57422f" stroke-width="1" vector-effect="non-scaling-stroke"><path d="M-2.4 2V-31L0-33L2.4-31V2Z"/><path d="M-10-24.5L10-26.5V-22.5L-10-20.5Z"/></g>` +
        `<path d="M-0.8-30V-2M0.9-12V0" stroke="#2a1d18" stroke-width="0.5"/><g fill="#8a7a6a"><circle cx="-0.8" cy="-23.4" r="0.6"/><circle cx="0.8" cy="-23.6" r="0.6"/></g>`;
      break;
    case "heart":
      // Small, a heart carved in it, wilted flowers leaning on it.
      s =
        solid("M-8 0V-15A8 8 0 0 1 8-15V0Z") +
        `<path d="M0-8.5C-5-12-4.6-17-1.8-17C-0.8-17 0-16 0-15.2C0-16 0.8-17 1.8-17C4.6-17 5-12 0-8.5Z" fill="${CARVE}"/>` +
        `<g stroke="#2f4a26" stroke-width="0.7" fill="none"><path d="M-4 0Q-6-4-9-6M-3 0Q-4-5-7-9M-2 0Q-2-4-4-8"/></g><g fill="#8a4fd0"><circle cx="-9" cy="-6" r="1.3"/><circle cx="-7" cy="-9.2" r="1.3"/></g><circle cx="-4" cy="-8.4" r="1.2" fill="#e0782c"/>`;
      break;
  }
  const k = h / 36;
  return `<g transform="translate(${x} ${y}) rotate(${tilt}) scale(${k.toFixed(3)})">${s}</g>`;
}
