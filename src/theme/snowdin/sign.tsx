// The town sign in the navigation: it hangs from two ropes, sways while pointed at, and swings
// when clicked (its snow falls off and builds up again over a few minutes). Now and then the dog
// is asleep on top of it: then clicks only nudge the sign, and a few of them wake the dog, which
// trots off. See snowdin.css ("The town sign").
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

const NUDGE_LINES = [
  "* The dog is sleeping on the sign. You decide not to swing it.",
  "* The dog is still asleep. It's dreaming about bones, probably.",
];
const WAKE_LINE = "* The dog wakes up, stretches, and trots off. The sign feels lighter.";

type Dog = "away" | "asleep" | "leaving";

let dog: Dog = "away";
let nudges = 0;
/** Counts snow puffs, so each click gets its own falling snow. */
let puffs = 0;
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

/** Plays one of the sign's animations from the start (`cls` comes off again when it's done). */
function animate(cls: string) {
  const sign = document.querySelector<HTMLElement>(".nav__brand");
  if (!sign || still()) return;
  sign.classList.remove("sd-sign-swing", "sd-sign-nudge");
  void sign.offsetWidth;
  sign.classList.add(cls);
  sign.addEventListener("animationend", () => sign.classList.remove(cls), { once: true });
}

/** Knocks the snow off the sign; it builds up again slowly (a long transition in snowdin.css). */
function shakeSnow() {
  const sign = document.querySelector<HTMLElement>(".nav__brand");
  if (!sign) return;
  sign.classList.add("sd-sign-bare");
  requestAnimationFrame(() => requestAnimationFrame(() => sign.classList.remove("sd-sign-bare")));
  puffs += 1;
  changed();
}

/** The theme's answer to a click on the sign: something to say, or null for the usual lines. */
export function signClick({ sound }: { sound: (name: SoundName) => void }): string | null {
  if (dog === "asleep") {
    nudges += 1;
    animate("sd-sign-nudge");
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
  animate("sd-sign-swing");
  shakeSnow();
  sound("select");
  return null;
}

/** The dog (when it's there) and falling snow, drawn onto the sign's `.nav__decor` spot. */
export function SignExtras() {
  const state = useSyncExternalStore(subscribe, () => dog);
  const puff = useSyncExternalStore(subscribe, () => puffs);
  const [spot, setSpot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSpot(document.querySelector<HTMLElement>(".nav__decor"));
    maybeArrive(START_CHANCE);
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
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!spot) return null;
  return createPortal(
    <>
      {state !== "away" && (
        <span className={`sd-sign__dog ${state === "leaving" ? "is-leaving" : ""}`}>
          {state === "asleep" && (
            <span className="sd-sign__z">
              <i>z</i>
              <i>z</i>
              <i>Z</i>
            </span>
          )}
        </span>
      )}
      {puff > 0 && (
        <span key={puff} className="sd-sign__puff">
          {[8, 22, 37, 51, 66, 80, 93].map((x, i) => (
            <i key={i} style={{ left: `${x}%`, animationDelay: `${(i % 3) * 60}ms` }} />
          ))}
        </span>
      )}
    </>,
    spot,
  );
}
