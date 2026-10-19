// Ratings on screen: the stickers a rating is shown with (in the chosen style and the theme's
// look), the control to give one, the "Rate" window, a cover's rating, and the "How was it?" note
// for things just finished.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { img, library, ratings, type RatingKind, type RatingNote } from "../library/api";
import { useTheme } from "../theme/theme";
import { CloseIcon } from "../ui/icons";
import { feeling, isPixel, sticker } from "./art";
import {
  describe,
  fromLevel,
  fromStars,
  fromTen,
  LEVELS,
  stickerParts,
  starsText,
  TIERS,
  toLevel,
  toStars,
  toTen,
  toTier,
  type RatingStyle,
} from "./scale";
import { useRatingSettings } from "./settings";

// ---------- Showing a rating ----------

function Thumb({ level }: { level: number }) {
  const hand = "M7 10v11H3V10h4zM7 10l4-8c1.7 0 3 1.3 3 3v4h5.5c1.4 0 2.4 1.3 2 2.6l-2.3 7.7c-.3.9-1.1 1.7-2 1.7H7";
  const one = (flip: boolean, key?: string) => (
    <svg key={key} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" style={flip ? { transform: "scaleY(-1)" } : undefined}>
      <path d={hand} />
    </svg>
  );
  return (
    <span className={`rt-thumb rt-thumb--${level}`}>
      {level === 0 ? one(true) : level === 1 ? one(false) : [one(false, "a"), one(false, "b")]}
    </span>
  );
}

/** A rating as stickers, in a style: five (stars, the theme's own; a score shows as the theme's),
 *  or one (a thumb, a tier, a feeling). `size` in px. */
export function Stickers({ score, style, size = 18 }: { score: number; style: RatingStyle; size?: number }) {
  const theme = useTheme();
  const box = { "--rt-size": `${size}px` } as React.CSSProperties;
  if (style === "thumbs") return <span className="rt-stickers rt-stickers--one" style={box}><Thumb level={toLevel(score)} /></span>;
  if (style === "tier") {
    const t = toTier(score);
    return (
      <span className="rt-stickers rt-stickers--one" style={box}>
        <span className="rt-tier" style={{ background: t.color }}>{t.tier}</span>
      </span>
    );
  }
  if (style === "feelings")
    return (
      <span className="rt-stickers rt-stickers--one rt-stickers--feel" style={box}>
        <i className={`rt-st ${isPixel(theme) ? "is-px" : ""}`} style={{ backgroundImage: feeling(toLevel(score), theme) }} />
      </span>
    );
  const own = style === "stars" ? null : theme;
  return (
    <span className={`rt-stickers ${own ? "rt-stickers--theme" : "rt-stickers--gold"}`} style={box} aria-hidden="true">
      {stickerParts(score).map((part, i) => (
        <i key={i} className={`rt-st ${own && isPixel(own) ? "is-px" : ""}`} style={{ backgroundImage: sticker(part, own) }} />
      ))}
    </span>
  );
}

/** A small rating beside a name: the score as a number, else small stickers. */
export function RatingChip({ score, size = 14 }: { score: number; size?: number }) {
  const { style } = useRatingSettings();
  return (
    <span className="rt-chip" title={`Your rating: ${describe(score, style)}`}>
      {style === "score" ? <span className="rt-num">{toTen(score)}</span> : <Stickers score={score} style={style} size={size} />}
    </span>
  );
}

/** A cover's rating, as Settings says: a row of stickers, only when pointed at, a sticker in the
 *  corner, or none. (The corner sticker sits on the card, over the cover's edge; the others on the
 *  cover.) */
export function CoverRating({ score, corner }: { score: number | null; corner: boolean }) {
  const { style, covers } = useRatingSettings();
  if (score == null || covers === "off" || (covers === "corner") !== corner) return null;
  const label = describe(score, style);
  const one = style === "thumbs" || style === "tier" || style === "feelings";
  if (covers === "corner") {
    return (
      <span className="rt-cover rt-cover--corner" title={`Your rating: ${label}`}>
        {one ? (
          <Stickers score={score} style={style} size={40} />
        ) : (
          <span className={`rt-coin ${style === "score" ? "rt-coin--score" : ""}`}>
            <i className="rt-coin__star" />
            <b>{style === "score" ? toTen(score) : starsText(toStars(score))}</b>
          </span>
        )}
      </span>
    );
  }
  return (
    <span className={`rt-cover rt-cover--${covers}`} title={`Your rating: ${label}`}>
      <Stickers score={score} style={style} size={one ? 30 : covers === "row" ? 20 : 22} />
      {covers === "hover" && <span className="rt-cover__label">{label}</span>}
    </span>
  );
}

// ---------- Giving a rating ----------

/** The control for a rating in the current style. `onChange` gets the new score (null: none). A
 *  score being dragged or typed is saved a moment after it stops changing. */
export function RatingInput({ score, onChange }: { score: number | null; onChange: (score: number | null) => void }) {
  const { style } = useRatingSettings();
  const theme = useTheme();
  const [preview, setPreview] = useState<number | null>(null);
  const [draft, setDraft] = useState<number | null>(score);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setDraft(score), [score]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const later = (value: number) => {
    setDraft(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(value), 450);
  };

  if (style === "score") {
    const value = draft ?? 0;
    const step = (by: number) => later(fromTen((value || 50) / 10 + by));
    return (
      <div className="rt-input rt-input--score">
        <input
          className="rt-input__number"
          type="number"
          min={1}
          max={10}
          step={0.1}
          placeholder="–"
          value={draft == null ? "" : toTen(draft)}
          onChange={(e) => e.target.value !== "" && later(fromTen(Number(e.target.value)))}
          aria-label="Your score out of 10"
        />
        <span className="rt-input__of">/ 10</span>
        <input
          className="rt-input__slider"
          type="range"
          min={10}
          max={100}
          step={1}
          value={draft ?? 10}
          style={{ "--p": `${draft == null ? 0 : ((draft - 10) / 90) * 100}%` } as React.CSSProperties}
          onChange={(e) => later(Number(e.target.value))}
          onWheel={(e) => later(fromTen((value || 50) / 10 + (e.deltaY < 0 ? 0.1 : -0.1)))}
          aria-label="Your score"
        />
        <span className="rt-input__steps">
          <button type="button" className="rt-input__step" onClick={() => step(-0.1)} title="0.1 less">
            −
          </button>
          <button type="button" className="rt-input__step" onClick={() => step(0.1)} title="0.1 more">
            +
          </button>
        </span>
      </div>
    );
  }

  if (style === "thumbs" || style === "feelings") {
    const chosen = draft == null ? null : toLevel(draft);
    return (
      <div className={`rt-input rt-input--levels rt-input--${style}`}>
        {LEVELS.map((label, level) => (
          <button
            key={label}
            type="button"
            className={`rt-level ${chosen === level ? "is-on" : ""}`}
            onClick={() => onChange(fromLevel(level))}
            data-sfx="save"
          >
            {style === "thumbs" ? (
              <Thumb level={level} />
            ) : (
              <i className={`rt-st ${isPixel(theme) ? "is-px" : ""}`} style={{ backgroundImage: feeling(level, theme) }} />
            )}
            <span>{label}</span>
          </button>
        ))}
      </div>
    );
  }

  if (style === "tier") {
    const chosen = draft == null ? null : toTier(draft).tier;
    return (
      <div className="rt-input rt-input--tier">
        {TIERS.map((t) => (
          <button
            key={t.tier}
            type="button"
            className={`rt-tier rt-tier--pick ${chosen === t.tier ? "is-on" : ""}`}
            style={{ background: t.color }}
            onClick={() => onChange(t.score)}
            data-sfx="save"
          >
            {t.tier}
          </button>
        ))}
      </div>
    );
  }

  // Five stickers: the left half of one gives a half.
  const shown = preview ?? draft;
  const own = style === "stars" ? null : theme;
  const at = (e: React.MouseEvent<HTMLButtonElement>, i: number) => {
    const r = e.currentTarget.getBoundingClientRect();
    return fromStars(i + (e.clientX - r.left < r.width / 2 ? 0.5 : 1));
  };
  return (
    <div
      className={`rt-input rt-input--five ${own ? "rt-stickers--theme" : "rt-stickers--gold"}`}
      onMouseLeave={() => setPreview(null)}
      onKeyDown={(e) => {
        const by = e.key === "ArrowRight" ? 0.5 : e.key === "ArrowLeft" ? -0.5 : 0;
        if (!by) return;
        e.preventDefault();
        onChange(fromStars(Math.min(5, Math.max(0.5, toStars(draft ?? 0) + by))));
      }}
    >
      {(shown == null ? [0, 0, 0, 0, 0] : stickerParts(shown)).map((part, i) => (
        <button
          key={i}
          type="button"
          className="rt-five"
          onMouseMove={(e) => setPreview(at(e, i))}
          onClick={(e) => onChange(at(e, i))}
          aria-label={`${i + 1} of 5`}
          data-sfx="save"
        >
          <i className={`rt-st ${own && isPixel(own) ? "is-px" : ""}`} style={{ backgroundImage: sticker(part, own) }} />
        </button>
      ))}
    </div>
  );
}

// ---------- The "Rate" window ----------

export interface RateTarget {
  kind: RatingKind;
  id: number;
  /** "Hunter x Hunter", "Hunter x Hunter · Season 2", "S1E5 · Hisoka × is × Sneaky". */
  name: string;
  thumb?: string | null;
  score: number | null;
}

let open: RateTarget | null = null;
const openers = new Set<() => void>();

/** Opens the "Rate" window for something (null closes it). */
export function openRate(target: RateTarget | null) {
  open = target;
  openers.forEach((l) => l());
}

/** Where the "Rate" window shows when something asks for it (once, in the library). */
export function RateHost() {
  const target = useSyncExternalStore(
    (listener) => {
      openers.add(listener);
      return () => openers.delete(listener);
    },
    () => open,
  );
  const close = useCallback(() => openRate(null), []);
  if (!target) return null;
  return <RateDialog key={`${target.kind}-${target.id}`} target={target} onClose={close} />;
}

function RateDialog({ target, onClose }: { target: RateTarget; onClose: () => void }) {
  const { style } = useRatingSettings();
  const [score, setScore] = useState(target.score);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const save = (next: number | null) => {
    setScore(next);
    ratings.set(target.kind, target.id, next).catch(() => {});
  };
  return createPortal(
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel rate" role="dialog" aria-label={`Rate ${target.name}`} tabIndex={-1} ref={panel}>
        <button className="icon-btn rate__close" onClick={onClose} title="Close (Esc)" data-sfx="back">
          <CloseIcon />
        </button>
        <div className="rate__head">
          {target.thumb && <img className="rate__thumb" src={img(target.thumb)} alt="" />}
          <div>
            <div className="rate__eyebrow">{target.score == null ? "How was it?" : "Your rating"}</div>
            <h2 className="rate__name">{target.name}</h2>
          </div>
        </div>
        <RatingInput score={score} onChange={save} />
        <div className="rate__foot">
          <span className="rate__says">{score == null ? "Not rated yet" : style === "score" ? "" : describe(score, style)}</span>
          <span className="spacer" />
          {score != null && (
            <button className="btn btn--small btn--ghost" onClick={() => save(null)} data-sfx="back">
              Remove rating
            </button>
          )}
          <button className="btn btn--small btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.querySelector(".app") ?? document.body,
  );
}

/** Your rating beside a name, or "Rate" when there's none: opens the "Rate" window. */
export function RateButton({ target, size = 15 }: { target: RateTarget; size?: number }) {
  const { style } = useRatingSettings();
  return (
    <button
      className={`rt-button ${target.score == null ? "is-empty" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        openRate(target);
      }}
      title={target.score == null ? "Rate it" : `Your rating: ${describe(target.score, style)} (change it)`}
    >
      {target.score == null ? (
        <>
          <i className="rt-button__plus" />
          Rate
        </>
      ) : (
        <>
          <RatingChip score={target.score} size={size} />
          <span className="rt-button__yours">yours</span>
        </>
      )}
    </button>
  );
}

// ---------- "How was it?" ----------

/** A note in the corner for the latest thing finished and not rated yet. "Not now" waves it away
 *  for good. */
export function RatingNotes() {
  const [notes, setNotes] = useState<RatingNote[]>([]);
  const load = useCallback(() => {
    ratings.notes().then(setNotes).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const off = library.onChanged(load);
    return () => {
      off.then((f) => f());
    };
  }, [load]);
  const note = notes[0];
  if (!note) return null;
  const name = note.season ? `${note.name} · ${note.season}` : note.name;
  const later = () => {
    setNotes((n) => n.slice(1));
    ratings.dismiss(note.kind, note.id).catch(() => {});
  };
  return (
    <div className="update-note rate-note" role="status">
      <button className="icon-btn update-note__close" onClick={later} title="Not now" data-sfx="back">
        <CloseIcon />
      </button>
      <div className="rate-note__body">
        {note.thumb && <img className="rate-note__thumb" src={img(note.thumb)} alt="" />}
        <div>
          <p className="update-note__title">How was {name}?</p>
          <p className="update-note__text">
            You finished it{notes.length > 1 ? ` (and ${notes.length - 1} more thing${notes.length > 2 ? "s" : ""} to rate)` : ""}.
          </p>
          <div className="update-note__actions">
            <button className="btn btn--small btn--primary" onClick={() => openRate({ kind: note.kind, id: note.id, name, thumb: note.thumb, score: null })}>
              Rate it
            </button>
            <button className="btn btn--small" onClick={later}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
