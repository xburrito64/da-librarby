// The player: mpv draws the video underneath the page; these are the controls on top.
// Saves watch progress, remembers volume and each show's audio/subtitle choice, and offers
// the next episode near the end.
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { mpv } from "./mpv";
import { watch, img, itemCode, itemName, reveal, type PlayItem } from "../library/api";
import { getSetting, setSetting } from "../ui/settings";
import {
  BackIcon,
  CameraIcon,
  ChaptersIcon,
  CheckIcon,
  CloseIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  LeaveMiniIcon,
  MiniPlayerIcon,
  MuteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  Skip10Icon,
  SpeedIcon,
  SubtitlesIcon,
  VolumeIcon,
  VolumeLowIcon,
} from "../ui/icons";
import { useSeekPictures } from "./thumbs";
import "./PlayerView.css";

const HIDE_CONTROLS_AFTER_MS = 2800;
const SAVE_EVERY_MS = 5000;
/** The "next episode" card shows up this close to the end. */
const UP_NEXT_SECONDS = 40;
const AUTOPLAY_SECONDS = 10;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const ENDING_CHAPTER = /\b(ed|ending|outro|credits|preview|next episode)\b/i;
/** Chapters worth a "Skip intro" / "Skip credits" button. */
const OPENING_CHAPTER = /^(op|opening|op song|opening song|opening theme|theme song)\b/i;
const CREDITS_CHAPTER = /^(ed|ending|ending song|ending theme|end credits|credits|outro)\b/i;
const SUB_SIZES = [
  { scale: 0.8, label: "Small" },
  { scale: 1, label: "Normal" },
  { scale: 1.2, label: "Large" },
  { scale: 1.45, label: "Huge" },
];
const SUB_POSITIONS = [
  { pos: 100, label: "Bottom" },
  { pos: 94, label: "A bit higher" },
  { pos: 88, label: "Higher" },
];
/** How far subtitles move up while the controls are showing (percent of the picture). */
const SUB_LIFT = 9;
/** How far the mouse moves on the mini player before it counts as dragging the window. */
const DRAG_THRESHOLD = 4;

interface SubStyle {
  scale: number;
  pos: number;
  /** Move up while the controls are showing, so the bar doesn't cover them. */
  lift: boolean;
}

const DEFAULT_SUB_STYLE: SubStyle = { scale: 1, pos: 100, lift: true };

interface Track {
  id: number;
  type: "audio" | "sub" | "video";
  title?: string;
  lang?: string;
  selected?: boolean;
  default?: boolean;
  forced?: boolean;
  external?: boolean;
  codec?: string;
  "demux-channel-count"?: number;
}

interface Chapter {
  title?: string;
  time: number;
}

/** A remembered track choice, matched by language and name on the next file. */
interface TrackChoice {
  lang?: string;
  title?: string;
}

interface TrackPrefs {
  audio?: TrackChoice;
  sub?: TrackChoice | "off";
  /** Playback speed for this show. */
  speed?: number;
}

type Menu = "tracks" | "chapters" | "speed" | null;

interface Props {
  item: PlayItem;
  onNext: (next: PlayItem) => void;
  onBack: () => void;
}

export default function PlayerView({ item, onNext, onBack }: Props) {
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState(item.resume ?? 0);
  const [duration, setDuration] = useState(item.duration ?? 0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapter, setChapter] = useState(-1);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ended, setEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [mini, setMini] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [menu, setMenu] = useState<Menu>(null);
  const [next, setNext] = useState<PlayItem | null>(null);
  const [upNextClosed, setUpNextClosed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);
  const [subStyle, setSubStyle] = useState<SubStyle>(DEFAULT_SUB_STYLE);
  const [showRemaining, setShowRemaining] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [notice, setNotice] = useState<{ text: string; path?: string } | null>(null);

  const timeRef = useRef(item.resume ?? 0);
  const durationRef = useRef(item.duration ?? 0);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const prefsRef = useRef<TrackPrefs>({});
  const hideTimer = useRef<number | undefined>(undefined);
  const clickTimer = useRef<number | undefined>(undefined);
  const seekRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef(false);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const pictures = useSeekPictures(item.path);

  // ----- Loading a file -----

  useEffect(() => {
    const { fileId, titleId } = item;
    timeRef.current = item.resume ?? 0;
    durationRef.current = item.duration ?? 0;
    setTime(item.resume ?? 0);
    setDuration(item.duration ?? 0);
    setLoading(true);
    setEnded(false);
    setError(null);
    setNext(null);
    setUpNextClosed(false);
    setCountdown(null);
    setChapters([]);
    setChapter(-1);
    setResumedAt(item.resume);

    const start = item.resume ? `start=${item.resume.toFixed(2)}` : "start=none";
    getSetting<TrackPrefs>(`ui.tracks.${titleId}`).then((p) => {
      prefsRef.current = p ?? {};
      // Each show keeps its own speed (normal unless changed for it).
      mpv.setProperty("speed", p?.speed ?? 1);
    });
    mpv
      .setProperty("pause", false)
      .then(() => mpv.command("loadfile", item.path, "replace", -1, start))
      .catch((e) => setError(String(e)));
    watch.next(fileId).then(setNext).catch(() => {});

    return () => {
      // Leaving this file (back, next episode or closing): remember where it stopped.
      if (durationRef.current > 0) watch.save(fileId, timeRef.current, durationRef.current, true);
    };
  }, [item]);

  // ----- What mpv reports -----

  useEffect(() => {
    const offs = [
      mpv.onProperty((name, value) => {
        switch (name) {
          case "pause":
            pausedRef.current = value === true;
            setPaused(value === true);
            break;
          case "time-pos":
            if (typeof value === "number") {
              timeRef.current = value;
              if (!draggingRef.current) setTime(value);
            }
            break;
          case "duration":
            if (typeof value === "number") {
              durationRef.current = value;
              setDuration(value);
            }
            break;
          case "track-list":
            setTracks(Array.isArray(value) ? (value as Track[]) : []);
            break;
          case "chapter-list":
            setChapters(Array.isArray(value) ? (value as Chapter[]) : []);
            break;
          case "chapter":
            setChapter(typeof value === "number" ? value : -1);
            break;
          case "volume":
            if (typeof value === "number") setVolume(value);
            break;
          case "mute":
            setMuted(value === true);
            break;
          case "speed":
            if (typeof value === "number") setSpeed(value);
            break;
          case "eof-reached":
            setEnded(value === true);
            break;
        }
      }),
      mpv.onEvent((e) => {
        if (e.event === "start-file") setLoading(true);
        else if (e.event === "playback-restart") setLoading(false);
        else if (e.event === "file-loaded") {
          setError(null);
          mpv.getProperty<Track[]>("track-list").then(applyTrackPrefs).catch(() => {});
        } else if (e.event === "end-file" && e.reason === "error") {
          setLoading(false);
          setError(e.error ?? "This file could not be played.");
        }
      }),
    ];
    // Values that don't change on their own still need a first reading.
    mpv.getProperty<number>("volume").then((v) => typeof v === "number" && setVolume(v)).catch(() => {});
    mpv.getProperty<boolean>("mute").then((v) => setMuted(v === true)).catch(() => {});
    mpv.getProperty<number>("speed").then((v) => typeof v === "number" && setSpeed(v)).catch(() => {});
    return () => offs.forEach((p) => p.then((off) => off()));
  }, []);

  // The volume is remembered between sessions.
  useEffect(() => {
    getSetting<number>("ui.volume").then((v) => {
      if (v != null) mpv.setProperty("volume", v);
    });
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setSetting("ui.volume", Math.round(volume)), 600);
    return () => window.clearTimeout(timer);
  }, [volume]);

  // Save progress regularly while playing, and whenever playback pauses.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!pausedRef.current && durationRef.current > 0) watch.save(item.fileId, timeRef.current, durationRef.current, false);
    }, SAVE_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [item.fileId]);
  useEffect(() => {
    if (paused && durationRef.current > 0) watch.save(item.fileId, timeRef.current, durationRef.current, false);
  }, [paused, item.fileId]);

  // ----- Tracks -----

  const applyTrackPrefs = (list: Track[]) => {
    const prefs = prefsRef.current;
    const find = (type: "audio" | "sub", choice: TrackChoice) => {
      const ofType = list.filter((t) => t.type === type);
      return (
        ofType.find((t) => (t.lang ?? "") === (choice.lang ?? "") && (t.title ?? "") === (choice.title ?? "")) ??
        (choice.lang ? ofType.find((t) => t.lang === choice.lang) : undefined)
      );
    };
    if (prefs.audio) {
      const t = find("audio", prefs.audio);
      if (t && !t.selected) mpv.setProperty("aid", t.id);
    }
    if (prefs.sub === "off") mpv.setProperty("sid", "no");
    else if (prefs.sub) {
      const t = find("sub", prefs.sub);
      if (t && !t.selected) mpv.setProperty("sid", t.id);
    }
  };

  const chooseTrack = (type: "audio" | "sub", track: Track | null) => {
    mpv.setProperty(type === "audio" ? "aid" : "sid", track ? track.id : "no");
    const choice: TrackChoice | "off" = track ? { lang: track.lang, title: track.title } : "off";
    prefsRef.current = { ...prefsRef.current, [type]: choice };
    setSetting(`ui.tracks.${item.titleId}`, prefsRef.current);
  };

  const chooseSpeed = (value: number) => {
    mpv.setProperty("speed", value);
    prefsRef.current = { ...prefsRef.current, speed: value === 1 ? undefined : value };
    setSetting(`ui.tracks.${item.titleId}`, prefsRef.current);
  };

  // ----- Subtitle look (the same for everything) -----

  useEffect(() => {
    getSetting<SubStyle>("ui.subs").then((s) => s && setSubStyle({ ...DEFAULT_SUB_STYLE, ...s }));
  }, []);

  const changeSubStyle = (change: Partial<SubStyle>) => {
    const next = { ...subStyle, ...change };
    setSubStyle(next);
    setSetting("ui.subs", next);
  };

  // ----- Screenshots, clock -----

  const screenshot = useCallback(async () => {
    try {
      const dir = await invoke<string>("player_screenshot_dir");
      const code = itemCode(item);
      const stamp = formatTime(timeRef.current).replace(/:/g, ".");
      const name = [item.titleName, code, stamp].filter(Boolean).join(" ").replace(/[<>:"/\\|?*]+/g, "").trim();
      const path = `${dir}\\${name}.jpg`;
      await mpv.command("screenshot-to-file", path, "subtitles");
      setNotice({ text: "Screenshot saved", path });
    } catch (e) {
      setNotice({ text: `Screenshot failed: ${e}` });
    }
  }, [item]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // ----- Controls -----

  const setWindowFullscreen = useCallback(async (on: boolean) => {
    await getCurrentWindow().setFullscreen(on);
    setFullscreen(on);
  }, []);

  /** The mini player: the window becomes a small video on top of everything, in a corner. */
  const setMiniPlayer = useCallback(async (on: boolean) => {
    if (on === miniRef.current) return;
    let aspect: number | undefined;
    if (on) {
      const size = await Promise.all([mpv.getProperty<number>("dwidth"), mpv.getProperty<number>("dheight")]).catch(() => null);
      if (size && size[0] > 0 && size[1] > 0) aspect = size[0] / size[1];
    }
    miniRef.current = on;
    setMini(on);
    setMenu(null);
    await invoke("player_mini", { on, aspect }).catch(() => {});
    setFullscreen(await getCurrentWindow().isFullscreen());
  }, []);

  // Leaving the player some other way still brings the big window back.
  useEffect(
    () => () => {
      if (miniRef.current) invoke("player_mini", { on: false });
    },
    [],
  );

  const back = useCallback(async () => {
    await mpv.command("stop").catch(() => {});
    await setMiniPlayer(false);
    if (await getCurrentWindow().isFullscreen()) await setWindowFullscreen(false);
    onBack();
  }, [onBack, setMiniPlayer, setWindowFullscreen]);

  const togglePause = useCallback(() => {
    if (ended) mpv.command("seek", 0, "absolute");
    mpv.command("cycle", "pause").catch((e) => setError(String(e)));
  }, [ended]);

  const toggleFullscreen = useCallback(async () => {
    // From the mini player straight to fullscreen.
    const fromMini = miniRef.current;
    if (fromMini) await setMiniPlayer(false);
    await setWindowFullscreen(fromMini || !(await getCurrentWindow().isFullscreen()));
  }, [setMiniPlayer, setWindowFullscreen]);

  const seekBy = (seconds: number) => mpv.command("seek", seconds, "relative");
  const changeVolume = (delta: number) => {
    const v = Math.max(0, Math.min(100, volume + delta));
    mpv.setProperty("volume", v);
    if (muted && delta > 0) mpv.setProperty("mute", false);
  };

  const playNext = useCallback(() => {
    if (next) onNext(next);
  }, [next, onNext]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_AFTER_MS);
  }, []);

  useEffect(() => {
    showControls();
  }, [item, showControls]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" && e.key !== "Escape") return;
      showControls();
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === " " || k === "k") togglePause();
      else if (k === "f") toggleFullscreen();
      else if (k === "p") setMiniPlayer(!miniRef.current);
      else if (k === "Escape") {
        if (menu) setMenu(null);
        else if (miniRef.current) setMiniPlayer(false);
        else if (await getCurrentWindow().isFullscreen()) setWindowFullscreen(false);
        else back();
      } else if (k === "ArrowLeft") seekBy(e.shiftKey ? -30 : -5);
      else if (k === "ArrowRight") seekBy(e.shiftKey ? 30 : 5);
      else if (k === "j") seekBy(-10);
      else if (k === "l") seekBy(10);
      else if (k === "ArrowUp") changeVolume(5);
      else if (k === "ArrowDown") changeVolume(-5);
      else if (k === "m") mpv.command("cycle", "mute");
      else if (k === "n") playNext();
      else if (k === "s") screenshot();
      else return;
      e.preventDefault();
    };
    const onMouse = (e: MouseEvent) => e.button === 3 && back();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mouseup", onMouse);
    };
  });
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  // ----- Next episode -----

  const remaining = duration > 0 ? duration - time : Infinity;
  const clock = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const endsAt = duration > 0 && !ended ? clock(new Date(now.getTime() + (remaining / (speed || 1)) * 1000)) : null;

  // "Skip intro" / "Skip credits" while in such a chapter (not when the next-episode card covers it).
  const chapterNow = chapter >= 0 ? chapters[chapter] : undefined;
  const chapterTitle = chapterNow?.title ?? "";
  const skipKind = OPENING_CHAPTER.test(chapterTitle) ? "intro" : CREDITS_CHAPTER.test(chapterTitle) ? "credits" : null;
  const skipTo = chapter >= 0 && chapter + 1 < chapters.length ? chapters[chapter + 1].time : null;
  const inEnding = chapter >= 0 && chapter >= chapters.length - 3 && ENDING_CHAPTER.test(chapters[chapter]?.title ?? "");
  const showUpNext = !!next && !upNextClosed && !error && (ended || remaining < UP_NEXT_SECONDS || inEnding);

  // When the file ends, count down and move on.
  useEffect(() => {
    if (!ended || !next || upNextClosed) {
      setCountdown(null);
      return;
    }
    setCountdown(AUTOPLAY_SECONDS);
    const timer = window.setInterval(() => setCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [ended, next, upNextClosed]);
  useEffect(() => {
    if (countdown != null && countdown <= 0) playNext();
  }, [countdown, playNext]);

  // The "resumed at" note disappears after a few seconds.
  useEffect(() => {
    if (resumedAt == null) return;
    const timer = window.setTimeout(() => setResumedAt(null), 7000);
    return () => window.clearTimeout(timer);
  }, [resumedAt]);

  // ----- Seek bar -----

  const fractionAt = (clientX: number) => {
    const rect = seekRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  const onSeekDown = (e: React.PointerEvent) => {
    if (!duration) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = fractionAt(e.clientX) * duration;
    setTime(t);
    mpv.command("seek", t.toFixed(2), "absolute+keyframes");
  };
  const onSeekMove = (e: React.PointerEvent) => {
    if (!duration) return;
    const f = fractionAt(e.clientX);
    const rect = seekRef.current!.getBoundingClientRect();
    setHover({ x: f * rect.width, time: f * duration });
    if (draggingRef.current) {
      setTime(f * duration);
      mpv.command("seek", (f * duration).toFixed(2), "absolute+keyframes");
    }
  };
  const onSeekUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    mpv.command("seek", (fractionAt(e.clientX) * duration).toFixed(2), "absolute");
  };
  // The picture above the time, kept inside the bar at its ends.
  const hoverPicture = hover ? pictures.at(hover.time) : null;
  const tipLeft = (() => {
    if (!hover || !hoverPicture || !seekRef.current) return hover?.x;
    const half = mini ? 70 : 110;
    return Math.max(half, Math.min(seekRef.current.clientWidth - half, hover.x));
  })();
  const chapterAt = (t: number) => {
    let found: Chapter | undefined;
    for (const c of chapters) if (c.time <= t) found = c;
    return found?.title;
  };

  // ----- Rendering -----

  const visible = controlsVisible || paused || menu != null || ended;

  // Subtitles: size, position, and moving up while the controls are showing.
  useEffect(() => {
    mpv.setProperty("sub-scale", subStyle.scale).catch(() => {});
    mpv.setProperty("sub-pos", subStyle.lift && visible ? subStyle.pos - SUB_LIFT : subStyle.pos).catch(() => {});
  }, [subStyle, visible]);
  const audio = tracks.filter((t) => t.type === "audio");
  const subs = tracks.filter((t) => t.type === "sub");
  const code = itemCode(item);
  const played = duration ? (time / duration) * 100 : 0;

  // A single click pauses; a double click goes fullscreen, or from the mini player back to the
  // big one (so the click waits a moment).
  const onStageClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (menu) return setMenu(null);
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(togglePause, 220);
  };
  const onStageDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    window.clearTimeout(clickTimer.current);
    if (miniRef.current) setMiniPlayer(false);
    else toggleFullscreen();
  };

  // The mini player moves by dragging the picture.
  const onStagePointerDown = (e: React.PointerEvent) => {
    draggedRef.current = false;
    pressRef.current = mini && e.button === 0 && e.target === e.currentTarget ? { x: e.screenX, y: e.screenY } : null;
  };
  const onStagePointerMove = (e: React.PointerEvent) => {
    const press = pressRef.current;
    if (!press || !(e.buttons & 1)) return;
    if (Math.abs(e.screenX - press.x) + Math.abs(e.screenY - press.y) < DRAG_THRESHOLD) return;
    pressRef.current = null;
    draggedRef.current = true;
    getCurrentWindow().startDragging();
  };

  return (
    <div
      className={`player ${visible ? "" : "player--hidden"} ${mini ? "player--mini" : ""}`}
      onMouseMove={showControls}
      onMouseLeave={() => mini && setControlsVisible(false)}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onClick={onStageClick}
      onDoubleClick={onStageDoubleClick}
      onWheel={(e) => e.target === e.currentTarget && changeVolume(e.deltaY < 0 ? 5 : -5)}
    >
      {loading && !error && <div className="player__spinner" />}
      {error && <div className="player__error">{error}</div>}

      {mini ? (
        <>
          <div className="player__top">
            <button className="player__btn" onClick={() => setMiniPlayer(false)} title="Back to the big player (Esc)">
              <LeaveMiniIcon />
            </button>
            <span className="player__spacer" />
            <button className="player__btn" onClick={back} title="Stop and go back to the library">
              <CloseIcon />
            </button>
          </div>
          {/* Makes way for the next-episode card, which doesn't fit beside it. */}
          {!showUpNext && (
            <div className="player__center">
              <button className="player__btn" onClick={() => seekBy(-10)} title="Back 10 seconds (J)">
                <Skip10Icon />
              </button>
              <button className="player__btn player__btn--main" onClick={togglePause} title="Play / pause (Space)">
                {paused || ended ? <PlayIcon /> : <PauseIcon />}
              </button>
              <button className="player__btn" onClick={() => seekBy(10)} title="Forward 10 seconds (L)">
                <Skip10Icon forward />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="player__top">
          <button className="player__btn" onClick={back} title="Back (Esc)">
            <BackIcon />
          </button>
          <div className="player__heading">
            <div className="player__show">{item.role === "movie" ? "" : item.titleName}</div>
            <div className="player__title">
              {code && <span className="player__code">{code}</span>}
              {itemName(item)}
            </div>
          </div>
          <span className="player__spacer" />
          <div className="player__clock">
            <span className="player__clock-now">{clock(now)}</span>
            {endsAt && <span className="player__clock-end">Ends at {endsAt}</span>}
          </div>
        </div>
      )}

      {notice && (
        <div className="player__notice">
          {notice.text}
          {notice.path && (
            <button className="player__toast-btn" onClick={() => reveal(notice.path!)}>
              Show
            </button>
          )}
        </div>
      )}

      {skipKind && skipTo != null && !showUpNext && (
        <button className="player__skip" onClick={() => mpv.command("seek", skipTo.toFixed(2), "absolute")}>
          {skipKind === "intro" ? "Skip intro" : "Skip credits"}
          <NextIcon />
        </button>
      )}

      {resumedAt != null && !mini && (
        <div className="player__toast">
          Picked up where you left off ({formatTime(resumedAt)})
          <button
            className="player__toast-btn"
            onClick={() => {
              mpv.command("seek", 0, "absolute");
              setResumedAt(null);
            }}
          >
            Start over
          </button>
        </div>
      )}

      {showUpNext && next && (
        <div className="upnext">
          <div className="upnext__label">{countdown != null ? `Next episode in ${Math.max(countdown, 0)}` : "Next episode"}</div>
          <button className="upnext__card" onClick={playNext}>
            <span className="upnext__still">
              {next.image && <img src={img(next.image)} alt="" />}
              <span className="upnext__play">
                <PlayIcon />
              </span>
              {countdown != null && (
                <span className="upnext__timer" style={{ "--p": `${(1 - countdown / AUTOPLAY_SECONDS) * 100}%` } as React.CSSProperties} />
              )}
            </span>
            <span className="upnext__text">
              <span className="upnext__code">{itemCode(next)}</span>
              <span className="upnext__name">{itemName(next)}</span>
            </span>
          </button>
          <button className="upnext__dismiss" onClick={() => setUpNextClosed(true)}>
            {countdown != null ? "Cancel" : "Hide"}
          </button>
        </div>
      )}

      <div className="player__controls">
        <div
          className="player__seek"
          ref={seekRef}
          onPointerDown={onSeekDown}
          onPointerMove={onSeekMove}
          onPointerUp={onSeekUp}
          onPointerLeave={() => setHover(null)}
        >
          <div className="player__rail">
            {hover && <div className="player__hover" style={{ width: hover.x }} />}
            <div className="player__played" style={{ width: `${played}%` }} />
          </div>
          {duration > 0 &&
            chapters.slice(1).map((c, i) => <span key={i} className="player__tick" style={{ left: `${(c.time / duration) * 100}%` }} />)}
          <div className="player__knob" style={{ left: `${played}%` }} />
          {hover && (
            <div className="player__tip" style={{ left: tipLeft }}>
              {hoverPicture && <img className="player__tip-picture" src={hoverPicture} alt="" />}
              {chapterAt(hover.time) && <span className="player__tip-chapter">{chapterAt(hover.time)}</span>}
              {formatTime(hover.time)}
            </div>
          )}
        </div>

        {mini ? (
          <div className="player__bar">
            <span className="player__time">
              {formatTime(time)} <span className="player__time-sep">/</span> {formatTime(duration)}
            </span>
            <span className="player__spacer" />
            {next && (
              <button className="player__btn" onClick={playNext} title={`Next episode: ${itemName(next)} (N)`}>
                <NextIcon />
              </button>
            )}
            <button className="player__btn" onClick={() => mpv.command("cycle", "mute")} title="Mute (M)">
              {muted || volume === 0 ? <MuteIcon /> : volume < 50 ? <VolumeLowIcon /> : <VolumeIcon />}
            </button>
          </div>
        ) : (
          <div className="player__bar">
            <button className="player__btn player__btn--main" onClick={togglePause} title="Play / pause (Space)">
              {paused || ended ? <PlayIcon /> : <PauseIcon />}
            </button>
            <button className="player__btn" onClick={() => seekBy(-10)} title="Back 10 seconds (J)">
              <Skip10Icon />
            </button>
            <button className="player__btn" onClick={() => seekBy(10)} title="Forward 10 seconds (L)">
              <Skip10Icon forward />
            </button>
            {next && (
              <button className="player__btn" onClick={playNext} title={`Next episode: ${itemName(next)} (N)`}>
                <NextIcon />
              </button>
            )}
            <div className="player__volume">
              <button className="player__btn" onClick={() => mpv.command("cycle", "mute")} title="Mute (M)">
                {muted || volume === 0 ? <MuteIcon /> : volume < 50 ? <VolumeLowIcon /> : <VolumeIcon />}
              </button>
              <input
                className="player__slider"
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                style={{ "--v": `${muted ? 0 : volume}%` } as React.CSSProperties}
                onChange={(e) => {
                  mpv.setProperty("volume", Number(e.target.value));
                  if (muted) mpv.setProperty("mute", false);
                }}
                aria-label="Volume"
              />
            </div>
            <button className="player__time" onClick={() => setShowRemaining((v) => !v)} title="Show time left / total length">
              {formatTime(time)} <span className="player__time-sep">/</span>{" "}
              {showRemaining && duration > 0 ? `-${formatTime(duration - time)}` : formatTime(duration)}
            </button>
            <span className="player__spacer" />
            {chapters.length > 1 && (
              <MenuButton menu={menu} id="chapters" onMenu={setMenu} title="Chapters">
                <ChaptersIcon />
              </MenuButton>
            )}
            <MenuButton menu={menu} id="tracks" onMenu={setMenu} title="Audio & subtitles">
              <SubtitlesIcon />
            </MenuButton>
            <button className="player__btn" onClick={screenshot} title="Screenshot (S)">
              <CameraIcon />
            </button>
            <MenuButton menu={menu} id="speed" onMenu={setMenu} title="Playback speed">
              {speed === 1 ? <SpeedIcon /> : <span className="player__speed">{speed}×</span>}
            </MenuButton>
            <button className="player__btn" onClick={() => setMiniPlayer(true)} title="Mini player (P)">
              <MiniPlayerIcon />
            </button>
            <button className="player__btn" onClick={toggleFullscreen} title="Fullscreen (F)">
              {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>
        )}

        {menu === "tracks" && (
          <div className="player__menu player__menu--tracks">
            <div className="player__menu-col">
              <div className="player__menu-title">Audio</div>
              {audio.length === 0 && <div className="player__menu-empty">None</div>}
              {audio.map((t) => (
                <MenuItem key={t.id} active={!!t.selected} onClick={() => chooseTrack("audio", t)} label={trackLabel(t)} detail={trackDetail(t)} />
              ))}
            </div>
            <div className="player__menu-col">
              <div className="player__menu-title">Subtitles</div>
              <MenuItem active={!subs.some((t) => t.selected)} onClick={() => chooseTrack("sub", null)} label="Off" />
              {subs.map((t) => (
                <MenuItem key={t.id} active={!!t.selected} onClick={() => chooseTrack("sub", t)} label={trackLabel(t)} detail={trackDetail(t)} />
              ))}
            </div>
            <div className="player__menu-col player__menu-col--style">
              <div className="player__menu-title">Subtitle size</div>
              {SUB_SIZES.map((o) => (
                <MenuItem key={o.scale} active={subStyle.scale === o.scale} onClick={() => changeSubStyle({ scale: o.scale })} label={o.label} />
              ))}
              <div className="player__menu-title player__menu-title--gap">Position</div>
              {SUB_POSITIONS.map((o) => (
                <MenuItem key={o.pos} active={subStyle.pos === o.pos} onClick={() => changeSubStyle({ pos: o.pos })} label={o.label} />
              ))}
              <MenuItem
                active={subStyle.lift}
                onClick={() => changeSubStyle({ lift: !subStyle.lift })}
                label="Move up while controls show"
              />
            </div>
          </div>
        )}
        {menu === "chapters" && (
          <div className="player__menu">
            <div className="player__menu-col">
              <div className="player__menu-title">Chapters</div>
              {chapters.map((c, i) => (
                <MenuItem
                  key={i}
                  active={i === chapter}
                  onClick={() => mpv.setProperty("chapter", i)}
                  label={c.title || `Chapter ${i + 1}`}
                  detail={formatTime(c.time)}
                />
              ))}
            </div>
          </div>
        )}
        {menu === "speed" && (
          <div className="player__menu player__menu--narrow">
            <div className="player__menu-col">
              <div className="player__menu-title">Speed</div>
              {SPEEDS.map((s) => (
                <MenuItem key={s} active={Math.abs(s - speed) < 0.01} onClick={() => chooseSpeed(s)} label={s === 1 ? "Normal" : `${s}×`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuButton({ menu, id, onMenu, title, children }: { menu: Menu; id: Menu; onMenu: (m: Menu) => void; title: string; children: React.ReactNode }) {
  return (
    <button className={`player__btn ${menu === id ? "is-active" : ""}`} onClick={() => onMenu(menu === id ? null : id)} title={title}>
      {children}
    </button>
  );
}

function MenuItem({ active, onClick, label, detail }: { active: boolean; onClick: () => void; label: string; detail?: string }) {
  return (
    <button className={`player__item ${active ? "is-active" : ""}`} onClick={onClick}>
      <span className="player__item-check">{active && <CheckIcon />}</span>
      <span className="player__item-label">{label}</span>
      {detail && <span className="player__item-detail">{detail}</span>}
    </button>
  );
}

const languageNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" });
  } catch {
    return null;
  }
})();

function languageName(code: string | undefined) {
  if (!code || code === "und") return null;
  try {
    const name = languageNames?.of(code);
    return name && name.toLowerCase() !== code.toLowerCase() ? name : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function trackLabel(t: Track) {
  const lang = languageName(t.lang);
  if (t.title && lang && !t.title.toLowerCase().includes(lang.toLowerCase())) return `${lang} · ${t.title}`;
  return t.title || lang || `Track ${t.id}`;
}

function trackDetail(t: Track) {
  const parts: string[] = [];
  const channels = t["demux-channel-count"];
  if (t.type === "audio" && channels) parts.push(channels === 6 ? "5.1" : channels === 8 ? "7.1" : channels === 2 ? "Stereo" : `${channels} ch`);
  if (t.forced) parts.push("Forced");
  if (t.external) parts.push("File");
  return parts.join(" · ") || undefined;
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
