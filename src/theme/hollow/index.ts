// Hollow's Eve: a pumpkin patch on Halloween night. Cute on the whole, with a few creepy surprises:
// glowing jack-o'-lanterns, bats and a spider in the top bar, a ghost behind the tombstones, embers
// and fog. Everything here (drawings, sounds, wording) is made for Da Librarby.
import "@fontsource/creepster/400.css";
import "@fontsource-variable/baloo-2";
import "./hollow.css";
import type { Theme } from "../themes";
import { SOUNDS } from "./sounds";
import Decor from "./Decor";
import Candle from "./Candle";
import { drawArt } from "./art";

drawArt();

const TRICKS = [
  "Trick! Something just floated past… did you see that?",
  "Trick! The lights went out for a second. Totally normal. Probably.",
  "Trick! Boo. (Sorry. It had to be done.)",
];
const TREATS = [
  (name: string) => `Treat! How about ${name} tonight?`,
  (name: string) => `Treat! The pumpkin thinks you'd like ${name}.`,
  (name: string) => `Treat! ${name} has been waiting for you.`,
];
const PLAIN_TREATS = [
  "Treat! You get a piece of candy corn. (It's imaginary. Still counts.)",
  "Treat! The bats say hi.",
];

let lit = true;
let lastWasTrick = false;

function say(text: string) {
  window.dispatchEvent(new CustomEvent("da:say", { detail: text }));
}

/** A title on screen to suggest, for a treat. */
function somethingToWatch() {
  const names = [...document.querySelectorAll(".card__name, .ccard__show")].map((el) => el.textContent?.trim()).filter((n): n is string => !!n);
  return names.length > 0 ? names[Math.floor(Math.random() * names.length)] : null;
}

/** Clicking the jack-o'-lantern by the app's name: trick or treat. */
function trickOrTreat({ sound }: { sound: (name: "snuff" | "ignite" | "trick" | "treat") => void }) {
  if (!lit) return null;
  lit = false;
  const root = document.documentElement;
  root.classList.add("he-jack-out");
  sound("snuff");
  const trick = !lastWasTrick && Math.random() < 0.4;
  lastWasTrick = trick;
  window.setTimeout(() => {
    if (trick) {
      window.dispatchEvent(new CustomEvent("he:trick"));
      sound("trick");
      say(TRICKS[Math.floor(Math.random() * TRICKS.length)]);
    } else {
      sound("treat");
      const name = somethingToWatch();
      say(name ? TREATS[Math.floor(Math.random() * TREATS.length)](name) : PLAIN_TREATS[Math.floor(Math.random() * PLAIN_TREATS.length)]);
    }
  }, 380);
  window.setTimeout(() => {
    root.classList.remove("he-jack-out");
    lit = true;
    sound("ignite");
  }, 1900);
  return null;
}

/** Hours watched, by candlelight: one candle burns down in about four hours. */
function statsLine(seconds: number) {
  const candles = Math.round(seconds / (4 * 3600));
  if (candles < 1) return "Not even one candle burned down yet.";
  return `That's about ${candles} candle${candles === 1 ? "" : "s"} burned down to the wick.`;
}

export const HOLLOW: Theme = {
  id: "hollow",
  name: "Hollow's Eve",
  description: "A pumpkin patch on Halloween night. Glowing jack-o'-lanterns, bats, fog and embers, and a few spooky surprises.",
  dark: true,
  extras: {
    options: [
      { id: "leaves", label: "Falling leaves", default: true },
      { id: "embers", label: "Embers and fog", default: true },
      {
        id: "surprises",
        label: "Spooky surprises",
        hint: "The ghost peeking out from behind its tombstone, eyes in the dark, that sort of thing.",
        default: true,
      },
      { id: "intro", label: "Candle out", hint: "Pressing Play blows out a candle before the video starts.", default: true },
      { id: "sounds", label: "Sounds", hint: "Plucked strings, an organ, candles, bats and creaky doors. Never during a video.", default: true },
      {
        id: "music",
        label: "Music",
        hint: "Your own music file, quietly in the background (see Your own files below). Never during a video.",
        choices: [
          { value: "off", label: "Off" },
          { value: "quiet", label: "Quiet" },
          { value: "normal", label: "Normal" },
          { value: "loud", label: "Loud" },
        ],
        default: "normal",
      },
      {
        id: "volume",
        label: "Sound volume",
        choices: [
          { value: "quiet", label: "Quiet" },
          { value: "normal", label: "Normal" },
          { value: "loud", label: "Loud" },
        ],
        default: "normal",
      },
    ],
    copy: {
      searchNone: "Nothing here but cobwebs. Try another word.",
      emptyTitle: "This place is empty. Spooky.",
      emptyText: "Add the folders or drives where your anime, shows and movies live, and they'll fill this place up.",
      emptyScanTitle: "Nothing has crept in yet",
      emptyScanText: "No videos turned up so far. If your folders are still being searched, they'll appear in a moment.",
      scanning: (place) => `Rummaging through ${place || "the attic"}…`,
      homeEnd: [
        "Somewhere in the patch, a pumpkin is grinning at you.",
        "The candles are burning low. One more episode?",
        "Something is scratching at the window. It's a branch. Probably.",
        "The bats are asleep. Try not to wake them.",
        "A black cat watches you from the fence. It approves of your taste.",
        "The fog is rolling in. Perfect weather for staying in.",
      ],
      lateNight: [
        "It's the witching hour. Everything is a little spookier now.",
        "Past midnight. Even the ghost has gone to bed.",
        "The candles are nearly out. Time for bed?",
      ],
      searchSecrets: {
        boo: "Eek! Oh. It's just you.",
        "trick or treat": "Treat! You found a secret. That's the treat.",
        pumpkin: "The pumpkin patch is right there, under the spotlight. Try pointing at one.",
        ghost: "It's shy. If you look right at it, it hides.",
        halloween: "It's always Halloween in here. Well, in October.",
        "hollow's eve": "You're already here. Welcome! Mind the bats.",
        candy: "You find a piece of candy corn. It's been here since last year.",
        bats: "They're sleeping on the branch up top. Go on, wake them.",
        spider: "It lives in the top bar. It's more scared of you than you are of it.",
      },
      seasonDone: (show, season) => `${season} of ${show}, all watched! You've earned a treat.`,
      showDone: (show) => `You watched every episode of ${show}. Spooktacular!`,
      sleepDone: "Sleep timer: the candles went out. Good night!",
      statsEmpty: "Nothing watched yet. The candles are waiting.",
      statsLine,
      brandLines: [],
    },
    sounds: SOUNDS,
    ownFiles: {
      sounds: [
        { name: "move", label: "Pointing at something" },
        { name: "select", label: "Picking something" },
        { name: "back", label: "Going back" },
        { name: "save", label: "Saved / marked watched" },
        { name: "nope", label: "Nothing found" },
        { name: "snuff", label: "A candle blown out" },
        { name: "ignite", label: "A candle lit" },
        { name: "boo", label: "The ghost, startled" },
        { name: "flutter", label: "Bats taking off" },
        { name: "treat", label: "Treat! / a secret found" },
        { name: "trick", label: "Trick!" },
        { name: "skitter", label: "The spider scurrying up" },
        { name: "bonk", label: "A pumpkin bonked" },
        { name: "creak", label: "The house's door creaking" },
        { name: "rattle", label: "The skeleton waking up" },
        { name: "scrape", label: "The coffin lid sliding" },
        { name: "moan", label: "Whoever's in the coffin" },
      ],
      music: true,
    },
    Decor,
    PlayIntro: Candle,
    brandClick: trickOrTreat,
  },
};
