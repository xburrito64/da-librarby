// Every cover gets a snow pile of its own: drawn to fit it, shaped by its title (`data-id` on
// `.card` and `.tp__cover`), so no two shows look alike and each keeps its pile. Shown by
// snowdin.css through --sd-cover-cap.
import { PX, drawCap, makeCap } from "./snowcap";

/** How far the snow reaches past each side (px, as in snowdin.css). */
const OVERHANG = { card: 2, cover: 6 };

/** Pictures already drawn, by title and width. */
const drawn = new Map<string, string>();

function paint(el: HTMLElement) {
  const id = Number(el.dataset.id);
  const width = el.offsetWidth;
  if (!Number.isFinite(id) || width === 0) return;
  const overhang = el.classList.contains("card") ? OVERHANG.card : OVERHANG.cover;
  const columns = Math.round((width + 2 * overhang) / PX);
  const key = `${id}:${columns}`;
  if (el.dataset.snow === key) return;
  let url = drawn.get(key);
  if (!url) {
    url = drawCap(makeCap(columns, id));
    drawn.set(key, url);
  }
  el.dataset.snow = key;
  el.style.setProperty("--sd-cover-cap", `url(${url}) 0 0 / 100% 100% no-repeat`);
}

/** Watches for covers (new ones, and ones changing size) while the theme is on. */
export function startCoverCaps() {
  const sizes = new ResizeObserver((entries) => entries.forEach((e) => paint(e.target as HTMLElement)));
  const seen = new WeakSet<Element>();
  let queued = 0;
  const scan = () => {
    queued = 0;
    document.querySelectorAll<HTMLElement>(".card[data-id], .tp__cover[data-id]").forEach((el) => {
      if (seen.has(el)) return paint(el);
      seen.add(el);
      sizes.observe(el);
      paint(el);
    });
  };
  const changes = new MutationObserver(() => {
    queued ||= requestAnimationFrame(scan);
  });
  changes.observe(document.body, { childList: true, subtree: true });
  scan();
  return () => {
    changes.disconnect();
    sizes.disconnect();
    cancelAnimationFrame(queued);
  };
}
