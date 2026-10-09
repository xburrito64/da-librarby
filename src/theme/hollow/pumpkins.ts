// Hollow's Eve's pumpkins, each with a personality of its own. A pumpkin is built from ribbed lobes
// with their own shading, grooves between them and a highlight, a stem (short, curly, bent or tall),
// and maybe a carved face that glows from inside: a classic grin, a cute one, a scary one, a sleepy
// one (it wakes up when you point at it), a surprised one, a winking one, a goofy one, a one-eyed
// one, a vampire and a cat. Some wear a witch's hat, carry a candle, have a crow on top or warts.

export type Palette = "orange" | "deep" | "pale" | "ghost" | "goblin";
export type Face = "classic" | "cute" | "scary" | "sleepy" | "surprised" | "wink" | "goofy" | "cyclops" | "vampire" | "cat";
export type Stem = "short" | "curly" | "bent" | "tall";
export type Extra = "hat" | "candle" | "leaf" | "crow" | "warts" | "bow";

export interface PumpkinSpec {
  /** Width in px. */
  size: number;
  face?: Face;
  palette?: Palette;
  /** 5 or 7 lobes. */
  ribs?: 5 | 7;
  /** Height for its width: under 1 is squat, over 1 tall. */
  squat?: number;
  stem?: Stem;
  extras?: Extra[];
  /** Leans a little (degrees). */
  tilt?: number;
  /** A face carved but not lit. */
  unlit?: boolean;
}

const PALETTES: Record<Palette, [string, string, string, string]> = {
  // light, middle, dark, groove
  orange: ["#ffa24c", "#f27a1f", "#b84a0b", "#8f3a08"],
  deep: ["#ff8a3a", "#e0561a", "#9c2f08", "#6e2105"],
  pale: ["#ffd583", "#f5ab45", "#c47a1c", "#93590f"],
  ghost: ["#ffffff", "#ece6df", "#bcb1a8", "#988b82"],
  goblin: ["#c3d37f", "#87a348", "#526b29", "#36461a"],
};

/** The gradients and filters pumpkins need, for an SVG's <defs>. `pre` keeps ids apart. */
export function pumpkinDefs(pre: string) {
  let s = "";
  for (const [name, [light, mid, dark, groove]] of Object.entries(PALETTES)) {
    s += `<radialGradient id="${pre}pb-${name}" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`;
    s += `<radialGradient id="${pre}pd-${name}" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="${mid}"/><stop offset="0.65" stop-color="${dark}"/><stop offset="1" stop-color="${groove}"/></radialGradient>`;
  }
  s += `<radialGradient id="${pre}carve" cx="0.5" cy="0.6" r="0.7"><stop offset="0" stop-color="#fffbe2"/><stop offset="0.3" stop-color="#ffe27c"/><stop offset="0.7" stop-color="#ffaa36"/><stop offset="1" stop-color="#f06810"/></radialGradient>`;
  s += `<linearGradient id="${pre}stem" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3f4d1c"/><stop offset="0.45" stop-color="#7a8b3c"/><stop offset="1" stop-color="#46551f"/></linearGradient>`;
  s += `<radialGradient id="${pre}plight"><stop offset="0" stop-color="#ff9a3c" stop-opacity="0.5"/><stop offset="1" stop-color="#ff7518" stop-opacity="0"/></radialGradient>`;
  s += `<radialGradient id="${pre}flame" cx="0.5" cy="0.7" r="0.6"><stop offset="0" stop-color="#fffbe0"/><stop offset="0.45" stop-color="#ffd36b"/><stop offset="1" stop-color="#ff8a2e" stop-opacity="0"/></radialGradient>`;
  s += `<filter id="${pre}fglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="0.14"/></filter>`;
  // Light and shade laid over a pumpkin's body (see drawPumpkin): darker underneath where it sits
  // in the dark, the moon catching its top on the right, warmth from a lantern nearby on either
  // side, and a carved one's skin glowing from the candle inside.
  s += `<linearGradient id="${pre}shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.35" stop-color="#2a0c1c" stop-opacity="0"/><stop offset="0.78" stop-color="#2a0c1c" stop-opacity="0.3"/><stop offset="1" stop-color="#16061a" stop-opacity="0.7"/></linearGradient>`;
  s += `<radialGradient id="${pre}moonlit" cx="0.8" cy="0" r="0.45"><stop offset="0" stop-color="#e2d8ff" stop-opacity="0.3"/><stop offset="1" stop-color="#d6c8ff" stop-opacity="0"/></radialGradient>`;
  s += `<linearGradient id="${pre}warmL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb54f" stop-opacity="0.75"/><stop offset="0.45" stop-color="#ff9a3c" stop-opacity="0"/></linearGradient>`;
  s += `<linearGradient id="${pre}warmR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ffb54f" stop-opacity="0.75"/><stop offset="0.45" stop-color="#ff9a3c" stop-opacity="0"/></linearGradient>`;
  s += `<radialGradient id="${pre}inner" cx="0.5" cy="0.6" r="0.42"><stop offset="0" stop-color="#ffc05a" stop-opacity="0.38"/><stop offset="0.6" stop-color="#ff8a24" stop-opacity="0.1"/><stop offset="1" stop-color="#ff8a2e" stop-opacity="0"/></radialGradient>`;
  // The pool of candlelight on the ground in front of a lit one.
  s += `<radialGradient id="${pre}pool"><stop offset="0" stop-color="#ff9a34" stop-opacity="0.5"/><stop offset="0.35" stop-color="#ff7a1c" stop-opacity="0.22"/><stop offset="1" stop-color="#e2560a" stop-opacity="0"/></radialGradient>`;
  return s;
}

interface FaceParts {
  /** Carved out (lit from inside). */
  carve: string;
  /** Left standing inside the holes: teeth, pupils, shines. */
  keep?: string;
  /** Painted on (not carved): blush, a tongue. Drawn over the light. */
  paint?: string;
  /** Sleepy's open eyes, shown when it wakes up. */
  awake?: string;
}

// Faces in a box from -1 to 1 each way (y down), fitted onto the front of the pumpkin.
const FACES: Record<Face, FaceParts> = {
  classic: {
    carve:
      `<path d="M-0.66 -0.08L-0.4 -0.56L-0.14 -0.08Z"/><path d="M0.66 -0.08L0.4 -0.56L0.14 -0.08Z"/><path d="M-0.09 0.15L0 -0.02L0.09 0.15Z"/>` +
      `<path d="M-0.76 0.2Q0 0.52 0.76 0.2Q0.6 0.82 0 0.86Q-0.6 0.82 -0.76 0.2Z"/>`,
    keep: `<path d="M-0.36 0.28h0.17v0.18h-0.17Z"/><path d="M0.18 0.28h0.17v0.18h-0.17Z"/><path d="M-0.08 0.9v-0.2h0.17v0.2Z"/>`,
  },
  cute: {
    carve: `<ellipse cx="-0.36" cy="-0.22" rx="0.15" ry="0.19"/><ellipse cx="0.36" cy="-0.22" rx="0.15" ry="0.19"/><path d="M-0.3 0.26Q0 0.64 0.3 0.26Q0 0.42 -0.3 0.26Z"/>`,
    keep: `<circle cx="-0.31" cy="-0.29" r="0.05"/><circle cx="0.41" cy="-0.29" r="0.05"/>`,
    paint: `<ellipse cx="-0.64" cy="0.16" rx="0.15" ry="0.08" fill="#ff6f8e" opacity="0.5"/><ellipse cx="0.64" cy="0.16" rx="0.15" ry="0.08" fill="#ff6f8e" opacity="0.5"/>`,
  },
  scary: {
    carve:
      `<path d="M-0.76 -0.52L-0.12 -0.18L-0.62 0.02Z"/><path d="M0.76 -0.52L0.12 -0.18L0.62 0.02Z"/>` +
      `<path d="M-0.12 0.12L-0.04 -0.04L-0.02 0.14Z"/><path d="M0.12 0.12L0.04 -0.04L0.02 0.14Z"/>` +
      `<path d="M-0.84 0.18L-0.64 0.42L-0.48 0.24L-0.32 0.5L-0.16 0.27L0 0.52L0.16 0.27L0.32 0.5L0.48 0.24L0.64 0.42L0.84 0.18Q0.68 0.92 0 0.94Q-0.68 0.92 -0.84 0.18Z"/>`,
    keep: `<path d="M-0.42 0.92L-0.32 0.66L-0.22 0.92Z"/><path d="M0.22 0.92L0.32 0.66L0.42 0.92Z"/>`,
  },
  sleepy: {
    carve: `<path d="M-0.64 -0.26Q-0.37 0.08 -0.1 -0.26Q-0.37 -0.06 -0.64 -0.26Z"/><path d="M0.64 -0.26Q0.37 0.08 0.1 -0.26Q0.37 -0.06 0.64 -0.26Z"/><ellipse cx="0.06" cy="0.42" rx="0.13" ry="0.16"/>`,
    awake: `<ellipse cx="-0.37" cy="-0.22" rx="0.14" ry="0.18"/><ellipse cx="0.37" cy="-0.22" rx="0.14" ry="0.18"/>`,
  },
  surprised: {
    carve:
      `<circle cx="-0.36" cy="-0.26" r="0.18"/><circle cx="0.36" cy="-0.26" r="0.18"/>` +
      `<path d="M-0.58 -0.62Q-0.36 -0.78 -0.14 -0.64Q-0.36 -0.7 -0.58 -0.62Z"/><path d="M0.58 -0.62Q0.36 -0.78 0.14 -0.64Q0.36 -0.7 0.58 -0.62Z"/>` +
      `<ellipse cx="0" cy="0.42" rx="0.17" ry="0.25"/>`,
    keep: `<circle cx="-0.31" cy="-0.31" r="0.05"/><circle cx="0.41" cy="-0.31" r="0.05"/>`,
  },
  wink: {
    carve:
      `<path d="M-0.62 -0.06L-0.38 -0.54L-0.14 -0.06Z"/><path d="M0.14 -0.2Q0.38 -0.46 0.62 -0.2Q0.38 -0.32 0.14 -0.2Z"/>` +
      `<path d="M-0.62 0.16Q0 0.92 0.62 0.16Q0 0.48 -0.62 0.16Z"/>`,
    paint: `<path class="he-tongue" d="M0.06 0.5Q0.22 0.42 0.36 0.47Q0.34 0.66 0.2 0.68Q0.08 0.64 0.06 0.5Z" fill="#ff5d73"/>`,
  },
  goofy: {
    carve:
      `<circle cx="-0.38" cy="-0.22" r="0.21"/><path d="M0.22 -0.1L0.39 -0.42L0.56 -0.1Z"/><circle cx="0" cy="0.08" r="0.06"/>` +
      `<path d="M-0.64 0.3Q-0.1 0.44 0.6 0.12Q0.48 0.64 0 0.72Q-0.5 0.68 -0.64 0.3Z"/>`,
    keep: `<path d="M-0.14 0.28h0.2v0.22h-0.2Z"/><circle cx="-0.32" cy="-0.28" r="0.06"/>`,
  },
  cyclops: {
    carve: `<path d="M-0.52 -0.24Q0 -0.76 0.52 -0.24Q0 0.2 -0.52 -0.24Z"/><path d="M-0.58 0.3Q0 0.72 0.58 0.3Q0 0.5 -0.58 0.3Z"/>`,
    keep: `<ellipse class="he-pupil" cx="0" cy="-0.26" rx="0.07" ry="0.2"/><path d="M-0.34 0.38L-0.25 0.54L-0.16 0.42Z"/><path d="M0.16 0.42L0.25 0.54L0.34 0.38Z"/>`,
  },
  vampire: {
    carve:
      `<path d="M-0.64 -0.34L-0.14 -0.18L-0.52 -0.02Z"/><path d="M0.64 -0.34L0.14 -0.18L0.52 -0.02Z"/>` +
      `<path d="M-0.64 0.22Q0 0.46 0.64 0.22Q0.42 0.66 0 0.68Q-0.42 0.66 -0.64 0.22Z"/>`,
    keep: `<path d="M-0.34 0.3L-0.25 0.56L-0.16 0.33Z"/><path d="M0.16 0.33L0.25 0.56L0.34 0.3Z"/>`,
    paint: `<path d="M-0.2 -0.86L0 -0.64L0.2 -0.86Q0 -0.76 -0.2 -0.86Z" fill="#3a1a2e" opacity="0.55"/>`,
  },
  cat: {
    carve:
      `<path d="M-0.62 -0.2Q-0.38 -0.5 -0.14 -0.2Q-0.38 0.04 -0.62 -0.2Z"/><path d="M0.62 -0.2Q0.38 -0.5 0.14 -0.2Q0.38 0.04 0.62 -0.2Z"/>` +
      `<path d="M-0.11 0.08L0.11 0.08L0 0.22Z"/>` +
      `<path d="M-0.32 0.32Q-0.16 0.52 0 0.34Q0.16 0.52 0.32 0.32Q0.16 0.42 0 0.28Q-0.16 0.42 -0.32 0.32Z"/>` +
      `<path d="M-0.94 0.12L-0.42 0.2L-0.94 0.18Z"/><path d="M-0.92 0.3L-0.42 0.26L-0.9 0.36Z"/><path d="M0.94 0.12L0.42 0.2L0.94 0.18Z"/><path d="M0.92 0.3L0.42 0.26L0.9 0.36Z"/>`,
    keep: `<ellipse cx="-0.38" cy="-0.2" rx="0.04" ry="0.17"/><ellipse cx="0.38" cy="-0.2" rx="0.04" ry="0.17"/>`,
  },
};

let clipIds = 0;

export interface Lighting {
  /** Standing on the ground in a scene: a shadow under it, and its candlelight on the ground. */
  ground?: boolean;
  /** Out in the night: dimmer, darker underneath, the moon catching its top. */
  night?: boolean;
  /** Warmth from lit pumpkins nearby, on its left and right (0 to 1). */
  warm?: [number, number];
}

/** One pumpkin standing at x, y (the middle of its bottom). `pre`: the ids of pumpkinDefs. */
export function drawPumpkin(pre: string, x: number, y: number, spec: PumpkinSpec, { ground = true, night = ground, warm = [0, 0] }: Lighting = {}) {
  const { size: W, face, palette = "orange", ribs = 5, squat = 0.82, stem = "short", extras = [], tilt = 0, unlit = false } = spec;
  const H = W * squat;
  const [, mid, dark, groove] = PALETTES[palette];
  const top = y - H;
  const k = (ribs - 1) / 2;
  const f = (n: number) => n.toFixed(2);
  // Its shadow: soft and wide, and dark right where it touches the ground.
  let s = ground
    ? `<ellipse cx="${f(x + W * 0.04)}" cy="${f(y)}" rx="${f(W * 0.62)}" ry="${f(H * 0.13)}" fill="#05020a" opacity="0.3"/><ellipse cx="${f(x)}" cy="${f(y - H * 0.01)}" rx="${f(W * 0.4)}" ry="${f(H * 0.055)}" fill="#05020a" opacity="0.55"/>`
    : "";

  // The lobes, outermost first, so the middle one is in front.
  const lobes: { t: number; cx: number; rx: number; ry: number }[] = [];
  for (let i = -k; i <= k; i++) {
    const t = i / k;
    const a = Math.abs(t);
    lobes.push({ t, cx: x + t * W * (ribs === 7 ? 0.35 : 0.31), rx: W * (ribs === 7 ? 0.25 - 0.06 * a : 0.3 - 0.07 * a), ry: (H / 2) * (0.88 + 0.12 * (1 - a)) });
  }
  lobes.sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
  let outline = "";
  for (const l of lobes) {
    const outer = Math.abs(l.t) > 0.7;
    const shape = `cx="${f(l.cx)}" cy="${f(y - l.ry)}" rx="${f(l.rx)}" ry="${f(l.ry)}"`;
    s += `<ellipse ${shape} fill="url(#${pre}${outer ? "pd" : "pb"}-${palette})"/>`;
    outline += `<ellipse ${shape}/>`;
  }
  // Grooves between the lobes, curving with the pumpkin.
  for (let i = -k; i < k; i++) {
    const t = (i + 0.5) / k;
    const gx = x + t * W * (ribs === 7 ? 0.35 : 0.31);
    const bow = t * W * 0.06;
    const depth = (H / 2) * (0.88 + 0.12 * (1 - Math.abs(t)));
    s += `<path d="M${f(gx - bow * 0.3)} ${f(y - depth * 1.9)}Q${f(gx + bow)} ${f(y - depth)} ${f(gx - bow * 0.3)} ${f(y - depth * 0.12)}" stroke="${groove}" stroke-width="${f(Math.max(0.6, W * 0.014))}" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  }
  // A soft shine, and the dip where the stem grows.
  s += `<ellipse cx="${f(x - W * 0.13)}" cy="${f(top + H * 0.26)}" rx="${f(W * 0.05)}" ry="${f(H * 0.13)}" fill="#fff" opacity="${palette === "ghost" ? 0.5 : 0.2}" transform="rotate(-18 ${f(x - W * 0.13)} ${f(top + H * 0.26)})"/>`;
  s += `<ellipse cx="${f(x)}" cy="${f(top + H * 0.05)}" rx="${f(W * 0.1)}" ry="${f(H * 0.035)}" fill="${groove}" opacity="0.7"/>`;

  // Light and shade over the body (gradients from pumpkinDefs).
  const lit = !!face && !unlit;
  const [warmL, warmR] = warm;
  if (night || lit || warmL || warmR) {
    const clip = `${pre}k${clipIds++}`;
    // (Each layer is kept to the outline by itself: as one group they'd have nothing beneath them
    // to blend with.)
    const box = `x="${f(x - W * 0.62)}" y="${f(top - H * 0.04)}" width="${f(W * 1.24)}" height="${f(H * 1.06)}" clip-path="url(#${clip})"`;
    let over = "";
    if (night) {
      // Lanterns are brighter than plain pumpkins sitting in the dark.
      // (Gentler on a white one, or it turns lilac.)
      if (!lit) over += `<rect ${box} fill="${palette === "ghost" ? "#b4adc4" : "#7d6aa6"}" style="mix-blend-mode:multiply"/>`;
      over += `<rect ${box} fill="url(#${pre}shade)"/><rect ${box} fill="url(#${pre}moonlit)"/>`;
    }
    if (warmL > 0.02) over += `<rect ${box} fill="url(#${pre}warmL)" opacity="${f(warmL)}" style="mix-blend-mode:screen"/>`;
    if (warmR > 0.02) over += `<rect ${box} fill="url(#${pre}warmR)" opacity="${f(warmR)}" style="mix-blend-mode:screen"/>`;
    if (lit) over += `<rect class="he-face" ${box} fill="url(#${pre}inner)" style="mix-blend-mode:screen"/>`;
    s += `<clipPath id="${clip}">${outline}</clipPath>${over}`;
  }

  if (extras.includes("warts"))
    for (const [u, v, r] of [[-0.22, 0.42, 0.045], [0.18, 0.3, 0.035], [0.3, 0.62, 0.05], [-0.34, 0.7, 0.035], [0.02, 0.78, 0.04]])
      s += `<circle cx="${f(x + u * W)}" cy="${f(top + v * H)}" r="${f(r * W)}" fill="${dark}"/><circle cx="${f(x + u * W - r * W * 0.3)}" cy="${f(top + v * H - r * W * 0.3)}" r="${f(r * W * 0.4)}" fill="${mid}"/>`;

  // A lit one's lid was cut round the stem: candlelight leaks out along the cut.
  if (lit && !extras.includes("hat")) {
    const lid = `M${f(x - W * 0.19)} ${f(top + H * 0.07)}L${f(x - W * 0.12)} ${f(top + H * 0.12)}L${f(x - W * 0.06)} ${f(top + H * 0.1)}L${f(x)} ${f(top + H * 0.15)}L${f(x + W * 0.06)} ${f(top + H * 0.1)}L${f(x + W * 0.12)} ${f(top + H * 0.12)}L${f(x + W * 0.19)} ${f(top + H * 0.07)}`;
    s += `<g class="he-face" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${lid}" stroke="#ff9a30" stroke-width="${f(W * 0.05)}" opacity="0.3"/><path d="${lid}" stroke="#ffd47a" stroke-width="${f(Math.max(0.5, W * 0.016))}"/></g>`;
  }
  if (!extras.includes("hat")) s += stemShape(pre, x, top + H * 0.05, W, stem);
  if (extras.includes("leaf")) s += leaf(x + W * 0.08, top + H * 0.02, W);
  if (extras.includes("bow")) s += bow(x, top + H * 0.02, W);

  if (face) s += carvedFace(pre, x, top + H * 0.54, W * 0.33, H * 0.35, FACES[face], mid, unlit);
  if (extras.includes("hat")) s += hat(x, top + H * 0.2, W);
  if (extras.includes("candle")) s += candle(pre, x - W * 0.04, top + H * 0.05, W);
  if (extras.includes("crow")) s += crow(x + W * 0.12, top + H * 0.04, W);

  // Its candlelight, falling on the ground around and in front of it.
  const light = lit && ground ? `<ellipse class="he-light" cx="${f(x)}" cy="${f(y + H * 0.08)}" rx="${f(W * 1.5)}" ry="${f(H * 0.36)}" fill="url(#${pre}pool)"/>` : "";
  const sleepy = face === "sleepy" ? zzz(x + W * 0.32, top - W * 0.02, W) : "";
  return `<g class="he-pumpkin he-pk--${face ?? "plain"} ${lit ? "is-jack" : ""}">${light}<g transform="rotate(${tilt} ${f(x)} ${f(y)})">${s}</g>${sleepy}</g>`;
}

function carvedFace(pre: string, cx: number, cy: number, sx: number, sy: number, parts: FaceParts, flesh: string, unlit: boolean) {
  const at = `transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})"`;
  const holes = (shapes: string, cls = "") => {
    if (unlit) return `<g class="${cls}" fill="#2a0e04" stroke="#4a1503" stroke-width="0.08">${shapes}</g>`;
    return (
      // The light spilling onto the skin around the holes...
      `<g class="${cls} he-face" filter="url(#${pre}fglow)" fill="#ffb347" opacity="0.9">${shapes}</g>` +
      // ...a dark cut edge, then the glowing inside with a rim of pale flesh.
      `<g class="${cls}" fill="none" stroke="#5a1c04" stroke-width="0.13">${shapes}</g>` +
      `<g class="${cls}" fill="url(#${pre}carve)" stroke="#ffd98a" stroke-width="0.06">${shapes}</g>`
    );
  };
  let s = holes(parts.carve, parts.awake ? "he-asleep-eyes" : "");
  if (parts.awake) s += holes(parts.awake, "he-awake-eyes");
  if (parts.keep) s += `<g fill="${flesh}" stroke="#4a1503" stroke-width="0.05">${parts.keep}</g>`;
  if (parts.paint) s += parts.paint;
  return `<g ${at}>${s}</g>`;
}

function stemShape(pre: string, x: number, y: number, W: number, kind: Stem) {
  const f = (n: number) => n.toFixed(2);
  const w = W * 0.075;
  if (kind === "curly" || kind === "bent") {
    const dir = kind === "bent" ? -1 : 1;
    const d =
      kind === "curly"
        ? `M${f(x)} ${f(y)}Q${f(x + w * 0.4)} ${f(y - W * 0.16)} ${f(x + w * 2)} ${f(y - W * 0.2)}`
        : `M${f(x)} ${f(y)}Q${f(x - w * 0.2)} ${f(y - W * 0.14)} ${f(x + dir * w * 2.2)} ${f(y - W * 0.17)}`;
    let s = `<path d="${d}" stroke="#46551f" stroke-width="${f(w * 1.6)}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#7d8f3e" stroke-width="${f(w * 0.6)}" fill="none" stroke-linecap="round" opacity="0.7"/>`;
    // A curly tendril.
    if (kind === "curly")
      s += `<path d="M${f(x + w * 0.8)} ${f(y - W * 0.08)}c${f(W * 0.12)} ${f(-W * 0.02)} ${f(W * 0.16)} ${f(W * 0.08)} ${f(W * 0.08)} ${f(W * 0.1)}c${f(-W * 0.05)} ${f(W * 0.01)} ${f(-W * 0.05)} ${f(-W * 0.05)} ${f(-W * 0.01)} ${f(-W * 0.05)}" stroke="#5f7a2c" stroke-width="${f(Math.max(0.6, W * 0.015))}" fill="none" stroke-linecap="round"/>`;
    return s;
  }
  const h = kind === "tall" ? W * 0.3 : W * 0.15;
  const lean = kind === "tall" ? W * 0.06 : W * 0.02;
  return (
    `<path d="M${f(x - w)} ${f(y + 1)}L${f(x - w * 0.75 + lean)} ${f(y - h)}Q${f(x + lean)} ${f(y - h - w * 0.6)} ${f(x + w * 0.85 + lean)} ${f(y - h + w * 0.2)}L${f(x + w * 1.05)} ${f(y + 1)}Z" fill="url(#${pre}stem)"/>` +
    `<path d="M${f(x - w * 0.3)} ${f(y)}L${f(x - w * 0.15 + lean)} ${f(y - h * 0.9)}M${f(x + w * 0.35)} ${f(y)}L${f(x + w * 0.4 + lean)} ${f(y - h * 0.85)}" stroke="#36431a" stroke-width="${f(Math.max(0.5, W * 0.01))}" opacity="0.7"/>`
  );
}

function leaf(x: number, y: number, W: number) {
  const f = (n: number) => n.toFixed(2);
  const l = W * 0.3;
  return (
    `<path d="M${f(x)} ${f(y)}Q${f(x + l * 0.5)} ${f(y - l * 0.6)} ${f(x + l)} ${f(y - l * 0.2)}Q${f(x + l * 0.55)} ${f(y + l * 0.15)} ${f(x)} ${f(y)}Z" fill="#4f7a2a"/>` +
    `<path d="M${f(x)} ${f(y)}Q${f(x + l * 0.5)} ${f(y - l * 0.25)} ${f(x + l * 0.9)} ${f(y - l * 0.2)}" stroke="#2f4a1a" stroke-width="${f(Math.max(0.5, W * 0.012))}" fill="none"/>`
  );
}

function bow(x: number, y: number, W: number) {
  const f = (n: number) => n.toFixed(2);
  const b = W * 0.12;
  return `<g fill="#8a4fd0" stroke="#5a2e94" stroke-width="${f(Math.max(0.5, W * 0.01))}"><path d="M${f(x)} ${f(y)}L${f(x - b * 1.4)} ${f(y - b * 0.7)}L${f(x - b * 1.4)} ${f(y + b * 0.7)}Z"/><path d="M${f(x)} ${f(y)}L${f(x + b * 1.4)} ${f(y - b * 0.7)}L${f(x + b * 1.4)} ${f(y + b * 0.7)}Z"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(b * 0.35)}"/></g>`;
}

/** A witch's hat, a little bent, with a purple band and a buckle. */
function hat(x: number, y: number, W: number) {
  const f = (n: number) => n.toFixed(2);
  const b = W * 0.5;
  const h = W * 0.62;
  return (
    `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(b)}" ry="${f(W * 0.08)}" fill="#1a1024" stroke="#3a2a50" stroke-width="${f(Math.max(0.6, W * 0.012))}"/>` +
    `<path d="M${f(x - b * 0.5)} ${f(y)}Q${f(x - b * 0.3)} ${f(y - h * 0.6)} ${f(x + b * 0.05)} ${f(y - h * 0.9)}Q${f(x + b * 0.3)} ${f(y - h * 1.02)} ${f(x + b * 0.62)} ${f(y - h * 0.78)}Q${f(x + b * 0.3)} ${f(y - h * 0.72)} ${f(x + b * 0.25)} ${f(y - h * 0.5)}Q${f(x + b * 0.4)} ${f(y - h * 0.2)} ${f(x + b * 0.5)} ${f(y)}Z" fill="#1a1024" stroke="#3a2a50" stroke-width="${f(Math.max(0.6, W * 0.012))}"/>` +
    `<path d="M${f(x - b * 0.47)} ${f(y - h * 0.08)}Q${f(x)} ${f(y - h * 0.02)} ${f(x + b * 0.48)} ${f(y - h * 0.1)}L${f(x + b * 0.45)} ${f(y - h * 0.2)}Q${f(x)} ${f(y - h * 0.13)} ${f(x - b * 0.42)} ${f(y - h * 0.2)}Z" fill="#7a3fc0"/>` +
    `<rect x="${f(x - W * 0.05)}" y="${f(y - h * 0.19)}" width="${f(W * 0.1)}" height="${f(h * 0.1)}" fill="none" stroke="#ffd36b" stroke-width="${f(Math.max(0.6, W * 0.015))}"/>`
  );
}

/** A stubby candle on top, wax dripping, its flame flickering. */
function candle(pre: string, x: number, y: number, W: number) {
  const f = (n: number) => n.toFixed(2);
  const w = W * 0.12;
  const h = W * 0.2;
  return (
    `<rect x="${f(x - w / 2)}" y="${f(y - h)}" width="${f(w)}" height="${f(h)}" rx="${f(w * 0.15)}" fill="#f3e6c8"/>` +
    `<path d="M${f(x - w / 2)} ${f(y - h * 0.8)}q${f(w * 0.12)} ${f(h * 0.5)} ${f(w * 0.25)} 0q${f(w * 0.15)} ${f(h * 0.25)} ${f(w * 0.3)} 0" fill="#f3e6c8" stroke="#d8c7a2" stroke-width="${f(Math.max(0.4, W * 0.006))}"/>` +
    `<path d="M${f(x)} ${f(y - h)}v${f(-h * 0.15)}" stroke="#2a1a10" stroke-width="${f(Math.max(0.5, W * 0.01))}"/>` +
    `<ellipse class="he-flame" cx="${f(x)}" cy="${f(y - h - h * 0.38)}" rx="${f(w * 0.42)}" ry="${f(h * 0.4)}" fill="url(#${pre}flame)"/>`
  );
}

/** A crow perched on top, looking about. */
function crow(x: number, y: number, W: number) {
  const s = W / 60;
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(3)})"><g class="he-crow"><path d="M-10 0c2-8 9-13 16-11l7-2-5 5c2 5-1 8-6 8h-9l-8 6 2-6z" fill="#0b0710" stroke="#2e2140" stroke-width="1"/><circle cx="6.5" cy="-8" r="1.3" fill="#ffd36b"/><path d="M-2 0l-1 4M2 0l1 4" stroke="#0b0710" stroke-width="1.4"/></g></g>`;
}

/** Sleepy's "z"s, drifting up. */
function zzz(x: number, y: number, W: number) {
  const s = Math.max(8, W * 0.3);
  return `<g class="he-zzz" fill="#ece4ff" stroke="#1a1024" stroke-width="0.8" paint-order="stroke" font-family="Baloo 2 Variable, sans-serif" font-weight="800">${[0, 1, 2]
    .map((i) => `<text x="${(x + i * s * 0.5).toFixed(1)}" y="${(y - i * s * 0.7).toFixed(1)}" font-size="${(s * (0.7 + i * 0.25)).toFixed(1)}" style="animation-delay:${i * 0.8}s">z</text>`)
    .join("")}</g>`;
}

/** A whole picture of one pumpkin (for the stylesheet), `w` x `h`, standing at the bottom middle. */
export function pumpkinPicture(w: number, h: number, spec: PumpkinSpec, pad = 1) {
  // A lit one glows softly all round (fading out well inside the picture's edges).
  const glow = spec.face && !spec.unlit ? `<ellipse cx="${w / 2}" cy="${h * 0.6}" rx="${w / 2}" ry="${h * 0.42}" fill="url(#pplight)"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${pumpkinDefs("p")}</defs>${glow}${drawPumpkin("p", w / 2, h - pad, spec, { ground: false })}</svg>`;
}

/** A random pumpkin of any sort, for scattering across the patch. */
export function anyPumpkin(rand: () => number, size: number): PumpkinSpec {
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const faces: (Face | undefined)[] = ["classic", "cute", "scary", "sleepy", "surprised", "wink", "goofy", "cyclops", "vampire", "cat", undefined, undefined, undefined];
  const face = pick(faces);
  return {
    size,
    face,
    palette: pick<Palette>(["orange", "orange", "deep", "pale", "pale", "ghost", "goblin"]),
    ribs: rand() < 0.3 ? 7 : 5,
    squat: 0.68 + rand() * 0.4,
    stem: pick<Stem>(["short", "curly", "bent", "tall"]),
    extras: face ? [] : rand() < 0.4 ? [pick<Extra>(["leaf", "warts", "bow"])] : [],
    tilt: (rand() - 0.5) * 12,
  };
}
