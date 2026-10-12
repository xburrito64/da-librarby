// Hollow's Eve's fonts, picked in Settings → Appearance: the titles' (and headings') font, and the
// font on the stone tablet under the home screen's big title. Each comes in at about the same size
// as the one it replaces (scaled by how tall its letters are drawn), so switching doesn't make
// titles jump bigger or smaller.
import "@fontsource/germania-one/400.css";
import "@fontsource/cinzel-decorative/700.css";
import "@fontsource/metamorphous/400.css";
import "@fontsource/im-fell-english-sc/400.css";
import "@fontsource/jolly-lodger/400.css";
import "@fontsource/pirata-one/400.css";
import "@fontsource/im-fell-english/400.css";
import "@fontsource-variable/eb-garamond";
import "@fontsource/almendra/400.css";
import "@fontsource/fondamento/400.css";
import "@fontsource/spectral/400.css";
import germania from "@fontsource/germania-one/files/germania-one-latin-400-normal.woff2?url";
import cinzel from "@fontsource/cinzel-decorative/files/cinzel-decorative-latin-700-normal.woff2?url";
import cinzelExt from "@fontsource/cinzel-decorative/files/cinzel-decorative-latin-ext-700-normal.woff2?url";
import metamorphous from "@fontsource/metamorphous/files/metamorphous-latin-400-normal.woff2?url";
import metamorphousExt from "@fontsource/metamorphous/files/metamorphous-latin-ext-400-normal.woff2?url";
import fellSc from "@fontsource/im-fell-english-sc/files/im-fell-english-sc-latin-400-normal.woff2?url";
import jolly from "@fontsource/jolly-lodger/files/jolly-lodger-latin-400-normal.woff2?url";
import jollyExt from "@fontsource/jolly-lodger/files/jolly-lodger-latin-ext-400-normal.woff2?url";
import pirata from "@fontsource/pirata-one/files/pirata-one-latin-400-normal.woff2?url";
import pirataExt from "@fontsource/pirata-one/files/pirata-one-latin-ext-400-normal.woff2?url";
import fell from "@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff2?url";
import garamond from "@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2?url";
import garamondExt from "@fontsource-variable/eb-garamond/files/eb-garamond-latin-ext-wght-normal.woff2?url";
import almendra from "@fontsource/almendra/files/almendra-latin-400-normal.woff2?url";
import almendraExt from "@fontsource/almendra/files/almendra-latin-ext-400-normal.woff2?url";
import fondamento from "@fontsource/fondamento/files/fondamento-latin-400-normal.woff2?url";
import fondamentoExt from "@fontsource/fondamento/files/fondamento-latin-ext-400-normal.woff2?url";
import spectral from "@fontsource/spectral/files/spectral-latin-400-normal.woff2?url";
import spectralExt from "@fontsource/spectral/files/spectral-latin-ext-400-normal.woff2?url";

/** The letters each file covers (as the font packages split them). */
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT = "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

interface Font {
  label: string;
  /** Its own name (for showing each choice in its font in Settings). */
  family: string;
  /** Its files: the Latin letters, and more accented ones where it has them. */
  files?: [string, string?];
  /** How much bigger or smaller to draw it, to match the theme's usual size. */
  scale: number;
}

/** For titles: Creepster (the theme's own), then the ones picked on the font board. Scaled to
 *  Creepster's size, between matching its capitals and its (capital-height) small letters. */
export const TITLE_FONTS: Record<string, Font> = {
  creepster: { label: "Creepster", family: "Creepster", scale: 1 },
  germania: { label: "Germania One", family: "Germania One", files: [germania], scale: 1.11 },
  cinzel: { label: "Cinzel Decorative", family: "Cinzel Decorative", files: [cinzel, cinzelExt], scale: 0.91 },
  metamorphous: { label: "Metamorphous", family: "Metamorphous", files: [metamorphous, metamorphousExt], scale: 1.055 },
  fell: { label: "IM Fell English", family: "IM Fell English SC", files: [fellSc], scale: 1.22 },
  jolly: { label: "Jolly Lodger", family: "Jolly Lodger", files: [jolly, jollyExt], scale: 1.07 },
  pirata: { label: "Pirata One", family: "Pirata One", files: [pirata, pirataExt], scale: 1.04 },
};

/** For the tablet's text: Baloo 2 (the theme's text font), and some that read well in a
 *  paragraph. Scaled to Baloo's small letters. */
export const TABLET_FONTS: Record<string, Font> = {
  baloo: { label: "Baloo 2", family: "Baloo 2 Variable", scale: 1 },
  fell: { label: "IM Fell English", family: "IM Fell English", files: [fell], scale: 1.02 },
  garamond: { label: "EB Garamond", family: "EB Garamond Variable", files: [garamond, garamondExt], scale: 1.15 },
  spectral: { label: "Spectral", family: "Spectral", files: [spectral, spectralExt], scale: 1.04 },
  almendra: { label: "Almendra", family: "Almendra", files: [almendra, almendraExt], scale: 0.96 },
  fondamento: { label: "Fondamento", family: "Fondamento", files: [fondamento, fondamentoExt], scale: 0.94 },
};

/** The fonts as a setting's choices, each shown in its own font. */
export const fontChoices = (fonts: Record<string, Font>) => Object.entries(fonts).map(([value, f]) => ({ value, label: f.label, font: `"${f.family}"` }));

/** A font under a name of the theme's own, at the size it should be. */
function face(name: string, f: Font) {
  if (!f.files) return "";
  const [latin, ext] = f.files;
  const rule = (url: string, range: string) =>
    `@font-face { font-family: "${name}"; font-style: normal; font-display: swap; font-weight: 100 900; src: url("${url}") format("woff2"); unicode-range: ${range}; size-adjust: ${Math.round(f.scale * 100)}%; }`;
  return rule(latin, LATIN) + (ext ? rule(ext, LATIN_EXT) : "");
}

/** Puts the chosen fonts in place (while Hollow's Eve is the theme). */
export function applyFonts(title: string, tablet: string) {
  const t = TITLE_FONTS[title] ?? TITLE_FONTS.creepster;
  const p = TABLET_FONTS[tablet] ?? TABLET_FONTS.baloo;
  let style = document.getElementById("he-fonts");
  if (!style) {
    style = document.createElement("style");
    style.id = "he-fonts";
    document.head.append(style);
  }
  style.textContent =
    face("Hollow Title", t) +
    face("Hollow Tablet", p) +
    `:root[data-theme="hollow"] { ${t.files ? `--font-display: "Hollow Title", "Creepster", fantasy;` : ""} --he-tablet-font: ${p.files ? `"Hollow Tablet"` : `"${p.family}"`}, var(--font-body); }`;
  // (Long titles are fitted again in the new font, titlefit.ts.)
  window.dispatchEvent(new Event("he:fonts"));
}
