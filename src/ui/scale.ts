// Interface size: the whole app is zoomed with the webview's own zoom, so everything (text,
// pictures, the pixel art) grows together. It grows with the window by itself (the design is made
// for about 1440 px across) unless that's turned off, times the size picked in Settings.
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getSetting, setSetting } from "./settings";

const SIZE_SETTING = "ui.scale";
const AUTO_SETTING = "ui.scaleAuto";
/** The width the interface is made for, and how much bigger than that it grows at most. */
const DESIGN_WIDTH = 1440;
const MAX_GROW = 1.6;

let applied = 1;
let percent = 100;
let auto = true;
let timer = 0;

function target() {
  // The window's width as it would be at 100%.
  const width = window.innerWidth * applied;
  const grow = auto ? Math.min(MAX_GROW, Math.max(1, width / DESIGN_WIDTH)) : 1;
  // In steps of 5%, so resizing doesn't keep nudging it.
  return Math.round(grow * (percent / 100) * 20) / 20;
}

function apply() {
  const zoom = target();
  if (Math.abs(zoom - applied) < 0.001) return;
  applied = zoom;
  getCurrentWebview()
    .setZoom(zoom)
    .catch(() => {});
}

export async function initScale() {
  percent = (await getSetting<number>(SIZE_SETTING)) ?? 100;
  auto = (await getSetting<boolean>(AUTO_SETTING)) !== false;
  apply();
  window.addEventListener("resize", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(apply, 200);
  });
}

export function scaleSettings() {
  return { percent, auto };
}

export function setScale(next: { percent?: number; auto?: boolean }) {
  if (next.percent != null) {
    percent = next.percent;
    setSetting(SIZE_SETTING, percent);
  }
  if (next.auto != null) {
    auto = next.auto;
    setSetting(AUTO_SETTING, auto);
  }
  apply();
}
