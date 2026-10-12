// Hollow's Eve's scenes, drawn as vector pictures right in the page (so their pumpkins can glow when
// pointed at and the ghost can peek out): a pumpkin patch at night under the spotlight, with a
// haunted house on the hill and a misty valley beyond it, and a graveyard on show pages. Both are as wide as the window, with
// everything placed from the right; the left stays calm, for the text.
import { C, ghostShape } from "./art";
import { anyPumpkin, drawPumpkin, pumpkinDefs, type PumpkinSpec } from "./pumpkins";
import { faceTree, farTree, owlTree, spiralTree, swingTree } from "./trees";
import { tuft, type Lantern } from "./grass";
import { house } from "./house";
import { tombstone, type Stone } from "./tombstones";
import { tomb } from "./tomb";
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

/** The ghost hiding behind the big gothic tombstone standing at x, foot (`h` tall, as tombstones.ts
 *  draws it): tucked away just under the stone's point, and rising far enough to show most of itself
 *  above it when it peeks out (see scenes.ts). */
function ghostBehind(x: number, foot: number, h: number) {
  const s = 0.7;
  // The gothic stone's point is 45 of its 36 units up; the ghost's body is 40 tall, 2 down its box.
  const k = h / 36;
  const top = foot - 36 * k;
  const rise = 9 * k + 0.65 * 40 * s;
  return `<g class="he-ghost" style="--he-peek: ${(-rise).toFixed(1)}px"><g transform="translate(${(x - 21 * s).toFixed(1)} ${(top - 2 * s).toFixed(1)}) scale(${s})">${ghostShape()}</g></g>`;
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
 *  a low hill under the open sky, a village with a church and a few lit windows, and a path winding down to
 *  it from the patch, lanterns along the way. `to`: where the patch's hill begins. */
function valley(id: string, rand: () => number, to: number) {
  let s = valleyFog(id, to, 220, true);
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
  // The patch's crooked wooden fence, up on its hill.
  let fence = `<g fill="#1f1529"><rect x="${r + 660}" y="246" width="${w - r - 660}" height="3"/><rect x="${r + 660}" y="258" width="${w - r - 660}" height="3"/>`;
  for (let x = r + 666; x < w; x += 17) {
    if (rand() < 0.08) continue;
    const t = (rand() - 0.5) * 10;
    const h = 24 + rand() * 6;
    fence += `<path transform="rotate(${t.toFixed(1)} ${x} 268)" d="M${x - 3} 268v${-h.toFixed(1)}l3-5 3 5v${h.toFixed(1)}z"/>`;
  }
  s += `${fence}</g>`;
  // The ground in front, vines, and the pumpkin patch.
  s += `<path d="${groundPath(w, 270, 4, 3)}" fill="#120a17"/>`;
  // On the left, where the land starts falling away into the valley, the old cemetery.
  const yard = { to: edge - 30 };
  s += cemetery(id, yard.to);
  s += `<g stroke="${C.vine}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.9"><path d="M${r + 740} 300C${r + 800} 290 ${r + 840} 312 ${r + 900} 300S${r + 1000} 290 ${r + 1060} 304S${r + 1200} 296 ${r + 1260} 306S${r + 1360} 300 ${w} 296"/><path d="M${r + 820} 300c6-8 14-6 12 2c-2 6-8 4-6-1"/><path d="M${r + 1010} 298c6-8 14-6 12 2c-2 6-8 4-6-1"/><path d="M${r + 1190} 302c6-8 14-6 12 2c-2 6-8 4-6-1"/></g>`;
  // The pumpkins, standing just behind where the ground is cut away (the top of under.ts's slice,
  // which carries on below the spotlight).
  const found: Spot[] = [];
  const patch = scattered(id, rand, Math.max(760, yard.to + 60), r + 560, 292, found) + pumpkins(id, r, PATCH, found);
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

/** The old cemetery left of the patch, reaching from the window's left edge to `to`: an iron fence
 *  along its back with a wide arched gate at the patch end (a lantern on it, the black cat on a
 *  pillar), the path leading out of the gate towards the patch, and the tombstones in two staggered
 *  rows (the back row smaller and dimmer), each its own (tombstones.ts), as far as the window
 *  goes. The ghost hides behind the big one. */
function cemetery(id: string, to: number) {
  const gate = to - 26;
  /** Half the gate's width, pillar to pillar. */
  const G = 24;
  const L = gate - G + 4;
  const R = gate + G - 4;
  let s = "";
  // The path, leading out of the gate's opening and down towards the patch, wider as it nears.
  s += `<path d="M${L} 278C${L + 2} 296 ${gate + 40} 312 ${to + 150} 314L${to + 150} 302C${gate + 60} 300 ${R + 4} 292 ${R} 278Z" fill="#221830" opacity="0.75"/>`;
  // The fence along the back, from beyond the window's left edge up to the gate.
  s += ironFence(-12, gate - G - 4, 276);
  // The gate: two stone pillars with flat capstones (moss on them, ivy up the cat's), an iron arch
  // over the way in, the left door shut, the right one swung open.
  const pillar = (x: number, ivy: boolean) =>
    `<rect x="${x - 4}" y="243" width="8" height="35" fill="#2c2238" stroke="#4a3d5e" stroke-width="1"/>` +
    `<path d="M${x - 4} 252h8M${x - 4} 262h8M${x - 4} 271h8M${x} 243v9M${x - 2} 252v10M${x + 1.5} 262v9" stroke="#221a2c" stroke-width="0.6"/>` +
    `<rect x="${x - 6}" y="240" width="12" height="3.4" fill="#2c2238" stroke="#4a3d5e" stroke-width="1"/>` +
    `<path d="M${x - 9.5} 240.2V237.6Q${x - 9.5} 236.6 ${x - 8.5} 236.6H${x + 8.5}Q${x + 9.5} 236.6 ${x + 9.5} 237.6V240.2Z" fill="#2c2238" stroke="#4a3d5e" stroke-width="1"/>` +
    `<path d="M${x - 9.5} 238.4Q${x - 7} 236.4 ${x - 4} 237Q${x - 6} 238.6 ${x - 9.5} 239.6Z" fill="#33402a"/><path d="M${x + 5} 236.8Q${x + 8} 236.4 ${x + 9.5} 237.8L${x + 9.5} 238.6Q${x + 7} 237.6 ${x + 5} 236.8Z" fill="#33402a"/>` +
    (ivy
      ? `<path d="M${x + 3} 278C${x + 5} 272 ${x + 1} 268 ${x + 3.4} 262C${x + 5} 258 ${x + 2} 254 ${x + 4} 249" stroke="#2f4a26" stroke-width="0.8" fill="none"/>` +
        [[3.6, 274, 30], [1.8, 268, -30], [4.2, 261, 30], [2.6, 255, -30], [4.4, 250, 30]].map(([dx, ly, r]) => `<ellipse cx="${x + dx}" cy="${ly}" rx="1.8" ry="1.1" transform="rotate(${r} ${x + dx} ${ly})" fill="#3a5a2e"/>`).join("")
      : "");
  s += `<path d="M${L} 248Q${gate} 224 ${R} 248" stroke="#1d1526" stroke-width="2.2" fill="none"/><path d="M${L + 5} 251Q${gate} 232 ${R - 5} 251" stroke="#1d1526" stroke-width="1" fill="none"/><path d="M${gate - 10} 240l0-5M${gate} 237l0-7M${gate + 10} 240l0-5" stroke="#1d1526" stroke-width="1.4"/>`;
  s +=
    `<g stroke="#1d1526" stroke-width="1.4" fill="none"><path d="M${L} 277V252L${gate - 1} 255V277M${L} 261H${gate - 1}M${L} 270H${gate - 1}M${L + 5} 252.6V277M${L + 10} 253.4V277M${L + 15} 254.2V277"/>` +
    `<path d="M${R} 277V252L${R + 11} 257V281M${R} 261L${R + 11} 265M${R} 270L${R + 11} 274M${R + 5.5} 254.5V279"/></g>`;
  s += pillar(gate - G, true) + pillar(gate + G, false);
  // A lantern hanging from the right pillar.
  s += `<g transform="translate(${gate + G + 6} 246)"><circle cx="0" cy="6" r="18" fill="url(#${id}light)"/><path d="M-6-2H0V2" stroke="#1d1526" stroke-width="1.4" fill="none"/><rect x="-3" y="2" width="6" height="8" rx="1" fill="${C.candle}" class="he-flicker" filter="url(#${id}glow)"/><path d="M-4 2h8l-4-4z" fill="#1d1526"/></g>`;
  // The black cat, sitting on the left pillar (cat.ts brings it to life).
  s += blackCat(id, gate - G, 236.6);
  // The stones, by how far left of `to` they stand. Nearest the gate, the first seven (as before);
  // beyond them, more at the same spacing, alternating rows, as far as the window goes, each one
  // different from its neighbours.
  type Grave = { d: number; front: boolean; kind: Stone; h: number; tilt: number };
  const graves: Grave[] = [
    { d: 166, front: false, kind: "heart", h: 27, tilt: -3 },
    { d: 222, front: true, kind: "candle", h: 34, tilt: 5 },
    { d: 265, front: false, kind: "cat", h: 34, tilt: -4 },
    { d: 321, front: true, kind: "gothic", h: 48, tilt: 0 },
    { d: 364, front: false, kind: "rip", h: 34, tilt: 2 },
    { d: 420, front: true, kind: "broken", h: 32, tilt: 3 },
    { d: 463, front: false, kind: "ivyCross", h: 35, tilt: -6 },
  ];
  const HEIGHT: Partial<Record<Stone, number>> = { obelisk: 44, urn: 40, column: 40, heart: 27, slab: 30, plain: 30, twin: 32 };
  const pool: Stone[] = ["obelisk", "angel", "twin", "celtic", "slab", "urn", "moon", "wooden", "plain", "column", "candle", "heart", "ivyCross", "cat", "broken", "rip"];
  const rand = random(61);
  let bag: Stone[] = [];
  for (let d = 463, front = true; to - d > -20; front = !front) {
    d += front ? 56 : 43;
    if (bag.length < 4) bag = bag.concat([...pool].sort(() => rand() - 0.5));
    const recent = graves.slice(-4).map((g) => g.kind);
    const kind = bag.splice(Math.max(0, bag.findIndex((k) => !recent.includes(k))), 1)[0];
    graves.push({ d: d + (rand() - 0.5) * 8, front, kind, h: (HEIGHT[kind] ?? 34) * (0.92 + rand() * 0.14), tilt: (rand() - 0.5) * 12 });
  }
  // (The back row first, so the front row stands in front of it.)
  [...graves]
    .sort((a, b) => Number(a.front) - Number(b.front))
    .forEach(({ d, front, kind, h, tilt }, i) => {
      const x = to - d;
      if (x < -20) return;
      if (kind === "gothic") s += ghostBehind(x, front ? 303 : 285, front ? h : h * 0.88);
      const stone = tombstone(kind, x, front ? 303 : 285, front ? h : h * 0.88, tilt, id, i);
      s += front ? stone : `<g opacity="0.88">${stone}</g>`;
    });
  return s;
}

/** The black cat on the gate's left pillar, sitting up on its capstone at x, y: a round haunch, its
 *  chest, two front legs, its tail curled round in front of its paws, a thin edge of moonlight
 *  (the moon is off to the right) and the lantern's warmth on its chest. In parts that can move
 *  (cat.ts, hollow.css): it breathes, its head turns and tilts, an ear flicks, its eyes follow
 *  things, it yawns, licks a paw (a front leg hidden in its chest comes up), flicks the tip of its
 *  tail. And drawn walking, for when it hops down and strolls along the fence (`he-cat-walk`, with
 *  where it sits and where the fence's top rail is). */
function blackCat(id: string, x: number, y: number) {
  const INK = "#07040a";
  const S = 1.12;
  const BODY = "M-11.5 0.3C-14 -5 -12.5 -12 -7 -15C-5.5 -17.5 -5.6 -20.6 -4.4 -22.8L5.4 -23C6.6 -19 7 -14 6.4 -8C6.1 -5 6.4 -2 7.4 -0.6C7.9 0.4 7.4 1.1 6 1.1L-11.5 0.6Z";
  const HEAD = "M-4.8 -23.4C-6.6 -25.4 -6.9 -28.6 -5.8 -31.2C-4.4 -33.9 -1.6 -34.6 0.9 -34.6C3.4 -34.6 6 -33.9 7.2 -31.2C8 -28.8 7.6 -25.6 5.8 -23.6L6.6 -22.5L5.1 -22.1C3.4 -21 -2.6 -21 -4.8 -23.4Z";
  const eye = (cx: number, r: number) => `<ellipse cx="${cx}" cy="-28.4" rx="1.55" ry="1.15" transform="rotate(${r} ${cx} -28.4)"/>`;
  const defs =
    `<defs><filter id="${id}catrim" x="-30%" y="-30%" width="160%" height="160%"><feOffset in="SourceAlpha" dx="0.7" dy="-0.45" result="o"/><feFlood flood-color="#6a5288"/><feComposite in2="o" operator="in" result="rim"/><feMerge><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<clipPath id="${id}catchest"><path d="${BODY}"/></clipPath>` +
    `<radialGradient id="${id}catwarm"><stop offset="0" stop-color="#ff9a3c" stop-opacity="0.32"/><stop offset="1" stop-color="#ff7518" stop-opacity="0"/></radialGradient></defs>`;
  const head =
    `<g class="he-cat__head"><g class="he-cat__turn">` +
    `<g class="he-cat__ear he-cat__ear--l"><path d="M-5.9 -30.2L-6.4 -37.6L-1.6 -33.9Z" fill="${INK}"/><path d="M-5.3 -35.4L-2.9 -33.6L-4.9 -32.4Z" fill="#3a1f3c"/></g>` +
    `<g class="he-cat__ear he-cat__ear--r"><path d="M3.4 -33.9L7 -37.9L7.1 -30.2Z" fill="${INK}"/><path d="M6.2 -35.8L4.2 -33.6L6 -32.4Z" fill="#3a1f3c"/></g>` +
    `<path d="${HEAD}" fill="${INK}"/>` +
    `<g class="he-cat__eyes"><g class="he-cat__glow" fill="${C.slime}" filter="url(#${id}glow)"><rect x="-4" y="-31" width="10.4" height="5.4" fill="none"/>${eye(-1.5, 10)}${eye(3.7, -10)}</g>` +
    `<g class="he-cat__look" fill="${INK}"><ellipse cx="-1.5" cy="-28.4" rx="0.38" ry="0.95"/><ellipse cx="3.7" cy="-28.4" rx="0.38" ry="0.95"/></g></g>` +
    `<path class="he-cat__happy" d="M-3 -28q1.5-1.8 3 0M2.2 -28q1.5-1.8 3 0" stroke="${C.slime}" stroke-width="0.7" fill="none" stroke-linecap="round" filter="url(#${id}glow)"/>` +
    `<path d="M0.45 -26.3h1.3l-0.65 0.7z" fill="#5a2a4a"/>` +
    `<g class="he-cat__mouth"><ellipse cx="1.1" cy="-24" rx="1.15" ry="1.45" fill="#2a0f1e"/><ellipse cx="1.1" cy="-23.3" rx="0.75" ry="0.55" fill="#d9708a"/></g>` +
    `<ellipse class="he-cat__tongue" cx="1.1" cy="-24.4" rx="0.6" ry="0.45" fill="#d9708a"/>` +
    `<g stroke="#8a74b8" stroke-width="0.28" opacity="0.6" fill="none"><path d="M-1.3 -25.6L-6.4 -26.4M-1.3 -24.9L-6.3 -24.4M3.5 -25.6L8.6 -26.4M3.5 -24.9L8.5 -24.4"/></g>` +
    `</g></g>`;
  const sitting =
    `<g class="he-cat__sit"><g class="he-cat__breath">` +
    `<path class="he-cat__body" d="${BODY}" fill="${INK}"/>` +
    `<g clip-path="url(#${id}catchest)"><ellipse cx="14" cy="-12" rx="12" ry="16" fill="url(#${id}catwarm)"/></g>` +
    `<path d="M2.4 -7.5C2.2 -4 2.6 -1.4 2.4 0.8M-7.5 -13.5C-10 -10 -10 -5 -7.6 -2" stroke="#1d1426" stroke-width="0.5" fill="none"/>` +
    head +
    // (In front of its face when it comes up, a faint edge so it shows against its chest.)
    `<path class="he-cat__paw" d="M4 -8.6C5.4 -13.4 5.2 -18.4 3.2 -22C2.6 -23.6 0.4 -23.6 0.1 -22C0.6 -18 1.4 -13.4 0.6 -8.6Z" fill="${INK}" stroke="#3a2d4a" stroke-width="0.35"/>` +
    `</g>` +
    `<path d="M-10.6 0C-6 1.8 1 2 7.2 0.8" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `<path class="he-cat__tip" d="M7.2 0.8C9.6 0.3 10.6 -1.2 9.8 -2.6" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `</g>`;
  // Walking (facing left), its legs in two sets that step in turn.
  const walking =
    `<g class="he-cat-walk" filter="url(#${id}catrim)" data-x="${x}" data-y="${y}" data-rail="258" transform="translate(${x} ${y}) scale(${S})">` +
    `<path class="he-cat-walk__tail" d="M8.8 -9.6C12 -10 13.4 -13 12.6 -16.4C12.2 -18 13.6 -18.6 14 -17.4" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<g stroke="${INK}" stroke-width="1.6" stroke-linecap="round"><path class="he-cat-walk__step-a" d="M-5 -5.5V0M7.2 -5.5V0"/><path class="he-cat-walk__step-b" d="M-3.2 -5.5V0M5.4 -5.5V0"/></g>` +
    `<path d="M-14.2 -11.2C-14.6 -13.4 -13.6 -14.6 -13.4 -15L-13.8 -18.8L-11.4 -16C-10.6 -16.3 -9.6 -16.2 -8.9 -15.8L-8.2 -19L-7.3 -14.4C-6.6 -13.2 -6.6 -12.2 -6.4 -11.2C-2 -12.6 5 -12.4 8.6 -10.4C10.8 -9 10.8 -6 9.2 -4.6C6 -3.6 -3 -3.6 -6.2 -4.8C-8.4 -5.8 -9.6 -7.2 -10.2 -8.6C-12.2 -8.8 -13.8 -9.6 -14.2 -11.2Z" fill="${INK}"/>` +
    `<ellipse cx="-12" cy="-12.4" rx="0.95" ry="0.7" fill="${C.slime}" filter="url(#${id}glow)"/>` +
    `</g>`;
  return `${defs}<g class="he-cat" filter="url(#${id}catrim)" transform="translate(${x} ${y}) scale(${S})">${sitting}</g>${walking}`;
}

/** An iron fence with spiky posts. */
function ironFence(from: number, to: number, y: number) {
  let s = `<g stroke="#1d1526" stroke-width="2.2" fill="none"><path d="M${from} ${y - 18}H${to}M${from} ${y - 6}H${to}"/>`;
  for (let x = from; x <= to; x += 11) s += `<path d="M${x} ${y}V${y - 26}"/><path d="M${x - 2.5} ${y - 24}l2.5-5 2.5 5" fill="#1d1526" stroke-width="1"/>`;
  return `${s}</g>`;
}

/** The graveyard along the bottom of a show page's artwork, with a family tomb on the right. */
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
  // The family tomb at the end of the path (tomb.ts).
  s += tomb(id, r + 1250, 264, 0.95);
  // A lantern by the path.
  s += `<g transform="translate(${r + 1120} 270)"><circle cx="0" cy="-56" r="26" fill="url(#${id}light)"/><path d="M0 0V-48" stroke="#1d1526" stroke-width="3"/><rect x="-6" y="-62" width="12" height="14" rx="2" fill="${C.candle}" class="he-flicker" filter="url(#${id}glow)"/><path d="M-8-62h16l-8-7z" fill="#1d1526"/></g>`;
  s += ironFence(r + 560, r + 1070, 266);
  // The path up to the tomb, and the ground.
  s += `<path d="${groundPath(w, 274, 3, 4)}" fill="#120a17"/>`;
  s += `<path d="M${r + 760} ${SCENE_H}C${r + 900} 300 ${r + 1100} 296 ${r + 1250} 266L${r + 1266} 266C${r + 1180} 300 ${r + 1000} 316 ${r + 880} ${SCENE_H}Z" fill="#221830" opacity="0.8"/>`;
  // The tombstones, in the grass in front, left of the path: two loose rows (the nearer ones lower
  // and a little bigger), the ghost behind the big one. Spread over what room the window leaves.
  const from = Math.max(70, r + 300);
  const to = r + 770;
  const stones: [number, number, Stone, number, number][] = [
    [0, 298, "obelisk", 42, -3], [0.13, 316, "angel", 38, 2], [0.27, 299, "celtic", 36, 4], [0.42, 317, "gothic", 48, 0],
    [0.56, 300, "moon", 34, 2], [0.69, 318, "slab", 33, -1], [0.83, 301, "wooden", 34, -7], [0.97, 314, "heart", 28, 5],
  ];
  const at = (t: number) => from + (to - from) * t;
  s += ghostBehind(at(0.42), 317, 48);
  stones.forEach(([t, y, kind, h, tilt], i) => (s += tombstone(kind, at(t), y, h, tilt, id, i)));
  // (A few small pumpkins further left, on a wide window.)
  s += scattered(id, rand, 720, from - 40, 300);
  s += pumpkins(id, r, GRAVEYARD);
  return `${s}</svg>`;
}
