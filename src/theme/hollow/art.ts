// Hollow's Eve's little pictures, drawn in code as vector shapes (smooth, at any size). They reach
// the stylesheet as CSS variables (--he-jack, --he-ghost, ...); the bats and the spider in the top
// bar and the scenes use the same shapes directly.
import { pumpkinPicture } from "./pumpkins";

/** A picture for CSS: an SVG as a data URL. */
export function svgUrl(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function svg(w: number, h: number, body: string, defs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
}

export const C = {
  pumpkin: "#ff7518",
  pumpkinDark: "#c9530f",
  pumpkinMid: "#e2650f",
  pumpkinLight: "#ff9a45",
  stem: "#56702a",
  vine: "#2f4a1e",
  candle: "#ffd36b",
  ember: "#ffb03b",
  night: "#0b0710",
  coal: "#120a17",
  bat: "#160d1d",
  batEdge: "#6a5288",
  ghost: "#f1ecff",
  ghostEdge: "#c9bde6",
  slime: "#9cff3a",
  bone: "#f3ead8",
};

/** The jack-o'-lantern by the app's name: lit, or with its candle blown out. */
function jack(lit: boolean) {
  return pumpkinPicture(48, 46, { size: 38, face: "classic", stem: "curly", squat: 0.82, unlit: !lit }, 2);
}

const GHOST_BODY = "M21 2C10 2 4 10 4 20v22l5-4 4 4 4-4 4 4 4-4 4 4 4-4 5 4V20C38 10 32 2 21 2z";
/** A friendly little ghost (42 x 46). */
export function ghostShape() {
  return (
    `<path d="${GHOST_BODY}" fill="${C.ghost}" stroke="${C.ghostEdge}" stroke-width="1.5"/>` +
    `<ellipse cx="15" cy="19" rx="3" ry="4" fill="#1a1024"/><ellipse cx="27" cy="19" rx="3" ry="4" fill="#1a1024"/>` +
    `<ellipse cx="21" cy="29" rx="3.5" ry="4.5" fill="#1a1024"/>` +
    `<ellipse cx="11" cy="25" rx="3" ry="2" fill="#ffb3c7" opacity="0.6"/><ellipse cx="31" cy="25" rx="3" ry="2" fill="#ffb3c7" opacity="0.6"/>`
  );
}

/** A bat asleep upside down (18 x 26), and one flying (40 x 22, its wings in `.he-wings`). */
export const HANGING_BAT = svg(
  18,
  26,
  `<path d="M7 0v3M11 0v3" stroke="${C.batEdge}" stroke-width="1.4"/>` +
    `<path d="M9 3C2 8 1 17 9 24C17 17 16 8 9 3Z" fill="${C.bat}" stroke="${C.batEdge}" stroke-width="1"/>` +
    `<path d="M9 6C6 10 6 15 9 20" stroke="${C.batEdge}" stroke-width="0.7" fill="none"/>` +
    `<path d="M6 21l-1 4 3-2zM12 21l1 4-3-2z" fill="${C.bat}"/>` +
    `<circle cx="7" cy="19" r="1" fill="#ffcf5a"/><circle cx="11" cy="19" r="1" fill="#ffcf5a"/>`,
);
export const FLYING_BAT = svg(
  40,
  22,
  `<g class="he-wings"><path d="M20 11C15 4 8 3 1 7c5 1 6 4 5 7 4-2 7-1 9 1 2-2 3-2 5-1 2-1 3-1 5 1 2-2 5-3 9-1-1-3 0-6 5-7-7-4-14-3-19 4Z" fill="${C.bat}" stroke="${C.batEdge}" stroke-width="0.8"/></g>` +
    `<path d="M17 8l1-4 2 3 2-3 1 4" fill="${C.bat}"/><circle cx="18.5" cy="10" r="0.9" fill="#ffcf5a"/><circle cx="21.5" cy="10" r="0.9" fill="#ffcf5a"/>`,
);

/** The spider in the top bar (30 x 26; its legs in `.he-legs`). */
export const SPIDER = svg(
  30,
  26,
  `<g class="he-legs" stroke="${C.coal}" stroke-width="1.6" fill="none" stroke-linecap="round">` +
    `<path d="M11 11L4 6 1 10"/><path d="M11 13L3 12 0 17"/><path d="M11 15L4 18 2 23"/><path d="M12 16L7 21 6 26"/>` +
    `<path d="M19 11L26 6 29 10"/><path d="M19 13L27 12 30 17"/><path d="M19 15L26 18 28 23"/><path d="M18 16L23 21 24 26"/></g>` +
    `<ellipse cx="15" cy="15" rx="6" ry="7" fill="${C.coal}" stroke="#4a3760" stroke-width="1"/>` +
    `<circle cx="15" cy="7.5" r="3.6" fill="${C.coal}" stroke="#4a3760" stroke-width="1"/>` +
    `<circle cx="13.6" cy="7.4" r="1" fill="#ff5a3c"/><circle cx="16.4" cy="7.4" r="1" fill="#ff5a3c"/>`,
);

export const GHOST = svg(42, 46, ghostShape());

// ----- Each cover's little friend (see hollow.css, "Covers")

const TOPPER_PUMPKIN = pumpkinPicture(40, 36, { size: 30, face: "cute", stem: "curly", extras: ["leaf"], squat: 0.82 });
const CANDY = (x: number, y: number, tilt: number, s: number) =>
  `<g transform="translate(${x} ${y}) rotate(${tilt}) scale(${s})">` +
  `<path d="M0 -10L8 10H-8Z" fill="#fff4dc"/><path d="M-4 0H4L6 5H-6Z" fill="#ff8a2e"/><path d="M-6.5 6H6.5L8 10H-8Z" fill="#ffd23a"/></g>`;
const TOPPER_CANDY = svg(46, 26, CANDY(13, 14, -12, 1) + CANDY(32, 15, 16, 0.85));
const TOPPER_GHOST = svg(42, 46, ghostShape());
const TOPPER_SPIDER = svg(
  20,
  70,
  `<path d="M10 0V50" stroke="rgba(243,234,216,0.6)" stroke-width="0.8"/>` +
    `<g stroke="${C.coal}" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M7 55L1 51M7 57L0 58M8 60L3 65M13 55L19 51M13 57L20 58M12 60L17 65"/></g>` +
    `<ellipse cx="10" cy="58" rx="4.2" ry="5" fill="${C.coal}" stroke="#4a3760" stroke-width="0.8"/><circle cx="10" cy="52.5" r="2.6" fill="${C.coal}"/>` +
    `<circle cx="9" cy="52.4" r="0.7" fill="#ff5a3c"/><circle cx="11" cy="52.4" r="0.7" fill="#ff5a3c"/>`,
);
const WEB = svg(
  64,
  64,
  `<g stroke="rgba(243,234,216,0.55)" stroke-width="0.9" fill="none">` +
    `<path d="M0 0L62 4M0 0L52 30M0 0L30 52M0 0L4 62"/>` +
    `<path d="M14 1Q11 7 12 12Q7 11 1 14"/><path d="M28 2Q22 13 24 23Q13 22 2 28"/><path d="M42 3Q33 19 36 34Q19 33 3 42"/><path d="M55 4Q44 26 46 44Q26 44 4 55"/></g>`,
);
const WEB_RIGHT = WEB.replace("<defs></defs>", `<defs></defs><g transform="translate(64 0) scale(-1 1)">`).replace("</svg>", "</g></svg>");
const TOPPER_BAT = svg(26, 34, `<g transform="scale(1.3)">${HANGING_BAT.replace(/^<svg[^>]*><defs><\/defs>/, "").replace("</svg>", "")}</g>`);

/** Switch knobs: a pumpkin, lit when on. */
const KNOB_ON = pumpkinPicture(40, 40, { size: 32, face: "classic", stem: "short", squat: 0.86 }, 4);
const KNOB_OFF = pumpkinPicture(40, 40, { size: 32, face: "classic", stem: "short", squat: 0.86, unlit: true }, 4);

/** A drip of glowing orange under the chosen tab. */
const DRIP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 14" preserveAspectRatio="none"><path fill="${C.pumpkin}" d="M0 0h60v3c-2 0-3 1-3 3s-1 4-2 4-2-2-2-4-1-3-3-3-5 0-6 2-1 7-3 7-2-5-2-7-2-2-4-2-7 0-8 1-1 3-2 3-2-2-2-3-1-1-3-1-2 1-2 2-1 2-2 2-1-1-1-2-1-1-3-1H0z"/></svg>`;

/** A candle for "Continue watching" and the player's loading, flame separate (it flickers). */
const CAULDRON = svg(
  130,
  120,
  `<ellipse cx="65" cy="48" rx="46" ry="10" fill="#7dff3a" opacity="0.9"/>` +
    `<path d="M17 50C17 100 113 100 113 50Z" fill="#1a1024"/>` +
    `<path d="M14 46h102a4 4 0 0 1 0 8h-102a4 4 0 0 1 0-8z" fill="#2a1c38"/>` +
    `<path d="M30 96l-6 14M100 96l6 14M65 100v12" stroke="#1a1024" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M40 112q6-14 10-2q4-12 10 0q4-10 10 0q4-12 10 2" fill="#ff8a2e" opacity="0.9"/>`,
);

let drawn = false;
/** Sets the pictures as CSS variables (once). */
export function drawArt() {
  if (drawn) return;
  drawn = true;
  const set = (name: string, value: string) => document.documentElement.style.setProperty(name, value);
  set("--he-img-jack", svgUrl(jack(true)));
  set("--he-img-jack-out", svgUrl(jack(false)));
  set("--he-img-ghost", svgUrl(GHOST));
  set("--he-img-pumpkin", svgUrl(TOPPER_PUMPKIN));
  set("--he-img-candy", svgUrl(TOPPER_CANDY));
  set("--he-img-ghost-peek", svgUrl(TOPPER_GHOST));
  set("--he-img-spider-thread", svgUrl(TOPPER_SPIDER));
  set("--he-img-web", svgUrl(WEB));
  set("--he-img-web-right", svgUrl(WEB_RIGHT));
  set("--he-img-bat", svgUrl(TOPPER_BAT));
  set("--he-img-knob-on", svgUrl(KNOB_ON));
  set("--he-img-knob-off", svgUrl(KNOB_OFF));
  set("--he-img-drip", svgUrl(DRIP));
  set("--he-img-cauldron", svgUrl(CAULDRON));
}
