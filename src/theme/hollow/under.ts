// Under the pumpkin patch: the ground is cut away like a slice of earth lifted out with a spade, so
// you can see into it under the library's rows. The cut has a ragged edge with grass hanging over
// it, warm where the jack-o'-lanterns' light spills over. Below are layers of drawn earth, each
// shading darker towards its bottom, with broken lines where it settled and specks here and there:
// topsoil with the patch's roots and worms going about their business; red clay with a skeleton
// asleep in its grave, a mole asleep in its den, someone's candy stash in an old tin, a worm asleep
// in its chamber, old bones, a lost key and little lost things; then stones with an old coffin,
// purple crystals and fossils. What's buried lies in hollows in the earth, partly covered. Some of
// them do something when clicked (scenes.ts). As wide as the window, lined up with the patch above
// (scene.ts).
// See hollow.css ("Under the patch").

/** One of the patch's pumpkins: where it stands (from the scene's left), how big, and lit or not. */
export interface Spot {
  x: number;
  size: number;
  lit: boolean;
}

/** How far down the slice goes (px), and where its layers begin. */
export const UNDER_H = 560;
const CLAY = 76;
const STONES = 150;
const DEEP = 262;

const f = (n: number) => n.toFixed(1);
/** The earth's layers, top to bottom. */
const TOPSOIL_C = "#24161f";
const CLAY_C = "#2c1519";
const STONES_C = "#1b1323";
const DEEP_C = "#130d1a";
/** Old bone (lit a little from above, shadowed below), and the dark of a hole. */
const BONE = "#8c8190";
const BONE_HI = "#b2a8b6";
const BONE_LO = "#5d5263";
const HOLE = "#0d070b";
/** Bone deep down in the stones, darker. */
const DEEP_BONE = "#3d3550";

function random(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** How far down a gently wavy line (see `wavy`) is at x. */
const waveY = (x: number, y: number, amp: number, k: number, phase: number) =>
  y + Math.sin(x / k + phase) * amp + Math.sin(x / (k * 0.37) + phase * 3) * amp * 0.35;

/** A gently wavy line across the slice, for where one layer meets the next. */
function wavy(w: number, y: number, amp: number, k: number, phase: number) {
  let d = `M0 ${f(y)}`;
  for (let x = 0; x <= w + 40; x += 40) d += `L${x} ${f(y + Math.sin(x / k + phase) * amp + Math.sin(x / (k * 0.37) + phase * 3) * amp * 0.35)}`;
  return d;
}

/** A worm along a path (in its own little drawing space, placed at x, y and shrunk to `scale`): a
 *  body with rings and a pale saddle, darker underneath and shiny on top, in the tunnel it has dug
 *  (`tunnel`, a path leading up to it; none if it's lying in a burrow drawn for it). `head`: where
 *  its head is, for its eyes. */
function worm(x: number, y: number, d: string, o: { width: number; color: string; dark: string; saddle: number; scale?: number; tunnel?: string; head?: [number, number]; eyes?: "open" | "shut" | "up"; extra?: string }) {
  const { width: wd, color, dark, saddle, scale = 0.7, tunnel, head, eyes, extra = "" } = o;
  const line = (stroke: string, width: number, more = "", cap = "round", path = d) =>
    `<path d="${path}" stroke="${stroke}" stroke-width="${f(width)}" fill="none" stroke-linecap="${cap}" stroke-linejoin="round" ${more}/>`;
  let s = `<g transform="translate(${f(x)} ${f(y)}) scale(${scale})">`;
  // Its tunnel: a dark hollow in the earth with a paler rim, fading out far behind it.
  if (tunnel != null) {
    s += line("url(#heu-tunnel-rim)", wd + 5, "", "round", tunnel + d);
    s += line("url(#heu-tunnel)", wd + 2.6, "", "round", tunnel + d);
  }
  s += `<g transform="translate(0.6 1)">${line(dark, wd)}</g>`;
  s += line(color, wd);
  s += line("#f1b7c4", wd * 1.05, `stroke-dasharray="0 ${saddle} ${f(wd * 1.5)} 999" opacity="0.35"`, "butt");
  s += line(dark, wd, `stroke-dasharray="0.7 ${f(wd * 0.75)}" opacity="0.45"`, "butt");
  s += `<g transform="translate(-0.3 ${f(-wd * 0.22)})">${line("#ffd6df", wd * 0.28, `opacity="0.3"`)}</g>`;
  if (head && eyes) {
    const [hx, hy] = head;
    const e = wd * 0.17;
    s +=
      eyes === "shut"
        ? `<path d="M${f(hx - e * 3)} ${f(hy - e)}q${f(e)} ${f(e)} ${f(e * 2)} 0M${f(hx + e)} ${f(hy - e)}q${f(e)} ${f(e)} ${f(e * 2)} 0" stroke="#120a17" stroke-width="0.7" fill="none" stroke-linecap="round"/>`
        : `<circle cx="${f(hx - e * 2)}" cy="${f(hy - e * (eyes === "up" ? 1.8 : 1))}" r="${f(e)}" fill="#120a17"/><circle cx="${f(hx + e * 1.4)}" cy="${f(hy - e * (eyes === "up" ? 1.8 : 1))}" r="${f(e)}" fill="#120a17"/>`;
  }
  return `${s}${extra}</g>`;
}

const beetle = (x: number, y: number, a: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})"><path d="M-3-3l-2-3M0-3.4v-3M3-3l2-3M-3 3l-2 3M0 3.4v3M3 3l2 3" stroke="#23193a" stroke-width="0.9" stroke-linecap="round"/><ellipse rx="5.2" ry="3.7" fill="#23193a"/><circle cx="6" r="2" fill="#23193a"/><path d="M-5 0H5" stroke="#120a17" stroke-width="0.6"/><ellipse cx="-1.6" cy="-1.8" rx="2" ry="0.8" fill="#4d3f70" opacity="0.8"/></g>`;
const snail = (x: number, y: number) =>
  `<g transform="translate(${f(x)} ${f(y)})"><path d="M-12 4c2-3 18-4 22-1c2-2 3-6 2-9M10 3c1-3 0-6-1-8" stroke="#56475f" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="12" cy="-6" r="0.9" fill="#56475f"/><circle cx="9" cy="-5" r="0.9" fill="#56475f"/><circle cx="-2" cy="-3" r="7" fill="#4a3550"/><path d="M-2-3m-1.5 0a1.5 1.5 0 1 1 3 0a3.2 3.2 0 1 1-6.4 0a5 5 0 1 1 10 0" stroke="#2c2038" stroke-width="1.2" fill="none"/></g>`;
/** A hollow in the earth that something lies buried in: darker inside, its lower lip catching a
 *  little light, its top in shadow, crumbs round it. */
function pocket(cx: number, cy: number, rx: number, ry: number, rand: () => number) {
  let s = `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx + 3)}" ry="${f(ry + 2.5)}" fill="url(#heu-pocket)" filter="url(#heu-soft)"/>`;
  s += `<path d="M${f(cx - rx * 0.85)} ${f(cy + ry * 0.35)}Q${f(cx)} ${f(cy + ry * 1.25)} ${f(cx + rx * 0.85)} ${f(cy + ry * 0.35)}" stroke="#7a4632" stroke-width="1.3" fill="none" opacity="0.35"/>`;
  s += `<path d="M${f(cx - rx * 0.8)} ${f(cy - ry * 0.55)}Q${f(cx)} ${f(cy - ry * 1.2)} ${f(cx + rx * 0.8)} ${f(cy - ry * 0.55)}" stroke="#05020a" stroke-width="2" fill="none" opacity="0.5" filter="url(#heu-soft)"/>`;
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const k = 1.05 + rand() * 0.2;
    s += `<circle cx="${f(cx + Math.cos(a) * rx * k)}" cy="${f(cy + Math.sin(a) * ry * k)}" r="${f(0.5 + rand() * 0.9)}" fill="#4a2a26" opacity="0.8"/>`;
  }
  return s;
}

/** Earth lying over the edge of something, so it's half buried: lumps in the clay's colour. */
const earthOver = (lumps: [number, number, number][]) =>
  lumps.map(([x, y, r]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * 0.6)}" fill="${CLAY_C}"/><ellipse cx="${f(x)}" cy="${f(y - r * 0.35)}" rx="${f(r * 0.7)}" ry="${f(r * 0.2)}" fill="#4a2a26" opacity="0.5"/>`).join("");

/** A long bone, old and real-looking: a slightly bent shaft, knobbly ends. */
function longBone(x: number, y: number, a: number, len: number, w = 2.6) {
  const h = len / 2;
  return (
    `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})">` +
    `<path d="M${f(-h + 2)} 0Q0 ${f(-w * 0.5)} ${f(h - 2)} 0" stroke="${BONE_LO}" stroke-width="${f(w + 1)}" stroke-linecap="round" fill="none"/>` +
    `<path d="M${f(-h + 2)} 0Q0 ${f(-w * 0.5)} ${f(h - 2)} 0" stroke="${BONE}" stroke-width="${f(w)}" stroke-linecap="round" fill="none"/>` +
    `<path d="M${f(-h + 3)} ${f(-w * 0.35)}Q0 ${f(-w * 0.85)} ${f(h - 3)} ${f(-w * 0.35)}" stroke="${BONE_HI}" stroke-width="0.7" fill="none" opacity="0.7"/>` +
    [-1, 1]
      .map(
        (e) =>
          `<circle cx="${f(e * h)}" cy="${f(-w * 0.45)}" r="${f(w * 0.8)}" fill="${BONE}"/><circle cx="${f(e * h)}" cy="${f(w * 0.45)}" r="${f(w * 0.75)}" fill="${BONE}"/><circle cx="${f(e * h - e * 0.3)}" cy="${f(-w * 0.7)}" r="${f(w * 0.3)}" fill="${BONE_HI}" opacity="0.6"/>`,
      )
      .join("") +
    `</g>`
  );
}

/** A small animal's skull (a bird's: round, with a long beak). */
const birdSkull = (x: number, y: number, a: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})"><path d="M-4-4C1-6 5-3 5 0C5 2 3 3.6 0 3.6C-3 3.6-6 2-6 -0.6C-6-2.4-5.4-3.4-4-4Z" fill="${BONE}" stroke="${BONE_LO}" stroke-width="0.6"/><path d="M4-1L14 0.6L4 2Z" fill="${BONE}" stroke="${BONE_LO}" stroke-width="0.5"/><circle cx="1" cy="-0.6" r="1.7" fill="${HOLE}"/><path d="M-4-3.2Q0-5 3.5-2.4" stroke="${BONE_HI}" stroke-width="0.6" fill="none" opacity="0.7"/></g>`;

/** Little things lost down here: an old coin, a marble, a bit of a pot, a button. */
const coin = (x: number, y: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(-20)"><ellipse rx="4" ry="2.4" fill="#5e4a20"/><ellipse rx="3.4" ry="1.9" fill="#a08440"/><ellipse cx="-0.4" cy="-0.3" rx="2" ry="1" fill="none" stroke="#c9ac5a" stroke-width="0.5"/><path d="M-1.6-1.2l0.6 0.3" stroke="#fff6d0" stroke-width="0.6"/></g>`;
const marble = (x: number, y: number) =>
  `<g transform="translate(${f(x)} ${f(y)})"><circle r="3.4" fill="url(#heu-marble)"/><path d="M-1.8 1.4C-0.4-0.6 1.2 0.6 2.2-1" stroke="#e85aa0" stroke-width="0.9" fill="none" opacity="0.8"/><circle cx="-1.2" cy="-1.3" r="0.8" fill="#fff" opacity="0.8"/></g>`;
const shard = (x: number, y: number, a: number) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})"><path d="M-6-3L5-4L7 2L-3 4Z" fill="#7a3b26" stroke="#4a2216" stroke-width="0.6"/><path d="M-4-1.4L5-2.2M-3 0.8L5.6 0.2" stroke="#c98a5a" stroke-width="0.6" opacity="0.7"/></g>`;
const button = (x: number, y: number) =>
  `<g transform="translate(${f(x)} ${f(y)})"><circle r="2.6" fill="#3a2a4a" stroke="#6a5480" stroke-width="0.6"/>${[[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.7], [0.7, 0.7]].map(([hx, hy]) => `<circle cx="${hx}" cy="${hy}" r="0.45" fill="${HOLE}"/>`).join("")}</g>`;

/** An old iron key, ornate and rusty, half sunk in the clay (the coffin's, perhaps). */
const key = (x: number, y: number, a: number) => {
  const bow = (stroke: string, wd: number) =>
    `<g fill="none" stroke="${stroke}" stroke-width="${wd}"><circle cx="-14" cy="-3" r="2.6"/><circle cx="-14" cy="3" r="2.6"/><circle cx="-19" cy="0" r="2.6"/></g>`;
  return (
    `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})">` +
    bow("#3d2418", 2.6) +
    bow("#8a5a36", 1.6) +
    `<path d="M-11 0H14" stroke="#3d2418" stroke-width="3"/><path d="M-11 0H14" stroke="#8a5a36" stroke-width="1.8"/><path d="M-10-0.6H13" stroke="#b07a4a" stroke-width="0.5" opacity="0.7"/>` +
    `<path d="M-8-1.5v3M-6-1.5v3" stroke="#3d2418" stroke-width="0.9"/><path d="M10 0v6h2v-3h2v3h1V0" fill="#8a5a36" stroke="#3d2418" stroke-width="0.7"/>` +
    `<circle cx="2" cy="0.4" r="0.9" fill="#4a2a1a"/><circle cx="-16" cy="2" r="0.8" fill="#4a2a1a"/></g>` +
    earthOver([[x + 13, y + 5, 5.5], [x + 18, y + 2, 4]])
  );
};

/** The skeleton, asleep on its side in its grave hollow, curled up with a hand under its skull, its
 *  old top hat fallen off beside it; a root from the patch has wound round its skull. Clicked, it
 *  lifts its head, waves and chatters (hollow.css, scenes.ts). */
function skeleton(x: number, y: number, rand: () => number) {
  const line = (d: string, wd: number, c = BONE) =>
    `<path d="${d}" stroke="${c}" stroke-width="${wd}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  let s = pocket(x - 6, y + 2, 56, 14, rand);
  s += `<g class="heu-skel" data-poke="skeleton" transform="translate(${f(x)} ${f(y)})">`;
  // The far leg and arm, in shadow.
  s += line("M17 4L5 13L15 18", 3, BONE_LO) + line("M15 18L9 20", 2, BONE_LO) + line("M-22 3L-29 11L-38 7", 2.2, BONE_LO);
  // The spine: little bones along a gentle curve.
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const vx = -27 + t * 44;
    const vy = -1 - Math.sin(t * Math.PI) * 4 + t * 3;
    s += `<rect x="${f(vx - 1.5)}" y="${f(vy - 1.6)}" width="3" height="3.2" rx="1.1" fill="${i % 2 ? BONE : BONE_HI}" transform="rotate(${f(-10 + t * 25)} ${f(vx)} ${f(vy)})"/>`;
  }
  // The ribs, curving down and forward, the lowest shortest.
  for (let i = 0; i < 6; i++) {
    const rx = -22 + i * 3.6;
    const ry = -3 - Math.sin(((rx + 27) / 44) * Math.PI) * 1.5;
    const len = 9 - i * 0.8;
    s += line(`M${f(rx)} ${f(ry)}q-5 ${f(len * 0.4)} -3 ${f(len)}`, 1.4) + line(`M${f(rx - 0.6)} ${f(ry + 0.4)}q-4 ${f(len * 0.35)} -2.6 ${f(len * 0.85)}`, 0.5, BONE_HI);
  }
  // The pelvis.
  s += `<path d="M12 -2Q19 -6 23 -1Q24 5 19 7Q15 8 13 5Q11 2 12 -2Z" fill="${BONE}" stroke="${BONE_LO}" stroke-width="0.8"/><ellipse cx="18" cy="2" rx="2.2" ry="1.6" fill="${HOLE}"/>`;
  // The near leg, drawn up: thigh, shin, the bones of the foot.
  s += longBone(10, 9, -142, 15, 2.8) + longBone(8, 16.5, 32, 14, 2.4) + line("M14 20L8 22M14 20l-5 2.8M14 20l-4 3.6", 1);
  // The near arm, tucked in (it waves when clicked), its fingers curled.
  s += `<g class="heu-skel__arm">${longBone(-17, 7, 60, 11, 2)}${longBone(-12, 12.5, -10, 10, 1.6)}${line("M-7 12.5l2.4 -1M-7 12.5l2.6 0.8M-7 12.5l1.8 2", 0.9)}</g>`;
  // The arm under its head: the hand for a pillow.
  s += longBone(-29, 6, 160, 11, 2) + line("M-37 7l-3 -1.2M-37 7l-3 0.4M-37 7l-2.6 1.6", 0.9);
  // The skull: a rounded cranium, a deep eye socket, the nose, the cheekbone, its upper teeth; the
  // jaw its own piece, so it can chatter.
  s += `<g class="heu-skel__head"><g transform="translate(-37 -3) rotate(-12) scale(0.86)">`;
  s += `<path d="M-1-8C6-11 13-6 12 1C11.5 4 10 5.5 7 6L-1 6C-6 5-9 1-8.5-3C-8-6.5-5-8.5-1-8Z" fill="${BONE}" stroke="${BONE_LO}" stroke-width="0.8"/>`;
  s += `<path d="M-1-7.4C5-9.6 10-6 11-1" stroke="${BONE_HI}" stroke-width="1" fill="none" opacity="0.7"/>`;
  s += `<ellipse cx="-3" cy="-1.5" rx="2.6" ry="3" fill="${HOLE}"/><path d="M-6.4 3l1.2-2.4 1.1 2.4z" fill="${HOLE}"/><path d="M-1.5 2.2Q1 1.4 3 3" stroke="${BONE_LO}" stroke-width="0.8" fill="none"/>`;
  s += `<path d="M-8 4.8h8" stroke="${BONE_LO}" stroke-width="0.6"/><path d="M-7 4.8v1.6M-5 4.8v1.8M-3 4.8v1.8M-1 4.8v1.6" stroke="${HOLE}" stroke-width="0.6"/>`;
  s += `<g class="heu-skel__jaw"><path d="M-8 7.5Q-3 10.5 3 8L4 6.5H-7.5Z" fill="${BONE}" stroke="${BONE_LO}" stroke-width="0.7"/><path d="M-6.5 6.8v1.4M-4.5 6.8v1.6M-2.5 6.8v1.6M-0.5 6.8v1.4" stroke="${HOLE}" stroke-width="0.6"/></g>`;
  s += `</g></g>`;
  // A root from the patch, wound round the skull.
  s += `<path d="M-30 -42C-31 -30 -36 -24 -32 -16C-29 -11 -36 -10 -42 -12C-48 -14 -47 -6 -41 -5" stroke="#3b2620" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M-33 -20l4 -3M-44 -12l-3 -3" stroke="#3b2620" stroke-width="0.7"/>`;
  // Its old top hat, fallen off, lying by its head.
  s += `<g transform="translate(-60 3) rotate(-78)"><path d="M-6 0V-11Q-6-13 -4-13H4Q6-13 6-11V0Z" fill="#20171f" stroke="#3d3346" stroke-width="0.9"/><path d="M-6-3H6" stroke="#5a2b35" stroke-width="1.6"/><path d="M-9.5 0.5Q0 3 9.5 0.5" stroke="#2a1f29" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M2-13L4-9" stroke="#120c12" stroke-width="0.8"/></g>`;
  s += `<text class="heu-skel__z" x="-46" y="-18" font-size="8" font-weight="800" fill="#8d7fb0" font-family="Baloo 2 Variable, sans-serif">z</text>`;
  s += `</g>`;
  // Earth over its feet and the end of the hollow.
  return s + earthOver([[x + 30, y + 15, 5], [x + 24, y + 18, 4], [x - 62, y + 12, 4]]);
}

/** The mole, asleep in its den at the end of its tunnel: curled up on a nest of dry grass and leaves,
 *  big pink paws by its pointy nose. Clicked, it wakes: opens an eye, wiggles its nose, stretches
 *  its paws (hollow.css, scenes.ts). */
function moleDen(x: number, y: number, rand: () => number) {
  const tunnel = `M${f(x - 70)} ${f(y - 58)}C${f(x - 64)} ${f(y - 40)} ${f(x - 40)} ${f(y - 28)} ${f(x - 22)} ${f(y - 10)}`;
  let s = `<path d="${tunnel}" stroke="#4a2a26" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.35"/><path d="${tunnel}" stroke="#140a0e" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.75" filter="url(#heu-soft)"/>`;
  s += pocket(x, y, 28, 15, rand);
  // The nest.
  let grass = "";
  for (let i = 0; i < 22; i++) {
    const gx = x - 24 + rand() * 48;
    const gy = y + 5 + rand() * 7;
    const a = (rand() - 0.5) * 0.9;
    const l = 6 + rand() * 9;
    grass += `<path d="M${f(gx)} ${f(gy)}q${f(Math.cos(a) * l * 0.5)} ${f(-2 - rand() * 2)} ${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)}" stroke="${rand() < 0.5 ? "#6b5538" : "#54432e"}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
  }
  s += grass;
  s += `<path transform="translate(${f(x + 16)} ${f(y + 8)}) rotate(-20)" d="M0 0Q4-4 9-1Q5 3 0 0Z" fill="#7a3f14" opacity="0.85"/><path transform="translate(${f(x - 22)} ${f(y + 9)}) rotate(14)" d="M0 0Q4-4 9-1Q5 3 0 0Z" fill="#8a4a12" opacity="0.8"/>`;
  // The mole: a round velvety body, a little tail, a pointy snout with a pink tip, paws.
  s += `<g class="heu-mole" data-poke="mole" transform="translate(${f(x)} ${f(y + 1)})">`;
  s += `<g class="heu-mole__body"><path d="M-14 4C-17-4-10-11 0-11C9-11 15-6 15 1C15 6 10 8 2 8C-6 8-12 7-14 4Z" fill="url(#heu-fur)"/>`;
  s += `<path d="M-15 3q-3 1-4 -1" stroke="#c98a95" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M-8-8Q0-12 8-8" stroke="#7a6c78" stroke-width="1" fill="none" opacity="0.6"/></g>`;
  s += `<g class="heu-mole__head"><path d="M12-2Q20-2 22 1Q20 3.5 13 4Z" fill="#3e333c"/><ellipse class="heu-mole__nose" cx="22.4" cy="1" rx="1.8" ry="1.4" fill="#e79aa8"/>`;
  s += `<path class="heu-mole__shut" d="M10.5-1q1.2 0.9 2.4 0" stroke="#120c12" stroke-width="0.7" fill="none"/><circle class="heu-mole__eye" cx="11.7" cy="-0.6" r="0.8" fill="#120c12"/><circle class="heu-mole__eye" cx="11.4" cy="-0.9" r="0.25" fill="#fff"/></g>`;
  s += `<g class="heu-mole__paws" fill="#e8a2ae"><path d="M8 4c3-1 7 0 8 3c-2 1.5-6 1.6-8 0.4z"/><path d="M3 5c3 0 6 1.5 6 4c-2 1-5 0.6-6.6-0.8z"/><path d="M10 6.2l3 0.6M5 7l3 1" stroke="#b56d7a" stroke-width="0.5"/></g>`;
  s += `<text class="heu-mole__z" x="-8" y="-17" font-size="7" font-weight="800" fill="#8d7fb0" font-family="Baloo 2 Variable, sans-serif">z</text>`;
  s += `</g>`;
  return s;
}

/** Someone's secret candy stash: an old dented cookie tin on its side, its lid off, sweets and a
 *  lollipop spilling out. It glints when clicked, and you've found it (scenes.ts). */
function stash(x: number, y: number, rand: () => number) {
  const corn = (cx: number, cy: number, a: number) =>
    `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${a})"><path d="M-3.4 3.2L0-4.6L3.4 3.2Q0 4.4-3.4 3.2Z" fill="#ffd23f"/><path d="M-2.1 0.2L-1 -2.2H1L2.1 0.2Z" fill="#ff8a1f"/><path d="M-0.95 -2.2L0-4.6L0.95-2.2Z" fill="#fff6e6"/></g>`;
  const sweet = (cx: number, cy: number, a: number, c: string) =>
    `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${a})"><path d="M-6-2.2L-3.4 0-6 2.2ZM6-2.2L3.4 0 6 2.2Z" fill="${c}" opacity="0.85"/><ellipse rx="3.6" ry="2.6" fill="${c}"/><path d="M-2-1q2-1 4 0" stroke="#fff" stroke-width="0.6" fill="none" opacity="0.6"/></g>`;
  let s = pocket(x, y, 26, 13, rand);
  s += `<g class="heu-stash" data-poke="stash">`;
  // The tin: its side showing, a faded band, rust spots, the open end.
  s += `<g transform="translate(${f(x - 6)} ${f(y)}) rotate(-14)"><rect x="-14" y="-9" width="22" height="16" rx="2" fill="url(#heu-tin)" stroke="#1d2a35" stroke-width="0.8"/>`;
  s += `<path d="M-14-2H8M-14 2H8" stroke="#8a6a3a" stroke-width="1.4" opacity="0.6"/><circle cx="-8" cy="4" r="1.8" fill="#6b3f2a" opacity="0.8"/><circle cx="2" cy="-6" r="1.2" fill="#6b3f2a" opacity="0.7"/>`;
  s += `<ellipse cx="8" cy="-1" rx="3.4" ry="8" fill="#101820" stroke="#7a9aa8" stroke-width="0.9"/></g>`;
  // Its lid, leaning against it.
  s += `<ellipse cx="${f(x - 24)}" cy="${f(y + 1)}" rx="3" ry="8.4" transform="rotate(16 ${f(x - 24)} ${f(y + 1)})" fill="#4a6676" stroke="#7a9aa8" stroke-width="0.8"/>`;
  s += sweet(x + 10, y + 3, 12, "#e94f64") + corn(x + 16, y - 1, 30) + sweet(x + 19, y + 6, -10, "#58c46d") + corn(x + 7, y + 8, -20);
  s += `<path d="M${f(x + 4)} ${f(y - 2)}L${f(x + 12)} ${f(y - 9)}" stroke="#f3ead8" stroke-width="1.2" stroke-linecap="round"/><circle cx="${f(x + 13.5)}" cy="${f(y - 10.5)}" r="3.2" fill="#9b5de5"/><path d="M${f(x + 12)} ${f(y - 11.6)}a2 2 0 0 1 3 0.6" stroke="#fff" stroke-width="0.7" fill="none" opacity="0.7"/>`;
  s += `<g class="heu-stash__glints" fill="#fff6dc">${[[x + 10, y], [x + 16, y - 5], [x + 13, y - 13], [x + 20, y + 6]].map(([gx, gy], i) => `<path d="M${f(gx)} ${f(gy - 3)}L${f(gx + 0.8)} ${f(gy)}L${f(gx)} ${f(gy + 3)}L${f(gx - 0.8)} ${f(gy)}ZM${f(gx - 3)} ${f(gy)}L${f(gx)} ${f(gy + 0.8)}L${f(gx + 3)} ${f(gy)}L${f(gx)} ${f(gy - 0.8)}Z" style="animation-delay:${i * 0.15}s"/>`).join("")}</g>`;
  s += `</g>`;
  return s + earthOver([[x - 18, y + 9, 4], [x + 22, y + 10, 3.4]]);
}

/** A worm asleep in its chamber at the end of its tunnel, tucked under a dry leaf. */
function wormChamber(x: number, y: number, rand: () => number) {
  const tunnel = `M${f(x + 40)} ${f(y - 56)}C${f(x + 34)} ${f(y - 36)} ${f(x + 20)} ${f(y - 16)} ${f(x + 8)} ${f(y - 6)}`;
  let s = `<path d="${tunnel}" stroke="#4a2a26" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.35"/><path d="${tunnel}" stroke="#140a0e" stroke-width="4.6" fill="none" stroke-linecap="round" opacity="0.75" filter="url(#heu-soft)"/>`;
  s += pocket(x, y, 15, 9, rand);
  s += worm(x - 2, y + 1, "M-8 2C-9-5-1-8 5-6S8 4 1 4S-4-1 1-2", { width: 4, color: "#8c5068", dark: "#552a3a", saddle: 8, head: [1, -2], eyes: "shut" });
  s += `<path transform="translate(${f(x - 2)} ${f(y + 1)}) rotate(-8)" d="M0 0Q6-6 13-1Q6 4 0 0Z" fill="#8a4a12" opacity="0.9"/><path transform="translate(${f(x - 2)} ${f(y + 1)}) rotate(-8)" d="M0 0L12-1" stroke="#4a2408" stroke-width="0.5"/>`;
  return s;
}

/** An old wooden coffin, lying a little crooked: planks, a long cross on the lid, and nails. Pointed at, the lid slides open a crack and a pair of eyes looks out. */
const coffin = (x: number, y: number, a: number) => {
  const shape = "M-42-6L-30-15L40-10L40 10L-30 15L-42 6Z";
  return (
    `<g class="heu-coffin" data-poke="coffin" transform="translate(${f(x)} ${f(y)}) rotate(${a})">` +
    `<path d="${shape}" fill="#08050c"/>` +
    `<g class="heu-coffin__eyes" fill="#ffcf5a"><ellipse cx="-31" cy="-3.4" rx="2" ry="1.4"/><ellipse cx="-31" cy="3.4" rx="2" ry="1.4"/></g>` +
    `<g class="heu-coffin__lid"><path d="${shape}" fill="#3b2531" stroke="#1e1119" stroke-width="1.6"/>` +
    `<path d="M-38-3.5L-28-11L38-7.5M-38 3.5L-28 11L38 7.5M-30 -1.5H38M-30 1.5H38" stroke="#2c1a25" stroke-width="0.8" fill="none" opacity="0.8"/>` +
    `<path d="M-36-5L-29-12L37-8.5V8.5L-29 12L-36 5Z" fill="none" stroke="#4e3242" stroke-width="1"/>` +
    `<path d="M-16 0H26M-6-6V6" stroke="#7a5868" stroke-width="2.6" stroke-linecap="round"/>` +
    `<g fill="#8a7a96">${[[-32, -8], [-32, 8], [34, -7], [34, 7]].map(([nx, ny]) => `<circle cx="${nx}" cy="${ny}" r="0.9"/>`).join("")}</g></g>` +
    `</g>`
  );
};

/** A cluster of purple crystals in a split rock, glowing faintly. */
const crystals = (x: number, y: number) => {
  const shard = (bx: number, by: number, h: number, wd: number, tilt: number) =>
    `<g transform="rotate(${tilt} ${bx} ${by})"><path d="M${bx - wd} ${by}V${by - h * 0.7}L${bx} ${by - h}L${bx + wd} ${by - h * 0.7}V${by}Z" fill="#7b4fc2"/><path d="M${bx} ${by - h}L${bx + wd} ${by - h * 0.7}V${by}H${bx}Z" fill="#5a3596"/><path d="M${bx - wd * 0.5} ${by - h * 0.15}V${by - h * 0.7}" stroke="#d8c2ff" stroke-width="0.8" opacity="0.7"/></g>`;
  return (
    `<g class="heu-crystals" data-poke="crystals" transform="translate(${f(x)} ${f(y)})">` +
    `<ellipse class="heu-crystals__glow" cx="0" cy="-6" rx="30" ry="20" fill="url(#heu-crystal-glow)"/>` +
    `<path d="M-24 6Q-26-6-16-8L-10 2L10 2L16-8Q26-6 24 6Q0 12-24 6Z" fill="#2a2038" stroke="#3c2f50" stroke-width="1"/>` +
    shard(-8, 3, 16, 3.4, -18) + shard(0, 3, 22, 4, 0) + shard(8, 3, 14, 3, 20) + shard(-14, 4, 9, 2.4, -36) + shard(13, 4, 8, 2.2, 38) +
    `<g class="heu-crystals__glints" fill="#fff">${[[0, -18], [-9, -11], [9, -10]].map(([gx, gy], i) => `<circle cx="${gx}" cy="${gy}" r="0.9" style="animation-delay:${i * 0.9}s"/>`).join("")}</g></g>`
  );
};

/** A fossil in a slab of pale stone: a fish, or a spiral shell. */
const fossil = (x: number, y: number, a: number, kind: "fish" | "shell") => {
  const slab = kind === "fish" ? "M-30-12L22-15L33-3L28 12L-24 14L-34 2Z" : "M-17-13L13-15L19 1L12 14L-14 13L-20-2Z";
  let mark = "";
  if (kind === "fish") {
    let ribs = "";
    for (let i = -10; i <= 8; i += 4.5) ribs += `M${i} ${-6 + Math.abs(i) * 0.15}Q${i + 2.5} 0 ${i} ${6 - Math.abs(i) * 0.15}`;
    mark = `<g stroke="#2a2138" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M-17 0H13${ribs}M-17 0l-6-6M-17 0l-6 6"/><path d="M13-6Q23-5 24 0Q23 5 13 6Z" fill="#2a2138" stroke="none"/></g>`;
  } else {
    mark =
      `<path d="M0 0m-1.6 0a1.6 1.6 0 1 1 3.2 0a3.4 3.4 0 1 1-6.8 0a5.4 5.4 0 1 1 10.8 0a7.6 7.6 0 1 1-15.2 0" stroke="#2a2138" stroke-width="1.3" fill="none"/>` +
      [...Array(9)]
        .map((_, i) => {
          const t = (i / 9) * Math.PI * 2;
          return `<path d="M${f(Math.cos(t) * 5)} ${f(Math.sin(t) * 5)}L${f(Math.cos(t) * 8)} ${f(Math.sin(t) * 8)}" stroke="#2a2138" stroke-width="0.7"/>`;
        })
        .join("");
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})"><path d="${slab}" fill="#3a3046" stroke="#4b3f5a" stroke-width="1.2" stroke-linejoin="round"/>${mark}</g>`;
};

/** A rounded stone, lit a little from above. */
function stone(x: number, y: number, r: number, rand: () => number) {
  const n = 7;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + rand() * 0.4;
    const k = 0.8 + rand() * 0.3;
    pts.push([x + Math.cos(t) * r * 1.25 * k, y + Math.sin(t) * r * 0.85 * k]);
  }
  // Smooth: through the middle of each side, bending at the corners.
  const mid = (i: number) => {
    const [ax, ay] = pts[i % n];
    const [bx, by] = pts[(i + 1) % n];
    return [(ax + bx) / 2, (ay + by) / 2];
  };
  let d = `M${f(mid(0)[0])} ${f(mid(0)[1])}`;
  for (let i = 1; i <= n; i++) d += `Q${f(pts[i % n][0])} ${f(pts[i % n][1])} ${f(mid(i)[0])} ${f(mid(i)[1])}`;
  return `<path d="${d}Z" fill="#241b31" stroke="#1a1325" stroke-width="1"/><ellipse cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.4)}" rx="${f(r * 0.6)}" ry="${f(r * 0.22)}" fill="#3a2e4c" opacity="0.8"/>`;
}

/** Where the cut is, up from the bottom of the patch's scene: it starts a little way inside it (the
 *  scene draws its top too), so nothing is cut off where the spotlight ends. */
export const CUT_IN = 12;

/** The slice of earth under the patch, `w` wide (the same as the patch's scene), with its cut edge
 *  at y = 0: what goes in an SVG's defs, the picture, and how far down its ragged edge is at x. */
export function underArt(w: number, spots: Spot[]) {
  const rand = random(19);
  const defs = `
    <linearGradient id="heu-tunnel"><stop offset="0" stop-color="#08050c" stop-opacity="0"/><stop offset="0.4" stop-color="#08050c"/></linearGradient>
    <linearGradient id="heu-tunnel-rim"><stop offset="0" stop-color="#33244a" stop-opacity="0"/><stop offset="0.4" stop-color="#33244a"/></linearGradient>
    <radialGradient id="heu-warm"><stop offset="0" stop-color="#ff8a2e" stop-opacity="0.42"/><stop offset="0.5" stop-color="#ff7518" stop-opacity="0.13"/><stop offset="1" stop-color="#ff7518" stop-opacity="0"/></radialGradient>
    <linearGradient id="heu-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0710" stop-opacity="0"/><stop offset="1" stop-color="#0b0710"/></linearGradient>
    <radialGradient id="heu-glow-deep"><stop offset="0" stop-color="#ff8a2e" stop-opacity="0.1"/><stop offset="0.55" stop-color="#ff7518" stop-opacity="0.04"/><stop offset="1" stop-color="#ff7518" stop-opacity="0"/></radialGradient>
    <radialGradient id="heu-pocket" cx="0.5" cy="0.42" r="0.55"><stop offset="0" stop-color="${HOLE}" stop-opacity="0.75"/><stop offset="0.7" stop-color="${HOLE}" stop-opacity="0.55"/><stop offset="1" stop-color="${HOLE}" stop-opacity="0"/></radialGradient>
    <radialGradient id="heu-fur" cx="0.45" cy="0.3" r="0.8"><stop offset="0" stop-color="#5a4d57"/><stop offset="0.6" stop-color="#3a2f37"/><stop offset="1" stop-color="#261e25"/></radialGradient>
    <linearGradient id="heu-tin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58798a"/><stop offset="0.5" stop-color="#3c5666"/><stop offset="1" stop-color="#26394a"/></linearGradient>
    <radialGradient id="heu-marble" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#b8f0ff"/><stop offset="0.5" stop-color="#3a8fb0"/><stop offset="1" stop-color="#173b52"/></radialGradient>
    <filter id="heu-soft" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="heu-softer" x="-5%" y="-200%" width="110%" height="500%"><feGaussianBlur stdDeviation="3"/></filter>
    <radialGradient id="heu-crystal-glow"><stop offset="0" stop-color="#a77bff" stop-opacity="0.4"/><stop offset="1" stop-color="#a77bff" stop-opacity="0"/></radialGradient>`;
  let s = "";

  // The cut's ragged edge (bites out of it here and there).
  const edge: [number, number][] = [];
  for (let x = -10; x <= w + 30; x += 14 + rand() * 26) edge.push([x, rand() < 0.2 ? 5 + rand() * 7 : rand() * 3]);
  const edgeD = "M" + edge.map(([x, y]) => `${f(x)} ${f(y)}`).join("L");
  /** How far down the edge is at x. */
  const edgeAt = (x: number) => {
    const i = Math.max(0, edge.findIndex(([ex]) => ex > x) - 1);
    const [ax, ay] = edge[i];
    const [bx, by] = edge[Math.min(edge.length - 1, i + 1)];
    return bx === ax ? ay : ay + ((by - ay) * (x - ax)) / (bx - ax);
  };

  // The cut face and its layers of earth, drawn: each a flat colour shading darker towards its
  // bottom, a couple of broken lines through it where it settled, specks in little clusters; each
  // edge catching a little light, a soft shadow under it.
  s += `<path d="${edgeD}L${w + 30} ${UNDER_H}L-10 ${UNDER_H}Z" fill="${TOPSOIL_C}"/>`;
  const bands: [number, number, number, number, string, string, number][] = [
    [0, 0, 1, 0, TOPSOIL_C, "", CLAY],
    [CLAY, 7, 140, 1, CLAY_C, "#3a2230", STONES],
    [STONES, 9, 190, 2, STONES_C, "#2e2340", DEEP],
    [DEEP, 8, 160, 3, DEEP_C, "#251b33", UNDER_H - 40],
  ];
  for (const [i, [y, amp, k, ph, fill, , next]] of bands.entries()) {
    if (i > 0) s += `<path d="${wavy(w, y, amp, k, ph)}L${w + 40} ${UNDER_H}L0 ${UNDER_H}Z" fill="${fill}"/>`;
    s += `<linearGradient id="heu-band${i}" gradientUnits="userSpaceOnUse" x1="0" y1="${y}" x2="0" y2="${next + 6}"><stop offset="0" stop-color="#ffd2b0" stop-opacity="0.045"/><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#05020a" stop-opacity="0.3"/></linearGradient>`;
    s += `<rect x="0" y="${y - 12}" width="${w}" height="${next - y + 30}" fill="url(#heu-band${i})"/>`;
    for (const t of [0.35, 0.68]) {
      const ly = y + (next - y) * t;
      let d = "";
      for (let x = rand() * 80; x < w; x += 60 + rand() * 140) {
        const len = 40 + rand() * 120;
        d += `M${f(x)} ${f(waveY(x, ly, amp * 0.8 + 1, k, ph))}`;
        for (let xx = x + 10; xx < x + len; xx += 10) d += `L${f(xx)} ${f(waveY(xx, ly, amp * 0.8 + 1, k, ph))}`;
      }
      s += `<path d="${d}" stroke="${i >= 2 ? "#2a2236" : "#3a2228"}" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.55"/>`;
    }
    for (let c = 0; c < w / 128; c++) {
      const cx = rand() * w;
      const cy = y + 8 + rand() * (next - y - 14);
      for (let j = 0; j < 4; j++)
        s += `<circle cx="${f(cx + (rand() - 0.5) * 16)}" cy="${f(cy + (rand() - 0.5) * 7)}" r="${f(0.5 + rand() * 0.8)}" fill="${i >= 2 ? "#352b45" : "#4a2e30"}" opacity="0.8"/>`;
    }
  }
  for (const [y, amp, k, ph, , edge] of bands.slice(1)) {
    s += `<path d="${wavy(w, y + 4, amp, k, ph)}" stroke="#05020a" stroke-width="7" fill="none" opacity="0.4" filter="url(#heu-softer)"/>`;
    s += `<path d="${wavy(w, y, amp, k, ph)}" stroke="${edge}" stroke-width="1.6" fill="none" opacity="0.6"/>`;
  }

  // The patch's roots, from under every pumpkin (and the odd weed), branching down.
  const root = (x: number, y: number, a: number, len: number, wd: number, depth: number): string => {
    const x1 = x + Math.cos(a) * len;
    const y1 = y + Math.sin(a) * len;
    let p = `<path d="M${f(x)} ${f(y)}Q${f((x + x1) / 2 + (rand() - 0.5) * len * 0.5)} ${f((y + y1) / 2)} ${f(x1)} ${f(y1)}" stroke="#3d2822" stroke-width="${f(wd)}" fill="none" stroke-linecap="round"/>`;
    if (depth > 0) for (let i = 0; i < 2; i++) p += root(x1, y1, a + (rand() - 0.5) * 1.2, len * 0.66, wd * 0.62, depth - 1);
    return p;
  };
  for (const p of spots) s += root(p.x + (rand() - 0.5) * p.size * 0.3, 12, Math.PI / 2 + (rand() - 0.5) * 0.4, 16 + p.size * 0.4, 1.2 + p.size * 0.03, 3);
  for (let x = 30 + rand() * 60; x < w; x += 140 + rand() * 180) s += root(x, 12, Math.PI / 2 + (rand() - 0.5) * 0.6, 20 + rand() * 22, 2.2, 3);

  // Pebbles and seeds in the topsoil.
  for (let i = 0; i < w / 24; i++) {
    const x = rand() * w;
    const y = 14 + rand() * (CLAY - 18);
    const r = 1.5 + rand() * 3;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 1.3)}" ry="${f(r)}" fill="#2e2238"/><ellipse cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.35)}" rx="${f(r * 0.5)}" ry="${f(r * 0.25)}" fill="#3b2d4c"/>`;
  }
  for (let i = 0; i < w / 160; i++) {
    const x = rand() * w;
    const y = 16 + rand() * 46;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2.2" ry="3.4" fill="#5b4a33" opacity="0.7" transform="rotate(${f(rand() * 180)} ${f(x)} ${f(y)})"/>`;
  }

  const at = (t: number) => w * t;
  // Where the special things lie in the stones (x, y, room round them), so the stones keep clear.
  const things: [number, number, number][] = [
    [at(0.26), 182, 30],
    [at(0.44), 194, 50],
    [at(0.62), 178, 34],
    [at(0.8), 194, 40],
    [at(0.93), 186, 22],
  ];
  // Stones in a few loose heaps (one big stone, smaller ones round it) and a couple of boulders
  // sitting across where the clay meets the stones; none on top of another, or of the things.
  const placed: [number, number, number][] = [...things];
  const free = (x: number, y: number, r: number) => placed.every(([px, py, pr]) => Math.hypot(px - x, (py - y) * 1.4) > pr + r + 3);
  const put = (x: number, y: number, r: number) => {
    if (!free(x, y, r)) return;
    placed.push([x, y, r]);
    s += stone(x, y, r, rand);
  };
  for (const t of [0.12, 0.53, 0.71]) put(at(t), STONES + rand() * 4, 13 + rand() * 4);
  // Heaps in the gaps between the special things: a stone or two, smaller ones round it, gravel.
  for (const [t, y] of [[0.05, 176], [0.15, 200], [0.35, 178], [0.53, 204], [0.71, 186], [0.87, 172], [0.99, 198]] as const) {
    const hx = at(t) + (rand() - 0.5) * 20;
    put(hx, y, 7 + rand() * 4);
    put(hx + 16 + rand() * 6, y + 4 + rand() * 4, 4 + rand() * 3);
    for (let i = 0; i < 4; i++) put(hx + (rand() - 0.5) * 70, y + (rand() - 0.5) * 30, 2.2 + rand() * 3);
    for (let i = 0; i < 6; i++) put(hx + (rand() - 0.5) * 90, y + (rand() - 0.3) * 34, 1.2 + rand() * 1.2);
  }
  // Deeper down, fewer and bigger, fading into the dark.
  for (let x = 60 + rand() * 100; x < w; x += 200 + rand() * 160) put(x, DEEP + 10 + rand() * 30, 9 + rand() * 6);

  // Who and what lives in the topsoil: worms going about their business, beetles, a snail.
  s += worm(at(0.2), 50, "M0 0C20-10 40 6 60-2S90-4 100 2", { width: 3.2, color: "#5e2f3e", dark: "#3a1724", saddle: 70, tunnel: "M-70 14C-40 16-20 4 0 0", extra: `<path d="M101 2q6-6 12-2q-5 6-12 2z" fill="#7a3f10"/>` });
  s += worm(at(0.36), 40, "M0 0c8-8 14 6 22-2s14 6 22-2s12 4 16-2", { width: 5, color: "#7a4256", dark: "#4a2333", saddle: 34, head: [60, -6], eyes: "open", tunnel: "M-70 24C-50 22-30 6 0 0" });
  s += worm(at(0.53), 48, "M0 0c4-3 8-2 10-8s6-8 10-6", { width: 4.6, color: "#6b3a4a", dark: "#3f1d2b", saddle: 6, head: [20, -14], eyes: "up", tunnel: "M-90 6c20 6 40-14 60-8S-14 8 0 0" });
  s += beetle(at(0.08), 56, 20) + snail(at(0.94), 44) + beetle(at(0.72), 58, -30);
  // In the clay, in a few groups with plain earth between them: an old bone; the skeleton asleep in
  // its grave; a coin and a button; the mole in its den; a marble and a bird's skull; the candy
  // stash; the worm in its chamber and a bit of an old pot; the key.
  s += longBone(at(0.11), 128, 12, 20) + earthOver([[at(0.11) + 10, 132, 4.5]]);
  s += skeleton(at(0.195), 112, rand);
  s += coin(at(0.275), 98) + button(at(0.31), 133);
  s += moleDen(at(0.47), 118, rand);
  s += marble(at(0.54), 101) + birdSkull(at(0.565), 133, -8);
  s += stash(at(0.67), 115, rand);
  s += wormChamber(at(0.805), 108, rand) + shard(at(0.865), 99, 18);
  s += key(at(0.92), 128, -16);
  // In the stones: a fossil shell, the coffin, purple crystals, a fossil fish, and a little skull.
  const [shell, box, gems, fishy, head] = things;
  s += pocket(box[0], box[1] + 1, 46, 16, rand) + fossil(shell[0], shell[1], -8, "shell") + coffin(box[0], box[1], -4) + crystals(gems[0], gems[1]) + fossil(fishy[0], fishy[1], 6, "fish");
  s += `<g transform="translate(${f(head[0])} ${head[1]}) rotate(14)" fill="${DEEP_BONE}"><path d="M-8 0a8 8 0 1 1 16 0v5h-3v3h-10v-3h-3z"/><circle cx="-3.2" cy="0" r="2.1" fill="#120a17"/><circle cx="3.2" cy="0" r="2.1" fill="#120a17"/><path d="M-0.8 3.4l0.8-1.6 0.8 1.6z" fill="#120a17"/></g>`;

  // Candlelight from the lit pumpkins spilling over the edge onto the cut face.
  for (const p of spots.filter((p) => p.lit))
    s += `<ellipse cx="${f(p.x)}" cy="0" rx="${f(p.size * 1.9)}" ry="${f(40 + p.size)}" fill="url(#heu-warm)"/><ellipse cx="${f(p.x)}" cy="20" rx="${f(150 + p.size * 2)}" ry="150" fill="url(#heu-glow-deep)"/>`;

  // The lip: a shadow under it, a pale rim where it's cut, crumbs falling, fine roots poking out
  // of the cut and dangling, and the odd fallen leaf lying on the edge. (The grass growing along
  // it is the scene's, see grass.ts.)
  s += `<g transform="translate(0 5)"><path d="${edgeD}" stroke="#050208" stroke-width="10" fill="none" opacity="0.55" stroke-linejoin="round"/></g>`;
  s += `<path d="${edgeD}" stroke="#55405e" stroke-width="2.2" fill="none" stroke-linejoin="round"/>`;
  for (let i = 0; i < w / 90; i++) {
    const x = rand() * w;
    for (let j = 0; j < 3; j++) s += `<circle cx="${f(x + (rand() - 0.5) * 6)}" cy="${f(10 + j * 9 + rand() * 4)}" r="${f(1.3 - j * 0.3)}" fill="#3a2a44" opacity="${f(0.9 - j * 0.28)}"/>`;
  }
  for (let x = rand() * 10; x < w; x += rand() < 0.35 ? 30 + rand() * 60 : 4 + rand() * 9) {
    const top = edgeAt(x) + 3;
    const len = 4 + rand() * 12;
    const dx = (rand() - 0.5) * 6;
    const thick = rand() < 0.2;
    s += `<path d="M${f(x)} ${f(top)}q${f(dx * 0.2 + (rand() - 0.5) * 3)} ${f(len * 0.5)} ${f(dx)} ${f(len)}" stroke="${thick ? "#4a3228" : "#5d4236"}" stroke-width="${thick ? 1.5 : 0.8}" fill="none" stroke-linecap="round" opacity="0.85"/>`;
  }
  const leafColors = ["#7a3f10", "#8a4a12", "#5a2410", "#6b3412"];
  for (let x = rand() * 40; x < w; x += 50 + rand() * 120) {
    const ly = edgeAt(x) - 1 + rand() * 3;
    const r = 3 + rand() * 3;
    s += `<path transform="translate(${f(x)} ${f(ly)}) rotate(${f((rand() - 0.5) * 60)})" d="M${-r} 0Q0 ${-r * 0.8} ${r} 0Q0 ${r * 0.8} ${-r} 0Z" fill="${leafColors[Math.floor(rand() * leafColors.length)]}"/>`;
  }

  // Down into the night.
  s += `<rect y="${DEEP}" width="${w}" height="${UNDER_H - DEEP}" fill="url(#heu-fade)"/>`;
  return { defs, body: s, edgeAt };
}

/** The slice as a picture of its own, for under the spotlight: from where the spotlight (which
 *  draws the top of it) ends, so the two meet without overlapping. */
export function underScene(w: number, spots: Spot[]) {
  const { defs, body } = underArt(w, spots);
  return `<svg class="he-under__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 ${CUT_IN} ${w} ${UNDER_H - CUT_IN}" width="${w}" height="${UNDER_H - CUT_IN}"><defs>${defs}</defs>${body}</svg>`;
}
