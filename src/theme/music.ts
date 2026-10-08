// Background music: a theme's own-files folder can hold a "music" file (see `ownFiles.music` in
// themes.ts) that plays on a loop in the library, at the theme's "music" option level. It fades
// out during videos and while the app is minimized or in the background, and carries on from
// where it was when it comes back.

/** How loud each "music" option value plays (music files are mastered loud). */
const LEVELS: Record<string, number> = { quiet: 0.12, normal: 0.25, loud: 0.45 };
const FADE_IN_MS = 1800;
const FADE_OUT_MS = 600;

type Hold = "video" | "away";

let audio: HTMLAudioElement | null = null;
let level = 0;
const holds = new Set<Hold>();
let fade: number | undefined;
/** Playing was refused until the page is interacted with: try again on the first click or key. */
let waitingForGesture = false;

function wanted() {
  return audio != null && level > 0 && holds.size === 0;
}

/** Brings the volume to `target` over `ms`, then calls `done`. */
function fadeTo(target: number, ms: number, done?: () => void) {
  window.clearInterval(fade);
  const el = audio;
  if (!el) return;
  const from = el.volume;
  const start = performance.now();
  fade = window.setInterval(() => {
    const t = Math.min(1, (performance.now() - start) / ms);
    el.volume = from + (target - from) * t;
    if (t >= 1) {
      window.clearInterval(fade);
      done?.();
    }
  }, 30);
}

function update() {
  const el = audio;
  if (!el) return;
  if (wanted()) {
    if (el.paused) {
      el.volume = 0;
      el.play().then(
        () => fadeTo(level, FADE_IN_MS),
        () => (waitingForGesture = true),
      );
    } else fadeTo(level, FADE_IN_MS / 2);
  } else if (!el.paused) {
    fadeTo(0, FADE_OUT_MS, () => {
      if (!wanted()) el.pause();
    });
  }
}

/** The music file to play (a URL the page can load), or null for none. */
export function setMusicFile(url: string | null) {
  if (audio?.src === url) return;
  window.clearInterval(fade);
  audio?.pause();
  audio = null;
  if (url) {
    audio = new Audio(url);
    audio.loop = true;
    audio.preload = "auto";
  }
  update();
}

/** The theme's "music" option: "off", "quiet", "normal" or "loud". */
export function setMusicLevel(value: string | boolean | undefined) {
  const next = LEVELS[String(value)] ?? 0;
  if (next === level) return;
  level = next;
  update();
}

/** Pauses the music for a while (during a video, while the app is in the background). */
export function holdMusic(reason: Hold, on: boolean) {
  if (on === holds.has(reason)) return;
  if (on) holds.add(reason);
  else holds.delete(reason);
  update();
}

/** Call once at startup. */
export function installMusic() {
  const away = () => holdMusic("away", document.visibilityState === "hidden" || !document.hasFocus());
  window.addEventListener("focus", away);
  window.addEventListener("blur", away);
  document.addEventListener("visibilitychange", away);
  // Clicking or typing in the app means it's in front (and lets the music start if it had to wait).
  const interacted = () => {
    holdMusic("away", false);
    if (!waitingForGesture) return;
    waitingForGesture = false;
    update();
  };
  document.addEventListener("pointerdown", interacted, true);
  document.addEventListener("keydown", interacted, true);
  // Started minimized (with Windows), or not yet in front: wait until it is.
  away();
}
