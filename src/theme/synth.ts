// Tiny chiptune tones for interface sounds, made on the spot (no sound files).

export interface ToneOptions {
  /** Seconds per note. */
  length?: number;
  wave?: OscillatorType;
  /** 0..1, before the overall volume. */
  level?: number;
  /** Seconds to wait before the first note. */
  delay?: number;
}

/** Plays `notes` (in Hz) one after another into `out`. */
export function tone(ctx: AudioContext, out: AudioNode, notes: number[], { length = 0.05, wave = "square", level = 0.5, delay = 0 }: ToneOptions = {}) {
  let t = ctx.currentTime + 0.005 + delay;
  for (const f of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const soften = ctx.createBiquadFilter();
    osc.type = wave;
    osc.frequency.value = f;
    soften.type = "lowpass";
    soften.frequency.value = 3200;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(soften).connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.02);
    t += length * 0.9;
  }
}
