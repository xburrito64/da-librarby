// The list of themes. Each one is a stylesheet in this folder (see README.md here for how to add one).
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

export interface Theme {
  id: string;
  name: string;
  description: string;
  /** Dark themes get a dark window title bar. */
  dark: boolean;
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
];

export const DEFAULT_THEME = "velvet";

export function findTheme(id: string | null | undefined): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}
