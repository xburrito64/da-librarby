// Picks the wide picture an anime shows (AniList's or TMDB's), here and on the home screen.
import { useEffect } from "react";
import { img, library, type BannerChoice, type BannerSource } from "./api";

interface Props {
  titleId: number;
  name: string;
  choice: BannerChoice;
  onClose: () => void;
}

const SOURCES: { key: BannerSource; label: string }[] = [
  { key: "anilist", label: "AniList" },
  { key: "tmdb", label: "TMDB" },
];

export default function BannerPicker({ titleId, name, choice, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = choice.picked ?? choice.automatic;
  const pick = (source: BannerSource | null) => library.setBanner(titleId, source).then(onClose);

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel picker bgpick" role="dialog" aria-label="Background picture">
        <h2 className="picker__heading">Background picture</h2>
        <p className="picker__hint">The wide picture behind "{name}", here and on the home screen.</p>

        <div className="bgpick__options">
          {SOURCES.map(({ key, label }) => {
            const option = choice[key];
            return (
              <button key={key} className={`bgpick__option ${shown === key ? "is-picked" : ""}`} onClick={() => pick(key)}>
                <span className="bgpick__frame">
                  <img src={img(option.path)} alt="" decoding="async" />
                </span>
                <span className="picker__meta">
                  <span className="picker__name">{label}</span>
                  {option.width != null && option.height != null && (
                    <span>
                      {option.width} × {option.height}
                    </span>
                  )}
                  {shown === key && <span className="chip chip--score">shown</span>}
                  {choice.picked == null && choice.automatic === key && <span className="chip">the app's pick</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="picker__actions">
          <button className={`btn btn--small ${choice.picked == null ? "is-listed" : ""}`} onClick={() => pick(null)}>
            Let the app decide (the sharper one)
          </button>
          <span className="spacer" />
          <button className="btn btn--small btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
