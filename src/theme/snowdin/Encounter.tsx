// Pressing Play starts like an encounter in the game: the screen goes black, the heart flashes
// where you clicked, glides to the middle and bursts open onto the video. See snowdin.css.
import { useEffect } from "react";
import type { SoundName } from "../sound";

/** When the screen is fully black and the heart is in the middle (the video can start). */
const COVERED_MS = 760;
/** When it's all over. */
const DONE_MS = 1200;
/** When the heart shows (one flicker sound each), and when it flies off (as in snowdin.css). */
const FLASHES_MS = [0, 140, 280];
const FLY_MS = 440;

interface Props {
  x: number;
  y: number;
  sound: (name: SoundName) => void;
  onCovered: () => void;
  onDone: () => void;
}

export default function Encounter({ x, y, sound, onCovered, onDone }: Props) {
  useEffect(() => {
    const timers = [
      ...FLASHES_MS.map((ms) => window.setTimeout(() => sound("encounter-flicker"), ms)),
      window.setTimeout(() => sound("encounter-fly"), FLY_MS),
      window.setTimeout(onCovered, COVERED_MS),
      window.setTimeout(onDone, DONE_MS),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
    // Runs once per encounter; the callbacks don't change its timing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="sd-encounter" style={{ "--x": `${x}px`, "--y": `${y}px` } as React.CSSProperties} aria-hidden="true">
      <span className="sd-encounter__heart" />
    </div>
  );
}
