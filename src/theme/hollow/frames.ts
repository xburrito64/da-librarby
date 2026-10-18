// The covers' stone frames: every cover (and every Continue watching episode) set in a chipped stone
// frame, carved like the tablets (tablets.ts), now and then with a cobweb, moss, grass, mushrooms, a
// crack or a snail on it. A handful of frames are carved for each size of cover and shared out by the
// show's name, so a show always gets the same one and pages with hundreds of covers stay quick.
//
// The frame is drawn behind the cover and what sits on it over it, by the cover's name block's
// ::before and ::after (hollow.css), from --he-frame, --he-frame-bits, --he-frame-w and --he-frame-h
// (short blob: links, so the page's styles stay quick to work out).

import { carve, hash } from "./tablets";

/** How far the stone reaches past the cover (px); hollow.css matches it. */
const FRAME = 11;
/** How far what sits on the frame may reach out past it (px), as on the tablets; hollow.css matches it. */
const PAD = 28;
/** How many different frames each size of cover gets. */
const KINDS = 16;

const COVERS = ".card, .ccard";
const ART = ".card__art, .ccard__art";

interface Frame {
  stone: string;
  bits: string;
}

const n1 = (n: number) => +n.toFixed(1);

const blob = (w: number, h: number, box: string, body: string) =>
  `url("${URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box}">${body}</svg>`], { type: "image/svg+xml" }))}")`;

/** Carves a frame for a cover `w`×`h` (the stone `FRAME` wider all round). */
function frame(w: number, h: number, kind: number): Frame {
  const W = w + FRAME * 2;
  const H = h + FRAME * 2;
  const carved = carve(W, H, `cover frame|${kind}`, null);
  // Its outline as a path, its colours, its grain and weathering (without the tablet's own edge).
  const outline = `M${[...carved.clip.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map((m) => `${m[1]} ${m[2]}`).join("L")}Z`;
  const tint = carved.tint.match(/#[0-9a-f]{6}/gi) ?? ["#34293f", "#261d31", "#1d1626"];
  const grain = carved.stone.replace(/<polygon[^>]*fill="none"[^>]*\/>\s*$/, "");
  // Where the cover is set into the stone: a dark recess, its lower edge catching the light.
  const x = FRAME - 2.5;
  const y = FRAME - 2.5;
  const stone =
    `<defs><linearGradient id="ft" x1="0" y1="0" x2=".15" y2="1"><stop offset="0" stop-color="${tint[0]}"/><stop offset=".55" stop-color="${tint[1]}"/><stop offset="1" stop-color="${tint[2]}"/></linearGradient>` +
    `<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>` +
    `<clipPath id="fc"><path d="${outline}"/></clipPath></defs>` +
    `<path d="${outline}" fill="url(#ft)"/>` +
    `<g clip-path="url(#fc)">${grain}<rect width="${W}" height="${H}" fill="url(#fl)"/><path d="${outline}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1.4" transform="translate(0 1.4)"/></g>` +
    `<path d="${outline}" fill="none" stroke="#4a3d5e" stroke-width="2.2"/>` +
    `<rect x="${x}" y="${y}" width="${n1(w + 5)}" height="${n1(h + 5)}" rx="3.5" fill="#0c0811"/>` +
    `<path d="M${n1(x + 1)} ${n1(y + h + 5)}H${n1(x + w + 5)}V${n1(y + 1)}" stroke="rgba(255,255,255,.08)" stroke-width="1.2" fill="none"/>`;
  return {
    stone: blob(W, H, `0 0 ${W} ${H}`, stone),
    bits: blob(W + PAD * 2, H + PAD * 2, `${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`, carved.bits),
  };
}

/** Whose cover it is (the show, or the show of the episode). */
const nameOf = (el: HTMLElement) => el.title || el.querySelector(".ccard__show")?.textContent || "";

/** Frames the covers on the page (and again when one changes size or shows something else). */
export function startFrames() {
  const known = new Map<HTMLElement, string>();
  const carved = new Map<string, Frame>();
  const sizes = new ResizeObserver(() => schedule());
  let pending = 0;

  const clear = (el: HTMLElement) => {
    for (const p of ["--he-frame", "--he-frame-bits", "--he-frame-w", "--he-frame-h"]) el.style.removeProperty(p);
    const art = el.querySelector(ART);
    if (art) sizes.unobserve(art);
    known.delete(el);
  };
  const forget = () => {
    for (const f of carved.values()) for (const u of [f.stone, f.bits]) URL.revokeObjectURL(u.slice(5, -2));
    carved.clear();
  };

  const pass = () => {
    pending = 0;
    const now = [...document.querySelectorAll<HTMLElement>(COVERS)];
    const live = new Set(now);
    for (const el of [...known.keys()]) if (!live.has(el)) clear(el);
    // (While a window is being resized, covers keep changing size: don't pile up frames for each.)
    if (carved.size > 160) {
      forget();
      known.clear();
    }
    for (const el of now) {
      const art = el.querySelector<HTMLElement>(ART);
      if (!art) continue;
      if (!known.has(el)) sizes.observe(art);
      const w = Math.round(art.offsetWidth);
      const h = Math.round(art.offsetHeight);
      // (Covers far off screen aren't laid out yet: they're done once they are.)
      if (w < 40 || h < 30) continue;
      const kind = hash(nameOf(el)) % KINDS;
      const key = `${w}x${h}|${kind}`;
      let f = carved.get(key);
      if (!f) {
        f = frame(w, h, kind);
        carved.set(key, f);
      }
      if (known.get(el) === key) continue;
      known.set(el, key);
      el.style.setProperty("--he-frame", f.stone);
      el.style.setProperty("--he-frame-bits", f.bits);
      el.style.setProperty("--he-frame-w", `${w + FRAME * 2}px`);
      el.style.setProperty("--he-frame-h", `${h + FRAME * 2}px`);
    }
  };
  const schedule = () => {
    if (!pending) pending = requestAnimationFrame(pass);
  };

  // Covers come and go with the page.
  const changes = new MutationObserver(schedule);
  changes.observe(document.body, { childList: true, subtree: true });
  schedule();

  return () => {
    cancelAnimationFrame(pending);
    changes.disconnect();
    sizes.disconnect();
    for (const el of [...known.keys()]) clear(el);
    forget();
  };
}
