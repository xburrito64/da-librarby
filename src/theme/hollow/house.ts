// The haunted house on the hill, in front of the moon: a crooked old place, leaning a little, its
// roof sagging. A skinny tower with a spire bent at the tip, a chimney with smoke curling out, a
// weathervane with a crow, a little porch with a lantern over the front door. Arched windows with shutters (one
// hanging loose), lights going on and off in them now and then, someone passing the round attic
// window, a bat leaving the tower once in a while. Point at it and the door creaks open a crack,
// and a pair of eyes looks out. The moon behind catches its outline. See hollow.css ("The house").

const f = (n: number) => n.toFixed(1);

const BLACK = "#0d0712";
/** The moonlight on its edges. */
const RIM = "#43345f";
const LIGHT = "#ffb347";

/** An arched window, `w` wide and `h` tall, its top left at x, y. */
function arch(x: number, y: number, w: number, h: number) {
  const r = w / 2;
  return `M${f(x)} ${f(y + h)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h)}Z`;
}

/** A window: lit (with its own way of going on and off) or dark, with crossbars and shutters. */
function window(id: string, x: number, y: number, w: number, h: number, light: "on" | "dark" | string, loose = false) {
  const shape = arch(x, y, w, h);
  const glass = light === "dark" ? `<path d="${shape}" fill="#1c1228"/>` : `<path class="${light === "on" ? "" : light}" d="${shape}" fill="${LIGHT}" filter="url(#${id}glow)"/>`;
  const bars = `<path d="M${f(x + w / 2)} ${f(y + 1)}V${f(y + h)}M${f(x)} ${f(y + h * 0.55)}H${f(x + w)}" stroke="${BLACK}" stroke-width="1.3"/>`;
  const sw = w * 0.42;
  const left = `<path d="M${f(x - sw - 0.6)} ${f(y + 1)}h${f(sw)}v${f(h - 1)}h${f(-sw)}Z"/>`;
  // The right one hangs from its top hinge only, swung askew.
  const right = loose
    ? `<path transform="rotate(16 ${f(x + w + 0.6)} ${f(y + 1)})" d="M${f(x + w + 0.6)} ${f(y + 1)}h${f(sw)}v${f(h - 1)}h${f(-sw)}Z"/>`
    : `<path d="M${f(x + w + 0.6)} ${f(y + 1)}h${f(sw)}v${f(h - 1)}h${f(-sw)}Z"/>`;
  return { glass: glass + bars, shutters: left + right };
}

/** The house, standing at x, y (the middle of its floor). */
export function house(id: string, x: number, y: number) {
  // The shapes of its outline (drawn once in moonlight a little larger, then in black on top, so
  // only the outer edge shows the moon).
  const shapes =
    // The main house, its left wall leaning.
    `<path d="M-40 8L-41-52L31-56L32 8Z"/>` +
    // Its roof, steep and sagging, hanging over the walls.
    `<path d="M-51-48Q-31-72-8-107Q10-80 42-53L40-49L-48-45Z"/>` +
    // The chimney, a little crooked, and its cap.
    `<path d="M-35-64L-34-90H-25L-24-70Z"/><path d="M-37-89H-22V-93H-37Z"/>` +
    // The tower and its spire, bent over at the tip.
    `<path d="M16 8L17-98L41-96L42 8Z"/>` +
    `<path d="M10-93L48-91Q37-108 34-130Q33-144 40-153Q31-150 28-138Q23-112 10-93Z"/>`;
  let s = `<g fill="${RIM}" stroke="${RIM}" stroke-width="2.6" stroke-linejoin="round">${shapes}</g><g fill="${BLACK}">${shapes}</g>`;

  // Where the roof overhangs the walls, and the tower's corner, catching a little moonlight.
  s += `<path d="M-47-45L39-49M17-91L16-50" stroke="${RIM}" stroke-width="0.9" fill="none" opacity="0.8"/>`;

  // Shingles in rows across the roof and the spire, a few missing.
  s += `<g stroke="#1d1530" stroke-width="1.1" fill="none" stroke-dasharray="3.5 1.6"><path d="M-40-58Q-8-60 30-58"/><path d="M-33-68Q-8-70 18-69"/><path d="M-25-79Q-8-81 8-80"/><path d="M-18-89Q-8-90 0-90"/><path d="M16-104H40M20-116H37M24-127H34"/></g>`;
  s += `<g fill="#231a38"><path d="M-21-73l5-1 1 4-5 1z"/><path d="M6-62l4 0 0 3.6-4 0.4z"/><path d="M27-120l3 0.4-0.4 3-3-0.4z"/></g>`;

  // The weathervane on the peak, a crow sitting on top.
  s += `<g stroke="${BLACK}" stroke-width="1.2" fill="none"><path d="M-8-106V-124M-16-118H0"/><path d="M-1-120L1.5-118L-1-116"/></g>`;
  s += `<path transform="translate(-8 -124) scale(0.5)" d="M-10 0c2-8 9-13 16-11l7-2-5 5c2 5-1 8-6 8h-9l-8 6 2-6z" fill="${BLACK}"/>`;

  // Windows: two in the house (one dark), two in the tower, and the round one in the attic.
  const w1 = window(id, -35, -42, 10, 18, "he-win he-win--a", true);
  const w2 = window(id, 5, -41, 8, 15, "dark");
  const w3 = window(id, 24, -86, 10, 16, "he-flicker");
  const w4 = window(id, 24, -52, 10, 17, "he-win he-win--b");
  s += w1.glass + w2.glass + w3.glass + w4.glass;
  s += `<g fill="${BLACK}" stroke="${RIM}" stroke-width="0.6">${w1.shutters + w2.shutters + w4.shutters}</g>`;
  s += `<clipPath id="${id}attic"><circle cx="-8" cy="-72" r="6"/></clipPath>`;
  s += `<circle cx="-8" cy="-72" r="6" fill="${LIGHT}" opacity="0.8" filter="url(#${id}glow)"/>`;
  s += `<g clip-path="url(#${id}attic)"><g class="he-attic"><circle cx="-8" cy="-74" r="2.6" fill="${BLACK}"/><path d="M-13-64Q-13-70-8-70.5Q-3-70-3-64Z" fill="${BLACK}"/></g></g>`;
  s += `<circle cx="-8" cy="-72" r="6" fill="none" stroke="${BLACK}" stroke-width="1.6"/><path d="M-8-78V-66M-14-72H-2" stroke="${BLACK}" stroke-width="1"/>`;

  // The front door: arched, planks, a knocker, light under it. Behind it, darkness with eyes in it.
  const door = arch(-13, -27, 14, 24);
  s += `<path d="${door}" fill="#120705"/>`;
  s += `<g class="he-door-eyes" fill="#ffd36b"><ellipse cx="-4" cy="-16" rx="1.1" ry="0.8"/><ellipse cx="-0.8" cy="-16" rx="1.1" ry="0.8"/></g>`;
  s += `<g class="he-door"><path d="${door}" fill="#2a1520" stroke="${BLACK}" stroke-width="1"/><path d="M-9.5-24V-3M-6-26.5V-3M-2.5-24.5V-3" stroke="#1a0c14" stroke-width="0.8"/><circle cx="-2" cy="-14" r="1.4" fill="none" stroke="#8a6a3a" stroke-width="0.7"/></g>`;
  s += `<path d="M-12.5-3.4H0.5" stroke="${LIGHT}" stroke-width="1" filter="url(#${id}glow)"/>`;
  // The porch over it: a little roof on two posts, a lantern hanging under it.
  s += `<g fill="${BLACK}" stroke="${RIM}" stroke-width="0.8" stroke-linejoin="round"><path d="M-25-30L-6-40L13-30L11-27.5L-6-36L-23-27.5Z"/><path d="M-22.6-28.5h2.2v25.5h-2.2ZM8.4-28.5h2.2v25.5h-2.2Z"/></g>`;
  s += `<path d="M5.5-31.5v3" stroke="${BLACK}" stroke-width="0.7"/><rect class="he-flicker he-flicker--slow" x="4" y="-28.5" width="3" height="3.6" rx="0.6" fill="${LIGHT}" filter="url(#${id}glow)"/>`;

  // Smoke curling out of the chimney, and the bat that leaves the tower now and then.
  s += `<g class="he-chimney-smoke" fill="#8b7aa3">${[0, 1, 2].map((i) => `<circle cx="-29.5" cy="-96" r="2.6" style="animation-delay:${i * 1.6}s"/>`).join("")}</g>`;
  s += `<path class="he-house-bat" d="M27-80q3-3 6 0q2-1 3 1q1-2 3-1q3-3 6 0q-4 0-5 3q-2-1-4 0q-1-3-9-3z" fill="${BLACK}"/>`;

  // The hill swelling round its foot, then the steps up to the door, lit from under it.
  const outside =
    `<ellipse cx="0" cy="6" rx="66" ry="9" fill="#140b1d"/>` +
    `<ellipse cx="-6" cy="-1" rx="12" ry="3.5" fill="${LIGHT}" opacity="0.18" filter="url(#${id}glow)"/>` +
    `<path d="M-16-3h20v3h-20ZM-19 0h26v3.4h-26Z" fill="#1d1428" stroke="#2c2140" stroke-width="0.6"/>`;
  return `<g class="he-house" transform="translate(${f(x)} ${f(y)}) rotate(-2)">${s}</g><g transform="translate(${f(x)} ${f(y)})">${outside}</g>`;
}
