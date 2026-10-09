// Hollow's Eve's sounds, made on the spot: a little organ, a wooden knock, candles, bats, a spider,
// a ghost and a cauldron.
import type { SoundName, SoundPlayer } from "../sound";

/** The app's volume is set for loud square-wave blips; these softer sounds get this much more. */
const BOOST = 15;

function gain(ctx: AudioContext, into: AudioNode, level: number) {
  const g = ctx.createGain();
  g.gain.value = level * BOOST;
  g.connect(into);
  return g;
}

/** Fades `node` in and out: up over `attack`, held, then down over `release` (seconds). */
function envelope(ctx: AudioContext, node: AudioNode, at: number, attack: number, hold: number, release: number, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.setValueAtTime(peak, at + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  node.connect(g);
  return g;
}

function noise(ctx: AudioContext, seconds: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

/** An organ note: a few sine "drawbars" with a slow wobble. */
function organ(ctx: AudioContext, into: AudioNode, hz: number, at: number, length: number, level: number) {
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = 5.5;
  depth.gain.value = hz * 0.006;
  lfo.connect(depth);
  [1, 2, 3, 4, 6].forEach((harmonic, i) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = hz * harmonic;
    depth.connect(osc.frequency);
    envelope(ctx, osc, at, 0.03, length * 0.6, length * 0.6, level * [1, 0.6, 0.35, 0.25, 0.12][i]).connect(into);
    osc.start(at);
    osc.stop(at + length * 1.4);
  });
  lfo.start(at);
  lfo.stop(at + length * 1.4);
}

/** Semitones above A3. */
const note = (n: number) => 220 * 2 ** (n / 12);

/** A breathy burst of noise through a filter sweeping from `from` to `to` Hz. */
function breath(ctx: AudioContext, into: AudioNode, at: number, seconds: number, from: number, to: number, attack: number, q = 1) {
  const n = noise(ctx, seconds + 0.1);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + seconds * 0.8);
  n.connect(filter);
  envelope(ctx, filter, at, attack, seconds * 0.2, seconds * 0.6, 1).connect(into);
  n.start(at);
}

export const SOUNDS: Partial<Record<SoundName, SoundPlayer>> = {
  // A little wooden knock, pitched down.
  move: (ctx, out) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.08);
    envelope(ctx, osc, t, 0.002, 0, 0.09, 1).connect(gain(ctx, out, 0.06));
    osc.start(t);
    osc.stop(t + 0.15);
  },
  // A soft minor chord on the organ, rolled.
  select: (ctx, out) => {
    const t = ctx.currentTime;
    const into = gain(ctx, out, 0.055);
    [0, 3, 7].forEach((n, i) => organ(ctx, into, note(n), t + i * 0.035, 0.42, 1));
  },
  back: (ctx, out) => {
    const t = ctx.currentTime;
    const into = gain(ctx, out, 0.055);
    organ(ctx, into, note(7), t, 0.16, 1);
    organ(ctx, into, note(0), t + 0.15, 0.32, 1);
  },
  // Saved / a season finished: a twinkly run up a spooky (harmonic minor) scale.
  save: (ctx, out) => {
    const t = ctx.currentTime;
    const into = gain(ctx, out, 0.035);
    [12, 14, 15, 17, 19, 20, 23, 24].forEach((n, i) => {
      const at = t + i * 0.07;
      [1, 4].forEach((h, k) => {
        const osc = ctx.createOscillator();
        osc.frequency.value = note(n) * h;
        envelope(ctx, osc, at, 0.004, 0, 0.6 - k * 0.3, k ? 0.25 : 1).connect(into);
        osc.start(at);
        osc.stop(at + 0.8);
      });
    });
  },
  // Nothing found: two low notes that rub.
  nope: (ctx, out) => {
    const t = ctx.currentTime;
    const into = gain(ctx, out, 0.05);
    organ(ctx, into, note(-12), t, 0.5, 1);
    organ(ctx, into, note(-11), t, 0.5, 0.8);
  },
  treat: (ctx, out) => SOUNDS.save!(ctx, out),
  // A wrong chord and something whooshing past.
  trick: (ctx, out) => {
    const t = ctx.currentTime;
    const into = gain(ctx, out, 0.05);
    [0, 1, 6].forEach((n) => organ(ctx, into, note(n - 12), t, 0.9, 1));
    breath(ctx, gain(ctx, out, 0.09), t + 0.2, 1.2, 300, 2200, 0.4, 3);
  },
  // A candle blown out, and lit again.
  snuff: (ctx, out) => breath(ctx, gain(ctx, out, 0.06), ctx.currentTime, 0.35, 2600, 500, 0.02, 0.8),
  ignite: (ctx, out) => {
    const t = ctx.currentTime;
    breath(ctx, gain(ctx, out, 0.045), t, 0.45, 400, 3000, 0.12, 1.2);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = note(19);
    envelope(ctx, osc, t + 0.15, 0.01, 0, 0.5, 1).connect(gain(ctx, out, 0.012));
    osc.start(t + 0.15);
    osc.stop(t + 0.8);
  },
  // A ghostly "woo": sliding up and down with a wobble, and an echo.
  boo: (ctx, out) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(760, t + 0.35);
    osc.frequency.exponentialRampToValueAtTime(300, t + 1.2);
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 6;
    depth.gain.value = 14;
    lfo.connect(depth).connect(osc.frequency);
    const into = gain(ctx, out, 0.03);
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.22;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    const voice = envelope(ctx, osc, t, 0.25, 0.4, 0.6, 1);
    voice.connect(into);
    voice.connect(delay).connect(feedback).connect(delay);
    feedback.connect(into);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 2.4);
    lfo.stop(t + 2.4);
  },
  // Bats taking off: a flurry of wingbeats.
  flutter: (ctx, out) => {
    const t = ctx.currentTime;
    const into = gain(ctx, out, 0.05);
    for (let i = 0; i < 9; i++) {
      const at = t + i * 0.055;
      const n = noise(ctx, 0.05);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 900 + Math.random() * 500;
      n.connect(filter);
      envelope(ctx, filter, at, 0.004, 0, 0.04, 1 - i * 0.08).connect(into);
      n.start(at);
    }
  },
  // A spider scurrying up its thread.
  skitter: (ctx, out) => {
    const t = ctx.currentTime;
    const into = gain(ctx, out, 0.03);
    for (let i = 0; i < 12; i++) {
      const at = t + i * 0.025 + Math.random() * 0.01;
      const n = noise(ctx, 0.02);
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 3500;
      n.connect(filter);
      envelope(ctx, filter, at, 0.001, 0, 0.015, 1).connect(into);
      n.start(at);
    }
  },
  // A pumpkin bumped: a hollow "bonk".
  bonk: (ctx, out) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    envelope(ctx, osc, t, 0.004, 0.02, 0.18, 1).connect(gain(ctx, out, 0.06));
    osc.start(t);
    osc.stop(t + 0.3);
  },
};
