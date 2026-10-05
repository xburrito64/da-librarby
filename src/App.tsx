// Step 1 prototype: embedded mpv with a few custom controls layered on top.
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { mpv } from "./player/mpv";
import "./App.css";

const TEST_FILE =
  "F:\\Anime\\Chainsaw Man\\Chainsaw Man S01\\Chainsaw Man - S01E01 - Dog & Chainsaw.mkv";

const OBSERVED = ["pause", "time-pos", "duration", "media-title"];
const HIDE_CONTROLS_AFTER_MS = 2500;

// Guards against React's development double-mount loading the file twice.
let started = false;

export default function App() {
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const unlisteners = [
      mpv.onProperty((name, value) => {
        if (name === "pause") setPaused(value === true);
        else if (name === "time-pos") setTime(typeof value === "number" ? value : 0);
        else if (name === "duration") setDuration(typeof value === "number" ? value : 0);
        else if (name === "media-title") setTitle(typeof value === "string" ? value : "");
      }),
      mpv.onEvent((e) => {
        if (e.event === "end-file" && e.reason === "error") setError(e.error ?? "Playback failed");
        if (e.event === "file-loaded") setError(null);
      }),
    ];

    mpv
      .init(OBSERVED)
      .then(() => {
        if (started) return;
        started = true;
        return mpv.command("loadfile", TEST_FILE);
      })
      .catch((e) => setError(String(e)));

    return () => unlisteners.forEach((p) => p.then((off) => off()));
  }, []);

  const togglePause = useCallback(() => {
    mpv.command("cycle", "pause").catch((e) => setError(String(e)));
  }, []);

  const toggleFullscreen = useCallback(async (force?: boolean) => {
    const win = getCurrentWindow();
    const next = force ?? !(await win.isFullscreen());
    await win.setFullscreen(next);
    setFullscreen(next);
  }, []);

  const openFile = useCallback(async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "Video", extensions: ["mkv", "mp4", "avi", "webm", "mov", "m4v", "ts"] }],
    });
    if (typeof path === "string") mpv.command("loadfile", path).catch((e) => setError(String(e)));
  }, []);

  const seekTo = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    mpv.command("seek", (fraction * 100).toFixed(3), "absolute-percent");
  };

  const showControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_AFTER_MS);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      showControls();
      if (e.key === " ") togglePause();
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "Escape") toggleFullscreen(false);
      else if (e.key === "ArrowLeft") mpv.command("seek", -5);
      else if (e.key === "ArrowRight") mpv.command("seek", 5);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showControls, togglePause, toggleFullscreen]);

  const idle = controlsVisible || paused;

  return (
    <div
      className={`stage ${idle ? "" : "stage--hidden"}`}
      onMouseMove={showControls}
      onDoubleClick={(e) => e.target === e.currentTarget && toggleFullscreen()}
    >
      {error && <div className="error">{error}</div>}

      <div className="topbar">
        <span className="title">{title}</span>
      </div>

      <div className="controls" onDoubleClick={(e) => e.stopPropagation()}>
        <div className="progress" onClick={seekTo}>
          <div className="progress__fill" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
        </div>
        <div className="row">
          <button className="btn btn--main" onClick={togglePause} title="Play / pause (Space)">
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <span className="time">
            {formatTime(time)} / {formatTime(duration)}
          </span>
          <span className="spacer" />
          <button className="btn" onClick={openFile} title="Open a file">
            <FolderIcon />
          </button>
          <button className="btn" onClick={() => toggleFullscreen()} title="Fullscreen (F)">
            {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const PlayIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
);
const FolderIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z" /></svg>
);
const FullscreenIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z" /></svg>
);
const ExitFullscreenIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M8 4h2v6H4V8h4zm6 0h2v4h4v2h-6zM4 14h6v6H8v-4H4zm10 0h6v2h-4v4h-2z" /></svg>
);
