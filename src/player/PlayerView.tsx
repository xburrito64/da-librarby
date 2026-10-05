// Plays one file through the embedded mpv, with our controls layered on top.
// The full player UI (chapters, tracks, volume, next episode...) comes in step 5.
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { mpv } from "./mpv";
import "./PlayerView.css";

const HIDE_CONTROLS_AFTER_MS = 2500;

export default function PlayerView({ path, label, onBack }: { path: string; label: string; onBack: () => void }) {
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const offs = [
      mpv.onProperty((name, value) => {
        if (name === "pause") setPaused(value === true);
        else if (name === "time-pos") setTime(typeof value === "number" ? value : 0);
        else if (name === "duration") setDuration(typeof value === "number" ? value : 0);
      }),
      mpv.onEvent((e) => {
        if (e.event === "end-file" && e.reason === "error") setError(e.error ?? "This file could not be played.");
        if (e.event === "file-loaded") setError(null);
      }),
    ];
    setTime(0);
    setDuration(0);
    mpv
      .setProperty("pause", false)
      .then(() => mpv.command("loadfile", path))
      .catch((e) => setError(String(e)));
    return () => offs.forEach((p) => p.then((off) => off()));
  }, [path]);

  const setWindowFullscreen = useCallback(async (next: boolean) => {
    await getCurrentWindow().setFullscreen(next);
    setFullscreen(next);
  }, []);

  const back = useCallback(async () => {
    await mpv.command("stop").catch(() => {});
    if (await getCurrentWindow().isFullscreen()) await setWindowFullscreen(false);
    onBack();
  }, [onBack, setWindowFullscreen]);

  const togglePause = useCallback(() => {
    mpv.command("cycle", "pause").catch((e) => setError(String(e)));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    await setWindowFullscreen(!(await getCurrentWindow().isFullscreen()));
  }, [setWindowFullscreen]);

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
    showControls();
    const onKey = async (e: KeyboardEvent) => {
      showControls();
      if (e.key === " ") togglePause();
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "Escape") {
        if (await getCurrentWindow().isFullscreen()) setWindowFullscreen(false);
        else back();
      } else if (e.key === "ArrowLeft") mpv.command("seek", -5);
      else if (e.key === "ArrowRight") mpv.command("seek", 5);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(hideTimer.current);
    };
  }, [showControls, togglePause, toggleFullscreen, setWindowFullscreen, back]);

  const visible = controlsVisible || paused;

  return (
    <div
      className={`stage ${visible ? "" : "stage--hidden"}`}
      onMouseMove={showControls}
      onDoubleClick={(e) => e.target === e.currentTarget && toggleFullscreen()}
    >
      {error && <div className="error">{error}</div>}

      <div className="topbar">
        <button className="btn" onClick={back} title="Back (Esc)">
          <BackIcon />
        </button>
        <span className="title">{label}</span>
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
          <button className="btn" onClick={toggleFullscreen} title="Fullscreen (F)">
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

const BackIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" /></svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
);
const FullscreenIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z" /></svg>
);
const ExitFullscreenIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M8 4h2v6H4V8h4zm6 0h2v4h4v2h-6zM4 14h6v6H8v-4H4zm10 0h6v2h-4v4h-2z" /></svg>
);
