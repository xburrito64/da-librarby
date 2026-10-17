// The mouse pointer, as a setting: the everyday pointer (the graveyard's ghost, a ghost reaching out,
// a will-o'-the-wisp, a tiny jack-o'-lantern, a bat), the one over anything clickable (the ghost
// pointing, a bony hand, a witch's hand, a ghostly hand), and, pointing at things in the scene, the
// pointer turning into them (a key at the tomb's gate, a bone over the skeleton, ...; scenes.ts says
// which). Each is drawn here at 32×32 with the spot the click lands on, made into crisp pictures for
// ordinary and high-resolution screens, and shown by rules added to the page (see applyPointer).
// Each everyday pointer also comes with its own pictures for scrolling with the middle mouse button
// (see ../autoscroll.ts) and for where you type.

import { setScrollLook } from "../autoscroll";

const INK = "#1b1024";

/** A picture, 32×32. */
const svg = (body: string, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><filter id="hb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.3"/></filter><filter id="hw" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.3"/></filter>${defs}</defs>${body}</svg>`;

/** A soft glow in `color` behind `shapes` (their fills and strokes recoloured). */
const glow = (shapes: string, color: string, opacity = 0.8, wide = false) =>
  `<g opacity="${opacity}" filter="url(#${wide ? "hw" : "hb"})">${shapes.replace(/fill="(?!none)[^"]*"/g, `fill="${color}"`).replace(/stroke="[^"]*"/g, `stroke="${color}"`)}</g>`;

/** Where a point lands after `translate(tx ty) rotate(deg) scale(s)`. */
const moved = (x: number, y: number, tx: number, ty: number, deg: number, s = 1): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [tx + s * (x * Math.cos(a) - y * Math.sin(a)), ty + s * (x * Math.sin(a) + y * Math.cos(a))];
};

export interface Pointer {
  /** Its name in Settings. */
  label: string;
  /** Where the click lands. */
  hot: [number, number];
  svg: string;
}

// ---------- The ghosts ----------

const GHOST_DEFS = `<linearGradient id="gh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f1ecff"/><stop offset="1" stop-color="#cbbcf0"/></linearGradient>`;
/** The little sheet ghost (as in the graveyard), upright, its head's top at y -6.7. */
const SHEET = "M-7 0C-7 -9 7 -9 7 0L7 6C7 11 9.6 15 6.4 19.6C4.6 16.6 3.4 18.4 1.4 20.6C.2 17.4 -1.8 18.4 -4.2 19.8C-3.2 15.6 -7 11.4 -7 6Z";
const ghostFace = (smile: boolean) =>
  `<ellipse cx="-2.6" cy="-1" rx="1.45" ry="2" fill="${INK}"/><ellipse cx="2.6" cy="-1" rx="1.45" ry="2" fill="${INK}"/>` +
  `<circle cx="-2.1" cy="-1.7" r=".5" fill="#fff"/><circle cx="3.1" cy="-1.7" r=".5" fill="#fff"/>` +
  (smile ? `<path d="M-1.6 2.9Q0 4.3 1.6 2.9" stroke="${INK}" stroke-width="1" fill="none" stroke-linecap="round"/>` : `<ellipse cx="0" cy="3.6" rx=".85" ry="1.1" fill="${INK}"/>`) +
  `<ellipse cx="-4.6" cy="2" rx="1.3" ry=".8" fill="#ffb3c7" opacity=".7"/><ellipse cx="4.6" cy="2" rx="1.3" ry=".8" fill="#ffb3c7" opacity=".7"/>`;
const sheetGhost = (arm = "", smile = false) =>
  glow(`<path d="${SHEET}" fill="x"/>${arm}`, "#b99bff") +
  arm +
  `<path d="${SHEET}" fill="url(#gh)" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>` +
  // (A little shine on its head, well inside the outline.)
  `<path d="M-4.4 -2.2C-4.2 -4.4 -3 -5.3 -1.6 -5.6" stroke="#fff" stroke-width="1" stroke-linecap="round" fill="none" opacity=".9"/>` +
  ghostFace(smile);

const ARM_UP = `<path d="M-7 -.4Q-6.4 -9 -3.6 -14.4Q-1.6 -16.4 .4 -14.6Q1 -13.4 .2 -12Q-1.2 -6.4 -1 -.4Z" fill="#f1ecff" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`;
const ARM_OUT = `<path d="M-6.2 1.6Q-12 -4 -15.6 -11Q-14.6 -12.6 -13 -11.6Q-10 -7.4 -5.6 -4Z" fill="#f1ecff" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`;

/** A little bat (its head up, its middle at 0 0), placed by `transform`. */
const BAT_SHAPES =
  `<path d="M-2 -3.4C-6 -5.4 -10 -4.6 -14 -1.4C-12.4 -.4 -11.6 .8 -11.8 2.4C-10.2 1.4 -8.6 1.6 -7.6 3C-6.4 1.8 -4.6 1.8 -3.2 3.2Z"/>` +
  `<path d="M2 -3.4C6 -5.4 10 -4.6 14 -1.4C12.4 -.4 11.6 .8 11.8 2.4C10.2 1.4 8.6 1.6 7.6 3C6.4 1.8 4.6 1.8 3.2 3.2Z"/>` +
  `<path d="M0 -10.4C1.6 -10.4 2.6 -9 2.6 -7.6L2.6 2C2.6 4.8 1.4 7 0 8.4C-1.4 7 -2.6 4.8 -2.6 2L-2.6 -7.6C-2.6 -9 -1.6 -10.4 0 -10.4Z"/>` +
  `<path d="M-2 -9.2L-2.8 -12.6L-.6 -10.2ZM2 -9.2L2.8 -12.6L.6 -10.2Z"/>`;
const batFigure = (transform: string) =>
  `<g transform="${transform}">` +
  glow(BAT_SHAPES.replace(/<path /g, '<path fill="x" '), "#c9b6ee", 0.9) +
  `<g fill="#241a33" stroke="#0c0712" stroke-width=".8" stroke-linejoin="round">${BAT_SHAPES}</g>` +
  `<path d="M-13 -1.6C-9.4 -4.2 -5.8 -4.6 -2.4 -3M13 -1.6C9.4 -4.2 5.8 -4.6 2.4 -3" stroke="#a48fd0" stroke-width=".7" fill="none"/>` +
  `<path d="M-7.6 -3.6L-7.6 2.6M-11 -2.4L-11.6 2M7.6 -3.6L7.6 2.6M11 -2.4L11.6 2" stroke="#3d2d52" stroke-width=".6"/>` +
  `<circle cx="-1" cy="-8" r=".85" fill="#ffcf5a"/><circle cx="1" cy="-8" r=".85" fill="#ffcf5a"/></g>`;

/** The jack-o'-lantern's pumpkin (its middle at 18 20), without its stem and face. */
const PUMPKIN = "M18 11.4C24.6 10 29 14 29 19.6C29 25.6 24 28.8 18 28.8C12 28.8 7 25.6 7 19.6C7 14 11.4 10 18 11.4Z";
const PUMPKIN_DEFS = `<radialGradient id="pk" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#ffb04a"/><stop offset=".7" stop-color="#ff7a12"/><stop offset="1" stop-color="#c4520a"/></radialGradient><clipPath id="pkc"><path d="${PUMPKIN}"/></clipPath>`;
const PUMPKIN_BODY =
  `<path d="${PUMPKIN}" fill="url(#pk)" stroke="${INK}" stroke-width="1.1"/>` +
  `<g clip-path="url(#pkc)"><path d="M18 11.8V28.4M12.6 12.6Q10.4 19.6 13 28M23.4 12.6Q25.6 19.6 23 28" stroke="#b34f0c" stroke-width=".9" fill="none"/></g>`;

// ---------- The everyday pointers ----------

export const POINTERS: Record<string, Pointer> = {
  ghost: {
    label: "Ghost",
    hot: moved(0, -6.7, 8.2, 8.2, -45).map((v) => Math.round(v)) as [number, number],
    svg: svg(`<g transform="translate(8.2 8.2) rotate(-45)">${sheetGhost()}</g>`, GHOST_DEFS),
  },
  reaching: {
    label: "Reaching ghost",
    hot: [3, 3],
    svg: svg(`<g transform="translate(18.5 15.5) rotate(-18)">${sheetGhost(ARM_OUT, true)}</g>`, GHOST_DEFS),
  },
  wisp: {
    label: "Will-o'-the-wisp",
    hot: [3, 3],
    svg: svg(
      (() => {
        const d = "M2.6 2.6C9 4 17.4 6.6 20.6 11.6C24 17 21 22.4 15.6 22.6C11.4 22.8 9.6 19.6 10.4 16.6C10.8 15 10.6 13.2 9.2 11.6C7.4 9.4 4.6 6.6 2.6 2.6Z";
        return (
          glow(`<path d="${d}" fill="x"/>`, "#5dff8f", 0.9, true) +
          `<path d="M19.6 20.6C23 23 22.6 26.4 25.6 27.4C28 28.2 29.6 26.6 29.2 25" stroke="#6fe89a" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".75"/>` +
          `<path d="${d}" fill="url(#wi)" stroke="#0f3a24" stroke-width=".9" stroke-linejoin="round"/>` +
          `<path d="M6.6 6C10.6 8 15.6 10.6 17.4 14C18.6 16.4 17.4 18.6 15.4 18.6" stroke="#f2fff0" stroke-width="2" fill="none" stroke-linecap="round" opacity=".85"/>` +
          `<circle cx="13.6" cy="15.4" r="1.1" fill="#0f3a24"/><circle cx="17.2" cy="16.6" r="1.1" fill="#0f3a24"/>`
        );
      })(),
      `<radialGradient id="wi" cx=".62" cy=".62" r=".7"><stop offset="0" stop-color="#f4fff0"/><stop offset=".45" stop-color="#9dffb4"/><stop offset="1" stop-color="#2fae6a"/></radialGradient>`,
    ),
  },
  lantern: {
    label: "Jack-o'-lantern",
    hot: [3, 3],
    svg: svg(
      `<g transform="rotate(-22 18 19)">` +
        glow(`<ellipse cx="18" cy="20" rx="10.5" ry="9" fill="x"/>`, "#ff7a1a", 0.7, true) +
        PUMPKIN_BODY +
        `<path d="M17.2 11.6Q16.6 7.6 13.2 6.4Q10.4 5.6 9.6 3.6Q12.6 4 14.6 3.8" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M17.2 11.6Q16.6 7.6 13.2 6.4Q10.4 5.6 9.6 3.6Q12.6 4 14.6 3.8" stroke="#5f7a3a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M11.8 17.6L14.6 15.2L15.6 18.8ZM24.2 17.6L21.4 15.2L20.4 18.8Z" fill="#ffe27a" stroke="#7a3206" stroke-width=".5"/>` +
        `<path d="M11.4 21.4Q18 26.8 24.6 21.4L22.6 22.2L21.6 23.6L20.2 22.6L18 24.2L15.8 22.6L14.4 23.6L13.4 22.2Z" fill="#ffe27a" stroke="#7a3206" stroke-width=".5"/>` +
        `</g>`,
      PUMPKIN_DEFS,
    ),
  },
  bat: {
    label: "Bat",
    hot: [3, 4],
    svg: svg(batFigure("translate(11.8 12.8) rotate(-45) scale(1.05)")),
  },
};

// ---------- Over anything clickable ----------

const BONE = "#ece2c8";
const BONE_SHADE = "#b9a888";
const BONE_INK = "#2a1d2e";
/** Bones from point to point (x1, y1, x2, y2, thickness, knob size), outlined. */
const bones = (list: number[][]) => {
  const one = ([x1, y1, x2, y2, w, k]: number[]) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const nx = (-Math.sin(a) * w) / 2;
    const ny = (Math.cos(a) * w) / 2;
    return `<path d="M${x1 + nx} ${y1 + ny}L${x2 + nx} ${y2 + ny}L${x2 - nx} ${y2 - ny}L${x1 - nx} ${y1 - ny}Z"/><circle cx="${x1}" cy="${y1}" r="${k}"/><circle cx="${x2}" cy="${y2}" r="${k}"/>`;
  };
  const body = list.map(one).join("");
  return `<g fill="${BONE_INK}" stroke="${BONE_INK}" stroke-width="1.7" stroke-linejoin="round">${body}</g><g fill="${BONE}">${body}</g>`;
};

export const HANDS: Record<string, Pointer> = {
  ghost: {
    label: "Ghost points",
    hot: [2, 2],
    svg: svg(
      `<g transform="translate(13 13) rotate(-45)">${sheetGhost(ARM_UP)}</g>` +
        `<path d="M1.4 7.6L.4 8.6M5.4 .8L6.4 .2M.6 4.2L-.6 4" stroke="#ffd36b" stroke-width=".9" stroke-linecap="round"/>`,
      GHOST_DEFS,
    ),
  },
  bony: {
    label: "Bony hand",
    hot: [11, 1],
    svg: svg(
      glow(`<rect x="6" y="2" width="16" height="28" rx="6" fill="x"/>`, "#ff9a45", 0.35, true) +
        bones([
          [11, 2.4, 11, 5.6, 1.9, 1.2], [11, 6.8, 11, 10.6, 2.1, 1.3], [11, 11.8, 11.4, 16.4, 2.3, 1.4],
          [14.4, 13, 14.2, 17.2, 2.1, 1.3], [17.2, 13.6, 17, 17.6, 2, 1.25], [19.8, 14.8, 19.6, 18.4, 1.9, 1.2],
          [11.4, 17.8, 12.6, 23.4, 1.7, 1.15], [14.2, 18.4, 14.6, 23.6, 1.7, 1.15], [17, 18.8, 16.6, 23.6, 1.6, 1.1], [19.6, 19.6, 18.6, 23.6, 1.5, 1.05],
          [11.6, 24, 8.4, 20.8, 1.8, 1.2], [7.6, 19.8, 5.8, 17.4, 1.7, 1.15],
          [12.8, 25.4, 14.6, 25.6, 1.8, 1.3], [16.2, 25.4, 18, 25.2, 1.8, 1.3], [13.6, 27.6, 13.4, 31.6, 2.2, 1.4], [17.4, 27.6, 17.8, 31.6, 2.2, 1.4],
        ]) +
        `<g stroke="${BONE_SHADE}" stroke-width=".55" stroke-linecap="round" opacity=".9"><path d="M11.6 7.4V10M11.9 12.4L12.2 15.8M12.9 18.6L13.4 22.6M15 19L15.2 23"/></g>`,
    ),
  },
  witch: {
    label: "Witch's hand",
    hot: [11, 1],
    svg: svg(
      glow(`<path d="M10 1L12 4L12.6 15L22 15L24 22L21 28L13 28L8 22Z" fill="x"/>`, "#9dff7a", 0.35, true) +
        `<path d="M8.6 5.6Q8.4 9 9 11.4Q8.6 13.6 9.2 15.4L8.8 18.4Q6 17.2 5.4 18.6Q5.2 20.4 7.6 22.2Q9.6 24.2 12.4 25L20 25.2Q23.2 24 23.8 20.6L24 16.6Q23.6 15 22 15.2Q21.4 13.8 19.6 14Q19 12.8 17.2 13Q16.2 12 14.6 12.6L13.2 13.4Q13.6 11.4 13 9.4Q13.2 7.6 12.6 5.6Z" fill="url(#sk)" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>` +
        `<path d="M8.6 5.8L10.6 .4L12.6 5.8Q10.6 6.8 8.6 5.8Z" fill="#14101a" stroke="${INK}" stroke-width=".7" stroke-linejoin="round"/>` +
        `<path d="M10.2 2.6L10.6 1.2" stroke="#8a7aa8" stroke-width=".6" stroke-linecap="round"/>` +
        `<g stroke="#4c5f45" stroke-width=".6" fill="none" stroke-linecap="round"><path d="M9.2 10.6Q10.8 11.2 12.6 10.6M9.4 8.2Q10.8 8.6 12.2 8.2M15.6 14.4Q15.4 15.8 15.2 16.8M18.8 15.2Q18.6 16.4 18.4 17.4M21.6 16.6Q21.6 17.6 21.4 18.6"/></g>` +
        `<path d="M14.6 13.2L16.6 13.6M17.6 14.2L19.6 14.6M20.6 15.6L22.6 16.2" stroke="#14101a" stroke-width="1.1" stroke-linecap="round"/>` +
        `<rect x="16.6" y="16.2" width="3.4" height="1.6" rx=".6" fill="#d9a83a" stroke="${INK}" stroke-width=".5"/><circle cx="18.3" cy="16.2" r="1.3" fill="#a24dff" stroke="${INK}" stroke-width=".5"/><circle cx="17.9" cy="15.8" r=".4" fill="#f0d8ff"/>` +
        `<path d="M11.4 24.2L21 24.4L23.4 31.6L21.4 30.2L19.6 31.8L17.6 30.2L15.6 31.8L13.4 30.2L10.6 31.6Z" fill="#3a2452" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>` +
        `<path d="M12 25.4L21 25.6" stroke="#6b4a8e" stroke-width=".8"/>`,
      `<linearGradient id="sk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b7cca8"/><stop offset=".6" stop-color="#8fa58a"/><stop offset="1" stop-color="#5f7a5a"/></linearGradient>`,
    ),
  },
  ghostly: {
    label: "Ghostly hand",
    hot: [11, 1],
    svg: svg(
      (() => {
        const d = "M9.4 3.6Q9.4 1.2 11 1.2Q12.6 1.2 12.6 3.6V12.4Q13.2 11.4 14.6 11.6Q15.8 11.8 16 13Q16.6 12.2 18 12.4Q19.2 12.6 19.4 13.8Q20 13.2 21.2 13.6Q22.4 14.2 22.2 15.8L21.8 20.6Q21.2 23.6 18.8 25Q19 28 21.6 29.6Q24.4 31 26.4 29.4Q24.4 32.4 20 31.6Q15.4 30.4 14.4 26.6L13.8 25.2Q11.6 24.6 9.6 22L6.8 18.6Q6 17 7.2 16.4Q8.4 16 9.4 17.2Z";
        return (
          glow(`<path d="${d}" fill="x"/>`, "#b99bff", 0.95, true) +
          `<path d="${d}" fill="url(#gl)" stroke="#8b6fd0" stroke-width=".9" stroke-linejoin="round" opacity=".9"/>` +
          `<path d="M10.6 3V10.6M14.4 13.6V16M17.6 14.4V16.8" stroke="#ffffff" stroke-width=".9" stroke-linecap="round" opacity=".85"/>` +
          `<circle cx="7" cy="9" r=".7" fill="#e9dcff"/><circle cx="24" cy="10" r=".6" fill="#e9dcff"/><circle cx="5" cy="24" r=".5" fill="#e9dcff"/>`
        );
      })(),
      `<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf8ff" stop-opacity=".95"/><stop offset=".65" stop-color="#d9c8ff" stop-opacity=".8"/><stop offset="1" stop-color="#b99bff" stop-opacity=".35"/></linearGradient>`,
    ),
  },
};

// ---------- Pointing at things in the scene ----------

/** A thing drawn in a 20×20 box (scaled up to fill the pointer). */
const fromSmall = (art: string, defs = "") => svg(`<g transform="translate(1 1) scale(1.5)">${glow(art, "#ffffff", 0.3)}${art}</g>`, defs);

const KEY_AT = { x: 16.4, y: 16.2, deg: -38, s: 1.12 };
const BONE_AT = { x: 16, y: 16, deg: 40, s: 1.05 };

export const THINGS: Record<string, Pointer> = {
  door: {
    label: "The house's door",
    hot: [16, 18],
    svg: svg(
      // Its stone arch, the warm light inside, the door swung half open, light spilling out.
      `<path d="M17.4 27.4L23.6 27.4L29.6 31.6L19.4 31.6Z" fill="url(#spill)"/>` +
        `<path d="M6.4 28V12.6A9.6 9.6 0 0 1 25.6 12.6V28Z" fill="#3b3149" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
        `<path d="M8.6 28V12.8A7.4 7.4 0 0 1 23.4 12.8V28Z" fill="url(#lit)"/>` +
        `<path d="M8.6 28V12.8Q8.6 6.6 13.6 5.6L17.6 7.4V30.2Z" fill="url(#wood)" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>` +
        `<g clip-path="url(#leaf)" stroke="#4a2a14" stroke-width=".7"><path d="M11.4 4V31M14.4 4V31"/><path d="M8 14.6L18 13.8M8 23.4L18 23.8" stroke="#2a1608" stroke-width="1.2"/></g>` +
        `<circle cx="15.8" cy="18.6" r="1" fill="#ffd36b" stroke="${INK}" stroke-width=".5"/>` +
        `<path d="M7.6 12.6A8.4 8.4 0 0 1 12 5.6" stroke="#5a4c6a" stroke-width=".8" fill="none"/>`,
      `<linearGradient id="lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf6a"/><stop offset="1" stop-color="#ff8a1e"/></linearGradient>` +
        `<linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e4126"/><stop offset="1" stop-color="#9a6438"/></linearGradient>` +
        `<linearGradient id="spill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347" stop-opacity=".75"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></linearGradient>` +
        `<clipPath id="leaf"><path d="M8.6 28V12.8Q8.6 6.6 13.6 5.6L17.6 7.4V30.2Z"/></clipPath>`,
    ),
  },
  bone: {
    label: "The skeleton",
    hot: moved(-12.6, -1.6, BONE_AT.x, BONE_AT.y, BONE_AT.deg, BONE_AT.s).map((v) => Math.round(v)) as [number, number],
    svg: svg(
      (() => {
        // A real bone: a shaft swelling a little at its ends, each end two round knobs.
        const shape = `<path d="M-9.4 -1.9Q0 -1.2 9.4 -1.9V1.9Q0 1.2 -9.4 1.9Z"/><circle cx="-10.6" cy="-2.4" r="3"/><circle cx="-10.6" cy="2.4" r="3"/><circle cx="10.6" cy="-2.4" r="3"/><circle cx="10.6" cy="2.4" r="3"/>`;
        return (
          `<g transform="translate(${BONE_AT.x} ${BONE_AT.y}) rotate(${BONE_AT.deg}) scale(${BONE_AT.s})">` +
          glow(shape.replace(/<(path|circle) /g, '<$1 fill="x" '), "#ffffff", 0.3) +
          `<g fill="${BONE_INK}" stroke="${BONE_INK}" stroke-width="2.2" stroke-linejoin="round">${shape}</g>` +
          `<g fill="url(#bn)">${shape}</g>` +
          `<path d="M-8.6 1.1Q0 .5 8.6 1.1M-12.6 3.6Q-11 5.2 -9 4.6M12.6 3.6Q11 5.2 9 4.6" stroke="${BONE_SHADE}" stroke-width=".9" fill="none" stroke-linecap="round"/>` +
          `<path d="M-11.8 -3.8Q-10.6 -4.8 -9.4 -4" stroke="#fffaf0" stroke-width=".9" fill="none" stroke-linecap="round"/></g>`
        );
      })(),
      `<linearGradient id="bn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf6ea"/><stop offset="1" stop-color="#dccfae"/></linearGradient>`,
    ),
  },
  coffin: {
    label: "The coffin",
    hot: [16, 16],
    svg: fromSmall(`<path d="M7 1.5H13L16 6.5L13.6 18.5H6.4L4 6.5Z" fill="#4a2e1e" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M7.6 3H12.4L14.4 6.6L12.4 17H7.6L5.6 6.6Z" fill="none" stroke="#6e4630" stroke-width=".8"/><path d="M10 5.5V13M7.6 8H12.4" stroke="#d9c7a6" stroke-width="1.4" stroke-linecap="round"/>`),
  },
  paw: {
    label: "The black cat",
    hot: [16, 17],
    svg: svg(
      (() => {
        // A black cat's paw from below: soft fur round it, pink beans.
        const toes = [[8.2, 14.8, -28], [12.6, 9.6, -10], [19.4, 9.6, 10], [23.8, 14.8, 28]];
        const pad = "M16 17.4C19.6 17.4 22.2 19.4 23.4 22.2C24.6 25.2 23.2 28.6 20.4 28.6C18.6 28.6 17.8 27.6 16 27.6C14.2 27.6 13.4 28.6 11.6 28.6C8.8 28.6 7.4 25.2 8.6 22.2C9.8 19.4 12.4 17.4 16 17.4Z";
        const fur =
          `<path d="${pad}" transform="translate(16 23) scale(1.28) translate(-16 -23)"/>` +
          toes.map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="4.8" transform="rotate(${a} ${x} ${y})"/>`).join("");
        return (
          glow(fur.replace(/<(path|ellipse) /g, '<$1 fill="x" '), "#c9b6ee", 0.7) +
          `<g fill="#2a2036" stroke="#0c0712" stroke-width="1.6">${fur}</g><g fill="#2a2036">${fur}</g>` +
          `<path d="M6 12.4Q7 9.6 9.6 9.2M10.6 6.2Q12.6 4.6 14.6 5.6" stroke="#6b5a86" stroke-width=".9" fill="none" stroke-linecap="round"/>` +
          `<path d="${pad}" fill="url(#bean)"/>` +
          toes.map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="2.3" ry="2.9" transform="rotate(${a} ${x} ${y})" fill="url(#bean)"/>`).join("") +
          `<path d="M12.6 20.6Q14.4 19.4 16.4 19.6" stroke="#ffd6e2" stroke-width="1" fill="none" stroke-linecap="round"/>` +
          toes.map(([x, y]) => `<circle cx="${x - 0.7}" cy="${y - 1.1}" r=".6" fill="#ffe4ec"/>`).join("")
        );
      })(),
      `<radialGradient id="bean" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffb8cb"/><stop offset="1" stop-color="#e2809c"/></radialGradient>`,
    ),
  },
  key: {
    label: "The tomb's gate",
    hot: moved(12.4, 0, KEY_AT.x, KEY_AT.y, KEY_AT.deg, KEY_AT.s).map((v) => Math.round(v)) as [number, number],
    svg: svg(
      (() => {
        // An old iron key: a three-lobed bow, a collar, a long shank, a toothed bit at the end.
        const shape =
          `<circle cx="-11.4" cy="0" r="3.1"/><circle cx="-8.4" cy="-2.9" r="3.1"/><circle cx="-8.4" cy="2.9" r="3.1"/>` +
          `<rect x="-5.6" y="-2.3" width="1.6" height="4.6" rx=".5"/><rect x="-3.4" y="-1.8" width="1.2" height="3.6" rx=".4"/>` +
          `<rect x="-3" y="-1.15" width="15.4" height="2.3" rx="1"/>` +
          `<path d="M7.4 0H12V5.8H10.6V4.2H9.4V5.8H8.2V3.4H7.4Z"/>`;
        return (
          `<g transform="translate(${KEY_AT.x} ${KEY_AT.y}) rotate(${KEY_AT.deg}) scale(${KEY_AT.s})">` +
          glow(shape.replace(/<(path|circle|rect) /g, '<$1 fill="x" '), "#ffffff", 0.3) +
          `<g fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round">${shape}</g>` +
          `<g fill="url(#iron)">${shape}</g>` +
          `<circle cx="-9.4" cy="0" r="1.9" fill="${INK}"/><circle cx="-9.4" cy="0" r="1.2" fill="#2a2234"/>` +
          `<path d="M-2.6 -.5H11.6" stroke="#e4def0" stroke-width=".6" stroke-linecap="round" opacity=".8"/>` +
          `<path d="M-13.4 -1.4Q-12.6 -2.8 -11.2 -3M-10 -4.6Q-8.4 -6 -6.8 -5" stroke="#e4def0" stroke-width=".6" fill="none" stroke-linecap="round" opacity=".7"/></g>`
        );
      })(),
      `<linearGradient id="iron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6c0d2"/><stop offset=".55" stop-color="#8e879e"/><stop offset="1" stop-color="#5e576c"/></linearGradient>`,
    ),
  },
  blow: {
    label: "The tomb's candles",
    hot: [2, 4],
    svg: svg(
      // The little ghost, eyes squeezed shut and cheeks puffed, blowing the flame out.
      `<g transform="translate(20.4 13.4) rotate(-12)">` +
        glow(`<path d="${SHEET}" fill="x"/>`, "#b99bff") +
        `<path d="${SHEET}" fill="url(#gh)" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>` +
        `<path d="M-4.4 -2.2C-4.2 -4.4 -3 -5.3 -1.6 -5.6" stroke="#fff" stroke-width="1" stroke-linecap="round" fill="none" opacity=".9"/>` +
        `<path d="M-4.2 -1.2Q-2.8 -2.4 -1.4 -1.2M1 -1.4Q2.4 -2.6 3.8 -1.4" stroke="${INK}" stroke-width="1" fill="none" stroke-linecap="round"/>` +
        `<circle cx="-4.6" cy="2.6" r="2.3" fill="#ffc3d3" stroke="#e9a3b8" stroke-width=".5"/><circle cx="2.6" cy="2.8" r="2.1" fill="#ffc3d3" stroke="#e9a3b8" stroke-width=".5" opacity=".8"/>` +
        `<ellipse cx="-1.3" cy="3.4" rx="1" ry=".9" fill="${INK}"/>` +
        `</g>` +
        `<path d="M10.4 15.2Q7 13.4 3.2 11.4M10.8 17.8Q7 17.6 3.6 16.6M9.8 12.6Q6.6 9 2.4 4.4" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>` +
        `<path d="M10.4 15.2Q7 13.4 3.2 11.4M10.8 17.8Q7 17.6 3.6 16.6M9.8 12.6Q6.6 9 2.4 4.4" stroke="#f6f2ff" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
      GHOST_DEFS,
    ),
  },
  match: {
    label: "A blown-out candle",
    hot: [8, 4],
    svg: svg(
      // A struck match, its flame forward, to light it again.
      `<g transform="rotate(-32 16 16)">` +
        glow(`<path d="M16 1.6C19.6 5 19.2 8.2 16 9C12.8 8.2 12.4 5 16 1.6Z" fill="x"/>`, "#ffb347", 0.9) +
        `<path d="M14.6 11H17.4V30H14.6Z" fill="#d9b27a" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>` +
        `<path d="M15.4 13V28.6" stroke="#f0d3a0" stroke-width=".7"/>` +
        `<ellipse cx="16" cy="10.4" rx="2.6" ry="3.1" fill="#b33a2a" stroke="${INK}" stroke-width="1.1"/>` +
        `<path d="M15.2 9.2Q15.6 8.4 16.6 8.6" stroke="#e8786a" stroke-width=".7" fill="none" stroke-linecap="round"/>` +
        `<path d="M16 .8C20.2 4.6 19.6 8 16 8.8C12.4 8 11.8 4.6 16 .8Z" fill="#ffb347"/>` +
        `<path d="M16 3.4C17.8 5.2 17.6 7 16 7.6C14.4 7 14.2 5.2 16 3.4Z" fill="#fff3c4"/>` +
        `</g>`,
    ),
  },
  pumpkin: {
    label: "A pumpkin",
    hot: [16, 19],
    svg: svg(
      (() => {
        // Plump lobes (the middle one in front), a curly stem, a leaf and a tendril.
        const outline = `<ellipse cx="10.4" cy="20" rx="8" ry="8.6"/><ellipse cx="21.6" cy="20" rx="8" ry="8.6"/><ellipse cx="16" cy="20" rx="7" ry="9.4"/>`;
        return (
          glow(outline.replace(/<ellipse /g, '<ellipse fill="x" '), "#ff7a1a", 0.55, true) +
          `<g fill="${INK}" stroke="${INK}" stroke-width="2.2">${outline}</g>` +
          `<ellipse cx="10.4" cy="20" rx="8" ry="8.6" fill="url(#pkSide)"/><ellipse cx="21.6" cy="20" rx="8" ry="8.6" fill="url(#pkSide)"/>` +
          `<ellipse cx="16" cy="20" rx="7" ry="9.4" fill="url(#pkMid)" stroke="#a9480a" stroke-width=".9"/>` +
          `<path d="M13.4 13.2Q12.6 16.6 13.2 20" stroke="#ffd08a" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".8"/>` +
          `<path d="M16 11.4Q15.4 7.4 18 4.4" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M16 11.4Q15.4 7.4 18 4.4" stroke="#6b7a3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
          `<path d="M17.4 8.6Q21.6 5.4 25.4 7.6Q22.6 11.4 17.8 10Z" fill="#4f7040" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/><path d="M18.2 9.6L23.6 7.8" stroke="#2e4526" stroke-width=".6"/>` +
          `<path d="M15.4 9.4Q11.6 9.6 11.2 7Q11 5.2 12.8 5.4Q14 5.8 13.2 6.8" stroke="#5f7a3a" stroke-width=".9" fill="none" stroke-linecap="round"/>`
        );
      })(),
      `<radialGradient id="pkMid" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffac4a"/><stop offset="1" stop-color="#f06e0c"/></radialGradient>` +
        `<radialGradient id="pkSide" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#f58a26"/><stop offset="1" stop-color="#c4520a"/></radialGradient>`,
    ),
  },
  boo: {
    label: "The ghost",
    hot: [6, 28],
    svg: svg(
      glow(`<path d="M2 8Q2 3.6 6.4 3.6H25.6Q30 3.6 30 8V17Q30 21.4 25.6 21.4H12.4L6 28L7.6 21.4H6.4Q2 21.4 2 17Z" fill="x"/>`, "#b99bff", 0.6) +
        `<path d="M2 8Q2 3.6 6.4 3.6H25.6Q30 3.6 30 8V17Q30 21.4 25.6 21.4H12.4L6 28L7.6 21.4H6.4Q2 21.4 2 17Z" fill="#f6f2ff" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
        `<text x="16" y="16.4" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="8.4" letter-spacing=".3" text-anchor="middle" fill="${INK}">BOO</text>`,
    ),
  },
  bat: {
    label: "A bat",
    hot: [16, 14],
    svg: svg(
      (() => {
        // A bat face on, wings spread: scalloped edges held up by its long finger bones.
        const left = "M12.4 14C9 9.8 5.2 8.6 1.4 9.8C2.6 11.8 2.8 14 2.4 16.2C4 15 5.8 15.4 6.6 17.2C7.8 15.8 9.6 16 10.4 17.8C11 16.6 12 16.4 12.8 17.2Z";
        const right = "M19.6 14C23 9.8 26.8 8.6 30.6 9.8C29.4 11.8 29.2 14 29.6 16.2C28 15 26.2 15.4 25.4 17.2C24.2 15.8 22.4 16 21.6 17.8C21 16.6 20 16.4 19.2 17.2Z";
        const body = `<ellipse cx="16" cy="18" rx="4.2" ry="5.4"/><circle cx="16" cy="12.6" r="3.8"/><path d="M12.8 11.4L12 6.8L15 9.6ZM19.2 11.4L20 6.8L17 9.6Z"/>`;
        const all = `<path d="${left}"/><path d="${right}"/>${body}`;
        return (
          glow(all.replace(/<(path|ellipse|circle) /g, '<$1 fill="x" '), "#c9b6ee", 0.85) +
          `<g fill="#241a33" stroke="#0c0712" stroke-width=".9" stroke-linejoin="round">${all}</g>` +
          `<path d="M12.4 14L2.4 16.2M12.4 14.4L6.6 17.2M12.6 15L10.4 17.8M19.6 14L29.6 16.2M19.6 14.4L25.4 17.2M19.4 15L21.6 17.8" stroke="#4a3a66" stroke-width=".6"/>` +
          `<path d="M1.8 10Q6 8.8 10 11.2M30.2 10Q26 8.8 22 11.2" stroke="#a48fd0" stroke-width=".7" fill="none"/>` +
          `<circle cx="14.5" cy="12.4" r="1.15" fill="#ffcf5a"/><circle cx="17.5" cy="12.4" r="1.15" fill="#ffcf5a"/><circle cx="14.7" cy="12.2" r=".4" fill="#1b1024"/><circle cx="17.7" cy="12.2" r=".4" fill="#1b1024"/>` +
          `<path d="M15 14.6L15.4 15.8L15.8 14.7M16.2 14.7L16.6 15.8L17 14.6" fill="#fff" stroke="#fff" stroke-width=".3" stroke-linejoin="round"/>` +
          `<path d="M13.6 19.6Q16 21 18.4 19.6" stroke="#3d2d52" stroke-width=".6" fill="none"/>`
        );
      })(),
    ),
  },
  feather: {
    label: "The spider",
    hot: [26, 4],
    svg: fromSmall(`<path d="M3 18Q6 9 16.6 1.8Q18.6 6.4 15 10.6Q11.4 14.6 5.4 15.8Z" fill="#e9defa" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/><path d="M1.6 19.4Q8 11 16.4 2.6" stroke="#8f7bb0" stroke-width=".9" fill="none" stroke-linecap="round"/><path d="M8 12.6L12.6 12.4M10.4 10L14.8 9.2M12.6 7.6L16.4 6" stroke="#b7a6d4" stroke-width=".6"/>`),
  },
  pickaxe: {
    label: "The crystals",
    hot: [27, 9],
    svg: fromSmall(`<path d="M3.5 18.5L13.5 6.5" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M3.5 18.5L13.5 6.5" stroke="#8a5e3a" stroke-width="2" stroke-linecap="round"/><path d="M5.4 3.4Q12 .4 18.6 5.4Q14 3.8 12.6 4.4L15.6 7.4Q16 10.2 18.6 12.6Q12.4 8.6 10.2 6Q8.4 4.4 5.4 3.4Z" fill="#a8a2b4" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`),
  },
  secret: {
    label: "A secret",
    hot: [16, 15],
    svg: fromSmall(`<path d="M10 1L11.8 7.6L18.6 9.4L11.8 11.2L10 18L8.2 11.2L1.4 9.4L8.2 7.6Z" fill="#c9a2ff" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/><circle cx="16.6" cy="3" r="1" fill="#e9dcff"/><circle cx="3.4" cy="16" r=".8" fill="#e9dcff"/>`),
  },
};

/** Windows' own arrow, for the choice that keeps it (as a picture in Settings). */
const WINDOWS = svg(`<path d="M6 3V23.6L10.8 19L14.4 27.2L17.4 25.9L13.9 18H20.6Z" fill="#fff" stroke="#000" stroke-width="1.1" stroke-linejoin="round"/>`);
const WINDOWS_HAND = svg(`<path d="M11.6 4.2Q11.6 2.6 13 2.6Q14.4 2.6 14.4 4.2V12.6Q14.6 11.6 15.8 11.6Q17.2 11.6 17.2 13V13.4Q17.4 12.4 18.6 12.4Q20 12.4 20 13.8V14.2Q20.2 13.2 21.4 13.2Q22.8 13.2 22.8 14.6V20.6Q22.8 24.2 20.4 26.4V28.4H13.2V26.6L8.4 20.2Q7.6 18.8 8.8 18.2Q9.8 17.8 10.6 18.8L11.6 20Z" fill="#fff" stroke="#000" stroke-width="1.1" stroke-linejoin="round"/>`);

const picture = (s: string) => `data:image/svg+xml,${encodeURIComponent(s)}`;

/** The choices for the settings, each with its picture. */
export const pointerChoices = () => [{ value: "windows", label: "Windows'", image: picture(WINDOWS) }, ...Object.entries(POINTERS).map(([value, p]) => ({ value, label: p.label, image: picture(p.svg) }))];
export const handChoices = () => [{ value: "windows", label: "Windows'", image: picture(WINDOWS_HAND) }, ...Object.entries(HANDS).map(([value, p]) => ({ value, label: p.label, image: picture(p.svg) }))];

// ---------- Scrolling with the middle button, and typing ----------

/** For each everyday pointer: waiting after a middle click (little arrows up and down), scrolling
 *  up and down (sideways: the same, turned), and where you type. All centred on the pointer. */
interface ScrollSet {
  wait: string;
  up: string;
  down: string;
  text: string;
}

const arrowUp = (y: number, fill: string, stroke: string, w = 3.4, h = 3.4) =>
  `<path d="M16 ${y}L${16 + w} ${y + h}L${16 - w} ${y + h}Z" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`;
const arrowDown = (y: number, fill: string, stroke: string, w = 3.4, h = 3.4) =>
  `<path d="M16 ${y}L${16 + w} ${y - h}L${16 - w} ${y - h}Z" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`;
/** Three short streaks from y0 to y1 behind something moving (the side ones shorter). */
const streaks = (y0: number, y1: number, color: string) => {
  const side = y0 + (y1 - y0) * 0.3;
  return `<g stroke="${color}" stroke-width="1.4" stroke-linecap="round" opacity=".85"><path d="M11.4 ${side}V${y1}"/><path d="M16 ${y0}V${y1}"/><path d="M20.6 ${side}V${y1}"/></g>`;
};
/** Where you type: a bar with ends, and something of the pointer's on top or below. */
const typing = (fill: string, stroke: string, glowColor: string, extra = "", defs = "") => {
  const d = "M12.6 5.4H19.4V7.4H17.1V24.6H19.4V26.6H12.6V24.6H14.9V7.4H12.6Z";
  return svg(glow(`<path d="${d}" fill="x"/>`, glowColor, 0.75) + `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>` + extra, defs);
};
const LILAC = "#f1ecff";
const ARMS_OUT = ARM_OUT + `<g transform="scale(-1 1)">${ARM_OUT}</g>`;

const WISP_DEFS =
  `<radialGradient id="wa" cx=".5" cy=".6" r=".7"><stop offset="0" stop-color="#f4fff0"/><stop offset=".45" stop-color="#9dffb4"/><stop offset="1" stop-color="#2fae6a"/></radialGradient>` +
  `<radialGradient id="wc" cx=".5" cy=".25" r=".8"><stop offset="0" stop-color="#f4fff0"/><stop offset=".35" stop-color="#9dffb4"/><stop offset="1" stop-color="#2fae6a" stop-opacity=".7"/></radialGradient>`;
const WISP_DARK = "#0f3a24";
const FLAME = "M0 -9C3 -5 6.5 -2 6.5 2.5C6.5 6.6 3.6 9 0 9C-3.6 9 -6.5 6.6 -6.5 2.5C-6.5 -2 -3 -5 0 -9Z";
/** The wisp streaming along like a comet, its head leading upwards (or, `down`, downwards). */
const comet = (down: boolean) => {
  const d = "M16 3.6C20 3.6 22.4 6.6 22.2 10.2C22 14 19.6 17 18.4 21C17.6 24 18.6 27 16.2 30.6C14.6 27.6 14.8 24.6 14 21.6C12.4 17.4 9.8 14 9.8 10.2C9.8 6.6 12.2 3.6 16 3.6Z";
  return svg(
    `<g${down ? ' transform="translate(0 32) scale(1 -1)"' : ""}>` +
      glow(`<path d="${d}" fill="x"/>`, "#5dff8f", 0.9, true) +
      `<path d="${d}" fill="url(#wc)" stroke="${WISP_DARK}" stroke-width=".9" stroke-linejoin="round"/>` +
      `<path d="M13 9.6C13.2 7.6 14.4 6.4 16 6.2" stroke="#f2fff0" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9"/>` +
      `<circle cx="14.2" cy="9.4" r="1.05" fill="${WISP_DARK}"/><circle cx="17.8" cy="9.4" r="1.05" fill="${WISP_DARK}"/></g>`,
    WISP_DEFS,
  );
};

const LIT = "#ffe27a";
const UNLIT = "#5a2306";
/** The jack-o'-lantern carved with an up and a down arrow (lit or not), `dy` up or down. */
const carvedLantern = (up: string, down: string, dy = 0, light = 0.7) =>
  `<g transform="translate(-2 ${-3 + dy})">` +
  glow(`<ellipse cx="18" cy="20" rx="10.5" ry="9" fill="x"/>`, "#ff7a1a", light, true) +
  PUMPKIN_BODY +
  `<path d="M18 11.6Q17.6 8.6 15.4 7.2" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M18 11.6Q17.6 8.6 15.4 7.2" stroke="#5f7a3a" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
  `<path d="M18 13.8L21.2 17.6H14.8Z" fill="${up}" stroke="#7a3206" stroke-width=".6" stroke-linejoin="round"/><path d="M18 26L21.2 22.2H14.8Z" fill="${down}" stroke="#7a3206" stroke-width=".6" stroke-linejoin="round"/>` +
  `<ellipse cx="13" cy="19.9" rx="1" ry="1.2" fill="${LIT}"/><ellipse cx="23" cy="19.9" rx="1" ry="1.2" fill="${LIT}"/>` +
  `</g>`;

/** The bat hanging asleep, wrapped in its wings (upside down: feet at the top, ears below). */
const SLEEPING_BAT = (() => {
  const d = "M16 7.4C19.8 7.4 21.4 11 21.2 15.6C21 20.2 19.4 23.4 16 23.4C12.6 23.4 11 20.2 10.8 15.6C10.6 11 12.2 7.4 16 7.4Z";
  return (
    `<g transform="translate(0 .4)">` +
    glow(`<path d="${d}" fill="x"/>`, "#c9b6ee", 0.9) +
    `<path d="M14.4 7.8V5.6M17.6 7.8V5.6M13.4 5.6H18.6" stroke="#a48fd0" stroke-width=".9" stroke-linecap="round"/>` +
    `<path d="M14 22.6L13 25.6L15.4 23.2ZM18 22.6L19 25.6L16.6 23.2Z" fill="#241a33" stroke="#0c0712" stroke-width=".7" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="#241a33" stroke="#0c0712" stroke-width=".8"/>` +
    `<path d="M16 8.4C14.4 11.6 14 15.4 14.8 19.6M16 8.4C17.6 11.6 18 15.4 17.2 19.6" stroke="#a48fd0" stroke-width=".7" fill="none"/>` +
    `<path d="M14.2 21.2Q15 21.9 15.6 21.2M16.4 21.2Q17 21.9 17.8 21.2" stroke="#ffcf5a" stroke-width=".7" fill="none" stroke-linecap="round"/>` +
    `</g>`
  );
})();

export const SCROLLS: Record<string, ScrollSet> = {
  ghost: {
    wait: svg(arrowUp(1.2, LILAC, INK) + `<g transform="translate(16 11.7) scale(.62)">${sheetGhost("", true)}</g>` + arrowDown(30.8, LILAC, INK), GHOST_DEFS),
    up: svg(`<g transform="translate(16 9) scale(.78)">${sheetGhost()}</g>` + streaks(26.6, 31, "#c9b6ee"), GHOST_DEFS),
    down: svg(streaks(5.4, 1, "#c9b6ee") + `<g transform="translate(16 23) rotate(180) scale(.78)">${sheetGhost()}</g>`, GHOST_DEFS),
    // (Ending in a little sheet hem.)
    text: typing(
      LILAC,
      INK,
      "#b99bff",
      `<path d="M12.6 24.6Q13.4 27.6 14.6 26.2Q15.6 28 16.4 26.2Q17.4 28 18.4 26.2Q19.2 27.4 19.4 24.6" fill="${LILAC}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/><path d="M13.2 24.9H18.8" stroke="${LILAC}" stroke-width="1.4"/>`,
    ),
  },
  reaching: {
    // (Its body, not its arms, halfway between the arrows.)
    wait: svg(arrowUp(1.2, LILAC, INK) + `<g transform="translate(16 11.8) scale(.6)">${sheetGhost(ARMS_OUT, true)}</g>` + arrowDown(30.8, LILAC, INK), GHOST_DEFS),
    up: svg(`<g transform="translate(17 12.4) scale(.66)">${sheetGhost(ARM_UP, true)}</g>` + streaks(27, 31, "#c9b6ee"), GHOST_DEFS),
    down: svg(streaks(5, 1, "#c9b6ee") + `<g transform="translate(15 19.6) rotate(180) scale(.66)">${sheetGhost(ARM_UP, true)}</g>`, GHOST_DEFS),
    // (Holding its little arms up.)
    text: typing(
      LILAC,
      INK,
      "#b99bff",
      `<g transform="translate(16 6.2) scale(.36)"><path d="M-9 0Q-14 -6 -15.6 -11Q-14.6 -12.6 -13 -11.6Q-10 -6 -5 -1Z" fill="${LILAC}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M9 0Q14 -6 15.6 -11Q14.6 -12.6 13 -11.6Q10 -6 5 -1Z" fill="${LILAC}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/></g>`,
    ),
  },
  wisp: {
    wait: svg(
      arrowUp(0.8, "#6fe89a", WISP_DARK) +
        `<g transform="translate(16 16) scale(.92)">` +
        glow(`<path d="${FLAME}" fill="x"/>`, "#5dff8f", 0.9, true) +
        `<path d="${FLAME}" fill="url(#wa)" stroke="${WISP_DARK}" stroke-width=".9"/>` +
        `<path d="M-3.6 1.2C-3.6 -1.4 -2 -3.6 0 -5.2" stroke="#f2fff0" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9"/>` +
        `<circle cx="-1.9" cy="3" r="1.05" fill="${WISP_DARK}"/><circle cx="1.9" cy="3" r="1.05" fill="${WISP_DARK}"/></g>` +
        arrowDown(31.2, "#6fe89a", WISP_DARK),
      WISP_DEFS,
    ),
    up: comet(false),
    down: comet(true),
    // (A little flame on top.)
    text: typing(
      "#c8ffd6",
      WISP_DARK,
      "#5dff8f",
      `<path d="M16 .8C17.6 2.4 18.4 3.6 18 5.4H14C13.6 3.6 14.4 2.4 16 .8Z" fill="#9dffb4" stroke="${WISP_DARK}" stroke-width=".9" stroke-linejoin="round"/><path d="M16 3.2C16.6 3.8 16.8 4.4 16.6 5H15.4C15.2 4.4 15.4 3.8 16 3.2Z" fill="#f4fff0"/>`,
    ),
  },
  lantern: {
    wait: svg(carvedLantern(LIT, LIT), PUMPKIN_DEFS),
    up: svg(carvedLantern(LIT, UNLIT, -1.6, 0.85) + streaks(28.2, 31.4, "#ffb04a"), PUMPKIN_DEFS),
    down: svg(streaks(4.4, 0.6, "#ffb04a") + carvedLantern(UNLIT, LIT, 2.6, 0.85), PUMPKIN_DEFS),
    // (Pumpkin-orange, with a stem.)
    text: typing(
      "#ffb04a",
      INK,
      "#ff7a1a",
      `<path d="M16 5.6Q15.8 3.4 14 2.4" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M16 5.6Q15.8 3.4 14 2.4" stroke="#5f7a3a" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
    ),
  },
  bat: {
    wait: svg(arrowUp(0.6, "#c9b6ee", "#0c0712", 3, 3) + SLEEPING_BAT + arrowDown(31.4, "#c9b6ee", "#0c0712", 3, 3)),
    up: svg(batFigure("translate(16 13) scale(1.02)") + streaks(26.4, 31, "#a48fd0")),
    down: svg(streaks(5.6, 1, "#a48fd0") + batFigure("translate(16 19) rotate(180) scale(1.02)")),
    // (A tiny bat perched on top.)
    text: typing(
      "#3a2a52",
      "#0c0712",
      "#c9b6ee",
      `<g transform="translate(16 6.6) scale(.42)"><g fill="#241a33" stroke="#0c0712" stroke-width="1.8" stroke-linejoin="round">${BAT_SHAPES.split("<path").slice(0, 3).join("<path")}<circle cx="0" cy="-1" r="3.6"/></g><circle cx="-1.3" cy="-1.6" r="1" fill="#ffcf5a"/><circle cx="1.3" cy="-1.6" r="1" fill="#ffcf5a"/></g>`,
    ),
  },
};

/** The same picture turned around its middle (for scrolling sideways). */
const turned = (picture: string, degrees: number) => picture.replace("</defs>", `</defs><g transform="rotate(${degrees} 16 16)">`).replace(/<\/svg>$/, "</g></svg>");
const centred = (s: string): Pointer => ({ label: "", hot: [16, 16], svg: s });

// ---------- Showing them ----------

/** Anything clickable. */
const CLICKABLE =
  'a[href], button:not(:disabled), select, summary, label:has(input:is([type="checkbox"], [type="radio"])), [role="button"], [role="tab"], [role="radio"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [role="slider"], input:is([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="button"], [type="submit"]), .card, .tp__desc:not(.is-open), .tp__parent, .toast, .sort-select, .ctx-menu__item, .swatch, .player__seek, .player__slider';
const ROOT = ':root[data-theme="hollow"]';
/** Where you type. */
const TYPING = 'textarea, input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="button"], [type="submit"])';
/** The scene's things that are under the pointer themselves (not behind the page), and what the
 *  pointer turns into over them, every part of them. */
const OWN: [string, string][] = [
  [".he-house", "door"],
  [".he-pumpkin", "pumpkin"],
  [".he-ghost.is-peeking", "boo"],
  [".he-bat", "bat"],
  [".he-spider__body", "feather"],
  [".he-tomb__door", "key"],
  [".he-tomb__candle", "blow"],
  [".he-tomb__candle.is-out", "match"],
  [".he-tomb__gargoyle", "hand"],
];

const made = new Map<string, Promise<string>>();

/** The pointer as a CSS cursor: crisp pictures for ordinary and high-resolution screens (kept as
 *  short blob: links, so the page's styles stay quick to work out), and where the click lands. */
function cursorOf(p: Pointer) {
  let done = made.get(p.svg);
  if (!done) {
    done = new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = async () => {
        const at = (scale: number) =>
          new Promise<string>((ok) => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 32 * scale;
            canvas.getContext("2d")!.drawImage(img, 0, 0, 32 * scale, 32 * scale);
            canvas.toBlob((blob) => ok(blob ? `url("${URL.createObjectURL(blob)}") ${scale}x` : ""), "image/png");
          });
        const sizes = await Promise.all([at(1), at(1.5), at(2)]);
        resolve(sizes.every(Boolean) ? `image-set(${sizes.join(", ")}) ${p.hot[0]} ${p.hot[1]}` : "");
      };
      img.onerror = () => resolve("");
      img.src = picture(p.svg);
    });
    made.set(p.svg, done);
  }
  return done;
}

let asked = "";

/** Puts the chosen pointers in place (`main`, `hand`: a key of POINTERS or HANDS, or "windows";
 *  `things`: whether the pointer turns into what it points at in the scene; scenes.ts marks the
 *  element under the pointer with data-he-point: a key of THINGS, or "hand").
 *  (The everyday pointer is set once on the page and passed down; the clicking one only on what's
 *  clickable: rules reaching every element would make every change on the page slow.) */
export function applyPointer(main: string, hand: string, things: boolean) {
  const want = `${main}|${hand}|${things}`;
  asked = want;
  const keys = Object.keys(THINGS);
  const scroll = SCROLLS[main];
  const scrolling = scroll && {
    v: scroll.wait,
    h: turned(scroll.wait, 90),
    up: scroll.up,
    down: scroll.down,
    left: turned(scroll.up, -90),
    right: turned(scroll.down, -90),
  };
  void Promise.all([
    POINTERS[main] ? cursorOf(POINTERS[main]) : "",
    HANDS[hand] ? cursorOf(HANDS[hand]) : "",
    Promise.all(keys.map((k) => (things ? cursorOf(THINGS[k]) : ""))),
    scroll ? cursorOf(centred(scroll.text)) : "",
    Promise.all(Object.values(scrolling || {}).map((s) => cursorOf(centred(s)))),
  ]).then(([arrow, finger, over, text, scrollCursors]) => {
    if (asked !== want) return;
    const handCursor = finger ? `${finger}, pointer` : "pointer";
    let css = "";
    if (arrow) {
      css += `${ROOT}.he-pointer, ${ROOT}.he-pointer :is(.choice-row, .tp__desc.is-open, .filter:disabled) { cursor: ${arrow}, auto; }
`;
      css += `${ROOT}.he-pointer :is(${CLICKABLE}) { cursor: pointer; }
`;
      if (text) css += `${ROOT}.he-pointer.he-pointer :is(${TYPING}) { cursor: ${text}, text !important; }
`;
    }
    if (finger) css += `${ROOT}.he-pointer-hand :is(${CLICKABLE}) { cursor: ${handCursor}; }
`;
    const cursorFor = (key: string) => (over[keys.indexOf(key)] ? `${over[keys.indexOf(key)]}, pointer` : handCursor);
    for (const key of [...keys, "hand"]) css += `${ROOT} [data-he-point="${key}"] { cursor: ${cursorFor(key)} !important; }
`;
    for (const [selector, key] of OWN) css += `${ROOT} ${selector}, ${ROOT} ${selector} * { cursor: ${cursorFor(key)} !important; }
`;
    let style = document.getElementById("he-pointer");
    if (!style) {
      style = document.createElement("style");
      style.id = "he-pointer";
      document.head.append(style);
    }
    style.textContent = css;
    const root = document.documentElement;
    root.classList.toggle("he-pointer", !!arrow);
    root.classList.toggle("he-pointer-hand", !!finger);
    // Scrolling with the middle button (in the pointer's style, or the browser's own).
    if (arrow && scrolling && scrollCursors.every(Boolean)) {
      const names = Object.keys(scrolling) as (keyof typeof scrolling)[];
      const mark = (s: string) => ({ src: picture(s), width: 32, height: 32 });
      setScrollLook("hollow", {
        cursors: Object.fromEntries(names.map((n, i) => [n, `${scrollCursors[i]}, all-scroll`])) as Record<keyof typeof scrolling, string>,
        marks: { v: mark(scrolling.v), h: mark(scrolling.h) },
      });
    } else setScrollLook("hollow", null);
  });
}
