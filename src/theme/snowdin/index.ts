// Snowdin: a cozy snowy town at night, after the little RPG this app's name comes from.
// Everything here (pixel art, sounds, wording) is made for Da Librarby; nothing is taken from the game.
import "@fontsource-variable/pixelify-sans";
import "./snowdin.css";
import type { Theme } from "../themes";
import { HEART_RED, ICONS, setHeartColors } from "./art";
import { SOUNDS } from "./sounds";
import Decor from "./Decor";

export const SNOWDIN: Theme = {
  id: "snowdin",
  name: "Snowdin",
  description: "A cozy snowy town at night. Pixel text, warm windows, falling snow, little blips, and a red heart that follows you.",
  dark: true,
  extras: {
    options: [
      { id: "snow", label: "Falling snow", default: true },
      { id: "pointer", label: "Heart pointer", hint: "The mouse pointer becomes the heart.", default: true },
      {
        id: "heart",
        label: "Heart colour",
        kind: "color",
        // The seven colours a soul can have in the game.
        choices: [
          { value: HEART_RED, label: "Red: Determination" },
          { value: "#fca600", label: "Orange: Bravery" },
          { value: "#ffff00", label: "Yellow: Justice" },
          { value: "#00c000", label: "Green: Kindness" },
          { value: "#42fcff", label: "Light blue: Patience" },
          { value: "#003cff", label: "Blue: Integrity" },
          { value: "#d535d9", label: "Purple: Perseverance" },
        ],
        default: HEART_RED,
      },
      {
        id: "pointerOnly",
        label: "Colour only the pointer",
        hint: "The heart colour is used for the mouse pointer only; the other hearts stay red.",
        default: false,
      },
      { id: "typing", label: "Typing text", hint: "Descriptions type themselves out the first time you see them.", default: true },
      { id: "sounds", label: "Sounds", hint: "Little blips when you point at and pick things. Never during a video.", default: true },
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
      searchPlaceholder: "Search",
      searchNone: "* But nobody came.",
      emptyTitle: "* The shelves are empty.",
      emptyText: "* Add the folders or drives where your anime, shows and movies live, and they'll fill these shelves.",
      emptyScanTitle: "* Nothing on the shelves yet.",
      emptyScanText: "* No videos turned up so far. If the shelves are still being searched, they'll appear in a moment.",
      scanning: (place) => `* Looking through ${place || "the shelves"}…`,
      homeEnd: [
        "* The shelves are full of shows. It fills you with DETERMINATION.",
        "* You hear a dog snoring somewhere between the shelves.",
        "* The snow keeps falling outside. It's cozy in here.",
        "* Warm light spills out of the windows onto the snow.",
        "* Somewhere in town, someone is telling a terrible pun.",
        "* You feel like you're going to have a good time.",
      ],
      lateNight: [
        "* It's late. Someone motherly would want you in bed by now.",
        "* The whole town is asleep. Only the shelves are still awake.",
        "* It's past midnight. You hear a faint snore from the sentry station.",
      ],
      december: [
        "* Lights, presents and snow everywhere. It's Gyftmas in town.",
        "* Someone left a present under the tree. It's labelled \"for whoever is reading this\".",
      ],
      searchSecrets: {
        determination: "* You search the shelves for it... and find it was in you all along. You're filled with DETERMINATION.",
        librarby: "* It's spelled like that on purpose. Probably.",
        snowdin: "* You're already here. Welcome!",
        sans: "* You hear a rimshot somewhere in the distance.",
        papyrus: "* A tall skeleton would like you to know that he could find it much faster.",
        toriel: "* It smells like butterscotch-cinnamon pie in here.",
        dog: "* A little white dog runs off with your search. You let it.",
        "annoying dog": "* A little white dog runs off with your search. You let it.",
        "spaghetti": "* There is a plate of cold spaghetti here. Nobody is sure who made it.",
      },
      brandLines: [
        "* It's the Librarby. Somebody misspelled the sign.",
        "* You think about fixing the sign. You decide it has character.",
        "* The sign is still misspelled.",
        "* You knock on the sign. Nobody's there.",
        "* It's still the Librarby. It fills you with determination.",
      ],
    },
    sounds: SOUNDS,
    ownFiles: {
      font: true,
      sounds: [
        { name: "move", label: "Pointing at something" },
        { name: "select", label: "Picking something" },
        { name: "back", label: "Going back" },
        { name: "save", label: "Saved / marked watched" },
        { name: "nope", label: "Nothing found" },
        { name: "text", label: "Text typing" },
      ],
    },
    typing: true,
    icons: ICONS,
    apply: (options) => {
      const color = String(options.heart ?? HEART_RED);
      setHeartColors(options.pointerOnly === true ? HEART_RED : color, color);
      document.documentElement.classList.toggle("sd-heart-pointer", options.pointer !== false);
    },
    Decor,
  },
};
