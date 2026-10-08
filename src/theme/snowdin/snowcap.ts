// Snow lying along a top edge, in pixel art: columns of snow (2 screen pixels each) with soft
// rounded mounds, ends that taper off, and little runs of icicles hanging over the edge. Each
// `seed` gives its own shape (the town sign's, every cover's). Drawn on a small canvas and used
// as a background image (8 snow pixels = 16 px tall, as in snowdin.css).

/** Screen pixels per snow pixel, and the cap's height in snow pixels. */
export const PX = 2;
const ROWS = 8;
/** Snow pixels above the edge; the rows below hang over it. */
export const BASE = 6;
const SNOW = "#eef4ff";
const SHADE = "#c9d9f0";

/** The same "random" numbers every time for the same seed, so a shape never changes by itself. */
export function noise(n: number, seed = 0) {
  const x = Math.sin((n + seed * 7919.37) * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export interface Cap {
  /** Each column's height when all the snow is there (1 to 6). */
  full: number[];
  /** Icicles under each column (0 to 2 pixels). */
  drips: number[];
  seed: number;
}

/** A layer 4 pixels deep with rounded domes of snow on it, here and there a dip, rounded off
 *  at both ends. */
export function makeCap(columns: number, seed = 0): Cap {
  const lift = new Array(columns).fill(0);
  for (let at = 2 + Math.floor(noise(1, seed) * 6), i = 0; at < columns; i++) {
    const radius = 3 + noise(i + 10, seed) * 5;
    const height = noise(i + 20, seed) < 0.2 ? -1 : 1 + Math.round(noise(i + 30, seed));
    for (let x = Math.floor(at - radius); x <= at + radius; x++) {
      const d = Math.abs(x - at) / radius;
      if (x >= 0 && x < columns && d < 1)
        lift[x] = height < 0 ? Math.min(lift[x], -1) : Math.max(lift[x], Math.round(height * Math.sqrt(1 - d * d) + 0.2));
    }
    at += radius * 2 + 2 + Math.floor(noise(i + 40, seed) * 8);
  }
  // Covers' piles lean a little: more snow blown to one side (the sign's lies even).
  const lean = seed === 0 ? 0 : (noise(500, seed) * 2 - 1) * 1.6;
  const full = lift.map((l, x) => {
    const end = Math.min(x, columns - 1 - x);
    const rounded = [2, 3, 4][end] ?? 9;
    const drift = Math.round(lean * (x / Math.max(1, columns - 1) - 0.5) * 2);
    return Math.max(1, Math.min(6, 4 + l + drift, rounded));
  });
  const drips = new Array(columns).fill(0);
  for (let x = 3; x < columns - 3; ) {
    const run = 2 + Math.floor(noise(x + 100, seed) * 3);
    for (let i = 0; i < run && x + i < columns - 2; i++)
      drips[x + i] = i === 0 || i === run - 1 ? 1 : 1 + Math.round(noise(x + i + 200, seed));
    x += run + 4 + Math.floor(noise(x + 300, seed) * 6);
  }
  return { full, drips, seed };
}

/** The cap with each column at `heights` (its full snow when left out), as an image URL. */
export function drawCap(cap: Cap, heights = cap.full): string {
  const canvas = document.createElement("canvas");
  canvas.width = heights.length;
  canvas.height = ROWS;
  const c = canvas.getContext("2d");
  if (!c) return "";
  heights.forEach((h, x) => {
    if (h <= 0) return;
    c.fillStyle = SNOW;
    c.fillRect(x, BASE - h, 1, h);
    // A little shade underneath, and icicles over the edge where the snow lies thick.
    if (noise(x + 400, cap.seed) < 0.1) {
      c.fillStyle = SHADE;
      c.fillRect(x, BASE - 1, 1, 1);
    }
    const drip = h >= 3 ? cap.drips[x] : 0;
    if (drip > 0) {
      c.fillStyle = drip > 1 ? SNOW : SHADE;
      c.fillRect(x, BASE, 1, 1);
      if (drip > 1) {
        c.fillStyle = SHADE;
        c.fillRect(x, BASE + 1, 1, 1);
      }
    }
  });
  return canvas.toDataURL();
}
