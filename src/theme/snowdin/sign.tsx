// The town sign in the navigation hangs from two ropes like a pendulum: pointing at it is a
// breeze that sets it rocking gently, and a click pushes it away from where you clicked. Swinging
// knocks clumps of snow off its top, which builds up again over a few minutes. Now and then the
// dog is asleep on top of it: then clicks only nudge the sign, and a few of them wake the dog,
// which trots off. See snowdin.css ("The town sign").
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { SoundName } from "../sound";

/** The dog is asleep on the sign at about one start in five... */
const START_CHANCE = 0.2;
/** ...and sometimes when you come back after a while away. */
const RETURN_CHANCE = 0.34;
const AWAY_MS = 10 * 60 * 1000;
/** Clicks it takes to wake the dog. */
const NUDGES_TO_WAKE = 3;
/** How long getting up and trotting off takes (as in snowdin.css). */
const LEAVING_MS = 1700;

// The pendulum, in degrees and seconds: it swings back and forth about every 1.7 seconds and
// slowly comes to rest.
const STIFFNESS = ((2 * Math.PI) / 1.7) ** 2;
const DAMPING = 0.9;
/** Pointing at it: a breeze in time with its swing, rocking it about a degree each way. */
const BREEZE = 1.1 * DAMPING * Math.sqrt(STIFFNESS);
/** A click's push (so it swings out about 6 degrees), and the gentle one with the dog on it. */
const PUSH = 24;
const NUDGE = 5;
/** Each swing knocks off this much of the snow (all of it is 1): five swings clear it... */
const SNOW_PER_SWING = 0.2;
/** ...which takes this long to build up again from nothing. */
const SNOW_REGROW_S = 180;

const NUDGE_LINES = [
  "* The dog is sleeping on the sign. You decide not to swing it.",
  "* The dog is still asleep. It's dreaming about bones, probably.",
];
const WAKE_LINE = "* The dog wakes up, stretches, and trots off. The sign feels lighter.";

type Dog = "away" | "asleep" | "leaving";

/** A clump of snow falling off the sign (screen position, sideways throw, drop, size). */
interface Clump {
  id: number;
  x: number;
  y: number;
  dx: number;
  fall: number;
  size: number;
  ms: number;
}

let dog: Dog = "away";
let nudges = 0;
let clumps: Clump[] = [];
let nextClump = 0;
const listeners = new Set<() => void>();

function changed() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function maybeArrive(chance: number) {
  if (dog !== "away" || Math.random() >= chance) return;
  dog = "asleep";
  nudges = 0;
  changed();
}

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const signEl = () => document.querySelector<HTMLElement>(".nav__brand");

// ----- The pendulum

let angle = 0;
let speed = 0;
let hovered = false;
let breezeTime = 0;
let frame = 0;
let last = 0;
/** Which side the last press on the sign was on (-1 left, 1 right). */
let pressSide = 1;

function step(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let force = -STIFFNESS * angle - DAMPING * speed;
  if (hovered) {
    breezeTime += dt;
    force += BREEZE * Math.sin(Math.sqrt(STIFFNESS) * breezeTime);
  }
  speed += force * dt;
  angle += speed * dt;
  const sign = signEl();
  if (!hovered && Math.abs(angle) < 0.02 && Math.abs(speed) < 0.05) {
    // At rest again.
    angle = speed = 0;
    if (sign) sign.style.transform = "";
    frame = 0;
    return;
  }
  if (sign) sign.style.transform = `rotate(${angle.toFixed(3)}deg)`;
  frame = requestAnimationFrame(step);
}

function wake() {
  if (frame || still()) return;
  last = performance.now();
  frame = requestAnimationFrame(step);
}

/** Pushes the sign's bottom towards `side` (-1 left, 1 right). Turning it clockwise (a positive
 *  angle) about its hook above moves the bottom to the left, hence the minus. */
function push(side: number, amount: number) {
  speed -= side * amount;
  wake();
}

// ----- The snow on top

let snow = 1;
let snowTimer = 0;

function showSnow() {
  signEl()?.style.setProperty("--sd-sign-snow", snow.toFixed(3));
}

function regrow() {
  window.clearInterval(snowTimer);
  snowTimer = window.setInterval(() => {
    snow = Math.min(1, snow + 1 / SNOW_REGROW_S);
    showSnow();
    if (snow >= 1) window.clearInterval(snowTimer);
  }, 1000);
}

/** Knocks some snow off, thrown towards `side` (-1 left, 1 right). */
function shakeSnow(side: number) {
  const sign = signEl();
  const lost = Math.min(snow, SNOW_PER_SWING);
  if (!sign || lost < 0.05) return;
  snow -= lost;
  showSnow();
  regrow();
  if (still()) return;
  const r = sign.getBoundingClientRect();
  const count = Math.round(lost * 30);
  const fresh: Clump[] = [];
  for (let i = 0; i < count; i++) {
    fresh.push({
      id: nextClump++,
      // Mostly from the end it swings towards, flung clear of the board.
      x: r.left + r.width / 2 + side * Math.random() * (r.width / 2 - 4) - 4,
      y: r.top - 6 - Math.random() * 6,
      dx: side * (40 + Math.random() * 80),
      fall: 80 + Math.random() * 80,
      size: [3, 3, 6, 6, 9][Math.floor(Math.random() * 5)],
      ms: 850 + Math.random() * 450,
    });
  }
  clumps = [...clumps, ...fresh];
  changed();
  window.setTimeout(() => {
    clumps = clumps.filter((c) => !fresh.includes(c));
    changed();
  }, 1400);
}

/** The theme's answer to a click on the sign: something to say, or null for the usual lines. */
export function signClick({ sound }: { sound: (name: SoundName) => void }): string | null {
  // Pushed away from where it was clicked: its bottom swings towards `side`.
  const side = -pressSide;
  if (dog === "asleep") {
    nudges += 1;
    push(side, NUDGE);
    if (nudges < NUDGES_TO_WAKE) {
      sound("move");
      return NUDGE_LINES[(nudges - 1) % NUDGE_LINES.length];
    }
    dog = "leaving";
    changed();
    sound("select");
    window.setTimeout(() => {
      dog = "away";
      changed();
    }, LEAVING_MS);
    return WAKE_LINE;
  }
  if (dog === "leaving") return null;
  push(side, PUSH);
  shakeSnow(side);
  sound("select");
  return null;
}

/** The dog (when it's there) on the sign's `.nav__decor` spot, and falling clumps of snow. */
export function SignExtras() {
  const state = useSyncExternalStore(subscribe, () => dog);
  const falling = useSyncExternalStore(subscribe, () => clumps);
  const [spot, setSpot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSpot(document.querySelector<HTMLElement>(".nav__decor"));
    maybeArrive(START_CHANCE);
    showSnow();

    const sign = signEl();
    const enter = () => {
      hovered = true;
      wake();
    };
    const leave = () => (hovered = false);
    const press = (e: PointerEvent) => {
      const r = sign!.getBoundingClientRect();
      pressSide = e.clientX < r.left + r.width / 2 ? -1 : 1;
    };
    sign?.addEventListener("pointerenter", enter);
    sign?.addEventListener("pointerleave", leave);
    sign?.addEventListener("pointerdown", press);

    // Back after a good while away: the dog may have climbed up for a nap.
    let leftAt = 0;
    const onBlur = () => (leftAt = Date.now());
    const onFocus = () => {
      if (leftAt && Date.now() - leftAt >= AWAY_MS) maybeArrive(RETURN_CHANCE);
      leftAt = 0;
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      sign?.removeEventListener("pointerenter", enter);
      sign?.removeEventListener("pointerleave", leave);
      sign?.removeEventListener("pointerdown", press);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      hovered = false;
    };
  }, []);

  return (
    <>
      {spot &&
        state !== "away" &&
        createPortal(
          <span className={`sd-sign__dog ${state === "leaving" ? "is-leaving" : ""}`}>
            {state === "asleep" && (
              <span className="sd-sign__z">
                <i>z</i>
                <i>z</i>
                <i>Z</i>
              </span>
            )}
          </span>,
          spot,
        )}
      {falling.length > 0 &&
        createPortal(
          <span className="sd-clumps" aria-hidden="true">
            {falling.map((c) => (
              <span
                key={c.id}
                className="sd-clump"
                style={
                  {
                    left: c.x,
                    top: c.y,
                    "--dx": `${c.dx}px`,
                    "--fall": `${c.fall}px`,
                    "--size": `${c.size}px`,
                    "--ms": `${c.ms}ms`,
                  } as React.CSSProperties
                }
              >
                <i />
              </span>
            ))}
          </span>,
          document.body,
        )}
    </>
  );
}
