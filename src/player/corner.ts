// The corner player: going back to the library while something plays keeps it playing in a
// small box in the bottom right. mpv draws the picture into that box (its video margins) and the
// library leaves a hole there to see it through.
import { useEffect, useState } from "react";
import { getSetting, setSetting } from "../ui/settings";

/** On unless turned off in Settings. */
export const CORNER_SETTING = "ui.cornerPlayer";
/** How wide the box was made last (CSS pixels). */
export const CORNER_WIDTH_SETTING = "ui.cornerWidth";
export const CORNER_DEFAULT_WIDTH = 420;
export const CORNER_MIN_WIDTH = 260;
/** Its gap to the window's edges, and its rounded corners. */
export const CORNER_MARGIN = 24;
export const CORNER_RADIUS = 12;

export interface CornerRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useCornerPlayerSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    getSetting<boolean>(CORNER_SETTING).then((v) => setOn(v !== false));
  }, []);
  return [
    on,
    (value: boolean) => {
      setOn(value);
      setSetting(CORNER_SETTING, value);
    },
  ];
}

/** The box for a video `aspect` wide per high, `width` wide if it fits the window. */
export function cornerRect(width: number, aspect: number, viewW: number, viewH: number): CornerRect {
  const maxW = Math.max(CORNER_MIN_WIDTH, Math.min(viewW * 0.6, (viewH * 0.6) * aspect));
  const w = Math.round(Math.max(CORNER_MIN_WIDTH, Math.min(width, maxW)));
  const h = Math.round(w / aspect);
  return { x: viewW - w - CORNER_MARGIN, y: viewH - h - CORNER_MARGIN, w, h };
}

/** Everything but the box, with rounded corners: a clip-path that lets the video show through. */
export function cornerHole(r: CornerRect, viewW: number, viewH: number) {
  const R = CORNER_RADIUS;
  const { x, y, w, h } = r;
  const hole =
    `M${x + R} ${y}H${x + w - R}A${R} ${R} 0 0 1 ${x + w} ${y + R}V${y + h - R}A${R} ${R} 0 0 1 ${x + w - R} ${y + h}` +
    `H${x + R}A${R} ${R} 0 0 1 ${x} ${y + h - R}V${y + R}A${R} ${R} 0 0 1 ${x + R} ${y}Z`;
  return `path(evenodd, "M0 0H${viewW}V${viewH}H0Z${hole}")`;
}
