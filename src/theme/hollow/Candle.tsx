// Pressing Play: the room darkens around a candle flame where you clicked, the flame is blown out
// (a curl of smoke), and the darkness lifts onto the video. See hollow.css ("Candle out").
import { useEffect } from "react";
import type { SoundName } from "../sound";

/** When the flame goes out, when the screen is fully dark (the video starts), and the end. */
const OUT_MS = 520;
const COVERED_MS = 760;
const DONE_MS = 1350;

interface Props {
  x: number;
  y: number;
  sound: (name: SoundName) => void;
  onCovered: () => void;
  onDone: () => void;
}

export default function Candle({ x, y, sound, onCovered, onDone }: Props) {
  useEffect(() => {
    const timers = [
      window.setTimeout(() => sound("snuff"), OUT_MS),
      window.setTimeout(onCovered, COVERED_MS),
      window.setTimeout(onDone, DONE_MS),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
    // Runs once; the callbacks don't change its timing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="he-candle" style={{ "--x": `${x}px`, "--y": `${y}px` } as React.CSSProperties} aria-hidden="true">
      <span className="he-candle__flame" />
      <span className="he-candle__smoke" />
    </div>
  );
}
