// Hollow's Eve's scenes, drawn as vector pictures right in the page (so their pumpkins can glow when
// pointed at and the ghost can peek out): a pumpkin patch at night under the spotlight, with a
// haunted house on the hill and a misty valley beyond it, and a graveyard on show pages. Both are as wide as the window, with
// everything placed from the right; the left stays calm, for the text.
import { C, ghostShape } from "./art";
import { anyPumpkin, drawPumpkin, pumpkinDefs, type PumpkinSpec } from "./pumpkins";
import { faceTree, farTree, owlTree, spiralTree, swingTree } from "./trees";
import { tuft, type Lantern } from "./grass";
import { house } from "./house";
import { CUT_IN, underArt, type Spot } from "./under";

/** The scenes' height (px, as in hollow.css), and where the ground is. */
export const SCENE_H = 330;
/** Room above the scene for the moon's glow to fade out in (it reaches up past the scene's top). */
const HEAD = 150;
/** Opens a scene's picture: SCENE_H tall, with the room above it. */
const open = (w: number) => `<svg class="he-scene__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 ${-HEAD} ${w} ${SCENE_H + HEAD}" width="${w}" height="${SCENE_H + HEAD}">`;
/** Things are placed as on a 1440-wide scene, shifted to stay at the right. */
const DESIGN_W = 1440;

/** Same numbers every time, so the scene doesn't reshuffle. */
function random(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function defs(id: string) {
  return `<defs>
    <radialGradient id="${id}moon-glow"><stop offset="0" stop-color="#ffe4a3" stop-opacity="0.35"/><stop offset="0.45" stop-color="#ffb35c" stop-opacity="0.12"/><stop offset="1" stop-color="#ff8a2e" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}moon" cx="0.4" cy="0.38"><stop offset="0" stop-color="#fff2c9"/><stop offset="0.7" stop-color="#f6d98a"/><stop offset="1" stop-color="#e9b862"/></radialGradient>
    <radialGradient id="${id}fog"><stop offset="0" stop-color="#c8b4e6" stop-opacity="0.16"/><stop offset="1" stop-color="#c8b4e6" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}light"><stop offset="0" stop-color="#ff9a3c" stop-opacity="0.45"/><stop offset="1" stop-color="#ff7518" stop-opacity="0"/></radialGradient>
    ${pumpkinDefs(id)}
    <filter id="${id}glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
}

/** Pumpkins placed by hand: where (from the right), and who they are. */
type Placed = [x: number, y: number, spec: PumpkinSpec];

function pumpkins(id: string, r: number, list: Placed[], spots?: Spot[]) {
  const lanterns = list.filter(([, , p]) => p.face && !p.unlit);
  return list
    .map(([x, y, spec]) => {
      // Lit neighbours warm the side facing them: more the bigger and closer they are.
      const warm: [number, number] = [0, 0];
      for (const [lx, ly, l] of lanterns) {
        const gap = Math.abs(lx - x) - (l.size + spec.size) / 2;
        if (lx === x && ly === y) continue;
        const near = Math.max(0, 1 - Math.max(0, gap) / (l.size * 1.2)) * Math.min(1, l.size / 40);
        warm[lx < x ? 0 : 1] += near;
      }
      spots?.push({ x: r + x, size: spec.size, lit: !!spec.face && !spec.unlit });
      return drawPumpkin(id, r + x, y, spec, { warm: [Math.min(0.7, warm[0]), Math.min(0.7, warm[1])] });
    })
    .join("");
}

/** The patch's pumpkins, each one its own character. */
const PATCH: Placed[] = [
  [606, 296, { size: 13, palette: "pale", stem: "curly", squat: 0.78 }],
  [640, 300, { size: 9, palette: "orange", stem: "short", squat: 0.7, tilt: 8 }],
  [702, 300, { size: 24, face: "cute", palette: "ghost", stem: "short", squat: 0.8, tilt: -4 }],
  [772, 306, { size: 42, face: "classic", stem: "curly", extras: ["leaf"], squat: 0.8 }],
  [838, 300, { size: 27, palette: "deep", stem: "bent", squat: 0.66, extras: ["hat"], tilt: -3 }],
  [904, 302, { size: 30, face: "sleepy", palette: "pale", stem: "short", squat: 0.86, tilt: 6 }],
  [992, 314, { size: 62, face: "scary", palette: "deep", ribs: 7, stem: "tall", squat: 0.78 }],
  [1060, 302, { size: 30, face: "goofy", stem: "curly", squat: 1, tilt: -7 }],
  [1098, 300, { size: 11, palette: "pale", stem: "bent", squat: 0.8 }],
  [1112, 302, { size: 8, palette: "orange", stem: "short", squat: 0.72, tilt: -10 }],
  [1162, 310, { size: 46, face: "cyclops", palette: "orange", ribs: 7, stem: "short", squat: 0.92 }],
  [1236, 302, { size: 30, palette: "goblin", extras: ["warts", "crow"], stem: "tall", squat: 0.95, tilt: 4 }],
  [1290, 306, { size: 38, palette: "pale", stem: "short", squat: 0.62 }],
  [1290, 284, { size: 22, face: "surprised", stem: "curly", squat: 0.86, tilt: 3 }],
  [1356, 314, { size: 52, face: "wink", extras: ["candle"], stem: "short", squat: 0.8, tilt: -2 }],
  [1416, 304, { size: 30, face: "cat", palette: "deep", stem: "bent", squat: 0.84 }],
];

/** The graveyard's pumpkins. */
const GRAVEYARD: Placed[] = [
  [1178, 304, { size: 22, face: "sleepy", palette: "pale", stem: "curly", squat: 0.82 }],
  [1300, 308, { size: 46, face: "vampire", palette: "deep", ribs: 7, stem: "tall", squat: 0.82 }],
  [1342, 302, { size: 20, palette: "ghost", stem: "bent", squat: 0.74, extras: ["bow"] }],
  [1428, 308, { size: 30, face: "classic", stem: "short", squat: 0.8, tilt: -5 }],
];

function tombstone(x: number, y: number, w: number, h: number, kind: "round" | "cross", tilt = 0) {
  const fill = "#2c2238";
  const edge = "#4a3d5e";
  const shape =
    kind === "cross"
      ? `<path d="M${x - 3} ${y}v${-h}h-9v-7h9v-9h7v9h9v7h-9v${h}z" fill="${fill}" stroke="${edge}" stroke-width="1.2"/>`
      : `<path d="M${x - w / 2} ${y}v${-h + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0v${h - w / 2}z" fill="${fill}" stroke="${edge}" stroke-width="1.2"/>` +
        `<path d="M${x - w / 4} ${y - h + w / 2 + 6}h${w / 2}M${x - w / 5} ${y - h + w / 2 + 11}h${w / 2.5}" stroke="#1c1526" stroke-width="2" stroke-linecap="round"/>`;
  return `<g transform="rotate(${tilt} ${x} ${y})">${shape}</g>`;
}

function moon(id: string, x: number, y: number, r: number) {
  return (
    `<circle cx="${x}" cy="${y}" r="${r * 2.8}" fill="url(#${id}moon-glow)"/>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id}moon)"/>` +
    `<circle cx="${x - r * 0.28}" cy="${y - r * 0.24}" r="${r * 0.16}" fill="#e8c27a" opacity="0.5"/>` +
    `<circle cx="${x + r * 0.32}" cy="${y + r * 0.28}" r="${r * 0.22}" fill="#e8c27a" opacity="0.4"/>` +
    `<circle cx="${x + r * 0.24}" cy="${y - r * 0.4}" r="${r * 0.1}" fill="#e8c27a" opacity="0.45"/>`
  );
}

/** A bat in flight, about 34px across (scaled by `s`), wings flapping (hollow.css): scalloped
 *  wings with their finger bones, pointed ears, two glinting eyes, the moon catching its edges. */
function bat(x: number, y: number, s: number, cls: string) {
  const wing = (side: 1 | -1) => {
    const p = (px: number, py: number) => `${(px * side).toFixed(1)} ${py}`;
    return (
      `<g class="he-mb__wing he-mb__wing--${side < 0 ? "l" : "r"}">` +
      `<path d="M${p(1.2, -1.6)}C${p(5, -7)} ${p(11, -8.5)} ${p(17, -5)}Q${p(14.6, -2.6)} ${p(13.6, 0.8)}Q${p(11, -1.2)} ${p(8.6, 2)}Q${p(6, -0.2)} ${p(3.4, 2.6)}Q${p(2.2, 1)} ${p(1.2, 1.6)}Z"/>` +
      `<path d="M${p(1.6, -1.2)}L${p(13.6, 0.8)}M${p(5.4, -4.4)}L${p(8.6, 2)}M${p(3, -2)}L${p(3.4, 2.6)}" fill="none" stroke="#231a33" stroke-width="0.6"/></g>`
    );
  };
  return (
    `<g transform="translate(${x} ${y}) scale(${s})"><g class="he-mb ${cls}" fill="#0b0610" stroke="#43345f" stroke-width="0.5" stroke-linejoin="round">` +
    wing(-1) + wing(1) +
    `<ellipse cx="0" cy="1" rx="2.4" ry="4.2"/><circle cx="0" cy="-3.4" r="2.3"/>` +
    `<path d="M-1.9-4.6L-2.5-8.6L-0.5-5.6ZM1.9-4.6L2.5-8.6L0.5-5.6Z"/>` +
    `<g fill="#ffcf5a" stroke="none"><circle cx="-0.8" cy="-3.4" r="0.45"/><circle cx="0.8" cy="-3.4" r="0.45"/></g></g></g>`
  );
}

/** Two bats flitting about in front of the moon, one near, one further off. */
function moonBats(x: number, y: number) {
  // (Clear of the house's roof and weathervane, which stand in front of the moon's right side.)
  return bat(x - 34, y - 18, 1, "he-mb--near") + bat(x - 44, y + 34, 0.55, "he-mb--far");
}

/** The ghost hiding behind a tombstone (it peeks out now and then, see Decor.tsx). */
function ghost(x: number, y: number, s: number) {
  return `<g class="he-ghost"><g transform="translate(${x} ${y}) scale(${s})">${ghostShape()}</g></g>`;
}

/** The ground's top edge, gently rolling: its height at one point... */
function groundY(x: number, y: number, amp: number, phase: number) {
  return y + Math.sin(x / 180 + phase) * amp + Math.sin(x / 67 + phase * 2) * amp * 0.4;
}

/** ...the outline (a point every 60px, joined by straight lines)... */
function groundPath(w: number, y: number, amp: number, phase: number) {
  let d = `M0 ${SCENE_H}L0 ${y}`;
  for (let x = 0; x <= w; x += 60) d += `L${x} ${groundY(x, y, amp, phase).toFixed(1)}`;
  return `${d}L${w} ${SCENE_H}Z`;
}

/** How high a curve (one cubic Bézier: start, two pulls, end, as x, y pairs) is at x. */
function curveY(x: number, [x0, y0, x1, y1, x2, y2, x3, y3]: number[]) {
  const at = (t: number, a: number, b: number, c: number, d: number) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
  let best = 0;
  for (let t = 0; t <= 1; t += 0.002) if (Math.abs(at(t, x0, x1, x2, x3) - x) < Math.abs(at(best, x0, x1, x2, x3) - x)) best = t;
  return at(best, y0, y1, y2, y3);
}

/** ...and where something standing on it at x has its feet (a little way in, so it's planted). */
function groundAt(x: number, y: number, amp: number, phase: number, sink = 4) {
  const a = Math.floor(x / 60) * 60;
  const t = (x - a) / 60;
  return groundY(a, y, amp, phase) * (1 - t) + groundY(a + 60, y, amp, phase) * t + sink;
}

/** A hill in the valley, from the left edge to `to`, sinking out of sight at its right end. */
function ridge(to: number, y: number, amp: number, phase: number, fill: string) {
  const at = (x: number) => groundY(x, y, amp, phase) + Math.max(0, (x - (to - 220)) / 220) ** 2 * 60;
  let d = `M0 ${SCENE_H}`;
  for (let x = 0; x <= to; x += 30) d += `L${x} ${at(x).toFixed(1)}`;
  return { svg: `<path d="${d}L${to} ${SCENE_H}Z" fill="${fill}"/>`, at };
}

/** Little houses and maybe a church along a hill, a few windows lit. */
function village(rand: () => number, x0: number, count: number, church: boolean, ground: (x: number) => number) {
  let s = "";
  let windows = "";
  for (let i = 0; i < count; i++) {
    const x = x0 + i * 16 + rand() * 5 + (church && i > count / 2 ? 14 : 0);
    const w = 11 + rand() * 6;
    const h = 7 + rand() * 7;
    const y = ground(x + w / 2) + 2;
    s += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}v${(-h).toFixed(1)}l${(w / 2).toFixed(1)} -5l${(w / 2).toFixed(1)} 5v${h.toFixed(1)}z"/>`;
    if (rand() < 0.65) windows += `<rect class="${rand() < 0.3 ? "he-flicker he-flicker--slow" : ""}" x="${(x + w / 2 - 1.2).toFixed(1)}" y="${(y - h + 2).toFixed(1)}" width="2.4" height="2.4"/>`;
    if (church && i === Math.floor(count / 2)) {
      const cx = x + w + 3;
      const cy = ground(cx) + 2;
      s += `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)}v-24l5.5-17 5.5 17v24z"/>`;
      windows += `<rect x="${(cx + 4.2).toFixed(1)}" y="${(cy - 19).toFixed(1)}" width="2.6" height="4"/>`;
    }
  }
  return `<g fill="#0f0916">${s}</g><g fill="#ffbe57">${windows}</g>`;
}

/** Fog lying in the valley: soft bands drifting slowly. */
function valleyFog(id: string, to: number, y: number, slow: boolean) {
  let s = "";
  for (let x = -80; x < to + 80; x += 260) s += `<ellipse cx="${x + 130}" cy="${y + ((x / 260) % 2) * 5}" rx="200" ry="16" fill="url(#${id}fog)"/>`;
  return `<g class="he-valley-fog ${slow ? "he-valley-fog--slow" : ""}">${s}</g>`;
}

/** Left of the patch, past the edge of the hill it's on, the land falls away into a misty valley:
 *  hills behind hills, a village with a church and a few lit windows, and a path winding down to
 *  it from the patch, lanterns along the way. `to`: where the patch's hill begins. */
function valley(id: string, rand: () => number, to: number) {
  let s = "";
  const far = ridge(to + 160, 204, 7, 0.4, "#251a35");
  s += far.svg + valleyFog(id, to, 220, true);
  const mid = ridge(to + 60, 226, 6, 2.1, "#1d1429");
  s += mid.svg;
  s += village(rand, to * 0.4, 7, true, mid.at);
  if (to > 900) s += village(rand, to * 0.12, 4, false, mid.at);
  s += valleyFog(id, to, 242, false);
  // The path from the patch, down past the hill's edge and away to the village.
  const vx = to * 0.4 + 50;
  const path = `M${to - 10} 268C${to - 120} 262 ${to - 90} 248 ${to - 210} 246S${vx + 140} 236 ${vx + 30} ${mid.at(vx + 30) + 1}`;
  s += `<path d="${path}" stroke="#352850" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.85"/>`;
  // Lanterns along the stretch of it that can be seen, smaller the further away.
  const [ax, ay, bx, by] = [to - 210, 246, vx + 30, mid.at(vx + 30) + 1];
  for (const t of [0.12, 0.45, 0.75]) {
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t - 4;
    const k = 1 - t * 0.5;
    s += `<g class="${t === 0.45 ? "he-flicker" : ""}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(9 * k).toFixed(1)}" fill="url(#${id}light)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.5 * k).toFixed(1)}" fill="#ffc35a"/></g>`;
  }
  return { svg: s, mid };
}

/** A few small pumpkins and vines scattered over the wide middle of a wide window. */
function scattered(id: string, rand: () => number, from: number, to: number, y: number, spots?: Spot[]) {
  let s = "";
  for (let x = from + rand() * 80; x < to; x += 150 + rand() * 180) {
    const spec = anyPumpkin(rand, 12 + rand() * 18);
    spots?.push({ x, size: spec.size, lit: !!spec.face && !spec.unlit });
    s += drawPumpkin(id, x, y + rand() * 6, spec);
    s += `<path d="M${x - 30} ${y + 4}c10-6 20 4 30 0s20-6 30 0" stroke="${C.vine}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8"/>`;
  }
  return s;
}

/** The pumpkin patch under the spotlight. `spots`: gets where its pumpkins stand (for under.ts). */
export function patchScene(width: number, spots?: Spot[]) {
  const id = "hep-";
  const w = Math.max(1100, Math.ceil(width));
  const r = w - DESIGN_W;
  const rand = random(7);
  let s = `${open(w)}${defs(id)}`;
  s += moon(id, r + 1180, 78, 50) + moonBats(r + 1180, 78);
  // The valley on the left, then the patch's hill (falling away towards the valley), then the hill
  // with the house.
  const edge = r + 640;
  const vale = valley(id, rand, edge);
  s += vale.svg;
  const hill = [236, 10, 1] as const;
  const dip = (x: number) => Math.min(1, Math.max(0, (edge - x) / 280)) ** 1.5 * 40;
  let hillD = `M0 ${SCENE_H}`;
  for (let x = 0; x <= w; x += 30) hillD += `L${x} ${(groundY(x, ...hill) + dip(x)).toFixed(1)}`;
  s += `<path d="${hillD}L${w} ${SCENE_H}Z" fill="#1b1026"/>`;
  // The owl's tree, up on the house's hill: drawn before the hill, which hides the foot of its trunk
  // (so it grows out of the ground, wherever the slope is).
  const owlX = r + 1104;
  s += owlTree(owlX, curveY(owlX, [r + 930, 330, r + 990, 236, r + 1076, 176, r + 1186, 172]) + 12, 128);
  s += `<path d="M${r + 930} ${SCENE_H}C${r + 990} 236 ${r + 1076} 176 ${r + 1186} 172C${r + 1296} 168 ${r + 1384} 204 ${w} 220L${w} ${SCENE_H}Z" fill="#140b1d"/>`;
  // The haunted house (house.ts).
  s += house(id, r + 1190, 178);
  // Three trees with a personality of their own, and distant ones along the hills on a wide window.
  s += spiralTree(r + 1380, 216, 100) + swingTree(r + 884, groundAt(r + 884, ...hill, 6), 90);
  // (Those out in the valley are smaller, far away on its hills.)
  for (let x = 760, n = 1; x < r + 760; x += 260 + rand() * 200, n++) {
    const away = x < edge - 140;
    const sink = 3 + rand() * 6;
    s += farTree(x, away ? vale.mid.at(x) + 2 : groundAt(x, ...hill, sink) + dip(x), (46 + rand() * 30) * (away ? 0.5 : 1), n * 5);
  }
  // Tombstones, the ghost hiding behind the big one.
  s += ghost(r + 846, 228, 0.62);
  s += tombstone(r + 700, 262, 22, 34, "round", -4) + tombstone(r + 742, 258, 18, 28, "round", 6) + tombstone(r + 790, 262, 0, 26, "cross", -3);
  s += tombstone(r + 858, 258, 30, 40, "round", 0) + tombstone(r + 912, 262, 20, 30, "round", 9);
  // The crooked fence, with a black cat on it.
  let fence = `<g fill="#1f1529"><rect x="${r + 560}" y="246" width="${w - r - 560}" height="3"/><rect x="${r + 560}" y="258" width="${w - r - 560}" height="3"/>`;
  for (let x = r + 566; x < w; x += 17) {
    if (rand() < 0.08) continue;
    const t = (rand() - 0.5) * 10;
    const h = 24 + rand() * 6;
    fence += `<path transform="rotate(${t.toFixed(1)} ${x} 268)" d="M${x - 3} 268v${-h.toFixed(1)}l3-5 3 5v${h.toFixed(1)}z"/>`;
  }
  s += `${fence}</g>`;
  s += `<g transform="translate(${r + 626} 240)" class="he-cat">
    <path class="he-cat__tail" d="M11-3c10-2 14-10 10-18c-2-4 2-6 4-2c4 10-2 20-14 21z" fill="#07040a"/>
    <path d="M0 0c-2-10 0-18 4-22c-3-4-4-10-2-14l4 4c2-1 5-1 7 0l4-4c2 4 1 10-2 14c4 4 6 12 4 22z" fill="#07040a"/>
    <g class="he-cat__eyes" fill="${C.slime}" filter="url(#${id}glow)"><ellipse cx="5" cy="-27" rx="1.6" ry="1.2"/><ellipse cx="11" cy="-27" rx="1.6" ry="1.2"/></g>
  </g>`;
  // The ground in front, vines, and the pumpkin patch.
  s += `<path d="${groundPath(w, 270, 4, 3)}" fill="#120a17"/>`;
  s += `<g stroke="${C.vine}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.9"><path d="M${r + 740} 300C${r + 800} 290 ${r + 840} 312 ${r + 900} 300S${r + 1000} 290 ${r + 1060} 304S${r + 1200} 296 ${r + 1260} 306S${r + 1360} 300 ${w} 296"/><path d="M${r + 820} 300c6-8 14-6 12 2c-2 6-8 4-6-1"/><path d="M${r + 1010} 298c6-8 14-6 12 2c-2 6-8 4-6-1"/><path d="M${r + 1190} 302c6-8 14-6 12 2c-2 6-8 4-6-1"/></g>`;
  // The pumpkins, standing just behind where the ground is cut away (the top of under.ts's slice,
  // which carries on below the spotlight).
  const found: Spot[] = [];
  const patch = scattered(id, rand, 760, r + 560, 292, found) + pumpkins(id, r, PATCH, found);
  const cut = underArt(w, found);
  s += `<defs>${cut.defs}</defs><g transform="translate(0 ${SCENE_H - CUT_IN})">${cut.body}</g>`;
  // Grass: tufts along the back of the patch (still), the pumpkins, then tufts along the cut's edge
  // in front of them, swaying (in a layer of their own, so only they need redrawing as they move).
  const lanterns: Lantern[] = found.filter((p) => p.lit).map((p) => ({ x: p.x, y: 302, reach: p.size * 2.2 + 24 }));
  const grow = random(31);
  for (let x = grow() * 20; x < w; x += x < r + 560 ? 40 + grow() * 60 : 22 + grow() * 34) s += tuft(grow, x, 276 + grow() * 8, 6 + grow() * 6, "#0d0812", lanterns, false);
  s += patch;
  let front = "";
  for (let x = grow() * 10; x < w; x += grow() < 0.2 ? 36 + grow() * 60 : 8 + grow() * 16) front += tuft(grow, x, SCENE_H - CUT_IN + cut.edgeAt(x) + 1.5, 7 + grow() * 9, "#07040a", lanterns, true);
  spots?.push(...found);
  return `${s}</svg><svg class="he-scene__svg he-grass" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${SCENE_H}" width="${w}" height="${SCENE_H}">${front}</svg>`;
}

/** An iron fence with spiky posts. */
function ironFence(from: number, to: number, y: number) {
  let s = `<g stroke="#1d1526" stroke-width="2.2" fill="none"><path d="M${from} ${y - 18}H${to}M${from} ${y - 6}H${to}"/>`;
  for (let x = from; x <= to; x += 11) s += `<path d="M${x} ${y}V${y - 26}"/><path d="M${x - 2.5} ${y - 24}l2.5-5 2.5 5" fill="#1d1526" stroke-width="1"/>`;
  return `${s}</g>`;
}

/** The graveyard along the bottom of a show page's artwork, with a crypt on the right. */
export function graveyardScene(width: number) {
  const id = "heg-";
  const w = Math.max(1100, Math.ceil(width));
  const r = w - DESIGN_W;
  const rand = random(13);
  let s = `${open(w)}${defs(id)}`;
  s += moon(id, r + 1330, 70, 34);
  const hill = [238, 9, 2] as const;
  s += `<path d="${groundPath(w, ...hill)}" fill="#1b1026"/>`;
  for (let x = 700, n = 1; x < r + 1300; x += 220 + rand() * 220, n++) s += farTree(x, groundAt(x, ...hill, 3 + rand() * 6), 50 + rand() * 32, n * 7 + 3);
  s += faceTree(r + 1392, 270, 132);
  // The crypt: stone, a pointed roof, a door that glows (and sometimes has eyes in it).
  s += `<g transform="translate(${r + 1250} 264)">
    <path d="M-52 0V-70H52V0Z" fill="#231a2e" stroke="#3d3050" stroke-width="1.5"/>
    <path d="M-62-68L0-112L62-68Z" fill="#1a1222" stroke="#3d3050" stroke-width="1.5"/>
    <path d="M-6-112V-128M-12-122H0" stroke="#3d3050" stroke-width="3" stroke-linecap="round"/>
    <path d="M-58-68H58" stroke="#3d3050" stroke-width="4"/>
    <path d="M-16 0V-42A16 16 0 0 1 16-42V0Z" fill="#0a060d"/>
    <path d="M-16 0V-42A16 16 0 0 1 16-42V0Z" fill="none" stroke="#ff7518" stroke-opacity="0.35" stroke-width="2" filter="url(#${id}glow)"/>
    <g class="he-eyes" fill="${C.candle}" filter="url(#${id}glow)"><ellipse cx="-5" cy="-30" rx="2.2" ry="1.4"/><ellipse cx="5" cy="-30" rx="2.2" ry="1.4"/></g>
    <path d="M-44-50h18M-44-40h12M28-50h16M32-40h12" stroke="#2f2540" stroke-width="2"/>
  </g>`;
  // A lantern by the path.
  s += `<g transform="translate(${r + 1120} 270)"><circle cx="0" cy="-56" r="26" fill="url(#${id}light)"/><path d="M0 0V-48" stroke="#1d1526" stroke-width="3"/><rect x="-6" y="-62" width="12" height="14" rx="2" fill="${C.candle}" class="he-flicker" filter="url(#${id}glow)"/><path d="M-8-62h16l-8-7z" fill="#1d1526"/></g>`;
  s += ironFence(r + 560, r + 1070, 266);
  // Tombstones in rows, the ghost behind one.
  s += ghost(r + 906, 232, 0.6);
  const stones: [number, number, number, number, "round" | "cross", number][] = [
    [600, 268, 20, 30, "round", -5], [650, 266, 24, 36, "round", 3], [700, 268, 0, 26, "cross", 4], [760, 270, 18, 26, "round", -8],
    [820, 266, 22, 32, "round", 2], [918, 262, 30, 42, "round", 0], [976, 268, 0, 28, "cross", -6], [1030, 270, 20, 28, "round", 7],
  ];
  for (const [x, y, sw, sh, kind, t] of stones) s += tombstone(r + x, y, sw, sh, kind, t);
  // The path up to the crypt, and the ground.
  s += `<path d="${groundPath(w, 274, 3, 4)}" fill="#120a17"/>`;
  s += `<path d="M${r + 760} ${SCENE_H}C${r + 900} 300 ${r + 1100} 296 ${r + 1250} 266L${r + 1266} 266C${r + 1180} 300 ${r + 1000} 316 ${r + 880} ${SCENE_H}Z" fill="#221830" opacity="0.8"/>`;
  s += scattered(id, rand, 720, r + 560, 296);
  s += pumpkins(id, r, GRAVEYARD);
  return `${s}</svg>`;
}
