// The covers' stone frames: every cover (and every Continue watching episode) set in a chipped stone
// frame, carved like the tablets (tablets.ts), now and then with a cobweb, moss, grass, mushrooms, a
// crack or a snail on it. A handful of frames are carved for each size of cover and shared out by the
// show's name, so a show always gets the same one and pages with hundreds of covers stay quick.
//
// The frame is drawn behind the cover and what sits on it over it, by the cover's name block's
// ::before and ::after (hollow.css), each frame by a rule of its own made here (.he-fr-N), the name
// block given its frame's class. (Not by settings on each cover, read in hollow.css: then every part
// of every cover had to be styled on its own, three times slower, enough to stutter while scrolling.)
// Each frame, carved as a drawing, is then made a plain picture at the screen's sharpness, its shadow
// drawn in: drawn as it was (shapes, grain, a blurred shadow) for every cover scrolling into view, it
// took the graphics card more than a frame's time on a page of many covers.

import { warm } from "./art";
import { carve, hash } from "./tablets";

/** How far the stone reaches past the cover (px); hollow.css matches it. */
const FRAME = 11;
/** How far what sits on the frame may reach out past it (px), as on the tablets; hollow.css matches it. */
const PAD = 28;
/** How many different frames each size of cover gets. */
const KINDS = 16;
/** The stone's shadow (px: how far down, how blurred), and the room left for it round the stone. */
const SHADOW = { y: 12, blur: 16, color: "rgba(0, 0, 0, 0.6)" };
const ROOM = { side: 24, top: 16, bottom: 40 };
const NO_ROOM = { side: 0, top: 0, bottom: 0 };

const COVERS = ".card, .ccard";
const ART = ".card__art, .ccard__art";
const TEXT = ".card__text, .ccard__text";

interface Frame {
  /** Its class, given to the name blocks of the covers it frames. */
  cls: string;
  /** Its pictures (blob: links), once made. */
  stone?: string;
  bits?: string;
}

const n1 = (n: number) => +n.toFixed(1);

const svg = (w: number, h: number, box: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box}">${body}</svg>`;

/** Carves a frame for a cover `w`×`h` (the stone `FRAME` wider all round), as drawings (SVG): the
 *  stone, and what sits on it. */
function frame(w: number, h: number, kind: number) {
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
    stone: svg(W, H, `0 0 ${W} ${H}`, stone),
    bits: svg(W + PAD * 2, H + PAD * 2, `${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`, carved.bits),
  };
}

/** Draws an SVG `w`×`h` as a plain picture at the screen's sharpness, with `room` round it and, if
 *  asked, the stone's shadow; its blob: link. */
async function picture(drawing: string, w: number, h: number, room: typeof ROOM, shadow: boolean) {
  const source = URL.createObjectURL(new Blob([drawing], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = source;
    await img.decode();
    const dpr = window.devicePixelRatio || 1;
    const canvas = new OffscreenCanvas(Math.ceil((w + room.side * 2) * dpr), Math.ceil((h + room.top + room.bottom) * dpr));
    const g = canvas.getContext("2d")!;
    if (shadow) {
      // (A canvas's shadow isn't scaled with what's drawn.)
      g.shadowColor = SHADOW.color;
      g.shadowOffsetY = SHADOW.y * dpr;
      g.shadowBlur = SHADOW.blur * dpr;
    }
    g.drawImage(img, room.side * dpr, room.top * dpr, w * dpr, h * dpr);
    return URL.createObjectURL(await canvas.convertToBlob());
  } finally {
    URL.revokeObjectURL(source);
  }
}

/** Pictures being made, one after another, each started while nothing else is going on: each takes
 *  a few milliseconds, and made all at once (a page of new frames) they held the page up a third of
 *  a second. */
let turns: Promise<unknown> = Promise.resolve();
function inTurn<T>(make: () => Promise<T>): Promise<T> {
  const mine = turns.then(() => new Promise<void>((go) => requestIdleCallback(() => go(), { timeout: 1000 }))).then(make);
  turns = mine.catch(() => {});
  return mine;
}

/** Whose cover it is (the show, or the show of the episode). */
const nameOf = (el: HTMLElement) => el.title || el.querySelector(".ccard__show")?.textContent || "";

/** Frames the covers on the page (and again when one changes size or shows something else). */
export function startFrames() {
  /** Each framed cover's frame (its key) and the name block given its class. */
  const known = new Map<HTMLElement, { key: string; text: Element; cls: string }>();
  const carved = new Map<string, Frame>();
  const rules = document.head.appendChild(document.createElement("style"));
  let made = 0;
  /** Each cover picture's size (px), as told whenever it's laid out: never measured here. (Covers
   *  off screen aren't laid out until they come near; measuring them had each one laid out, one
   *  after another: 35 ms on a tab of covers.) */
  const size = new WeakMap<Element, { w: number; h: number }>();
  const sizes = new ResizeObserver((entries) => {
    for (const e of entries) {
      const [box] = e.borderBoxSize;
      if (box) size.set(e.target, { w: Math.round(box.inlineSize), h: Math.round(box.blockSize) });
    }
    schedule();
  });
  const watched = new WeakSet<Element>();
  let pending = 0;

  const clear = (el: HTMLElement) => {
    const was = known.get(el);
    if (was) was.text.classList.remove(was.cls);
    const art = el.querySelector(ART);
    if (art) {
      sizes.unobserve(art);
      watched.delete(art);
    }
    known.delete(el);
  };
  /** Frames' pictures being got ready (art.ts), to let go of with the frames. */
  const unwarm: (() => void)[] = [];
  const forget = () => {
    for (const f of carved.values()) for (const u of [f.stone, f.bits]) if (u) URL.revokeObjectURL(u);
    carved.clear();
    rules.textContent = "";
    for (const u of unwarm.splice(0)) u();
  };

  /** Carves a frame and makes its pictures, then its rules; the covers waiting for it are framed after. */
  const make = async (f: Frame, w: number, h: number, kind: number) => {
    const W = w + FRAME * 2;
    const H = h + FRAME * 2;
    const drawing = frame(w, h, kind);
    const stone = await inTurn(() => picture(drawing.stone, W, H, ROOM, true));
    const bits = await inTurn(() => picture(drawing.bits, W + PAD * 2, H + PAD * 2, NO_ROOM, false));
    // (Let go of meanwhile: the window resized through many sizes, or the theme changed.)
    if (![...carved.values()].includes(f)) {
      URL.revokeObjectURL(stone);
      URL.revokeObjectURL(bits);
      return;
    }
    Object.assign(f, { stone, bits });
    // (Twice the class: these win over hollow.css's frames, which have none.)
    const sheet = rules.sheet!;
    const at = `:root[data-theme="hollow"] .${f.cls}.${f.cls}`;
    sheet.insertRule(
      `${at}::before { left: ${-FRAME - ROOM.side}px; top: ${-FRAME - ROOM.top}px; width: ${W + ROOM.side * 2}px; height: ${H + ROOM.top + ROOM.bottom}px; background-image: url("${stone}"); }`,
      sheet.cssRules.length,
    );
    sheet.insertRule(`${at}::after { width: ${W + PAD * 2}px; height: ${H + PAD * 2}px; background-image: url("${bits}"); }`, sheet.cssRules.length);
    unwarm.push(warm([`url("${stone}")`, `url("${bits}")`]));
    schedule();
  };

  /** How many frames may still be carved this frame (each takes half a millisecond or so), and
   *  whether some had to wait for the next. */
  let carving = Infinity;
  let waited = false;
  /** Frames a cover whose picture is `w`×`h` (once its frame is made). */
  const put = (el: HTMLElement, text: Element, w: number, h: number) => {
    const kind = hash(nameOf(el)) % KINDS;
    const key = `${w}x${h}|${kind}|${window.devicePixelRatio}`;
    let f = carved.get(key);
    if (!f) {
      if (carving-- <= 0) {
        waited = true;
        return;
      }
      f = { cls: `he-fr-${made++}` };
      carved.set(key, f);
      void make(f, w, h, kind);
    }
    if (!f.stone) return;
    const was = known.get(el);
    if (was?.key === key && was.text === text) return;
    if (was) was.text.classList.remove(was.cls);
    text.classList.add(f.cls);
    known.set(el, { key, text, cls: f.cls });
  };

  /** Covers not laid out yet (off screen), framed ahead at the size of the others beside them (a row's
   *  or a page's covers are all one size), while nothing else is going on: framed only once they're
   *  shown, every frame was carved and its pictures made as they scrolled into view. */
  let ahead: { el: HTMLElement; text: Element; w: number; h: number }[] = [];
  /** A cover picture of each kind none of which is laid out yet (all off screen): measured (which
   *  lays out that one cover) for the size of the others. */
  let probes: HTMLElement[] = [];
  let idle = 0;
  const prepare = (deadline: IdleDeadline) => {
    idle = 0;
    const art = probes.shift();
    if (art?.isConnected && !size.has(art)) {
      size.set(art, { w: art.offsetWidth, h: art.offsetHeight });
      schedule();
    }
    while (ahead.length && deadline.timeRemaining() > 3) {
      const a = ahead.shift()!;
      if (a.el.isConnected && !known.has(a.el)) put(a.el, a.text, a.w, a.h);
    }
    if (ahead.length || probes.length) idle = requestIdleCallback(prepare);
  };

  const besides = (el: HTMLElement) => `${el.classList[0]}|${el.parentElement?.className ?? ""}`;

  const pass = () => {
    pending = 0;
    // (A page of covers of a new size, a tab say, needs 16 new frames: carved over a few frames, not
    // all in the one the page comes in.)
    carving = 4;
    waited = false;
    const now = [...document.querySelectorAll<HTMLElement>(COVERS)];
    const live = new Set(now);
    for (const el of [...known.keys()]) if (!live.has(el)) clear(el);
    // (While a window is being resized, covers keep changing size: don't pile up frames for each.)
    if (carved.size > 160) {
      for (const el of [...known.keys()]) clear(el);
      forget();
    }
    // (Beside: the same kind of cover in the same kind of row or page, e.g. any row of covers on Home.)
    const laidOut = new Map<string, { w: number; h: number }>();
    const notYet: { el: HTMLElement; text: Element; art: HTMLElement }[] = [];
    for (const el of now) {
      const art = el.querySelector<HTMLElement>(ART);
      const text = el.querySelector(TEXT);
      if (!art || !text) continue;
      if (!watched.has(art)) {
        watched.add(art);
        sizes.observe(art);
      }
      const { w, h } = size.get(art) ?? { w: 0, h: 0 };
      if (w < 40 || h < 30) {
        if (!known.has(el)) notYet.push({ el, text, art });
        continue;
      }
      laidOut.set(besides(el), { w, h });
      put(el, text, w, h);
    }
    carving = Infinity;
    if (waited) schedule();
    const unsized = new Map<string, HTMLElement>();
    ahead = notYet.flatMap(({ el, text, art }) => {
      const like = laidOut.get(besides(el));
      if (!like && !unsized.has(besides(el))) unsized.set(besides(el), art);
      return like ? [{ el, text, ...like }] : [];
    });
    probes = [...unsized.values()];
    if ((ahead.length || probes.length) && !idle) idle = requestIdleCallback(prepare);
  };
  const schedule = () => {
    if (!pending) pending = requestAnimationFrame(pass);
  };

  // Covers come and go with the page. (Only then: with hundreds of covers, going over them all
  // whenever anything on the page changes would slow everything down.)
  const covers = (nodes: NodeList) => [...nodes].some((n) => n instanceof Element && (n.matches(COVERS) || n.querySelector(COVERS) != null));
  const changes = new MutationObserver((records) => {
    if (records.some((r) => covers(r.addedNodes) || covers(r.removedNodes))) schedule();
  });
  changes.observe(document.body, { childList: true, subtree: true });
  schedule();

  return () => {
    cancelAnimationFrame(pending);
    cancelIdleCallback(idle);
    changes.disconnect();
    sizes.disconnect();
    for (const el of [...known.keys()]) clear(el);
    forget();
    rules.remove();
  };
}
