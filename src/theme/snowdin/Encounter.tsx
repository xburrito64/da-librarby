// Pressing Play starts like an encounter in the game: the screen goes black, the heart flashes
// where you clicked, glides to the middle and bursts open onto the video. See snowdin.css.
import { useEffect } from "react";

/** When the screen is fully black and the heart is in the middle (the video can start). */
const COVERED_MS = 760;
/** When it's all over. */
const DONE_MS = 1200;

export default function Encounter({ x, y, onCovered, onDone }: { x: number; y: number; onCovered: () => void; onDone: () => void }) {
  useEffect(() => {
    const covered = window.setTimeout(onCovered, COVERED_MS);
    const done = window.setTimeout(onDone, DONE_MS);
    return () => {
      window.clearTimeout(covered);
      window.clearTimeout(done);
    };
    // Runs once per encounter; the callbacks don't change its timing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="sd-encounter" style={{ "--x": `${x}px`, "--y": `${y}px` } as React.CSSProperties} aria-hidden="true">
      <span className="sd-encounter__heart" />
    </div>
  );
}
