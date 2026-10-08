// A theme's "your own files" folder (see `extras.ownFiles` in themes.ts): a font and sounds the
// owner adds themselves. They stay on this PC; the app only looks for them.
// A font named "font.*" replaces the theme's text font (root class "own-font");
// sounds named after a sound ("select.wav", ...) replace the theme's own blips;
// "music.*" plays in the background (see music.ts).
import { useSyncExternalStore } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { findTheme } from "./themes";
import { setOwnSounds, type SoundName } from "./sound";
import { setMusicFile } from "./music";

export interface OwnFiles {
  folder: string;
  files: { name: string; path: string }[];
}

/** The family name an own font is loaded under; themes use it in their font lists. */
export const OWN_FONT = "Theme Own Font";

let current: OwnFiles | null = null;
let font: FontFace | null = null;
let request = 0;
const listeners = new Set<() => void>();

function changed(next: OwnFiles | null) {
  current = next;
  listeners.forEach((l) => l());
}

/** Looks in the theme's folder and uses what it finds (or clears it for themes without one). */
export async function loadOwnFiles(themeId: string) {
  const mine = ++request;
  const wanted = findTheme(themeId)?.extras?.ownFiles;
  const found = wanted ? await invoke<OwnFiles>("theme_files", { theme: themeId }).catch(() => null) : null;
  if (mine !== request) return;

  // The font
  if (font) document.fonts.delete(font);
  font = null;
  document.documentElement.classList.remove("own-font");
  const fontFile = wanted?.font ? found?.files.find((f) => f.name === "font") : undefined;
  if (fontFile) {
    try {
      const face = new FontFace(OWN_FONT, `url("${convertFileSrc(fontFile.path)}")`);
      await face.load();
      if (mine !== request) return;
      document.fonts.add(face);
      font = face;
      document.documentElement.classList.add("own-font");
    } catch {
      // Not a font the browser can read: keep the theme's own.
    }
  }

  // The sounds
  const sounds = new Map<SoundName, ArrayBuffer>();
  for (const s of wanted?.sounds ?? []) {
    const file = found?.files.find((f) => f.name === s.name && !/\.(ttf|otf|woff2?)$/i.test(f.path));
    if (!file) continue;
    const data = await fetch(convertFileSrc(file.path))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
    if (data) sounds.set(s.name, data);
  }
  if (mine !== request) return;
  setOwnSounds(sounds);
  const music = wanted?.music ? found?.files.find((f) => f.name === "music" && !/\.(ttf|otf|woff2?)$/i.test(f.path)) : undefined;
  setMusicFile(music ? convertFileSrc(music.path) : null);
  changed(found);
}

/** What the current theme's own folder holds (null while unknown or for themes without one). */
export function useOwnFiles() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

export function openOwnFolder(themeId: string) {
  return invoke("theme_files_open", { theme: themeId });
}
