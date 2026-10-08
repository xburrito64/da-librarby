// Background music: a theme's own-files folder can hold music files (see `ownFiles.music` in
// themes.ts) that play in the library at the theme's "music" option level. One file loops; with
// several, each loops for a while and then fades into the next, in a shuffled order. The music
// fades out during videos and while the app is minimized or in the background, and carries on
// from where it was when it comes back.

/** How loud each "music" option value plays (music files are mastered loud). */
const LEVELS: Record<string, number> = { quiet: 0.12, normal: 0.25, loud: 0.45 };
const FADE_IN_MS = 1800;
const FADE_OUT_MS = 600;
/** With several tracks, each plays at least twice through and for at least this long... */
const TRACK_SECONDS = 150;
/** ...then fades out over the end of its last time through, and the next one starts after a pause. */
const SWITCH_FADE_SECONDS = 4;
const SWITCH_GAP_MS = 1200;

type Hold = "video" | "away";

let tracks: string[] = [];
/** Tracks still to come before the order is shuffled again. */
let queue: string[] = [];
let audio: HTMLAudioElement | null = null;
let level = 0;
const holds = new Set<Hold>();
let fade: number | undefined;
let gap: number | undefined;
/** Fading out to move on to the next track. */
let switching = false;
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
    switching = false;
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

/** The next track in a shuffled order (never the same one twice in a row). */
function nextTrack(): string {
  if (queue.length === 0) {
    queue = [...tracks].sort(() => Math.random() - 0.5);
    if (queue.length > 1 && queue[0] === audio?.dataset.track) queue.push(queue.shift()!);
  }
  return queue.shift()!;
}

/** Starts `url` (looping); with several tracks, moves on to the next one after a while. */
function startTrack(url: string) {
  window.clearInterval(fade);
  audio?.pause();
  const el = new Audio(url);
  el.dataset.track = url;
  el.loop = true;
  el.preload = "auto";
  audio = el;
  switching = false;

  if (tracks.length > 1) {
    let passes = 1;
    let last = 0;
    el.addEventListener("timeupdate", () => {
      if (el !== audio) return;
      const t = el.currentTime;
      if (t < last - 1) passes += 1; // looped back to the start
      last = t;
      const duration = el.duration;
      if (!Number.isFinite(duration) || switching || !wanted()) return;
      const needed = Math.max(2, Math.ceil(TRACK_SECONDS / duration));
      const left = duration - t;
      if (passes >= needed && left <= SWITCH_FADE_SECONDS) {
        switching = true;
        fadeTo(0, Math.max(300, left * 1000 - 150), () => {
          el.pause();
          window.clearTimeout(gap);
          gap = window.setTimeout(() => {
            if (el === audio && switching) {
              startTrack(nextTrack());
            }
          }, SWITCH_GAP_MS);
        });
      }
    });
  }
  update();
}

/** The music files to play (URLs the page can load); none for no music. */
export function setMusicFiles(urls: string[]) {
  if (urls.join("\n") === tracks.join("\n")) return;
  tracks = urls;
  queue = [];
  window.clearTimeout(gap);
  window.clearInterval(fade);
  audio?.pause();
  audio = null;
  if (tracks.length > 0) startTrack(nextTrack());
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
