import { useCallback, useEffect, useState } from "react";
import LibraryView from "./library/LibraryView";
import PlayerView from "./player/PlayerView";
import { mpv } from "./player/mpv";
import { watch, type PlayItem } from "./library/api";
import { setSoundsMuted } from "./theme/sound";
import { useTheme } from "./theme/theme";
import { findTheme } from "./theme/themes";
import { useThemeOptions } from "./theme/options";
import { loadOwnFiles } from "./theme/ownFiles";

const OBSERVED = [
  "pause",
  "time-pos",
  "duration",
  "track-list",
  "chapter-list",
  "chapter",
  "volume",
  "mute",
  "speed",
  "eof-reached",
];

export default function App() {
  const [playing, setPlaying] = useState<PlayItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The current theme's own-files folder (a font and sounds the owner added), if it has one.
  const theme = useTheme();
  useEffect(() => {
    loadOwnFiles(theme);
  }, [theme]);

  // Lets the theme act on its options (e.g. recolour its artwork).
  const options = useThemeOptions();
  const optionsKey = JSON.stringify(options);
  useEffect(() => {
    findTheme(theme)?.extras?.apply?.(JSON.parse(optionsKey));
  }, [theme, optionsKey]);

  // A theme's interface sounds stay quiet over a video.
  useEffect(() => setSoundsMuted(playing != null), [playing]);

  // Start mpv right away so playback begins instantly when something is picked.
  useEffect(() => {
    mpv.init(OBSERVED).catch((e) => setError(`Player failed to start: ${e}`));
  }, []);

  const play = useCallback((fileId: number) => {
    watch
      .item(fileId)
      .then((item) => item && setPlaying(item))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <>
      {/* Stays mounted while playing so the library keeps its place. */}
      <div style={{ display: playing ? "none" : undefined }}>
        <LibraryView active={!playing} onPlay={play} />
      </div>
      {playing && <PlayerView item={playing} onNext={setPlaying} onBack={() => setPlaying(null)} />}
      {error && (
        <button className="toast" onClick={() => setError(null)}>
          {error}
        </button>
      )}
    </>
  );
}
