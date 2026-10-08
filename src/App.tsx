import { useCallback, useEffect, useRef, useState } from "react";
import LibraryView from "./library/LibraryView";
import PlayerView from "./player/PlayerView";
import { mpv } from "./player/mpv";
import { watch, type PlayItem } from "./library/api";
import { playSound, setSoundsMuted } from "./theme/sound";
import { holdMusic, setMusicLevel } from "./theme/music";
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
  /** The theme's play intro, running: where it starts and what plays once the screen is covered. */
  const [intro, setIntro] = useState<{ x: number; y: number; item: PlayItem } | null>(null);
  /** Where the last click was, so the intro can start there. */
  const lastPointer = useRef({ x: 0, y: 0, at: 0 });

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
    setMusicLevel(JSON.parse(optionsKey).music);
  }, [theme, optionsKey]);

  // A theme's interface sounds stay quiet over a video.
  useEffect(() => {
    setSoundsMuted(playing != null);
    holdMusic("video", playing != null);
  }, [playing]);

  // Start mpv right away so playback begins instantly when something is picked.
  useEffect(() => {
    mpv.init(OBSERVED).catch((e) => setError(`Player failed to start: ${e}`));
  }, []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => (lastPointer.current = { x: e.clientX, y: e.clientY, at: performance.now() });
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  const Intro = findTheme(theme)?.extras?.PlayIntro;
  const useIntro = Intro != null && options.intro !== false && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const useIntroRef = useRef(useIntro);
  useIntroRef.current = useIntro;

  const play = useCallback((fileId: number) => {
    watch
      .item(fileId)
      .then((item) => {
        if (!item) return;
        if (!useIntroRef.current) return setPlaying(item);
        // From the click that started it (a keyboard start begins in the middle).
        const p = lastPointer.current;
        const fresh = performance.now() - p.at < 2000;
        setIntro({ x: fresh ? p.x : window.innerWidth / 2, y: fresh ? p.y : window.innerHeight / 2, item });
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <>
      {/* Stays mounted while playing so the library keeps its place. */}
      <div style={{ display: playing ? "none" : undefined }}>
        <LibraryView active={!playing} onPlay={play} />
      </div>
      {playing && <PlayerView item={playing} onNext={setPlaying} onBack={() => setPlaying(null)} />}
      {intro && Intro && (
        <Intro
          key={intro.item.fileId}
          x={intro.x}
          y={intro.y}
          sound={playSound}
          onCovered={() => setPlaying(intro.item)}
          onDone={() => setIntro(null)}
        />
      )}
      {error && (
        <button className="toast" onClick={() => setError(null)}>
          {error}
        </button>
      )}
    </>
  );
}
