// Interface sounds of the current theme (see `extras.sounds` in themes.ts). Themes without
// sounds are silent. Sounds never play over a video. Sound files the owner added for the theme
// (see ownFiles.ts) play instead of the theme's own blips.
import { findTheme } from "./themes";
import { currentTheme } from "./theme";
import { themeOption } from "./options";

export type SoundName = "move" | "select" | "back" | "save" | "nope" | "text";

/** Plays a sound into `out`, which carries the chosen volume. */
export type SoundPlayer = (ctx: AudioContext, out: AudioNode) => void;

const VOLUMES: Record<string, number> = { quiet: 0.03, normal: 0.06, loud: 0.11 };
/** Sound files are recorded much louder than the made-up blips. */
const FILE_VOLUMES: Record<string, number> = { quiet: 0.2, normal: 0.4, loud: 0.75 };
/** Pointing at things in quick succession only blips once in a while. */
const MOVE_GAP_MS = 70;

let ctx: AudioContext | null = null;
let muted = false;
let lastMove = 0;
/** The owner's sound files, decoded the first time they play. */
let own = new Map<SoundName, { data: ArrayBuffer; buffer?: Promise<AudioBuffer> }>();

export function setOwnSounds(files: Map<SoundName, ArrayBuffer>) {
  own = new Map([...files].map(([name, data]) => [name, { data }]));
}

/** Silences everything while the player is showing. */
export function setSoundsMuted(on: boolean) {
  muted = on;
}

export function playSound(name: SoundName) {
  if (muted) return;
  const theme = findTheme(currentTheme());
  const sound = theme?.extras?.sounds?.[name];
  const file = own.get(name);
  if (!theme || !(sound || file) || themeOption(theme.id, "sounds") === false) return;
  if (name === "move") {
    const now = performance.now();
    if (now - lastMove < MOVE_GAP_MS) return;
    lastMove = now;
  }
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const audio = ctx;
    const out = audio.createGain();
    const levels = file ? FILE_VOLUMES : VOLUMES;
    out.gain.value = levels[String(themeOption(theme.id, "volume") ?? "normal")] ?? levels.normal;
    out.connect(audio.destination);
    if (file) {
      file.buffer ??= audio.decodeAudioData(file.data.slice(0));
      file.buffer
        .then((buffer) => {
          const source = audio.createBufferSource();
          source.buffer = buffer;
          source.connect(out);
          source.start();
        })
        .catch(() => own.delete(name));
    } else sound!(audio, out);
  } catch {
    // No audio device: stay quiet.
  }
}

const POINTABLE = "button, [role='button'], [role='tab'], select, .card";

/** Blips when pointing at and picking things anywhere in the library, and on Esc. */
export function installInterfaceSounds() {
  document.addEventListener("pointerover", (e) => {
    const el = (e.target as Element).closest?.(POINTABLE);
    if (!el || el.contains(e.relatedTarget as Node) || (el as HTMLButtonElement).disabled) return;
    if (el.closest(".player")) return;
    playSound("move");
  });
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element).closest?.(POINTABLE + ", [data-sfx]") as HTMLElement | null;
      if (!el || el.closest(".player")) return;
      const named = el.dataset.sfx;
      if (named === "none") return;
      playSound((named as SoundName) ?? "select");
    },
    true,
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.querySelector(".player")) playSound("back");
  });
}
