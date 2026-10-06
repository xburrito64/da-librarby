// Snowdin: a cozy snowy town at night, after the little RPG this app's name comes from.
// Everything here (pixel art, sounds, wording) is made for Da Librarby; nothing is taken from the game.
import "@fontsource-variable/pixelify-sans";
import "./snowdin.css";
import type { Theme } from "../themes";
import { ICONS } from "./art";
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
    },
    sounds: SOUNDS,
    typing: true,
    icons: ICONS,
    Decor,
  },
};
