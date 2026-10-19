// An episode's card (the "i" on an episode, or "More info" on its right-click menu): its picture,
// name and description, how you've watched it, and what's in the file (picture, colours, sound,
// subtitles). It opens over the page; clicking beside it, the X or Esc closes it.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { canResume, episodeFrames, episodeName, fileName, img, ratings, reveal, watch, type FileRow, type FileWatch, type TitleDetail } from "./api";
import { RatingInput } from "../rating/Rating";
import { useFileInfo } from "./MovieParts";
import { clock, date, fileRows, Groups, pictureRows, soundRows, watchingRows } from "./details";
import { CloseIcon, FolderIcon, PlayIcon, UndoIcon } from "../ui/icons";

interface Props {
  file: FileRow;
  title: TitleDetail;
  /** "S1E5", or "" for an extra. */
  code: string;
  onPlay: (file: FileRow) => void;
  onClose: () => void;
}

export default function EpisodeInfo({ file, title, code, onPlay, onClose }: Props) {
  const info = useFileInfo(file.path);
  const [watched, setWatched] = useState<FileWatch | null>(null);
  const frame = useEpisodeFrame(file.meta?.thumb ? null : file.path);
  const panel = useRef<HTMLDivElement>(null);
  // Keys go to the card while it's open (Esc closes it).
  useEffect(() => panel.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    watch.file(file.id).then(setWatched);
  }, [file.id, file.progress?.updatedAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onMouse = (e: MouseEvent) => e.button === 3 && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mouseup", onMouse);
    };
  }, [onClose]);

  const p = file.progress;
  const resumable = canResume(p);
  const seconds = info?.duration || p?.duration || 0;
  const season = title.seasons.find((s) => s.id === file.seasonId);
  const where = [title.meta?.name ?? title.name, file.role === "extra" ? file.extraGroup : season && title.seasons.length > 1 ? season.label : null];
  const aired = date(file.aired);
  const facts = [
    code ? <b key="code">{code}</b> : null,
    seconds > 60 ? <span key="len">{Math.round(seconds / 60)} min</span> : null,
    aired ? <span key="aired">Aired {aired}</span> : null,
    resumable && p!.duration > 0 ? (
      <span key="left">{Math.max(1, Math.round((p!.duration - p!.position) / 60))} min left</span>
    ) : p?.watched ? (
      <span key="watched">Watched</span>
    ) : null,
  ].filter(Boolean);
  const picture = file.meta?.thumb ? img(file.meta.thumb) : frame ? convertFileSrc(frame) : null;
  const play = () => {
    onClose();
    onPlay(file);
  };
  const restart = () => {
    onClose();
    watch.save(file.id, 0, p!.duration, false).then(() => onPlay(file));
  };

  // Over the whole app, the navigation too (the page it's opened from sits below it).
  return createPortal(
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel epi" role="dialog" aria-label={episodeName(file)} tabIndex={-1} ref={panel}>
        <button className="epi__close" onClick={onClose} title="Close (Esc)" data-sfx="back">
          <CloseIcon />
        </button>
        <div className="epi__head">
          <div className="epi__left">
            <button className="epi__still" onClick={play} title={resumable ? `Resume from ${clock(p!.position)}` : "Play"}>
              {picture && <img src={picture} alt="" decoding="async" />}
              <span className="ep__play">
                <PlayIcon />
              </span>
              {resumable && p!.duration > 0 && (
                <span className="progress">
                  <span style={{ width: `${(p!.position / p!.duration) * 100}%` }} />
                </span>
              )}
            </button>
            <div className="epi__watching">
              <Groups groups={[["Your watching", watchingRows(file, watched)]]} />
            </div>
          </div>
          <div className="epi__main">
            <div className="epi__where">{where.filter(Boolean).join(" · ")}</div>
            <h2 className="epi__name">{file.role === "extra" ? (file.name ?? fileName(file.path)) : episodeName(file)}</h2>
            {facts.length > 0 && <div className="epi__facts">{facts}</div>}
            <div className="epi__rate">
              <span className="epi__rate-label">Your rating</span>
              <RatingInput score={file.rating} onChange={(score) => ratings.set("file", file.id, score).catch(() => {})} />
            </div>
            {file.meta?.description && <p className="epi__desc">{file.meta.description}</p>}
            <div className="epi__actions">
              <button className="btn btn--primary" onClick={play}>
                <PlayIcon />
                {resumable ? `Resume from ${clock(p!.position)}` : "Play"}
              </button>
              {resumable && (
                <button className="btn" onClick={restart}>
                  <UndoIcon />
                  From the beginning
                </button>
              )}
              <button className="btn" onClick={() => reveal(file.path)}>
                <FolderIcon />
                Open file location
              </button>
            </div>
          </div>
        </div>
        <div className="epi__groups">
          <Groups
            groups={[
              ["The file", fileRows(file, info, true)],
              ["Picture", pictureRows(info)],
              ["Sound & subtitles", soundRows(info)],
            ]}
          />
        </div>
      </div>
    </div>,
    document.querySelector(".app") ?? document.body,
  );
}

/** A picture taken from the video, for an episode nothing else has a picture for. */
function useEpisodeFrame(path: string | null) {
  const [frame, setFrame] = useState<string | null>(null);
  useEffect(() => {
    setFrame(null);
    if (!path) return;
    let alive = true;
    const off = episodeFrames.onReady((p, file) => alive && p === path && file && setFrame(file));
    void episodeFrames.get(path).then((file) => alive && file && setFrame(file));
    return () => {
      alive = false;
      void off.then((f) => f());
    };
  }, [path]);
  return frame;
}
