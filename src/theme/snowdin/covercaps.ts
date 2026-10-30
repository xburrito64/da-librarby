// Every cover gets a snow pile of its own: drawn to fit it, shaped by its title (`data-id` on
// `.card` and `.tp__cover`), so no two shows look alike and each keeps its pile. Each pile is a rule
// of its own made here (.sd-cap-N, for the cover's ::after in snowdin.css), the cover given its
// class. (Not a setting on each cover, read in snowdin.css: then every part of every cover had to be
// styled on its own, slowly.) Piles are drawn as covers come near the screen, at the width the
// browser reports: never measured here (measuring every cover, on any change to the page, had each
// one laid out; on a big library that took seconds).
import { PX, drawCap, makeCap } from "./snowcap";

/** How far the snow reaches past each side (px, as in snowdin.css). */
const OVERHANG = { card: 2, cover: 6 };
const COVERS = ".card[data-id], .tp__cover[data-id]";

/** Piles already drawn, by title and width: their class. */
const drawn = new Map<string, string>();
let made = 0;
/** Their rules (kept for the session: they only apply in Snowdin). */
let rules: HTMLStyleElement | null = null;

function pile(id: number, columns: number) {
  const key = `${id}:${columns}`;
  let cls = drawn.get(key);
  if (!cls) {
    cls = `sd-cap-${made++}`;
    drawn.set(key, cls);
    rules ??= document.head.appendChild(document.createElement("style"));
    const sheet = rules.sheet!;
    // (Twice the class: these win over snowdin.css's plain pattern.)
    sheet.insertRule(
      `:root[data-theme="snowdin"] .${cls}.${cls}::after { background: url(${drawCap(makeCap(columns, id))}) 0 0 / 100% 100% no-repeat; }`,
      sheet.cssRules.length,
    );
  }
  return cls;
}

/** Watches for covers (new ones, and ones changing size) while the theme is on. */
export function startCoverCaps() {
  /** Each cover's pile (its class), and its width as last reported. */
  const given = new Map<HTMLElement, string>();
  const width = new WeakMap<Element, number>();
  const near = new WeakSet<Element>();

  const paint = (el: HTMLElement) => {
    const id = Number(el.dataset.id);
    const w = width.get(el) ?? 0;
    if (!Number.isFinite(id) || w === 0) return;
    const overhang = el.classList.contains("card") ? OVERHANG.card : OVERHANG.cover;
    const cls = pile(id, Math.round((w + 2 * overhang) / PX));
    const was = given.get(el);
    if (was === cls && el.classList.contains(cls)) return;
    if (was) el.classList.remove(was);
    el.classList.add(cls);
    given.set(el, cls);
  };

  const sizes = new ResizeObserver((entries) => {
    for (const e of entries) {
      const w = Math.round(e.borderBoxSize[0]?.inlineSize ?? 0);
      if (w === width.get(e.target)) continue;
      width.set(e.target, w);
      if (near.has(e.target)) paint(e.target as HTMLElement);
    }
  });
  // (Two screens' worth ahead, so a pile is there before its cover scrolls into view.)
  const coming = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || near.has(e.target)) continue;
        near.add(e.target);
        if (!width.has(e.target)) width.set(e.target, Math.round(e.boundingClientRect.width));
        paint(e.target as HTMLElement);
      }
    },
    { rootMargin: "200% 0px" },
  );

  const watch = (el: HTMLElement) => {
    sizes.observe(el);
    coming.observe(el);
  };
  const covers = (n: Node): HTMLElement[] =>
    n instanceof HTMLElement ? [...(n.matches(COVERS) ? [n] : []), ...n.querySelectorAll<HTMLElement>(COVERS)] : [];

  // Covers come and go with the page; a cover's classes are set anew by the page now and then
  // (going offline, say), taking its pile's class away.
  const changes = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") {
        const el = r.target as HTMLElement;
        if (given.has(el)) paint(el);
        continue;
      }
      r.addedNodes.forEach((n) => covers(n).forEach(watch));
      // (Not ones only moved, e.g. covers sorted anew.)
      r.removedNodes.forEach((n) =>
        covers(n).forEach((el) => {
          if (el.isConnected) return;
          sizes.unobserve(el);
          coming.unobserve(el);
          given.delete(el);
        }),
      );
    }
  });
  changes.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  document.querySelectorAll<HTMLElement>(COVERS).forEach(watch);

  return () => {
    changes.disconnect();
    sizes.disconnect();
    coming.disconnect();
    for (const [el, cls] of given) el.classList.remove(cls);
    given.clear();
  };
}
