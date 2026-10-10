// The list of themes. Each one is a stylesheet in this folder (see README.md here for how to add one).
import type { ComponentType } from "react";
import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import "@fontsource-variable/inter";
import "@fontsource/chakra-petch/400.css";
import "@fontsource/chakra-petch/500.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/nunito";

import "./base.css";
import "./velvet.css";
import "./paper.css";
import "./neon.css";
import "./mochi.css";
import type { Copy } from "./copy";
import type { SoundName, SoundPlayer } from "./sound";
import { SNOWDIN } from "./snowdin";
import { HOLLOW } from "./hollow";

export interface Theme {
  id: string;
  name: string;
  description: string;
  /** Dark themes get a dark window title bar. */
  dark: boolean;
  /** Extra pieces beyond colours, fonts and shapes. All optional. */
  extras?: ThemeExtras;
}

export interface ThemeExtras {
  /** Settings of its own, shown under the theme in Settings → Appearance. */
  options?: ThemeOption[];
  /** Texts that replace the app's usual ones (empty pages, loading lines, flavor). */
  copy?: Partial<Copy>;
  /** Little interface sounds. They play while the theme's "sounds" option is on: made up on the
   *  spot, or the addresses of recordings (with several, one at random each time). */
  sounds?: Partial<Record<SoundName, SoundPlayer | string[]>>;
  /** Descriptions and messages type themselves out while the "typing" option is on. */
  typing?: boolean;
  /** Replacement icons, by name (see src/ui/icons.tsx), drawn from rows of "#" and ".". */
  icons?: Record<string, string[]>;
  /** A folder on this PC where the owner can add their own font ("font.*") and sound files
   *  (named after the sounds below), used instead of the theme's, and background music
   *  ("music.*", played at the "music" option's level). Shown in Settings → Appearance. */
  ownFiles?: { font?: boolean; sounds?: { name: SoundName; label: string }[]; music?: boolean };
  /** Called with the theme's option values while it's the current theme, and again whenever they
   *  change (e.g. to recolour its artwork). */
  apply?: (options: Record<string, boolean | string | undefined>) => void;
  /** Clicking the app's name: return something to say, or null for the usual `copy.brandLines`.
   *  With this, the name no longer goes back Home (it's the theme's toy). `sound` plays one of
   *  the theme's sounds. */
  brandClick?: (args: { sound: (name: SoundName) => void }) => string | null;
  /** Shown over everything when something is played from the library, while its "intro" option
   *  is on. It calls `onCovered` once the screen is covered (the video starts underneath) and
   *  `onDone` when it's finished. `x`, `y`: where the click was; `sound` plays one of the
   *  theme's sounds. */
  PlayIntro?: ComponentType<{ x: number; y: number; sound: (name: SoundName) => void; onCovered: () => void; onDone: () => void }>;
  /** Drawn behind the library screens (e.g. falling snow); gets the theme's option values. */
  Decor?: ComponentType<{ active: boolean; options: Record<string, boolean | string | undefined> }>;
}

export interface ThemeOption {
  id: string;
  label: string;
  hint?: string;
  /** "color": a colour, picked from `choices` (values are "#rrggbb") or chosen freely. */
  kind?: "color";
  /** Pick one of these; a plain on/off switch when left out. */
  choices?: { value: string; label: string }[];
  default: boolean | string;
}

export const THEMES: Theme[] = [
  {
    id: "velvet",
    name: "Velvet",
    description: "Cinematic and dark. Deep blacks, soft glass, and colour that glows out of the artwork.",
    dark: true,
  },
  {
    id: "paper",
    name: "Paper",
    description: "A film magazine. Warm paper, ink-black serif headlines, thin rules and a red spot colour.",
    dark: false,
  },
  {
    id: "neon",
    name: "Neon",
    description: "Synthwave arcade. Midnight purple, glowing magenta and cyan, sharp corners and readouts.",
    dark: true,
  },
  {
    id: "mochi",
    name: "Mochi",
    description: "Soft and cosy. Pastel lavender and peach, rounded everything, bouncy little covers.",
    dark: false,
  },
  SNOWDIN,
  HOLLOW,
];

export const DEFAULT_THEME = "velvet";

export function findTheme(id: string | null | undefined): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}
