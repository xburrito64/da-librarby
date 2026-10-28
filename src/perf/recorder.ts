// Measures how smoothly the page draws: the time between frames, against the screen's refresh rate.
// A frame that took longer than one refresh (at 144 Hz, 6.9 ms) made the screen show the old
// picture again: those are the missed frames. Also notes what kept the page busy in the slowest
// frames (the browser's "long animation frame" reports, for frames over 50 ms).

export interface FrameStats {
  /** Frames drawn and over how long. */
  frames: number;
  seconds: number;
  fps: number;
  /** Refreshes the screen showed an old picture for, and as a share of all refreshes (%). */
  missed: number;
  missedPct: number;
  /** Frame times (ms): typical, 99 in 100 under, the slowest. */
  p50: number;
  p99: number;
  worst: number;
  /** Stalls you'd notice: frames over 50 ms. */
  stalls: number;
  /** What ran in the slowest frames. */
  slow: { ms: number; what: string }[];
}

/** The screen's time between refreshes (ms), measured once. */
let refreshMs = 0;

/** Measures the screen's refresh rate (the page must be on screen and idle). */
export async function calibrate() {
  const deltas = await frameDeltas(90);
  deltas.sort((a, b) => a - b);
  refreshMs = deltas[Math.floor(deltas.length / 2)];
  return refreshMs;
}

export function refreshInterval() {
  return refreshMs || 1000 / 60;
}

function frameDeltas(count: number) {
  return new Promise<number[]>((resolve) => {
    const out: number[] = [];
    let last = 0;
    const tick = (t: number) => {
      if (last) out.push(t - last);
      last = t;
      if (out.length >= count) resolve(out);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

interface LongFrame extends PerformanceEntry {
  scripts?: { invoker?: string; sourceURL?: string; sourceFunctionName?: string; duration: number }[];
}

/** What one recording caught: each frame's time, and the slowest frames' reports. */
export interface Recording {
  deltas: number[];
  slow: { ms: number; what: string }[];
}

/** Starts recording; `stop` ends it (see `summarize`). */
export function record() {
  const deltas: number[] = [];
  const slow: { ms: number; what: string }[] = [];
  let last = 0;
  let running = true;
  const tick = (t: number) => {
    if (!running) return;
    if (last) deltas.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as LongFrame[]) {
        const scripts = (e.scripts ?? []).slice().sort((a, b) => b.duration - a.duration).slice(0, 2);
        const what = scripts
          .map((s) => `${s.invoker || "?"}${s.sourceFunctionName ? ` ${s.sourceFunctionName}` : ""} ${Math.round(s.duration)} ms`)
          .join(", ");
        slow.push({ ms: Math.round(e.duration), what: what || "drawing (no script)" });
      }
    });
    observer.observe({ type: "long-animation-frame", buffered: false });
  } catch {
    observer = null;
  }

  return {
    stop(): Recording {
      running = false;
      observer?.disconnect();
      return { deltas, slow };
    },
  };
}

/** Sums up one or more recordings (the same thing measured several times counts as one). */
export function summarize(recordings: Recording[]): FrameStats {
  const deltas = recordings.flatMap((r) => r.deltas);
  const slow = recordings.flatMap((r) => r.slow);
  const interval = refreshInterval();
  let missed = 0;
  let slots = 0;
  for (const d of deltas) {
    // Each frame covers this many refreshes; all but one showed the old picture.
    const n = Math.max(1, Math.round(d / interval));
    slots += n;
    missed += n - 1;
  }
  const sorted = deltas.slice().sort((a, b) => a - b);
  const at = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);
  const seconds = deltas.reduce((a, b) => a + b, 0) / 1000;
  const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  return {
    frames: deltas.length,
    seconds: round(seconds),
    fps: round(seconds ? deltas.length / seconds : 0, 1),
    missed,
    missedPct: round(slots ? (missed / slots) * 100 : 0, 3),
    p50: round(at(0.5)),
    p99: round(at(0.99)),
    worst: round(sorted[sorted.length - 1] ?? 0),
    stalls: deltas.filter((d) => d > 50).length,
    slow: slow.sort((a, b) => b.ms - a.ms).slice(0, 5),
  };
}
