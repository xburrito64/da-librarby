// Interface sounds of the current theme (see `extras.sounds` in themes.ts): made up on the spot,
// or recordings (several for one sound take turns at random). Themes without sounds are silent.
// Sounds never play over a video. Sound files the owner added for the theme (see ownFiles.ts) play
// instead of the theme's own.
import { findTheme } from "./themes";
import { currentTheme } from "./theme";
import { themeOption } from "./options";

export type SoundName =
  | "move"
  | "select"
  | "back"
  | "save"
  | "nope"
  | "text"
  /** The battle start: the heart flashing (once per flash), then flying off. */
  | "encounter-flicker"
  | "encounter-fly"
  /** Hollow's Eve: trick or treat, candles, bats, the spider, the ghost, pumpkins. */
  | "treat"
  | "trick"
  | "snuff"
  | "ignite"
  | "boo"
  | "flutter"
  | "skitter"
  | "bonk"
  /** The haunted house's door, the skeleton underground, the coffin's lid and whoever's inside. */
  | "creak"
  | "rattle"
  | "scrape"
  | "moan";

/** Plays a sound into `out`, which carries the chosen volume. */
export type SoundPlayer = (ctx: AudioContext, out: AudioNode) => void;

const VOLUMES: Record<string, number> = { quiet: 0.03, normal: 0.06, loud: 0.11 };
/** Sound files are recorded much louder than the made-up blips. */
const FILE_VOLUMES: Record<string, number> = { quiet: 0.2, normal: 0.4, loud: 0.75 };
/** A theme's own recordings are levelled already (each as loud as it should be next to the others). */
const RECORDING_VOLUMES: Record<string, number> = { quiet: 0.5, normal: 1, loud: 1.3 };
/** Pointing at things in quick succession only blips once in a while. */
const MOVE_GAP_MS = 70;

let ctx: AudioContext | null = null;
let muted = false;
let lastMove = 0;
/** The owner's sound files, decoded the first time they play. */
let own = new Map<SoundName, { data: ArrayBuffer; buffer?: Promise<AudioBuffer> }>();
/** The themes' recordings, by address, loaded and decoded the first time one is needed. */
const recordings = new Map<string, Promise<AudioBuffer>>();
/** Which of a sound's recordings played last, so the next one is a different one. */
const lastTake = new Map<SoundName, number>();

function recording(audio: AudioContext, url: string) {
  let buffer = recordings.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => audio.decodeAudioData(data));
    buffer.catch(() => recordings.delete(url));
    recordings.set(url, buffer);
  }
  return buffer;
}

/** One of a sound's recordings, at random (never the same one twice in a row). */
function take(name: SoundName, urls: string[]) {
  if (urls.length === 1) return urls[0];
  let i = Math.floor(Math.random() * (urls.length - 1));
  if (i >= (lastTake.get(name) ?? -1)) i++;
  lastTake.set(name, i);
  return urls[i];
}

function playBuffer(audio: AudioContext, out: AudioNode, buffer: Promise<AudioBuffer>, failed: () => void) {
  buffer
    .then((b) => {
      const source = audio.createBufferSource();
      source.buffer = b;
      source.connect(out);
      source.start();
    })
    .catch(failed);
}

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
    const recorded = !file && Array.isArray(sound);
    const levels = file ? FILE_VOLUMES : recorded ? RECORDING_VOLUMES : VOLUMES;
    out.gain.value = levels[String(themeOption(theme.id, "volume") ?? "normal")] ?? levels.normal;
    out.connect(audio.destination);
    if (file) {
      file.buffer ??= audio.decodeAudioData(file.data.slice(0));
      playBuffer(audio, out, file.buffer, () => own.delete(name));
    } else if (Array.isArray(sound)) {
      playBuffer(audio, out, recording(audio, take(name, sound)), () => {});
      // Get the theme's other recordings ready, so they play without a delay when it's their turn.
      if (recordings.size < 2)
        for (const urls of Object.values(theme.extras?.sounds ?? {})) if (Array.isArray(urls)) urls.forEach((u) => recording(audio, u));
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
