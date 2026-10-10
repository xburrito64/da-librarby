// The spotlight's title in Hollow's Eve: its spooky letters are big, so a long title gets smaller
// until it fits in three lines (rather than being cut off, which would also cut off its glow).
// See hollow.css ("Spotlight").

/** At most this many lines, and no smaller than this (px). */
const LINES = 3;
const SMALLEST = 26;

function fit(title: HTMLElement) {
  title.style.fontSize = "";
  // Measure it whole: no line limit while measuring.
  title.style.setProperty("-webkit-line-clamp", "unset");
  let size = parseFloat(getComputedStyle(title).fontSize);
  const lines = () => {
    const css = getComputedStyle(title);
    const text = title.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
    return text / parseFloat(css.lineHeight);
  };
  while (lines() > LINES + 0.2 && size > SMALLEST) {
    size = Math.max(SMALLEST, size - 2);
    title.style.fontSize = `${size}px`;
  }
  title.style.removeProperty("-webkit-line-clamp");
}

export function startTitleFit() {
  // Fitted for this title at this width.
  const done = new WeakMap<HTMLElement, string>();
  const check = () => {
    document.querySelectorAll<HTMLElement>(".hero__title").forEach((title) => {
      const key = `${title.textContent}|${title.parentElement?.clientWidth}|${window.innerWidth}`;
      if (done.get(title) === key) return;
      done.set(title, key);
      fit(title);
    });
  };
  let queued = 0;
  const later = () => {
    queued ||= requestAnimationFrame(() => {
      queued = 0;
      check();
    });
  };
  const changes = new MutationObserver(later);
  changes.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("resize", later);
  // Once the spooky font has arrived, measure again (it's wider than the one shown before it).
  document.fonts?.ready.then(() => {
    document.querySelectorAll<HTMLElement>(".hero__title").forEach((t) => done.delete(t));
    later();
  });
  check();
  return () => {
    changes.disconnect();
    cancelAnimationFrame(queued);
    window.removeEventListener("resize", later);
    document.querySelectorAll<HTMLElement>(".hero__title").forEach((t) => (t.style.fontSize = ""));
  };
}
