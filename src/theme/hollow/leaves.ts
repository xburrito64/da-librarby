// Autumn leaves drifting down over the library, tumbling and swaying as they go: a few at a time,
// in front of the pages (under the top bar and dialogs). See hollow.css (".he-leaves").

/** One leaf per this many square pixels of window. */
const AREA_PER_LEAF = 90000;
const COLORS = ["#c4501a", "#d9822b", "#9a3c12", "#b8621b", "#e0a03a", "#7a2e10"];

interface Leaf {
  x: number;
  y: number;
  size: number;
  fall: number;
  sway: number;
  phase: number;
  angle: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  color: string;
  maple: boolean;
  alpha: number;
}

function spawn(w: number, h: number, anywhere: boolean): Leaf {
  const near = Math.random() < 0.3;
  return {
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : -20 - Math.random() * 60,
    size: near ? 12 + Math.random() * 6 : 7 + Math.random() * 4,
    fall: near ? 34 + Math.random() * 18 : 18 + Math.random() * 16,
    sway: 18 + Math.random() * 26,
    phase: Math.random() * Math.PI * 2,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 2.4,
    flip: Math.random() * Math.PI * 2,
    flipSpeed: 1.5 + Math.random() * 2.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    maple: Math.random() < 0.45,
    alpha: near ? 0.85 : 0.55,
  };
}

/** A maple leaf's outline (five points), in a box from -1 to 1. */
const MAPLE = [
  [0, -1], [0.18, -0.55], [0.55, -0.72], [0.45, -0.3], [0.95, -0.2], [0.55, 0.12], [0.7, 0.45], [0.2, 0.32],
  [0.06, 0.62], [0, 1], [-0.06, 0.62], [-0.2, 0.32], [-0.7, 0.45], [-0.55, 0.12], [-0.95, -0.2], [-0.45, -0.3],
  [-0.55, -0.72], [-0.18, -0.55],
];

function draw(g: CanvasRenderingContext2D, l: Leaf) {
  g.save();
  g.translate(l.x, l.y);
  g.rotate(l.angle);
  // Tumbling: squashed sideways as it turns over, darker on its back.
  const turn = Math.cos(l.flip);
  g.scale(l.size * (0.25 + 0.75 * Math.abs(turn)), l.size);
  g.globalAlpha = l.alpha;
  g.fillStyle = l.color;
  g.beginPath();
  if (l.maple) MAPLE.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  else {
    g.moveTo(0, -1);
    g.quadraticCurveTo(0.75, -0.2, 0, 1);
    g.quadraticCurveTo(-0.75, -0.2, 0, -1);
  }
  g.closePath();
  g.fill();
  if (turn < 0) {
    g.fillStyle = "rgba(20, 8, 4, 0.35)";
    g.fill();
  }
  // Its middle vein and stalk.
  g.strokeStyle = "rgba(60, 22, 8, 0.6)";
  g.lineWidth = 0.09;
  g.beginPath();
  g.moveTo(0, -0.8);
  g.lineTo(0, 1.25);
  g.stroke();
  g.restore();
}

/** Starts the leaves falling on `el`; returns the way to stop them. */
export function startLeaves(el: HTMLCanvasElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const g = el.getContext("2d")!;
  let list: Leaf[] = [];
  let frame = 0;
  let last = performance.now();
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (list.length > 0 && el.width === Math.round(w * dpr) && el.height === Math.round(h * dpr)) return;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    list = Array.from({ length: Math.max(4, Math.round((w * h) / AREA_PER_LEAF)) }, () => spawn(w, h, true));
  };
  const step = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    fit();
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    list = list.map((l) => {
      l.phase += dt * 0.9;
      l.y += l.fall * dt * (0.75 + 0.25 * Math.cos(l.phase * 2));
      l.x += Math.sin(l.phase) * l.sway * dt;
      l.angle += l.spin * dt;
      l.flip += l.flipSpeed * dt;
      if (l.y > h + 30) return spawn(w, h, false);
      draw(g, l);
      return l;
    });
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    g.clearRect(0, 0, el.width, el.height);
  };
}
