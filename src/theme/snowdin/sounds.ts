// Snowdin's interface blips: short square-wave tones, made on the spot.
import { tone } from "../synth";
import type { SoundName, SoundPlayer } from "../sound";

export const SOUNDS: Partial<Record<SoundName, SoundPlayer>> = {
  move: (ctx, out) => tone(ctx, out, [988], { length: 0.035, level: 0.32 }),
  select: (ctx, out) => tone(ctx, out, [659, 988], { length: 0.055, level: 0.5 }),
  back: (ctx, out) => tone(ctx, out, [587, 440], { length: 0.06, level: 0.46 }),
  text: (ctx, out) => tone(ctx, out, [180 + Math.random() * 25], { length: 0.025, level: 0.2 }),
  save: (ctx, out) => tone(ctx, out, [523, 659, 784, 1047, 1319], { length: 0.075, level: 0.48 }),
  nope: (ctx, out) => tone(ctx, out, [330, 247, 196], { length: 0.09, wave: "triangle", level: 0.8 }),
};
