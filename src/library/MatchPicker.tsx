// Search AniList/TMDB and pick the right entry for a show, season or movie.
import { useEffect, useState } from "react";
import { metadata, type Candidate, type MatchSource } from "./api";

interface Props {
  heading: string;
  source: MatchSource;
  initialQuery: string;
  /** Seasons can span several AniList entries (e.g. "Part 1" + "Part 2"). */
  multiple?: boolean;
  /** The current choice, to show what's selected. */
  current?: number[];
  onSave: (ids: number[]) => void;
  onAutomatic: () => void;
  onNone?: () => void;
  onClose: () => void;
}

export default function MatchPicker({ heading, source, initialQuery, multiple, current, onSave, onAutomatic, onNone, onClose }: Props) {
  const serviceName = source === "anilist" ? "AniList" : "TMDB";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Candidate[]>([]);

  const search = (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    metadata
      .search(q, source)
      .then(setResults)
      .catch((e) => setError(String(e)))
      .finally(() => setSearching(false));
  };

  useEffect(() => {
    search(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choose = (c: Candidate) => {
    if (!multiple) return onSave([c.id]);
    setPicked((p) => (p.some((x) => x.id === c.id) ? p.filter((x) => x.id !== c.id) : [...p, c]));
  };

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel picker" role="dialog" aria-label={heading}>
        <h2 className="picker__heading">{heading}</h2>
        <form
          className="field-row"
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
        >
          <input className="input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${serviceName}`} />
          <button className="btn btn--small btn--primary" type="submit">
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        {multiple && (
          <p className="picker__hint">
            Pick the entries this season covers, in order (e.g. Part 1, then Part 2).
            {picked.length > 0 && <> Selected: {picked.map((p) => p.title).join(" + ")}</>}
          </p>
        )}
        {error && <p className="picker__error">{error}</p>}

        <div className="picker__results">
          {results?.length === 0 && <p className="picker__hint">Nothing found. Try another name.</p>}
          {results?.map((c) => {
            const order = picked.findIndex((p) => p.id === c.id);
            const isCurrent = current?.includes(c.id);
            return (
              <button key={c.id} className={`picker__result ${order >= 0 ? "is-picked" : ""}`} onClick={() => choose(c)}>
                <span className="picker__cover">{c.coverUrl && <img src={c.coverUrl} alt="" />}</span>
                <span className="picker__info">
                  <span className="picker__name">
                    {order >= 0 && `${order + 1}. `}
                    {c.title}
                  </span>
                  {c.altTitle && <span className="picker__alt">{c.altTitle}</span>}
                  <span className="picker__meta">
                    {[formatLabel(c.format), c.year, c.episodes != null && `${c.episodes} episode${c.episodes === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                    {isCurrent && <span className="chip chip--score">current match</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="picker__actions">
          <button className="btn btn--small" onClick={onAutomatic}>
            Let the app decide
          </button>
          {onNone && (
            <button className="btn btn--small" onClick={onNone}>
              No match
            </button>
          )}
          <span className="spacer" />
          <button className="btn btn--small btn--ghost" onClick={onClose}>
            Cancel
          </button>
          {multiple && (
            <button className="btn btn--small btn--primary" disabled={picked.length === 0} onClick={() => onSave(picked.map((p) => p.id))}>
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatLabel(format: string | null) {
  const labels: Record<string, string> = { TV: "TV", TV_SHORT: "TV short", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "ONA", MUSIC: "Music" };
  return format ? (labels[format] ?? format) : null;
}
