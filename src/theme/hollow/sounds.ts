// Hollow's Eve's sounds: real recordings (plucked strings, a church organ, a tuba, candles, bats,
// creaking doors, bones...), all public domain; see sounds/CREDITS.md. A sound with several
// recordings plays one of them at random each time.
import type { SoundName } from "../sound";

const files = import.meta.glob<string>("./sounds/*.ogg", { query: "?url", import: "default", eager: true });

/** Every sound's recordings: "boo.ogg" for one, "creak-1.ogg", "creak-2.ogg", ... for several. */
export const SOUNDS: Partial<Record<SoundName, string[]>> = {};
for (const [path, url] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
  const name = path.replace(/^.*\//, "").replace(/(-\d+)?\.ogg$/, "") as SoundName;
  (SOUNDS[name] ??= []).push(url);
}
