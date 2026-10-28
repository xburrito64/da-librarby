// A small frame counter in the corner, turned on and off with Ctrl+Shift+P: frames per second over
// the last second, missed frames since it was turned on, and the slowest frame lately. For noticing
// where something stutters while using the app.
import { calibrate, refreshInterval } from "./recorder";

let box: HTMLDivElement | null = null;
let frame = 0;

function start() {
  box = document.createElement("div");
  Object.assign(box.style, {
    position: "fixed",
    right: "8px",
    bottom: "8px",
    zIndex: "99999",
    padding: "4px 8px",
    font: "12px/1.35 ui-monospace, Consolas, monospace",
    color: "#fff",
    background: "rgba(0,0,0,0.7)",
    borderRadius: "4px",
    pointerEvents: "none",
    whiteSpace: "pre",
  });
  box.textContent = "measuring…";
  document.body.append(box);

  const recent: { t: number; d: number }[] = [];
  let missed = 0;
  let slots = 0;
  let last = 0;
  let shown = 0;
  calibrate().then(() => {
    const tick = (t: number) => {
      if (!box) return;
      if (last) {
        const d = t - last;
        const n = Math.max(1, Math.round(d / refreshInterval()));
        slots += n;
        missed += n - 1;
        recent.push({ t, d });
      }
      last = t;
      while (recent.length && recent[0].t < t - 5000) recent.shift();
      if (t - shown > 500) {
        shown = t;
        const second = recent.filter((r) => r.t > t - 1000);
        const worst = Math.max(0, ...recent.map((r) => r.d));
        box.textContent =
          `${second.length} fps  (screen ${Math.round(1000 / refreshInterval())} Hz)\n` +
          `missed ${((missed / Math.max(1, slots)) * 100).toFixed(2)}%  (${missed})\n` +
          `slowest ${worst.toFixed(1)} ms  (last 5 s)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });
}

function stop() {
  cancelAnimationFrame(frame);
  box?.remove();
  box = null;
}

/** Call once at startup. (Before everything else: the player's P stays out of it.) */
export function installMeter() {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (box) stop();
        else start();
      }
    },
    true,
  );
}
