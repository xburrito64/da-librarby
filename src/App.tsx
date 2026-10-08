import { useCallback, useEffect, useRef, useState } from "react";
import LibraryView from "./library/LibraryView";
import PlayerView from "./player/PlayerView";
import { mpv } from "./player/mpv";
import { library, watch, type PlayItem } from "./library/api";
import { shuffledEpisodes } from "./library/shuffle";
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
  /** When a key was last pressed (a start from the keyboard begins at the chosen element). */
  const lastKey = useRef(0);

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
    const onKey = () => (lastKey.current = performance.now());
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  const Intro = findTheme(theme)?.extras?.PlayIntro;
  const useIntro = Intro != null && options.intro !== false && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const useIntroRef = useRef(useIntro);
  useIntroRef.current = useIntro;

  /** Plays `item`, after the theme's intro if it has one. */
  const start = useCallback((item: PlayItem) => {
    if (!useIntroRef.current) return setPlaying(item);
    // From the click that started it, or the element chosen with the keyboard, else the middle.
    const p = lastPointer.current;
    let at = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    if (lastKey.current > p.at && document.activeElement && document.activeElement !== document.body) {
      const r = document.activeElement.getBoundingClientRect();
      at = { x: r.left + Math.min(r.width / 2, 60), y: r.top + r.height / 2 };
    } else if (performance.now() - p.at < 2000) at = { x: p.x, y: p.y };
    setIntro({ ...at, item });
  }, []);

  /** Plays a file, from where it was stopped or from `at` seconds. */
  const play = useCallback(
    (fileId: number, at?: number) => {
      watch
        .item(fileId)
        .then((item) => item && start(at != null ? { ...item, resume: at } : item))
        .catch((e) => setError(String(e)));
    },
    [start],
  );

  /** Plays a show's episodes in a random order. */
  const shuffle = useCallback(
    (titleId: number) => {
      library
        .title(titleId)
        .then(async (title) => {
          const ids = title ? shuffledEpisodes(title) : [];
          if (ids.length === 0) return;
          const item = await watch.item(ids[0]);
          if (item) start({ ...item, shuffle: ids.slice(1) });
        })
        .catch((e) => setError(String(e)));
    },
    [start],
  );

  return (
    <>
      {/* Stays mounted while playing so the library keeps its place. */}
      <div style={{ display: playing ? "none" : undefined }}>
        <LibraryView active={!playing} onPlay={play} onShuffle={shuffle} />
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
