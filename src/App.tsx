import { useEffect, useState } from "react";
import LibraryView, { type PlayRequest } from "./library/LibraryView";
import PlayerView from "./player/PlayerView";
import { mpv } from "./player/mpv";

const OBSERVED = ["pause", "time-pos", "duration"];

export default function App() {
  const [playing, setPlaying] = useState<PlayRequest | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Start mpv right away so playback begins instantly when something is picked.
  useEffect(() => {
    mpv.init(OBSERVED).catch((e) => setPlayerError(String(e)));
  }, []);

  return (
    <>
      {/* Stays mounted while playing so the library keeps its place. */}
      <div style={{ display: playing ? "none" : undefined }}>
        <LibraryView active={!playing} onPlay={setPlaying} />
        {playerError && <div className="toast">Player failed to start: {playerError}</div>}
      </div>
      {playing && <PlayerView path={playing.path} label={playing.label} onBack={() => setPlaying(null)} />}
    </>
  );
}
