// Grass for the pumpkin patch, drawn like the rest of the scene: dark silhouettes, tufts of curved,
// tapering blades with a dry stalk or a seed head here and there. Near a jack-o'-lantern the blades
// catch its light along the side facing it; elsewhere the moon just touches their tops. See scene.ts (where it grows) and hollow.css (the
// tufts sway a little in the breeze).

/** A lit pumpkin, as the grass sees it: where, and how far its light reaches. */
export interface Lantern {
  x: number;
  y: number;
  reach: number;
}

const f = (n: number) => n.toFixed(1);

/** How much light falls on a spot from the lanterns (0 to 1), and from which side (-1 left, 1 right). */
function lightAt(x: number, y: number, lanterns: Lantern[]): [number, number] {
  let best = 0;
  let side = 0;
  for (const l of lanterns) {
    const k = 1 - Math.hypot(x - l.x, (y - l.y) * 2) / l.reach;
    if (k > best) {
      best = k;
      side = Math.sign(l.x - x) || 1;
    }
  }
  return [Math.min(1, best * 1.3), side];
}

/** One tuft standing at x, y, about `h` tall. `color`: its silhouette (paler further back). */
export function tuft(rand: () => number, x: number, y: number, h: number, color: string, lanterns: Lantern[], sway: boolean) {
  const [lit, side] = lightAt(x, y, lanterns);
  let dark = "";
  let rim = "";
  // The candlelight shows along the side of each blade facing the lantern: the blade again in
  // warm light, nudged that way, under the dark one.
  const nudge = side * 0.7;
  const blade = (bx: number, bh: number, lean: number, bend: number, wd: number) => {
    const tip = [bx + lean, y - bh];
    const d = `M${f(bx - wd)} ${f(y)}Q${f(bx - wd * 0.4 + lean * 0.35)} ${f(y - bh * 0.55)} ${f(tip[0])} ${f(tip[1])}Q${f(bx + wd * 0.5 + lean * 0.35 + bend)} ${f(y - bh * 0.5)} ${f(bx + wd)} ${f(y)}Z`;
    dark += `<path d="${d}"/>`;
    rim += `<path d="${d}" transform="translate(${f(nudge)} -0.3)"/>`;
  };
  const n = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const bh = h * (0.55 + rand() * 0.5) * (1 - Math.abs(t) * 0.5);
    blade(x + t * h * 0.35 + (rand() - 0.5) * 1.5, bh, t * h * 0.9 + (rand() - 0.5) * h * 0.3, (rand() - 0.5) * 2, 0.7 + rand() * 0.6);
  }
  // Now and then a dry stalk with a seed head, or a wispy one with seeds hanging off it.
  let stalk = "";
  if (rand() < 0.3) {
    const sh = h * (1.2 + rand() * 0.5);
    const lean = (rand() - 0.5) * h * 0.4;
    const top: [number, number] = [x + lean, y - sh];
    stalk += `<path d="M${f(x)} ${f(y)}Q${f(x + lean * 0.2)} ${f(y - sh * 0.6)} ${f(top[0])} ${f(top[1])}" stroke-width="0.9" fill="none"/>`;
    if (rand() < 0.5)
      // Like an oat: little seeds alternating down the top of it.
      for (let i = 0; i < 5; i++) {
        const sy = top[1] + i * 2.2;
        const sx = top[0] - lean * 0.06 * i + (i % 2 ? 1.6 : -1.6);
        stalk += `<ellipse cx="${f(sx)}" cy="${f(sy)}" rx="0.9" ry="1.8" transform="rotate(${i % 2 ? 30 : -30} ${f(sx)} ${f(sy)})" stroke="none"/>`;
      }
    else stalk += `<ellipse cx="${f(top[0])}" cy="${f(top[1] + 2)}" rx="1.3" ry="3.2" transform="rotate(${f(lean)} ${f(top[0])} ${f(top[1] + 2)})" stroke="none"/>`;
  }
  // Away from the lanterns the moon (up on the right) just catches their tops.
  const moon = lit < 0.35 ? `<g fill="#6f5c94" stroke="#6f5c94" stroke-width="0" opacity="${f(0.55 * (1 - lit / 0.35))}" transform="translate(0.5 -0.5)">${dark}${stalk}</g>` : "";
  const warm = lit > 0.05 ? `<g fill="#ffa64a" stroke="#ffa64a" stroke-width="0" opacity="${f(lit * 0.9)}">${rim}${stalk ? `<g transform="translate(${f(nudge)} -0.3)">${stalk}</g>` : ""}</g>` : "";
  const style = sway ? ` style="animation-delay:${f(-rand() * 6)}s;animation-duration:${f(4 + rand() * 3)}s"` : "";
  return `<g class="${sway ? "he-tuft" : ""}"${style}>${moon}${warm}<g fill="${color}" stroke="${color}" stroke-width="0">${dark}${stalk}</g></g>`;
}
