// While a dialog covers the library (Settings, say), the moving scenery behind it (the leaves, the
// embers, the pictures' little movements, the spider) holds still: it's hardly seen through the
// dark, blurred backdrop, and the dialog then opens and scrolls smoothly. It carries on where it
// was once the dialog closes.

let frozen = false;
/** Frames asked for while frozen (by negative ids), run once it thaws. */
const held = new Map<number, FrameRequestCallback>();
let nextId = -1;

/** Like requestAnimationFrame, but waits while frozen. */
export function frame(callback: FrameRequestCallback) {
  if (!frozen) return requestAnimationFrame(callback);
  const id = nextId--;
  held.set(id, callback);
  return id;
}

/** Like cancelAnimationFrame, for `frame`'s ids. */
export function cancelFrame(id: number) {
  if (id < 0) held.delete(id);
  else cancelAnimationFrame(id);
}

export function isFrozen() {
  return frozen;
}

function setFrozen(on: boolean) {
  if (frozen === on) return;
  frozen = on;
  if (on) return;
  const waiting = [...held.values()];
  held.clear();
  requestAnimationFrame((t) => waiting.forEach((callback) => callback(t)));
}

/** Freezes while a dialog is open; returns the way to stop watching. */
export function freezeUnderDialogs() {
  const check = () => setFrozen(document.querySelector(".modal:not(.settings-warmup *)") != null);
  const changes = new MutationObserver(check);
  changes.observe(document.body, { childList: true, subtree: true });
  check();
  return () => {
    changes.disconnect();
    setFrozen(false);
  };
}

// While the page is being scrolled, the little movements that would have the whole page gone over
// again (the pictures' parts, the spider's swing) hold still too: with many covers on the page that
// took every frame's time, and the scrolling stuttered. They carry on once it stops.

/** The movements hold still until the page has stopped scrolling for this long (ms). */
const SCROLL_HOLD_MS = 250;
let scrolledAt = -Infinity;
document.addEventListener("scroll", () => (scrolledAt = performance.now()), { capture: true, passive: true });

/** Whether the page is being scrolled. */
export function scrolling(now = performance.now()) {
  return now - scrolledAt < SCROLL_HOLD_MS;
}
